---
title: Connect runtime reliability & performance review (Stage 1.5)
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-10
last-reviewed: 2026-06-10
review-interval: P12M
---

# Connect runtime reliability & performance review (Stage 1.5)

**Date:** 2026-06-10 · **Scope:** the three product-owner reports — (1) runs freeze randomly,
(2) graph stats take far too long to load, (3) the dashboard is laggy in general use.
**Method:** static code-path analysis of the ingest worker, run orchestration, stats services,
hub load functions, and the Neon/Surreal persistence layers. Bounded low-risk fixes ship in
the same PR (marked ✅); everything else is a proposed follow-up stage.

Severity: **P0** = plausible freeze cause · **P1** = major latency · **P2** = general lag.

---

## 1. Runs freeze randomly (P0)

### F1 — P0 · Ingest runs execute as a detached promise inside a Vercel request invocation

`POST /keys/dashboard/api/connect/ingest/jobs` inserts the job, calls
`scheduleConnectIngestWorkerDrain()` and returns 201 immediately
(`apps/dashboard/src/routes/keys/dashboard/api/connect/ingest/jobs/+server.ts:107`).
The drain is a bare `queueMicrotask(() => void runConnectIngestWorkerLoop(...))`
(`apps/dashboard/src/lib/server/connect-ingest-worker.ts`, `scheduleConnectIngestWorkerDrain`).
The same pattern backs revalidate, embed-backfill, link-sources and restart endpoints.

The dashboard deploys with `@sveltejs/adapter-vercel` (`apps/dashboard/svelte.config.js`)
with **no `waitUntil`, no maxDuration config, and no cron/worker process** — `grep` finds no
other caller of `runConnectIngestWorkerLoop`. On Vercel, work not registered via `waitUntil`
is *not guaranteed* after the response is flushed: the instance can be suspended or recycled
at any point. When that happens mid-run:

- the job row stays `status = 'running'` forever — `claimNextPendingConnectIngestJob`
  (`apps/dashboard/src/lib/server/neon.ts:5798`) only claims `pending`, and there is **no
  stale-running reclaim anywhere**, so nothing ever fails or resumes it;
- the heartbeat `setInterval` (`ingest-full-runner.ts:78`, `graph-remediation-pass.ts:33`)
  dies with the process, so the log just stops;
- the run console keeps polling `…/status` and shows a run that is "running" with no
  progress and no error — **exactly the reported symptom**, and "random" because it depends
  on instance reuse/recycling, which the operator can't see.

Even when the instance survives, the function's `maxDuration` (default 300s on fluid
compute; no route exports a config) kills any real multi-source LLM run the same silent way.

**Fix shipped ✅ (partial, low-risk):** `scheduleConnectIngestWorkerDrain` now registers the
drain promise with Vercel's request context (`Symbol.for("@vercel/request-context")` — the
exact hook `@vercel/functions.waitUntil` uses, no new dependency; no-op outside Vercel).
This stops the *instant-suspend-after-response* class of freeze. Unit-tested
(`connect-ingest-worker.test.ts`, `vercelWaitUntil`).

**Follow-up stage (proposed, not done here — changes run semantics):**
1. a worker *lease + heartbeat column* (`worker_heartbeat_at`) and a reclaim that marks
   running jobs with a heartbeat older than ~5 min as `failed` (`error =
   'worker_lost'`) so freezes become visible, restartable failures;
2. `export const config = { maxDuration: <plan max> }` on the job POST/restart routes, or —
   better, given the Coolify migration (Stage 2 of the infra plan) — a real worker process /
   cron-drained queue so runs stop living inside request invocations;
3. resumable per-stage checkpoints so a reclaimed job restarts at its last completed source.

### F2 — P0 · Legacy LLM + embedding fetches had no timeout at all

The route-resolved chat path aborts at 180s (`runtime-openai-chat.ts:52`), but the legacy
fallback used whenever Keys routing is not configured did not:

- `generateChat` — `fetch("https://api.openai.com/v1/chat/completions", …)` with **no
  signal** (`apps/dashboard/src/lib/server/connect/llm-generate.ts:33` pre-fix);
- `knowledgeEmbed` — same (`llm-generate.ts:95` pre-fix);
- `knowledgeEmbedWithKey` — the *route path's own embedding call* also had no signal
  (`stage-route-generate.ts:290` pre-fix);
