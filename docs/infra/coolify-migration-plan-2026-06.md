---
title: Hetzner/Coolify migration plan — infra Stage 2 (dashboard + ingest worker)
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-12
last-reviewed: 2026-06-12
review-interval: P12M
---

# Hetzner/Coolify migration plan — infra Stage 2 (dashboard + ingest worker)

**Date:** 2026-06-12 · **Status:** proposed, awaiting owner decisions (§9)
**Builds on:** `docs/reviews/dashboard-latency-taskforce-2026-06.md` (PR #259, merged — measured
evidence; verdict: skip Vercel Pro, proceed Coolify ~€20/mo) and the executed Stage 1 of the
UK/EU self-host migration (Forgejo git+CI **done** 2026-06-09 — `.forgejo/workflows/` live and
green on the shared box; pattern + gotchas in
`~/projects/allotment-technology-ltd/INFRA-RUNBOOK.md`, "Product #2: restormel-keys" section).

**One-paragraph summary:** move the SvelteKit dashboard (which serves marketing, docs,
`/keys/v1/catalog`, and the dashboard itself at restormel.dev) from Vercel Hobby to a
Coolify-managed container on a dedicated Hetzner box, and promote the Connect ingest
cron-drain (PR #229's `waitUntil` + 5-minute Vercel cron) to a **real long-running worker
process** in a second container on the same box. Neon (Postgres + Auth, aws-eu-west-2) stays
managed and untouched. This permanently fixes cold starts (cause #4, measured 2.08s) and F9
(ingest/interactive instance sharing, cause #5), removes the Hobby build queue and the 300s
`maxDuration` ceiling, and lands at ~€9/mo incremental (~€17/mo total across both boxes).

---

## 1. Target architecture

```
                         restormel.dev (DNS stays at Vercel registrar; A record → prod box)
                         staging.restormel.dev (A record → prod box, separate Coolify app)
                                          │
                                          ▼
  ┌─ Hetzner #2 “restormel-prod” (NEW, fsn1/nbg1, CX33 4vCPU/8GB) ──────────────────────┐
  │  Hetzner Cloud Firewall: inbound 22/80/443 only (Docker bypasses ufw — runbook §0.0) │
  │                                                                                      │
  │  Traefik (Coolify-managed)  ── Let's Encrypt TLS (HTTP-01)                           │
  │     │                                                                                │
  │     ├──► [dashboard]  SvelteKit adapter-node, node:22                                │
  │     │      marketing + docs + /keys/dashboard + /keys/v1/catalog (contract for       │
  │     │      allotmentology.tech) + Connect APIs. Long-lived process: cold start = 0.  │
  │     │      Inline post-POST ingest drain DISABLED here (env flag, §6).               │
  │     │                                                                                │
  │     └──► [ingest-worker]  same image, different command                              │
  │            loops drainConnectIngestQueue() on an interval — lease/heartbeat          │
  │            claiming (PR #229) already makes concurrent drainers safe.                │
  │            No maxDuration. No instance sharing with interactive traffic (F9 dead).   │
  └──────────────────────────────────────────────┬───────────────────────────────────────┘
                                                 │ Postgres + Neon Auth HTTPS
                                                 ▼ (~10–17ms RTT FSN↔London, §3)
                                  Neon (managed, aws-eu-west-2) — unchanged
                                  Surreal BYO graph stores — unchanged (customer-side)

  ┌─ Hetzner #1 “shared control plane” (EXISTING CX33, 77.42.125.150) ───────────────────┐
  │  Coolify (control plane — manages Hetzner #2 as a *remote server* over SSH)          │
  │  Forgejo  git.allotmentology.tech  (git + Actions + container registry)              │
  │  act_runner (CI: build → push image → call Coolify deploy API)        [Stage 1 DONE] │
  └──────────────────────────────────────────────────────────────────────────────────────┘

  Stays elsewhere:
  • GitHub  — mirror + PR flow + Vercel *preview* deployments (§5)
  • Vercel  — previews only after cutover; instant DNS rollback target during transition
  • npmjs   — @restormel/* publishes (decided in Stage 1: public SDKs stay on npmjs)
  • Zuplo gateway — explicitly out of scope; separate decision (Stage 1 note)
```

Notes on the shape:

- **One image, two containers.** `Dockerfile.dashboard` (repo root) already targets
  adapter-node output. The worker is the same image with
  `command: node --import tsx scripts/connect-ingest-worker-daemon.ts` (new thin entry, §6).
  No build-time secrets exist — `grep` finds zero `$env/static/*` imports in
  `apps/dashboard/src`, all env is dynamic/runtime — so **the same image serves staging and
  prod** with different env. This is a real deployment-correctness win over Vercel.
- **Coolify multi-server.** The existing Coolify on the shared box manages the new prod box
  as a remote server over SSH. No second Coolify install; one control plane, one API.
- **Single app instance.** The in-memory caches and the Connect memory-write rate limiter
  are documented as per-process (`docs/guides/agent-memory-write.md` already assumes "single
  instance (Coolify, Stage 2 infra)"). Moving from Vercel's N fluid instances to exactly one
  makes those *more* correct, not less.

## 2. Hetzner sizing and monthly cost

Pricing anchored to the runbook's verified order (CX33 = 4 vCPU / 8GB / 80GB = **£7.30/mo**,
2026-06); re-verify at order time.

| Box | Class | Spec | ~Cost/mo | Runs |
|---|---|---|---|---|
| #1 shared (existing) | CX33 | 4 vCPU / 8GB | £7.30 (already paid) | Coolify, Forgejo+PG, act_runner, pilot app |
| #2 restormel-prod (new, recommended) | **CX33** | 4 vCPU / 8GB | **~£7.30 / €8.6** | dashboard + ingest-worker + Traefik |
| — headroom alternative | CX43 | 8 vCPU / 16GB | ~€16 | same, if ingest runs prove memory-hungry |
| — rejected | CAX31 (Arm) | 8 vCPU / 16GB | €12.49 | cheaper RAM, but the CI runner is x86 — arm64 images need buildx/QEMU; not worth it at this scale |

**RAM budget on the prod CX33 (8GB):** OS+Docker+Traefik ~1GB · dashboard Node process
0.5–1GB (the 10–11MB *bundle* is a cold-start problem on Vercel, not an RSS problem on a
long-lived process) · ingest worker 1–2GB peak while parsing multi-MB LLM responses
(`KNOWLEDGE_INGEST_MAX_CHUNKS` caps per-job fan-out) → **~4GB used worst case, ~50% headroom.**
CPU: ingest runs are I/O-bound on LLM calls; 4 shared vCPUs are ample at current traffic
(runtime logs: a handful of page views/hour).

**Builds do not run on this box** — CI builds the image on the shared box's runner (§ Stage
2.4), so prod RAM is never contended by `pnpm install` (~2–4GB transient).

**Total infra cost after migration:** ~€17/mo across both boxes (+ ~€0.60/mo IPv4 if billed
separately), vs the rejected Vercel Pro + Neon Launch path at ~$39/mo. Within the latency
task force's "~€20/mo" envelope. Cheaper option: reuse the shared box for everything
(€0 incremental) — viable, but couples product blast radius to the control plane; offered as
owner decision D1.

## 3. Region: Hetzner DC vs Neon eu-west-2 (London)

Hetzner Cloud DCs: Falkenstein (fsn1), Nuremberg (nbg1), Helsinki (hel1). No UK location.

| Path | RTT (typical public figures) | Per-request effect today |
|---|---|---|
| Vercel lhr1 → Neon eu-west-2 (current, post-PR #259) | ~1–5ms | baseline |
| **fsn1/nbg1 → Neon eu-west-2** | **~10–17ms** | post-PR #259 a warm authed nav is ~2–3 DB RTTs → **+~25–45ms** vs lhr1 |
| hel1 → Neon eu-west-2 | ~35–45ms | +~100ms+ on chatty paths — reject |
| UK client → fsn1 | ~13–18ms (vs ~3–8ms to lhr1) | +~10ms on the client hop |

**Recommendation: fsn1 or nbg1** (same region as the pilot box — pattern, snapshots, and
private networking all reuse). The ~+40–60ms total warm-path cost is trivially repaid by
deleting the **2.08s cold start** that currently fronts most of the product owner's sessions,
and the latency PR already removed the chattiness that would have multiplied the DC distance
(hooks memoized; status poll at ~2 RTTs). **Keep Neon in eu-west-2** — zero data move, and
the worker's write storms are equally happy at 15ms. Revisit relocating Neon to
aws-eu-central-1 (Frankfurt, ~5ms from fsn1) only if `DASHBOARD_PERF_LOG=1` spans show
DB-bound interactive paths after cutover; Neon region moves require a new project +
dump/restore, so it is not a casual tweak. A UK VPS provider would beat both hops but breaks
the shared-Coolify pattern and (per the runbook's shop-around) costs ~2× for the same RAM —
only worth it if data-locality policy demands UK soil (owner decision D2).

## 4. What the app needs — inventory

### 4.1 Adapter swap (`@sveltejs/adapter-vercel` → `adapter-node`)

`apps/dashboard/svelte.config.js` currently pins `adapter-vercel` with `regions: ["lhr1"]`.
For Coolify we need `adapter-node`. To keep Vercel prod + previews working during the
transition, make the adapter **env-selected** (additive, reversible — the pilot's
`pg-driver`-branch analog, done better):

```js
// svelte.config.js — DEPLOY_TARGET=node → adapter-node, else adapter-vercel (unchanged default)
```

What changes with adapter-node:

- Output: `build/index.js` + `client/` — already what `Dockerfile.dashboard` expects.
- Route-level `export const config = { runtime, maxDuration }` (the drain route, line 22 of
  `…/ingest/drain/+server.ts`) is **adapter-vercel-only and silently ignored** by
  adapter-node — fine, the worker replaces the budget, but the export must stay for the
  Vercel preview builds (it is type-checked per adapter; verify `check` passes under both).
- `vercelWaitUntil()` in `connect-ingest-worker.ts` is already a documented no-op off Vercel.
- Listener env: `PORT` (Dockerfile sets 8080; Coolify maps it), `HOST=0.0.0.0`,
  `BODY_SIZE_LIMIT` (set explicitly — ingest job POSTs carry source payloads),
  `ORIGIN=https://restormel.dev` (adapter-node needs it for correct form-action/origin
  handling; staging sets its own).
- `VERCEL_ENV === "production"` appears in 3 source files but every site also checks
  `NODE_ENV === "production"` (e.g. `outbound-surreal-endpoint.ts:17`) — audit in the same
  PR; set `NODE_ENV=production` in the image (one line in Dockerfile serve stage).
- `Dockerfile.dashboard` is on `node:20-alpine`; routes declare nodejs22/24 on Vercel —
  bump to `node:22-alpine` in the same PR.

### 4.2 Ingest worker (the F9 fix — design in §6)

Already in the tree and waiting for exactly this: `drainConnectIngestQueue()` +
lease/heartbeat claiming in `apps/dashboard/src/lib/server/connect-ingest-worker.ts`, a
one-shot CLI at `apps/dashboard/scripts/connect-ingest-worker.ts`, and the drain route's own
docstring: *"A future long-lived worker (Coolify, infra-migration Stage 2) replaces this by
calling `drainConnectIngestQueue` on an interval."* What's missing is a daemon entry + an
env gate for the inline post-POST drain (§6).

### 4.3 Vercel crons → worker loop (+ optional belt-and-braces)

`apps/dashboard/vercel.json` has exactly **one** cron: `*/5 * * * *` →
`/keys/dashboard/api/connect/ingest/drain`. The worker daemon's interval loop replaces it
outright. Keep the drain route itself (CRON_SECRET-protected) as a manual/emergency drain
and optionally add a Coolify **Scheduled Task** curling it every 15 min as a dead-worker
backstop — lease claiming makes overlapping drainers safe by design. No other crons exist
(`grep crons` across repo: only this file). The weekly efficacy run etc. live in CI
workflows, unaffected.

### 4.4 Env/secrets inventory (names only — values via `vercel env pull`, never the MCP)

From `process.env`/`$env/dynamic` usage in `apps/dashboard/src` (all runtime; none baked at
build):

- **Core:** `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `RESTORMEL_CREDENTIALS_ENCRYPTION_KEY`,
  `CRON_SECRET`, `NODE_ENV`, `ORIGIN`, `PORT`, `HOST`, `BODY_SIZE_LIMIT`
- **Billing (Paddle):** `PADDLE_API_KEY`, `PADDLE_SECRET`, `PADDLE_WEBHOOK_SECRET`,
  `PADDLE_ENVIRONMENT`, `PADDLE_ALLOW_UNSIGNED_WEBHOOKS`
- **Auth/OAuth:** `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `MS_OAUTH_CLIENT_ID/SECRET`,
  `RESTORMEL_OIDC_CLIENT_ID`
- **Access control:** `RESTORMEL_SERVICE_OWNER_EMAILS`, `RESTORMEL_SERVICE_ADMIN_USER_IDS`
- **Product flags:** `RESTORMEL_MODULE_FLAGS`, `RESTORMEL_PRO_FEATURES`,
  `RESTORMEL_PRO_DEV_DEFAULT`, `RESTORMEL_SUPPORT_ENABLED`, `RESTORMEL_SUPPORT_MODEL`,
  `RESTORMEL_ROLLOUT_PERCENT`, `RESTORMEL_DASHBOARD_UI_HIDDEN`, `USE_RESTORMEL_KEYS`,
  `DEFAULT_AI_PROVIDER`
- **Connect/ingest:** `CONNECT_INGEST_WORKER_MODE`, `KNOWLEDGE_INGEST_WORKER_MAX_JOBS`,
  `KNOWLEDGE_INGEST_MAX_CHUNKS`, `CONNECT_INGEST_LEASE_MS`,
  `CONNECT_INGEST_WORKER_HEARTBEAT_MS`, `CONNECT_INGEST_STUB_PAUSE_MS`,
  `CONNECT_LLM_TIMEOUT_MS`, `CONNECT_EMBED_TIMEOUT_MS`, `CONNECT_ROUTE_RETRY_DEADLINE_MS`,
  `CONNECT_MEMORY_RATE_LIMIT`, `CONNECT_MEMORY_RATE_WINDOW_MS`,
  `RESTORMEL_CONNECT_EMBED_MODEL`, `RESTORMEL_CONNECT_DESIGNER_MODEL`,
  `RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT`, `RESTORMEL_SURREAL_HTTP_TIMEOUT_MS`,
  `OPENAI_API_KEY` (legacy dev fallback), `UNSTRUCTURED_API_KEY`
- **Self-consumption (dogfood):** `RESTORMEL_GATEWAY_KEY`, `RESTORMEL_PROJECT_ID`,
  `RESTORMEL_ENVIRONMENT_ID`, `RESTORMEL_WORKSPACE_ID`, `RESTORMEL_BASE_URL`,
  `RESTORMEL_KEYS_BASE`
- **Telemetry/feedback:** `POSTHOG_API_KEY`, `POSTHOG_HOST`, `PUBLIC_POSTHOG_KEY`,
  `PUBLIC_POSTHOG_HOST`, `FEEDBACK_GITHUB_TOKEN`, `FEEDBACK_GITHUB_REPO`, `GITHUB_TOKEN`,
  `RESTORMEL_NPM_INSIGHTS_PACKAGE`, `RESTORMEL_NPM_INSIGHTS_GITHUB_REPO`,
  `RESTORMEL_GRAPH_STATS_CACHE_TTL_MS`, `RESTORMEL_DASHBOARD_VERSION`,
  `RESTORMEL_DOCS_AGENT_PROMPTS`
- **Drop on Coolify:** `VERCEL_ENV` (audit per §4.1)
- **New for Stage 2:** `DEPLOY_TARGET=node`, `CONNECT_INGEST_INLINE_DRAIN=0` (dashboard
  container only, §6), `CONNECT_INGEST_WORKER_INTERVAL_MS` (worker)

The runbook already flags it: the Vercel MCP cannot read env **values** — the owner runs
`vercel env pull` (or pastes from the Vercel UI) once, into Coolify. Coolify stores env
per-application; restrict Coolify dashboard access (it is already firewalled to SSH-tunnel
only).

### 4.5 Domains/TLS

restormel.dev was purchased at Vercel; **DNS stays on Vercel's nameservers throughout** —
only records change. Today the apex resolves to Vercel's anycast A record. Cutover = replace
apex A with the prod box IP (+ `www` CNAME/redirect). TLS on the box is Coolify/Traefik
Let's Encrypt HTTP-01 (proven in the pilot, needs 80 open — it is). `staging.restormel.dev`
is additive (new A record, TTL 300) and risks nothing. Negative-DNS-cache gotcha from the
runbook applies: don't query staging.restormel.dev before the record exists.

Optional: put Cloudflare (free) in front for CDN/static caching + DDoS at cutover time —
the only edge-cache loss vs Vercel is `_app/immutable/*` assets (84–92ms from Vercel edge
today; ~30–40ms from fsn1 uncached — fine, but Cloudflare would win it back). Owner decision
D3; not required for cutover.

### 4.6 The `/keys/v1/catalog` contract

`RESTORMEL_KEYS_CATALOG_URL` consumed by allotmentology.tech points at
`apps/dashboard/src/routes/keys/v1/catalog/+server.ts` — a route in this same app. It moves
with the app automatically; it doubles as the container **healthcheck** endpoint. No DNS or
contract change until the gated cutover, exactly as the Stage 1 notes require.

## 5. Preview deployments — decision

Vercel preview deploys are load-bearing for PR review today. Options:

| Option | How | Cost/effort | Verdict |
|---|---|---|---|
| **A. Keep Vercel for previews only (recommended)** | GitHub stays the PR remote (it already is — `gh` flow, mirror to Forgejo). After cutover, remove the prod domain from the Vercel project; preview URLs keep building per-PR exactly as now. `DEPLOY_TARGET` defaults to adapter-vercel so preview builds are untouched. | £0, zero work | **Do this.** Decouples the preview question from the hosting cutover entirely. |
| B. Coolify PR previews | Coolify supports preview deployments per-PR; first-class for GitHub-App sources, weaker for Forgejo-webhook sources. Each preview builds *on the box* (RAM contention with prod unless previews target the shared box). | medium | Revisit only when/if GitHub is decommissioned (infra plan Stage 6) — then previews move to Coolify off Forgejo PRs, deployed to the **shared** box, not prod. |
| C. No previews | — | — | Rejected; PR review quality regresses. |

Recommendation: **A now, B later if Stage 6 happens.** Note the latency PR's lhr1 pin means
previews even stay representative for DB latency.

## 6. F9 / durable runs — what the dedicated worker buys, and the design

### What permanently improves

- **F9 dead:** ingest LLM orchestration never again executes inside the process serving the
  operator's status polls (measured today: a run makes the console laggy *because* `waitUntil`
  runs the drain in `1.func`, the exact function being polled). On Coolify it's a separate
  OS process; the dashboard's event loop never parses a multi-MB LLM response.
- **No 300s ceiling:** the drain route's `maxDuration: 300` (Hobby fluid max) disappears.
  Long ingest runs stop being sliced into 5-minute cron windows with lease handoffs; a run
  executes start-to-finish in one claim, and `KNOWLEDGE_INGEST_MAX_CHUNKS` can rise from its
  cost-guard default when the owner wants bigger sources.
- **Durable-runs semantics get simpler and stronger:** the lease/heartbeat machinery (PR
  #229) stops being a workaround for instance recycling and becomes what it should be —
  crash insurance. Heartbeats come from a process that lives for days; "reclaimed after
  stall" becomes a rare real-failure signal instead of an artifact of serverless suspension.
  `vercelWaitUntil` becomes dead code on prod (already a documented no-op off Vercel).
- **Run-start latency improves:** today a run waits up to 5 min for the cron unless the
  post-POST inline drain wins; the worker polls every few seconds.
- **Unblocks roadmap items gated on the platform:** the dashboard-world-class roadmap's SSE
  STOP gate ("if the deployment platform cannot hold SSE connections for 10-minute runs…")
  clears — a long-lived Node process holds SSE trivially. F8's endgame (log streaming)
  becomes implementable.

### Design (small code change, one agent run)

1. **Daemon entry** `apps/dashboard/scripts/connect-ingest-worker-daemon.ts`: loop forever —
   `drainConnectIngestQueue({ maxJobs })` → sleep `CONNECT_INGEST_WORKER_INTERVAL_MS`
   (default ~5,000ms ± jitter) → repeat. Graceful `SIGTERM`: stop claiming, let the current
   job's stage finish or let the lease expire (reclaim already surfaces "restartable failure"
   in the run console — never silent). Reuses `load-dashboard-env.mjs` like the existing
   one-shot script.
2. **Gate the inline drain:** `scheduleConnectIngestWorkerDrain()` (called after job POST)
   gets an env switch — `CONNECT_INGEST_INLINE_DRAIN=0` makes it a no-op. Set `0` on the
   dashboard container (worker owns execution), leave default `1` everywhere else (dev,
   Vercel previews keep today's behavior). Without this, F9 would *migrate* to the box: the
   dashboard process would happily run the drain on its own event loop.
3. **Deployment:** second Coolify application, same image/build, different start command;
   restart policy `always`; healthcheck = process liveness (plus the §4.3 scheduled-task
   backstop). `CONNECT_INGEST_WORKER_MODE` resolves `full` automatically when a graph store
   is connected (existing behavior, `docs/runbooks/connect-ingest-hosted-worker.md`).
4. **Safety during dual-run:** Vercel's cron drain and the box worker may both run for a
   window — lease-based claiming (`claimConnectIngestJob` honoring expiry) makes concurrent
   drainers safe; this is already the tested PR #229 semantics.

## 7. Migration stages

Each stage is one agent run or one human session. **OWNER-ACTION** = only the product owner
can do it (accounts, DNS, secrets). Stage 1 (Forgejo git+CI) is done and not repeated here.

### Stage 2.0 — Provision (OWNER-ACTION, ~1 session)
- Create Hetzner Cloud server: CX33, Ubuntu 24.04, **fsn1 or nbg1**, new SSH key
  (runbook §0.0 recipe), Cloud Firewall inbound 22/80/443 only.
- Run the §0.1 host-hardening script (deploy user, key-only SSH, ufw, fail2ban, Docker).
- In the existing Coolify (SSH tunnel to shared box): **Servers → add remote server** with
  the new box's IP + deploy key; validate.
- DNS (Vercel dashboard): add `staging.restormel.dev` A → new box IP, TTL 300.
- `npm i -g vercel && vercel env pull` (or copy from Vercel UI) → hold the env list from
  §4.4 ready to paste. Generate a fresh `CRON_SECRET` for the box (don't reuse Vercel's).
- **Gate:** Coolify shows the remote server healthy; `dig staging.restormel.dev` resolves.

### Stage 2.1 — Adapter + image readiness (agent run, zero prod risk)
- Env-selected adapter in `apps/dashboard/svelte.config.js` (`DEPLOY_TARGET=node` →
  adapter-node; default unchanged = adapter-vercel, so Vercel prod/preview builds are
  byte-identical).
- `Dockerfile.dashboard`: bump to `node:22-alpine`, `ENV NODE_ENV=production`, document
  `ORIGIN`/`BODY_SIZE_LIMIT`, healthcheck on `/keys/v1/catalog`.
- Audit the 3 `VERCEL_ENV` call sites (§4.1).
- **Gate:** `pnpm --filter dashboard check` + vitest green under both adapter selections;
  `docker build -f Dockerfile.dashboard .` succeeds locally; container boots and serves
  `/keys/v1/catalog` against a dev `DATABASE_URL`.

### Stage 2.2 — Worker daemon + inline-drain gate (agent run, zero prod risk)
- Implement §6 items 1–2 with unit tests (SIGTERM path, env gate, jitter bounds).
- `package.json` script `connect-ingest-worker:daemon`.
- **Gate:** suite green; daemon processes a stub job locally and exits cleanly on SIGTERM.

### Stage 2.3 — Staging deploy (OWNER-ACTION + agent verify, ~1 session)
- Coolify: new application from the **Forgejo** repo (`Allotment-Technology-Ltd/restormel-keys`),
  Dockerfile build pack → `Dockerfile.dashboard`, target server = prod box, domain
  `https://staging.restormel.dev`, paste env (+ `DEPLOY_TARGET=node`,
  `CONNECT_INGEST_INLINE_DRAIN=0`). Second application: same image, daemon command (§6.3).
  Staging DB: point at the Forgejo-environment Neon branch/DB already used by CI
  (`FORGEJO_DATABASE_URL`) — **not prod** — or a fresh Neon branch.
- OWNER-ACTION: add `https://staging.restormel.dev` to Neon Auth trusted origins (the pilot's
  "not yet proven" item — prove interactive sign-in here).
- Verify (agent or owner): sign-in round-trip; `/keys/v1/catalog` 200; create an ingest job →
  watch the **worker** container logs claim and complete it; confirm dashboard container logs
  show no drain activity; kill -9 the worker mid-run → run console shows "reclaimed after
  stall" and restart works.
- **Gate:** all of the above + `curl -w` TTFB on staging beats Vercel's warm numbers and has
  no 2s cold-start signature after 30 min idle.

### Stage 2.4 — Forgejo CI deploy pipeline (agent run)
- `.forgejo/workflows/deploy-dashboard.yml`: on push to `main` (path-filtered to
  dashboard-relevant paths) — build `Dockerfile.dashboard` on the `docker` runner, tag
  `git.allotmentology.tech/allotment-technology-ltd/restormel-keys/dashboard:<sha>` + `:latest`,
  push to the **Forgejo container registry**, then `curl` the **Coolify deploy webhook/API**
  (`COOLIFY_TOKEN` as org-level Forgejo secret — same pattern as `NPM_TOKEN`) for staging.
  Coolify applications switch source from "build from repo" to "docker image" at this point
  (keeps the prod box from ever building).
- Prod deploy = same workflow, manual `workflow_dispatch` (or tag `dashboard-v*`) until
  trust is earned; never auto-deploy prod from day one.
- OWNER-ACTION (5 min): mint the Coolify API token; `PUT` it as org secret.
- **Gate:** a `main` push produces a fresh staging deploy with the new image SHA visible at
  `/keys/dashboard` (the existing deploy-marker pattern), with no human step.

### Stage 2.5 — Production cutover (OWNER-ACTION — see §8 for the full plan)
- Bake on staging ≥1 week (per the latency PR's "re-measure for a week" cadence).
- Pre-step (≥24h before): lower restormel.dev apex/`www` record TTLs to 300.
- Create the prod Coolify applications (dashboard + worker) with **prod env** + prod
  `DATABASE_URL`, domain `restormel.dev`, deploy, verify on the box via `curl --resolve`.
- OWNER-ACTION: add `https://restormel.dev` … it is already a Neon Auth trusted origin
  (current prod) — verify, don't assume. Update Paddle webhook URL only if it ever pointed at
  a vercel.app host (it points at restormel.dev → no change). Flip apex A record → box IP.
- Remove the Vercel **cron** (vercel.json) in the next merged PR after cutover — until then
  dual drainers are safe (§6.4).
- **Gate/kill criteria:** §8.

### Stage 2.6 — Post-cutover hardening (agent run + 1 owner action)
- Vercel project → previews-only: owner removes restormel.dev domains from the Vercel
  project (previews keep their vercel.app URLs); repo PR deletes `apps/dashboard/vercel.json`
  crons block and updates `docs/runbooks/` + master index.
- Uptime monitoring on `https://restormel.dev/keys/v1/catalog` (external — e.g. an
  UptimeRobot-class free check, OWNER-ACTION, 10 min) + Coolify healthcheck alerts.
- Hetzner snapshot schedule for the box (config only — the box is **stateless**; all state
  is Neon + Coolify config on the shared box).
- `DASHBOARD_PERF_LOG=1` for one week; record before/after `curl -w` table next to the
  latency task force doc.

### Stage 3+ (separate decisions, listed for completeness)
- SSE run-log streaming (roadmap W3.1 — STOP gate now clears).
- Zuplo gateway hosting decision.
- Neon region revisit (only if perf logs demand, §3).
- Coolify PR previews from Forgejo if/when GitHub is decommissioned (§5).

## 8. Cutover + rollback plan

**Dual-running is safe by construction:** both stacks are stateless against the same Neon
Postgres/Auth; ingest claiming is lease-based; in-memory caches/rate-limits are per-process
and short-TTL. The only double-execution surface during the window is the drain
(cron + worker), which is designed for concurrency (§6.4).

| Phase | State | Duration |
|---|---|---|
| T−7d | Staging baked, CI deploy pipeline green | ≥1 week |
| T−24h | Apex/`www` TTL → 300s (DNS at Vercel, records only) | 24h |
| T0 | Flip apex A → box IP. Vercel deployment **stays live and reachable** via its vercel.app URL | — |
| T0 → T+72h | **Dual-run window.** Both serve identically; traffic drains to the box as DNS propagates. Watch: Coolify logs, Neon Auth sign-ins, Paddle webhook deliveries, catalog consumer (allotmentology.tech), run console E2E | 72h |
| T+72h | Declare success → Stage 2.6 (previews-only Vercel, remove cron) | — |

**What stays on Vercel during transition:** everything — the project, prod deployment, env,
cron, and previews remain untouched until T+72h. Rollback is **one DNS record revert**
(≤5 min at TTL 300) to a deployment that never stopped working.

**Kill criteria (any one → revert the A record, file findings, re-attempt later):**
- Sign-in success rate degrades (Neon Auth origin/cookie issues on the new host);
- `/keys/v1/catalog` non-200s observed by the allotmentology.tech consumer;
- Paddle webhook delivery failures (signature/origin);
- p50 warm TTFB on the box worse than the Vercel baseline measured in the latency doc
  (§1.2: ~290–460ms warm SSR) for >1h, or any recurring cold-start-like multi-second stalls;
- Let's Encrypt issuance failure leaving the apex without a valid cert;
- An ingest run corrupts state in a way staging didn't show (worker bug class).

**Post-rollback posture:** Vercel cron still present (never removed before T+72h) → ingest
keeps draining; box keeps running staging; nothing to un-build.

## 9. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Single box, no HA (Vercel's multi-instance → one server) | Med | Stateless box; Hetzner snapshot + runbook rebuild ≈ 1h; Vercel stays deployable indefinitely as DR (previews-only project still builds prod-shaped artifacts); uptime alerting (2.6) |
| Worker and dashboard share one host's CPU/RAM (F9's little sibling) | Low–Med | Separate processes/cgroups — set Coolify memory limits (worker 2GB, dashboard 1.5GB); CX43 upgrade path is a resize, not a migration |
| Docker publishes ports past ufw | Med | Hetzner **Cloud Firewall** (outside the VM) is the enforcement layer — pilot-verified (runbook §0.0); never rely on ufw alone |
| Secrets live in Coolify UI/API | Med | Coolify port 8000 firewalled (SSH tunnel only); API token scoped + stored as Forgejo org secret; rotate `CRON_SECRET` at cutover |
| Neon Auth origin/cookie behavior differs on new host | Med | Proven on staging first (Stage 2.3 — the pilot explicitly left interactive sign-in unproven; we gate on it) |
| LE cert issuance race at cutover (HTTP-01 needs the DNS already flipped) | Low | Pre-issue staging cert proves the path; at T0, Traefik retries; rollback ≤5 min if it sticks |
| +10–17ms/RTT to Neon from fsn1 vs lhr1 | Low | Chattiness already fixed (PR #259); measured budget §3; Neon relocation documented as a later option |
| CI-built image drift vs Vercel build (two build paths while previews stay on Vercel) | Low | Same `pnpm --filter dashboard build`; deploy-marker SHA check (2.4 gate); `DEPLOY_TARGET` keeps configs side-by-side in one file |
| Forgejo/registry on the shared box becomes a deploy SPOF | Low | Prod keeps running regardless; GitHub mirror remains a full git fallback (Stage 1 guarantee); worst case is "can't deploy for an hour" |
| Loss of Vercel edge cache for static assets | Low | ~30–40ms asset TTFB from fsn1 acceptable; Cloudflare-in-front is a reversible add-on (D3) |
| `@sveltejs/adapter-node` behavioral deltas (ORIGIN, body limits, route `config` ignored) | Low | Stage 2.1 gates: dual-adapter check + container boot test; staging bake |

## 10. Decisions the owner must make

| # | Decision | Recommendation |
|---|---|---|
| D1 | **Dedicated prod box (CX33, ~€8.6/mo) vs reuse the shared control-plane box (€0)** | Dedicated. Keeps CI builds/Forgejo restarts out of the product's blast radius for the price of two coffees |
| D2 | **Region: Hetzner fsn1/nbg1 (EU, pattern reuse) vs a UK provider (data locality, ~2× cost)** | fsn1/nbg1 unless a customer/compliance commitment requires UK soil — decide *before* Stage 2.0 |
| D3 | **Cloudflare (free) in front of restormel.dev at cutover** | Not required; defer. Revisit if asset latency or DDoS exposure matters post-cutover |
| D4 | **Previews: keep Vercel previews-only (free) vs invest in Coolify PR previews now** | Keep Vercel previews (§5 option A) |
| D5 | **Cutover gate: bake duration + the calendar date for T0** | ≥1 week staging bake; owner picks T0 |
| D6 | **Vercel afterlife: previews-only indefinitely vs full decommission later** | Previews-only indefinitely (it is also the DR story); revisit at infra Stage 6 |
| D7 | **Neon stays eu-west-2** | Yes — zero data move; revisit only on perf-log evidence |
| D8 | **Prod deploy trigger: manual dispatch/tag vs auto-deploy on main** | Manual (`workflow_dispatch` or `dashboard-v*` tag) until several clean cycles, then reconsider |

Out of scope, flagged for their own plans: Zuplo gateway hosting; `@restormel/*` publishing
(already decided: stays on public npmjs); SOPHIA migration (next product in the infra
sequence).
