---
title: Dashboard latency task force — empirical diagnosis + safe fixes
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-12
last-reviewed: 2026-06-12
review-interval: P12M
---

# Dashboard latency task force — empirical diagnosis + safe fixes

**Date:** 2026-06-12 · **Trigger:** product owner (2026-06-11): "the whole dashboard is really
laggy — either we up the compute the product sits on or we improve things at a code level."
**Method:** live measurements against restormel.dev (curl timing, Vercel CLI/API, Neon API,
runtime logs) + code-path query tracing + a local adapter build for bundle sizes. Prior art:
`docs/reviews/connect-runtime-reliability-perf.md` (F5 fixed by PR #224, F6/F7 by PR #223,
F8/F9 still open at time of writing — F8 is substantially addressed in this PR).

**Headline:** this is not a compute problem. The dashboard's serverless functions run in
**iad1 (US East)** while Neon Postgres, Neon Auth, and the user base are in **London
(aws-eu-west-2)** — and the hooks/session layer paid **4 sequential Neon round-trips on every
request** (9 per status poll). Every round-trip crossed the Atlantic twice. Buying bigger
compute would not have fixed geometry or chattiness; this PR fixes both for £0.

---

## 1. Measured numbers (all live, 2026-06-11/12 unless noted)

### 1.1 Where things run — verified

| Component | Location | Evidence |
|---|---|---|
| Vercel edge (for a UK client) | lhr1 (London) | `x-vercel-id: lhr1::iad1::…` response header |
| **Vercel functions** | **iad1 (US East)** | same header; project API `resourceConfig.functionDefaultRegions: ["iad1"]`; local build output `λ … [iad1]` |
| Neon Postgres (`restormel-keys`, green-sky-53569304) | **aws-eu-west-2** (London), proxy `eu-west-2.aws.neon.tech` | Neon API |
| Neon compute | autoscaling 0.25–2 CU, scale-to-zero, PG17, 512MB branch logical-size limit (Free-tier signature) | Neon API |
| Vercel plan | **Hobby** (`"plan": "hobby"`, iteration "plus") | Vercel teams API |
| Fluid compute | **enabled**; memory "standard"; default maxDuration 300s; `elasticConcurrencyEnabled: false` | Vercel project API |
| Build concurrency | 1 (Hobby) | observed: 3 deployments sat Queued earlier on 2026-06-11; plan limit |

iad1 ↔ eu-west-2 network RTT is ~75–90ms. The Neon serverless HTTP driver pays roughly one
such RTT per SQL statement (TLS reused), so **every sequential query cost ~80ms instead of
the ~5–15ms it costs from lhr1**.

### 1.2 curl timings (from UK, `curl -w`, repeated)

| Target | TTFB | Notes |
|---|---|---|
| Static asset (`/_app/immutable/entry/start.*.js`) | **84–92ms** | edge baseline, 3 samples |
| Marketing `/` (SSR) | **278–461ms** (median ~313ms) | 5 samples, warm |
| `/keys/dashboard/login` (SSR) | 260–517ms | 3 samples, warm |
| Hooks-only API 401 (`/keys/dashboard/api/connect/ingest/jobs`, no auth) | **2,080ms first hit (cold)**, then 289–467ms warm | 5 samples |

Reading: a warm function request adds ~200–380ms over the edge baseline even with **zero
authenticated work** — consistent with one transatlantic hop client→iad1 plus one
iad1→eu-west-2 Neon Auth `get-session` call (which, pre-PR, ran for *every* request including
cookie-less bot/marketing traffic, because the session cache only stores hits). Cold start
signature ≈ **2s**. Production runtime logs show very low traffic (a handful of page views
per hour), so the fluid instance pool is routinely cold for the first interactive user — i.e.
the product owner frequently *starts* their session with a 2s request.

### 1.3 Per-request DB round-trips traced in code (pre-PR)

For a signed-in **service owner** (i.e. the product owner), every request — every navigation,
every API call, every poll — paid in `hooks.server.ts`:

1. `getSession` — cached 20s, else HTTP to Neon Auth;
2. `syncServiceOwnerBootstrap` → `service_admin_emails` SELECT + `service_admins` INSERT;
3. `syncFoundersAccessForServiceOwner` → `founders_circle_access` INSERT…ON CONFLICT UPDATE (a **write per request**);
4. `upsertUser` → `users` INSERT…ON CONFLICT (another write per request).

= **4 sequential Neon RTTs ≈ 320ms from iad1, per request, before any route code runs.**
(Non-owner users paid the same count via the admin/founders SELECT paths.)

The run-console status poll (`…/ingest/jobs/[jobId]/status`, F8) added, sequentially:
`getOrCreateDefaultWorkspace` + `listProjectsByWorkspace` (result unused by this endpoint) +
job row + log rows + `COUNT(*)` = 5 more → **9 sequential Neon RTTs ≈ 700–800ms server time
per poll, fired every 1.5s per viewer.** The poll interval was barely longer than the poll
itself, and `pollMs` also kept firing in hidden tabs.

The dashboard layout load adds `listProjectsWithEnvironments` (awaited on non-Connect routes)
+ workspace (30s cache) + 2 parallel journey queries ≈ 2–3 RTTs; Connect hub pages add their
stats loads on top (F6 — partially fixed in PR #223).

### 1.4 Bundle sizes (local `pnpm --filter dashboard build`, adapter output)

| Artifact | Size | Notes |
|---|---|---|
| `![-]/0.func` (marketing + docs + dashboard SSR pages, nodejs22) | 11MB unpacked, 1,104 files | λ ~2.38MB compressed per `vercel inspect` |
| `![-]/1.func` (Connect APIs incl. ingest jobs/**status**, nodejs24) | 9.9MB, 1,035 files | |
| `![-]/2.func` (ingest **drain** cron, maxDuration 300) | 3.4MB, 275 files | |
| `![-]/catchall.func` | 1.3MB, 76 files | |
| Client JS total | 6.6MB | largest chunk 2.6MB = Scalar API reference, **already route-split** to `/keys/docs/api-reference` only |
| Graph explorer (4,970-line `ConnectGraphExplorer.svelte`) | — | **already lazy-loaded** (`+page.svelte:55` dynamic import + skeleton) — no action needed |

Client-side hydration is *not* the problem: the login page preloads only the entry chunks,
and the two known heavyweights are already split. The 10–11MB/1,000-file server functions
explain the ~2s cold start but are not worth surgery while fluid keeps instances shared.

### 1.5 F9 — ingest/interactive instance sharing, quantified

The adapter build splits routes into four functions (1.4 above). Mapping (symlinks in
`.vercel/output/functions`):

- dashboard **page SSR** → `0.func`;
- `POST /api/connect/ingest/jobs`, `…/restart`, and the polled `…/status` → **`1.func`**;
- the cron drain → `2.func` (own maxDuration).

So with durable runs (PR #229), a run started from the UI executes via `waitUntil` **inside
`1.func` — the exact function the run console polls**. While the LLM orchestration loop is
parsing multi-MB responses, fluid routes the operator's own status polls onto the busy
instance: the console is laggy precisely while a run is active, which is the reported
experience. Page SSR (`0.func`) is insulated at the microVM level but shares the **Neon
0.25–2 CU compute** with the run's write storms — a second-order contention path that grows
with run size. Cron-drained runs (`2.func`) do *not* interfere with polls; only the
immediate post-POST drain does.

---

## 2. Ranked causes

| # | Cause | Evidence | Status |
|---|---|---|---|
| 1 | **Function region iad1 vs Neon/users in London** — multiplies every DB round-trip ~8–15× | §1.1, §1.2 | **fixed in this PR** (`regions: ["lhr1"]`) |
| 2 | **Per-request hooks fan-out**: 4 sequential Neon RTTs (incl. 3 idempotent writes) on every request | §1.3 | **fixed** (30s memo + once-per-process syncs) |
| 3 | **F8 status polling**: 9 sequential RTTs/poll @1.5s, also when tab hidden | §1.3 | **substantially fixed** (3 parallel queries, cached workspace, no projects fetch, 2.5s+jitter, hidden-tab pause) |
| 4 | **Cold starts ~2s** on a near-idle instance pool (10–11MB functions, low traffic) | §1.2, §1.4 | mitigated by #1 (less per-request work keeps responses snappy once warm); full fix = self-host (§4c) |
| 5 | **F9 instance sharing**: `waitUntil` ingest runs inside the status-poll function; Neon 2 CU shared | §1.5 | open — roadmap (worker split) |
| 6 | **Neon Free-tier compute**: scale-to-zero resume (~0.5–2s) on first query after idle; 2 CU ceiling during runs | §1.1 | open — config/plan option (§4b) |
| 7 | Anonymous traffic paid a Neon Auth HTTP call per request (cache only stores hits) | §1.2, `auth.ts` | **fixed** (cookie-gated session fetch) |

## 3. Shipped in this PR (zero/near-zero behavior change)

| Change | File(s) | Expected impact |
|---|---|---|
| Pin functions to **lhr1** | `apps/dashboard/svelte.config.js` | every Neon/Neon-Auth RTT ~80ms → ~5–15ms; authed navigation server time roughly −60–80%; UK client→function hop also shortens. Hobby supports one custom region; route-level `config` exports inherit it. |
| **Session-auth memoization**: admin/founders status cached 30s per (uid,email,role); bootstrap syncs (`service_admins`, `founders_circle_access`, `users` upserts) once per process; failed founders lookups not cached (keeps fail-open retry); admin grant/revoke endpoints invalidate the cache | `src/lib/server/session-auth-cache.ts` (+tests), `src/hooks.server.ts`, `keys/admin/api/founders/[email]`, `keys/admin/api/operator-emails` | −4 Neon RTTs on **every** authed request after the first; aligned with existing 20s session / 30s workspace caches |
| **Cookie-gated `getSession`**: skip the Neon Auth round-trip when the request has no `__Secure-*`/`rksecure-*` cookie | `src/lib/server/auth.ts` (+tests) | −100–250ms TTFB on all anonymous marketing/docs/bot requests |
| **Status endpoint**: drop the unused projects query, use the 30s workspace cache, run job row + logs + count concurrently | `…/ingest/jobs/[jobId]/status/+server.ts`, `src/lib/server/connect/session-context.ts` (opt-in `includeProjects: false`, default unchanged for all other callers) | poll server time: 9 sequential RTTs → ~2 RTT wall-clock (hooks memoized + 3 parallel queries) |
| **Poll cadence**: active 1.5s → **2.5s ±20% jitter**; polling pauses while `document.hidden`, resumes with an immediate catch-up fetch | `ConnectIngestRunConsole.svelte` | steady-state poll load −40%; zero when backgrounded; jitter de-syncs multiple tabs |

Combined expectation for the reported symptom: an authed dashboard navigation that cost
~0.8–1.5s of server time (hooks 320ms + layout ~200ms + page queries, all at 80ms/RTT) should
drop to **~100–300ms**; a status poll from ~700–800ms to **~80–150ms**. Verify after deploy
with `x-vercel-id` (expect `lhr1::lhr1::…`) and by temporarily setting `DASHBOARD_PERF_LOG=1`
(the `perfSpan` plumbing already exists, including around the new hook resolution).

Deliberately **not** done here (behavior-changing — see §5): moving the post-POST ingest
drain out of `1.func`, SSE instead of polling, spine stats request-level dedupe, Surreal
negative-TTL, social-proof stale-while-revalidate.

## 4. Recommendation — infra vs code

**Verdict: code + one config line first; do not buy compute for this.** The lag was geometry
(wrong continent) and chattiness (per-request query fan-out), not CPU or memory. Fluid
"standard" instances are adequate for SSR; the Neon 2 CU ceiling only matters during ingest
runs.

### (a) Code-only — this PR (£0)

Ships now. Expected to remove the majority of perceived lag. Bank it, re-measure
(`curl -w` on the same three targets + `x-vercel-id`), then decide whether (b) is needed
at all.

### (b) Vercel / Neon config & plan changes

| Option | Cost | What it buys | Recommendation |
|---|---|---|---|
| Function region lhr1 | £0 | the #1 fix | **in this PR** |
| `DASHBOARD_PERF_LOG=1` (temporary) | £0 | prod span timings in runtime logs to confirm | do for one week |
| Vercel **Pro** | **$20/user/mo** | >1 concurrent build (the 3-queued-deploys pain), 800s maxDuration for the drain, multi-region (not needed), better observability/log retention | **defer** — only if build queueing keeps biting or you want longer ingest budgets before the self-host worker lands |
| Neon **Launch** (or suspend-timeout tweak) | **$19/mo** | no scale-to-zero stall, larger compute/storage headroom for ingest write load | **defer**; revisit if perf logs show DB-resume stalls or CU saturation during runs |

Total "max config" path ≈ **$39/mo** — but neither line item addresses anything this PR's £0
changes don't already address better, except build concurrency and DB cold-resume.

### (c) Coolify self-host (infra-migration Stage 2) — the real compute-upgrade path

Already planned (Stage 1 Forgejo done). A single UK/EU VPS (e.g. Hetzner CAX31/CPX31 ~€15–25/mo,
or a UK provider if data locality demands it) running the SvelteKit dashboard under Coolify:

- **kills cold starts** (cause #4) — long-lived Node process;
- **kills F9 properly** — run `drainConnectIngestQueue` in a separate worker process/container
  on the same box (the drain route's docstring already anticipates exactly this), no
  maxDuration ceiling, no instance sharing with interactive traffic;
- removes the Hobby build queue and Vercel plan-limit questions entirely;
- keeps Neon in eu-west-2, now ~1–5ms away.

**Recommended order:** ship this PR → re-measure for a week → proceed with Coolify Stage 2 as
already planned (it is the compute upgrade, at ~€20/mo instead of $39/mo, and it unlocks the
F9 worker split) → skip Vercel Pro unless Stage 2 slips and build queueing/ingest budgets
hurt in the meantime.

## 5. Proposed follow-ups (roadmap candidates, not in this PR)

1. **F9 worker split (pre-Coolify stopgap):** on job POST, replace the in-process `waitUntil`
   drain with a fire-and-forget authenticated self-call to the drain route, so runs execute in
   `2.func` instead of the polled `1.func`. Small, but changes run-start semantics — needs its
   own review.
2. **F8 endgame:** SSE (or long-poll) run log streaming; return `log_line_total` from the
   cursor instead of `COUNT(*)`.
3. **F6 residue:** request-scoped stats resolution passed into the scorecard composer; spine
   stats TTL cache.
4. **Social proof stale-while-revalidate** so the hourly GitHub/npm refresh never blocks a
   marketing SSR.
5. **Neon suspend timeout** review once perf logs quantify DB-resume frequency.

## 6. Verified vs inferred

**Verified:** function region (header + project API + build output); Neon region/compute
(Neon API); plan = Hobby (teams API); fluid enabled (project API); curl timings; bundle
sizes (local build); route→function mapping (output symlinks); query counts (code read);
graph explorer + Scalar already split (code + build output).
**Inferred:** iad1↔eu-west-2 RTT ~80ms (public latency data; consistent with the measured
200–380ms warm overhead); cold-start attribution of the 2,080ms first API hit (single sample,
but consistent with low traffic and 1.4 sizes); Neon Free tier (512MB branch limit + 2 CU
signature; not read off a billing API); build concurrency = 1 (observed queueing + Hobby
plan docs).