- Surreal `signin` — no signal (`graph-target-service.ts:370` pre-fix), while `/sql` calls
  already aborted at 25s.

One wedged upstream connection (half-open TCP, stalled response body) suspends the awaiting
stage indefinitely; the 20s stage heartbeat keeps re-printing "Still validating…" so the run
looks alive but frozen — the second strong match for the reported symptom.

**Fix shipped ✅:** `AbortSignal.timeout` on all four, with clear timeout error messages so
the run *fails visibly* and the existing stage-level catch/skip handling takes over.
Defaults: chat 180s (`CONNECT_LLM_TIMEOUT_MS`), embeddings 120s
(`CONNECT_EMBED_TIMEOUT_MS`), sign-in reuses `RESTORMEL_SURREAL_HTTP_TIMEOUT_MS` (25s).
Unit-tested (`llm-generate.test.ts`).

### F3 — P0/P1 · Route-retry loop can silently spin for ~36 minutes per stage call

`callResolvedChat` / `embedViaRoute` retry up to `MAX_ROUTE_ATTEMPTS = 12` fallback steps
(`apps/dashboard/src/lib/server/connect/stage-route-generate.ts:34`). Each attempt may take
the full 180s upstream timeout. A provider chain that *times out* (rather than failing fast)
therefore burns up to **12 × 180s = 36 minutes for one logical LLM call**, with no reporter
output between attempts. Validation alone makes `ceil(units/10)` such calls
(`ENTAILMENT_BATCH_SIZE = 10`). To an operator this is indistinguishable from a freeze, and
combined with F1's maxDuration it guarantees a silent kill.

**Fix shipped ✅:** a wall-clock deadline across attempts —
`routeRetryDeadlineMs()` (default 15 min, `CONNECT_ROUTE_RETRY_DEADLINE_MS`) checked before
each retry; on expiry the loop throws the *last upstream error* wrapped in a
"Route retry deadline exceeded" message. Fast failures (missing key, 4xx, resolver
exhaustion) keep the full 12-attempt fallback semantics. Unit-tested
(`stage-route-generate.test.ts`).

**Residual risk to note:** 15 min is generous but still a behavior bound; if a workspace
legitimately needs >5 slow fallback attempts per call, raise the env var.

### F4 — P1 (freeze-adjacent) · Persistence round-trip storms stretch the kill window

Every per-row `await sql…` is one Neon HTTP round-trip; every Surreal write is one HTTP
`/sql` round-trip to the customer's endpoint. Pre-fix, for a 300-unit source the Postgres
spine paid roughly:

- 300 unit INSERTs + N relation INSERTs (`storeExtractedGraphPostgres`, neon.ts:6632),
- 300 claim-version INSERTs (`insertConnectClaimVersionsPostgres`),
- 300 verification-state UPDATEs (`updateConnectClaimVersionStatesPostgres`),
- 300 judgment INSERTs (`insertConnectClaimJudgmentsPostgres`),
- 300 validation UPDATEs (`updateUnitValidationPostgres`),
- 300 embedding UPDATEs (`updateUnitEmbeddingsPostgres`),

≈ 1800+ sequential round-trips ≈ minutes of pure network latency appended to the run —
all inside the F1 kill window, and all competing with interactive traffic on the same
fluid-compute instance (see F9).

**Fix shipped ✅:** the EBV trio + validation + embeddings are now single multi-row
`unnest()` statements (embeddings chunked at 200 rows to bound payload size); return values
and `persisted/missed` semantics in `graph-writer.ts` unchanged. Unit-tested
(`neon-ebv-batch.test.ts` pins "exactly one statement per call").

**Not done (proposed):** batching `storeExtractedGraphPostgres` (needs order-preserving
`unnest WITH ORDINALITY` — `PostgresGraphWriter.writeUnitsAndRelations` depends on insertion
order, and Stage 3.2 is concurrently editing this function) and the Surreal writer loops
(`SurrealGraphWriter.setEvidence/setVerificationStates/recordJudgments/setValidation`,
`graph-writer.ts:439-583` — per-unit `UPDATE … RETURN AFTER` round-trips to the BYO
endpoint; Surreal supports multi-statement scripts, but the per-row read-back verification
is load-bearing fail-safe behavior, so batching needs care).

---

## 2. Graph stats too slow (P1)

