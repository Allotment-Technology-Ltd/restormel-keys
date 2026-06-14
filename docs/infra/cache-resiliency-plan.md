---
title: Cache & resiliency plan
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-13
last-reviewed: 2026-06-13
review-interval: P12M
---

# Cache & resiliency plan

Status: DRAFT 2026-06-13. Written in response to the owner's question:

> Should we introduce a cache (Upstash, or a free open-source alternative) to improve
> resiliency when (a) our server drops out, (b) the user's connection drops, (c) a
> database connection drops?

Companion to `database-strategy-roadmap.md` — this plan **complements, does not replace**
that roadmap. The DB strategy is about *where data lives* and *not holding user content*;
this plan is about *staying up when a dependency blips* and *taking chatty reads off the
metered DB*. They share the same governance: **never cache sensitive data** (API keys, user
content, secrets), and **avoid re-introducing a metered managed dependency** — the exact
class of thing (Neon's egress metering) that caused the outage this document responds to.

The short version: **a cache is the right tool for two specific jobs, but it is not the
first thing to build, and it is not the fix for scenario (a).** Two cheaper changes prevent
the exact outage we just had, and one of them is a five-line Dockerfile edit. Build those
first; add a cache where it earns its place; never put it on the auth/keys/content path.

---

## 1. The incident, traced through the code

The prod + staging outage was a *cascade*, and every link is in the repo:

1. Neon hit its egress quota → every query returned **402** (a thrown error from the driver).
2. `/keys/v1/catalog` runs four DB reads with **no error handling**:
   `apps/dashboard/src/routes/keys/dashboard/api/catalog/+server.ts:91` (`listModels` +
   `loadCatalogExternalContext`), `:97` (`listProviderModelVariantsByModelIds`), `:173`
   (`listCatalogModelObservationsForPairs`). There is **no `try`/`catch`** anywhere in this
   handler — confirmed by grep. A thrown 402 propagates unhandled → SvelteKit returns **500**.
3. The dashboard container's liveness probe is **that same DB-backed endpoint**:
   `Dockerfile.dashboard` HEALTHCHECK → `wget … /keys/v1/catalog`. A 500 fails the probe.
4. After `--retries=3`, Coolify/Traefik marks the container unhealthy and **pulls it from the
   load balancer** → site-wide **503** on prod *and* staging.
5. `/keys/v1/catalog` is also the **public contract endpoint consumed externally by
   allotmentology.tech** (`RESTORMEL_KEYS_CATALOG_URL`), so the blast radius reached a sibling
   product, not just our own UI.

**The single highest-leverage fix is to break link 3:** make the healthcheck independent of
the DB. A DB blip should degrade catalog responses, never tear down the whole site. That is a
~5-line Dockerfile change plus a trivial route, and it would have prevented this entire
outage on its own — *with or without a cache.* A cache does not appear until link 2, and even
there a serve-stale buffer is the resilience win, not the cache technology.

---

## 2. Scenario-by-scenario: does a cache actually help?

### (a) Our server drops out — **a cache does NOT help. Say so plainly.**

If the dashboard container (or the box) goes down, a Redis on the *same box* goes down with
it, and a Redis on a *different* host doesn't serve SvelteKit routes. Caching is the wrong
layer for "the server is gone." The real mitigations are operational:

- **DB-independent healthcheck** (see §1, §5 Phase 1) so a *dependency* blip never gets
  misread as "server down" and triggers a needless container pull. This is the actual cause
  of the "server dropped out" we experienced — it wasn't down, it was *evicted* because a
  DB-coupled probe failed.
- **Restart policy** — the worker already runs `node` as PID 1 for clean SIGTERM
  (`Dockerfile.worker`) with Coolify `restart: always`; the dashboard should match.
- **Redundancy** is the textbook answer (≥2 replicas behind Traefik), but on a single shared
  7.6 GB box with self-hosted Postgres arriving, a second dashboard replica is a memory cost
  we should defer, not the first move.

**Verdict (a): not a caching problem. Fix the healthcheck and restart policy.**

### (b) The user's connection drops — **mostly already handled; a cache offers a marginal offload.**

The live-run SSE path is the relevant surface, and it is already robust:

- **Reconnect + resync is built and correct.** `live-run-event-client.ts` rebuilds a fresh
  URL on every reconnect (`:158`–`:171`), carrying the client's current log cursor; the
  server replays the gap in the first `snapshot` frame (`events/+server.ts:198`–`:209`,
  documented `:16`–`:24`). No `Last-Event-ID` dependence; a 50 s stream-budget rotation or a
  hidden-tab gap **loses no log lines**.
- **Failure handling is built.** Consecutive-failure counter + `RECONNECT_FAILURE_LIMIT`
  (`live-run-event-client.ts:219`–`:235`), a heartbeat-staleness watchdog (`:179`–`:188`),
  exponential backoff (`reconnectDelayMs`, `live-run-events.ts:190`), and a documented
  **fallback to the 30 s poll** (`live-run-poll.ts`, `POLL_MS = 30_000`).
- **The server already absorbs transient DB errors** without flapping the client:
  `events/+server.ts:236`–`:241` catches a tick's data-layer error and sends a heartbeat so
  the client keeps its last-known state instead of dropping to fallback.

So for (b) the *connection* resilience is done. Where a cache could help is **offloading the
reconnect snapshot**: every reconnect re-runs `listConnectIngestJobsForWorkspace` /
`getConnectIngestJobForWorkspace` against Neon (`events/+server.ts:74`, `:175`–`:182`). With
many open tabs and the 50 s budget rotation, that's a steady reconnect-driven query stream. A
short-TTL cache of the per-workspace job snapshot would make reconnects cheaper and faster
(masking Neon cold-start latency after scale-to-zero). **Real, but marginal** — and the live
job set changes constantly, so the TTL must be very short (1–2 s) or delta-invalidated, which
limits the saving.

**Verdict (b): the resilience is already there. A cache is a cost/latency offload on the
reconnect snapshot, not a resilience fix. Low priority.**

### (c) A database connection drops — **the strongest case, but the *resilience* is "serve stale," and that needs no Redis to begin with.**

This is what bit us. The honest decomposition:

- **The resilience pattern that prevents the 503 is serve-last-known-good on DB failure** —
  return the previous catalog payload (or a static fallback) with a `degraded` marker instead
  of throwing a 500. **This pattern already exists in the codebase for auth** and is the model
  to copy: `auth.ts:139` `STALE_SESSION_ON_FAILURE_MS = 60_000`, `:169`
  `lastKnownGoodOrDegraded()` — on a Neon Auth 429/5xx/throw it serves the last good session
  rather than silently signing the user out, with security-conscious eviction on a *definitive*
  sign-out (`:216`–`:219`, `:234`–`:238`) so a blip can never resurrect a revoked session.
- **Crucially, "serve stale" does not require Redis.** A single in-process last-known-good
  copy of the catalog payload (one variable, same shape as the auth cache) survives any Neon
  blip on that instance. That's the whole resilience win for (c), at near-zero cost and zero
  new moving parts.
- **Where a cache *does* add value for (c)** is breadth and cold-start: an in-process copy is
  per-instance and empty on a fresh boot; a shared cache means *any* instance (dashboard or
  the separate worker container) serves the warm catalog, and a cold container after a
  scale-to-zero/restart still has a warm answer. That is a genuine improvement — but it is a
  *second-order* one on top of serve-stale, not a prerequisite for it.

**Verdict (c): the cache's job here is read-through + serve-stale buffer, and it is the
strongest case — but the resilience itself comes from the serve-stale logic (cheap,
in-process first), with a shared cache as the durability/breadth upgrade.**

---

## 3. Concrete resiliency points in the code (cacheable vs not)

| Surface | Where | Cache-safe? | Notes |
|---|---|---|---|
| **Catalog read** | `routes/keys/dashboard/api/catalog/+server.ts:91,97,173` | ✅ **Yes** — non-sensitive public data | Read-heavy, externally consumed, **no error handling, no Cache-Control header**. The prime candidate. Today every external poll is 4 metered Neon HTTP calls. |
| **Catalog external signals** | `lib/server/catalog-external-signals.ts:11`–`:13` | ✅ already cached | In-process TTL cache (15/5/10 min) for OpenRouter/status. Pattern proof that short-TTL caching is accepted here. |
| **Live-run SSE/poll snapshot** | `events/+server.ts:74,175`; `live-run-poll.ts` | ⚠️ partial — non-sensitive job *metadata* only | Cacheable as a 1–2 s snapshot for reconnect offload. Job set changes constantly → short TTL or delta-invalidate. Never cache log *content* if it could carry user text. |
| **Session validation** | `auth.ts:131,139,144`; `session-auth-cache.ts:52` | ⚠️ **already cached in-process; do NOT move to a shared store** | 20 s session cache + 60 s serve-stale + 30 s admin/founders memo. These hold **identity/session** — exactly the sensitive, security-eviction-sensitive data we must not externalize. Keep in-process. |
| **Worker lease / heartbeat / reclaim** | `neon.ts:6252` (`claimNextPendingConnectIngestJob`, `FOR UPDATE SKIP LOCKED`), `:6293` (heartbeat), `:6328` (reclaim) | ❌ **Do NOT move to Redis** | The "Redis excels at distributed locks" instinct is wrong *here*: the existing PG lease is **durable, fenced, and atomic** (`UPDATE … RETURNING`, worker fencing token, crash-safe reclaim). A Redis lock is in-memory and would *lose* durability across a Redis restart. The PG lease is the correct design; don't regress it. |
| **Healthcheck** | `Dockerfile.dashboard` HEALTHCHECK → `/keys/v1/catalog` | ✅ **decouple from DB — cheapest independent win** | Liveness must not depend on the DB. Point it at a static route. See §5 Phase 1. |
| **DB driver** | `neon.ts:146` `getSql()` → `neon(url)` (HTTP) | n/a | Stateless `@neondatabase/serverless` HTTP driver — **no connection pool**. So there's *no pool-exhaustion failure mode* to mitigate with a cache, and every query is a separate metered HTTP request → read-offload converts directly into CU-hour/request savings. |

**Sensitive-data line (matches the DB strategy governance):** API keys (hashed in
`api_keys`), `provider_integrations.credential_ciphertext`, `knowledge_source_documents`
content, and sessions/identity **never go in a cache.** Cacheable = the public catalog and
non-sensitive job *metadata* only.

---

## 4. Options comparison

If we do add a cache, the technology choice is constrained by two repo facts: **(1) the box
is a shared, memory-tight 7.6 GB host** (no swap; ~3.3 GB already used by Coolify/Forgejo/
Traefik/the product web apps; **self-hosted Postgres is arriving** per the DB roadmap Phase 3),
and **(2) the strategic direction is to get *off* metered managed dependencies**, because
metered managed is precisely what failed us.

| Option | Marginal cost | Ops burden | Memory on the box | Persistence | Metered-managed risk | Fit |
|---|---|---|---|---|---|---|
| **Upstash (serverless Redis)** | **Metered** — per-request + bandwidth + storage. Free tier exists but the model is pay-per-use. | Lowest (no host to run) | None | Managed | ❌ **Re-introduces the exact class that bit us.** A cache request on the hot catalog path that hits a metered quota = a *new* version of the 402 cascade. | **Poor** — contradicts the stated direction. |
| **Redis (self-hosted)** | **$0** marginal (already paying for the box) | Moderate — another container to run/patch; BSD→**SSPL/RSALv2** license since 7.2 (fine for self-host, watch redistribution). | ~30–60 MB idle, bounded by `maxmemory` | RDB/AOF available | ✅ none | Good, but license drift and Valkey momentum make it the weaker fork choice. |
| **Valkey (Linux Foundation BSD fork of Redis)** | **$0** marginal | Moderate — same as Redis; **BSD-3 license**, drop-in protocol/clients, broad community + distro packaging. | ~30–60 MB idle | RDB/AOF | ✅ none | **Best fit.** Open governance, same client libraries, no license overhang. |
| **KeyDB** | $0 | Moderate; multithreaded but **smaller community / slower upstream** post-Snap acquisition. | Similar | RDB/AOF | ✅ none | Fine technically; less momentum than Valkey. |
| **Dragonfly** | $0 (BSL license — source-available, not OSI) | Moderate; high-throughput, but **higher baseline memory** and BSL terms. | Heavier — tuned for big/high-QPS workloads we don't have | Snapshots | ✅ none | **Over-spec'd** for our load and a tight box; BSL adds friction. |

**Recommendation: if and when we add a cache, use self-hosted Valkey on the box, with a hard
`maxmemory` (e.g. 128–256 MB) + `allkeys-lru` eviction**, sequenced *after* self-hosted
Postgres so we size the combined footprint deliberately. Rationale: $0 marginal, no metered
quota to trip (the whole point), BSD-3 with open governance and Redis-compatible clients, and
a small bounded footprint that respects the 7.6 GB budget. **Reject Upstash** specifically
because it re-introduces a metered managed dependency — the failure class this document exists
to address. The cache must never be allowed to become a new single point of metered failure on
the hot path.

---

## 5. Is a cache even the right *first* tool? (The cheaper wins)

**No — not first.** A cache is a moving part with its own failure mode (memory pressure on a
tight box, its own restart, stale-data correctness, an extra connection per request). It earns
its place only after the changes that make us resilient *without* it. Lead with the cheapest,
highest-leverage fixes:

1. **DB-independent healthcheck (≈5 lines).** The single biggest resiliency-per-effort win in
   this whole document, and it needs no cache. Point `Dockerfile.dashboard`'s HEALTHCHECK at a
   trivial static route (e.g. `/healthz` returning `200 "ok"` with no DB call) instead of
   `/keys/v1/catalog`. This alone breaks the outage cascade at link 3: a DB blip can no longer
   get the container evicted. **Do this regardless of any cache decision.**

2. **Catalog graceful degradation / serve-stale (in-process first).** Wrap the catalog DB
   reads in error handling and serve the last-known-good payload (or a static fallback) with a
   `degraded` flag + a short-cache `Cache-Control` header, instead of throwing a 500. Copy the
   proven shape from `auth.ts:169 lastKnownGoodOrDegraded`. This is the resilience win for
   scenario (c) and needs **no Redis** — one in-process variable. Also add the missing
   `Cache-Control` header so allotmentology.tech / any CDN/Traefik layer can absorb repeat
   reads (the catalog response is fully cacheable and currently sends none).

3. **Chatter reduction (already merged — acknowledge, don't redo).** The DB roadmap Phase 0 is
   done: worker sweep raised to **120 s ±10 % jitter** (`connect-ingest-worker-daemon.ts:24`)
   so Neon can scale to zero; the SSE path is the single live transport with the 30 s poll only
   as fallback. These already cut the metered load a cache would otherwise offload — which is
   *why* a cache is a cost optimization, not an emergency.

Only **after** 1–3 does a cache pull its weight, and only on the two surfaces where it does:
the catalog (cost + cross-instance/cold-start resilience) and the live-run reconnect snapshot
(cost/latency offload).

---

## 6. Phased plan

**Phase A — break the cascade (do now; no cache; cheap + reversible).**
- A1. Add `/healthz` (static `200`, no DB) and repoint the `Dockerfile.dashboard` HEALTHCHECK
  to it. *Prevents the entire outage we had, on its own.*
- A2. Add `try`/`catch` + serve-last-known-good (in-process) + `degraded` flag + `Cache-Control`
  to `/keys/v1/catalog`, mirroring `auth.ts:169`. A Neon blip now degrades the catalog instead
  of 500-ing it. Keep `/keys/v1/catalog` as the *public contract* but it is no longer the
  liveness probe.
- A3. Confirm the dashboard container's restart policy matches the worker's (`restart: always`).
- *Outcome:* the documented incident cannot recur, with zero new infrastructure.

**Phase B — add a cache layer where it earns its place (after Postgres self-host is sized).**
- B1. Stand up **Valkey** on the box as a Coolify app, `maxmemory` ~128–256 MB, `allkeys-lru`,
  AOF off (pure cache — losing it is harmless by design). Size it *together with* self-hosted
  Postgres against the box budget; per-container memory limits per `suite-server-sizing.md`.
- B2. Make the catalog a **read-through cache**: serve from Valkey, refresh on miss/TTL
  (e.g. 30–60 s), and on a DB error serve the cached value (now shared across instances and
  warm on a cold container). This upgrades Phase A2's in-process serve-stale to cross-instance.
  The cache must **fail open**: if Valkey is unreachable, fall straight back to the DB →
  in-process stale path. The cache is never a hard dependency on the hot path.
- B3. Cache the **live-run reconnect snapshot** (per-workspace job *metadata*, 1–2 s TTL or
  delta-invalidated) to offload reconnect-driven Neon reads (`events/+server.ts:74`). Optional;
  measure first — only worth it if reconnect query volume is material.

**Phase C — session/lease: deliberately do NOT migrate (revisit only with evidence).**
- Sessions stay **in-process** (`auth.ts`, `session-auth-cache.ts`) — they're sensitive and
  security-eviction-sensitive; externalizing identity to a shared cache adds risk for little
  gain at our scale. Revisit only if we run multiple dashboard replicas *and* measure
  cross-instance session-cache miss cost.
- The worker lease/heartbeat stays in **Postgres** (`neon.ts:6252`+) — it is correct, durable,
  and fenced. A Redis lock would be a *downgrade* in durability. Do not move it.

**Relationship to the DB strategy:** Phase A is independent and should ship first. Phase B's
Valkey is sequenced *after* DB-roadmap Phase 3 (operational Postgres on the box) so the
combined memory footprint is sized once, deliberately, against the shared 7.6 GB budget. The
cache holds **only** non-sensitive public catalog + job-metadata — never the user content,
secrets, or sessions the DB strategy is busy *removing* from where they don't belong.

---

## 7. Bottom line for Adam

- **Should we add a cache? Yes, but narrowly and not first.** It earns its place on exactly
  two surfaces — the **public catalog** (cost + cross-instance/cold-start resilience) and,
  optionally, the **live-run reconnect snapshot** (cost/latency). Nowhere else.
- **Which technology? Self-hosted Valkey on the box** ($0 marginal, BSD-3, Redis-compatible,
  small bounded footprint), sized alongside the incoming self-hosted Postgres. **Reject
  Upstash** — it re-introduces the metered-managed-dependency class that caused this outage.
- **A cache is NOT the fix for "our server drops out"** (a) — that's healthcheck + restart
  policy — and **NOT** what makes the SSE reconnect resilient (b) — that's already built.
- **Do first, before any cache:** (1) **decouple the healthcheck from the DB** and (2) add
  **catalog serve-stale + a Cache-Control header**. Together they prevent the exact incident
  we had, with no new infrastructure.
- **Single highest-leverage resiliency fix found:** the dashboard liveness probe is the
  DB-backed `/keys/v1/catalog` (`Dockerfile.dashboard` HEALTHCHECK). A ~5-line change to a
  static `/healthz` breaks the 503 cascade at its root — independent of, and more impactful
  than, any caching decision.