### F5 — P1 · Cold-start schema "ensure" runs ~120 sequential DDL statements before the first query

`ensureIngestionRoutingSchema` (`apps/dashboard/src/lib/server/neon.ts:2077-2614`) executes
roughly **120 sequential `ALTER TABLE` / `CREATE TABLE IF NOT EXISTS` / backfill UPDATE
statements** over the Neon HTTP driver, memoized **per process**. On serverless, every cold
instance replays the whole block before the first real query — at 30–80ms/statement that is
**4–10 seconds** added to whichever request loses the race (stats, hub load, status poll).
This is the single biggest "stats randomly take ages" / "dashboard randomly laggy"
contributor that is *not* the BYO store itself, and it grows with every release.

**Proposed (not done — deploy-pipeline change):** apply `migrations/*.sql` at deploy time
and reduce the runtime ensure to a single `SELECT` against a schema-version marker
(fall back to the full block only when the marker is missing/stale). This is mechanical but
must be coordinated with how Vercel/Coolify deploys run migrations today.

### F6 — P1 · Stats fan-out per hub load: the same aggregates resolved up to three times

One hub navigation (`connect/+page.server.ts`) starts three loads that each resolve stats:

- `loadConnectHubPage` → `peekConnectGraphStatsForView` (cache read + fire-and-forget
  refresh) — fine;
- `loadConnectGraphPulse` → `resolveConnectGraphStats` (`graph-explorer-service.ts:904`);
- `loadConnectTrustScorecardPanel` → `loadConnectTrustScorecard` → **another**
  `resolveConnectGraphStats` (`trust-scorecard-service.ts:235`) plus
  `resolveSurrealGraphReadContext` + 5 EBV aggregate queries + `resolveLastAssessedAt`
  (a 50-row job list scan).

For Surreal targets the in-flight dedupe map (`inFlightSurrealStatsCompute`,
`graph-explorer-service.ts:876`) collapses concurrent *cold* computes within one process —
good — but on the **Postgres spine** path `getConnectGraphStats` (6 aggregate queries,
neon.ts:6692) has **no cache and no dedupe**, so a hub load runs those aggregates 2–3×, and
`getConnectGraphTargetForWorkspace` is re-queried ~6× per navigation across the services.

**Fix shipped ✅ (index):** `knowledge_graph_units (workspace_id, validation_status)` —
the validation GROUP BY and the triage FILTER counts are the heaviest of the six spine
aggregates and previously had only `(workspace_id, created_at)` to work with
(`migrations/058_connect_graph_hot_path_indexes.sql`, mirrored in the dev ensure block).

**Proposed (not done):** (a) reuse the `knowledge_graph_stats_cache` plumbing (TTL +
worker-side `invalidateConnectGraphStatsCache`, already called in the worker `finally`)
for the Postgres spine too; (b) resolve stats once per request and pass them into the
scorecard composer (it already accepts `stats` via `composeTrustScorecard`).

### F7 — P1 · Cold-cache Surreal stats can probe every domain pack

`computeSurrealStats` fast-paths the active pack, but when it returns 0 units the code probes
**every other pack** — each probe is 4+ full-table `count()` aggregates plus triage counts
against the customer's endpoint (`graph-explorer-service.ts:706-744`), and
`quickConnectGraphStats` separately probes pack unit tables plus 4 fallback table names
(`discoverBestUnitCount`, `:393`). On a misconfigured pack this happens on *every* stats
refresh because a `units: 0` cache is never treated as authoritative
(`surrealStatsCacheIsAuthoritative`, `:382`). Correct fail-safe, but worth a negative-result
TTL. **Proposed only** — behavior trade-off (a wrong-pack workspace would wait up to the
negative TTL to see its graph appear).

---

## 3. Dashboard laggy in general use (P2)

### F8 — P2 · 1.5s status polling, 4 queries per poll, per-invocation session resolution

The run console polls `…/status` every **1.5s** while a run is active
(`ConnectIngestRunConsole.svelte:108`). Each poll resolves the session context, re-reads the
job row, reads new log lines *and* runs `countConnectIngestJobLogs` (a `COUNT(*)` per poll —
`status/+server.ts`). With F5, an unlucky cold poll pays the whole DDL preamble. Cheap
individually, but it is a steady 2–3 req/s/viewer multiplier on everything else.
**Proposed:** return `log_line_total` only when it changed (or compute from `since` cursor),
relax `pollMs` to 2.5–3s with jitter, and skip session re-resolution via the existing
workspace cache.

### F9 — P2 · Ingest runs and interactive traffic share one fluid-compute instance

Because runs execute in-process (F1), a single active ingest occupies the instance's event
loop with LLM orchestration, JSON parsing of big responses, and (pre-F4) thousands of
sequential awaits. Vercel fluid compute routes *other users' page loads onto the same
instance*. "The whole dashboard is laggy" while any run/revalidate/remediate is active is
the expected signature. F4's batching reduces event-loop pressure now; the real cure is the
F1 follow-up (worker process / queue outside request invocations).

### F10 — P2 · Remediation drops scanned all workspace relations per dropped unit

`deleteUnitPostgres` deletes relations `WHERE workspace_id = $1 AND (from_unit_id = $2 OR
to_unit_id = $2)` (neon.ts) with only `(workspace_id, created_at)` indexed — a full scan of
the workspace's relations *per dropped unit* during remediation/strict sweeps.
**Fix shipped ✅:** `from_unit_id` / `to_unit_id` indexes plus `units(source_id)`
(migration 057).

---

## Shipped in this PR (summary)

| # | Change | Files | Risk |
|---|--------|-------|------|
| F1 | `waitUntil` registration for the background drain | `connect-ingest-worker.ts` | Low (no-op outside Vercel; behavior otherwise identical) |
| F2 | Timeouts on legacy chat/embed fetches, route-embed fetch, Surreal sign-in | `llm-generate.ts`, `stage-route-generate.ts`, `graph-target-service.ts` | Low (turns infinite hangs into visible stage failures) |
| F3 | 15-min wall-clock deadline on route retry loops | `stage-route-generate.ts` | Low-medium (could cut a legitimately slow >15-min fallback chain; env-tunable) |
| F4 | Multi-row `unnest` batching for EBV claim versions/states/judgments + validation + embeddings | `neon.ts` | Low (same statements' semantics, single round-trip; return values preserved; tested) |
| F6/F10 | Hot-path indexes | `migrations/057…`, `neon.ts` ensure mirror | Low (additive, `IF NOT EXISTS`) |

Deliberately **not** touched: orchestrator structure, run semantics, fail-safe verdict
handling, `storeExtractedGraphPostgres` (Stage 3.2 overlap), Surreal writer per-row
read-back verification.

## What we could not determine without runtime data

1. **Which freeze cause dominates** — F1 (instance suspend / maxDuration kill) vs F2/F3
   (upstream hangs). Needed: Vercel runtime logs around the `updated_at` of a frozen job
   (was the invocation suspended? did it hit maxDuration?), and the project's plan/fluid
   settings.
2. **Actual Neon latency per statement** from the deployed region — determines how much F4
   really buys (`mcp neon list_slow_queries` / pg_stat_statements would confirm the
   aggregate hot spots too).
3. **BYO Surreal endpoint latency/size distribution** — whether stats slowness is mostly F5
   (our cold start) or genuinely slow customer stores.
4. **Whether freezes correlate with deploys** (instance recycling) — timestamps of stuck
   jobs vs deployment events.

**Telemetry to add (small, follow-up):**
- log drain start/end with `jobId` + duration + outcome in `runConnectIngestWorkerOnce`;
- a `worker_heartbeat_at` column updated by the reporter's `persist()` (enables both the
  staleness diagnosis and the F1 reclaim);
- PostHog event on route-retry deadline hits and on LLM timeout errors (provider, stage);
- `perfSpan` (already used in `connect-hub-load.ts`) around `ensureIngestionRoutingSchema`,
  `computeSurrealStats`, and `getConnectGraphStats` so the P1s are measurable in prod.

## Proposed follow-up stages (roadmap candidates)

1. **Durable run execution** — job lease + heartbeat + stale reclaim; worker outside request
   invocations (cron drain with route-level `maxDuration`, or a Coolify worker per the infra
   migration). Removes the P0 class entirely.
2. **Deploy-time migrations** — retire the runtime DDL ensure (F5).
3. **Spine stats caching + single resolution per request** (F6) and a negative-result TTL
   for Surreal pack probing (F7).
4. **Writer batching, phase 2** — order-preserving batch insert for extraction, batched
   Surreal scripts with preserved read-back verification (F4 residue).
