# Sophia — Hetzner/Coolify migration plan (PoC)

**Date:** 2026-06-12 · **Status:** proposed, awaiting owner decisions (§8)
**Builds on:** `docs/infra/coolify-migration-plan-2026-06.md` (Restormel Stage 2 — the proven
adapter-node + worker + DNS-flip pattern this plan reuses) and `docs/infra/suite-server-sizing.md`
(decision: all four products on one **CAX31** all-in-one box).
**Cross-ref:** `docs/restormel/SUITE-ARCHITECTURE-MIGRATION.md` (Sophia = reference consumer),
`docs/restormel/SOPHIA-CONNECT-INGEST-CUTOVER.md` (the *app-level* ingest cutover, separate
from this *infra* move).

> **One-paragraph summary:** move the Sophia showcase app (Stoa SSE dialogue, Learn, Paddle
> billing, philosophy corpus) and its ingest poller/workers from their current GCP/Railway
> hosting onto the shared Coolify box, as `adapter-node` containers. All durable state stays
> where it is — Firestore (conversation docs), Neon (Postgres/Auth, `sophia_documents` +
> Knowledge job tables), BYO SurrealDB (graph), Paddle (billing). This is a hosting move, not
> a data move: cutover is a DNS flip with the same dual-run safety as the Restormel plan §8.
> It is **independent of** the `@restormel/connect-core` ingest cutover (that can happen
> before or after; see §6).

---

## 1. Target architecture

```
                     sophia.<domain> (DNS A record → all-in-one box)
                     staging.sophia.<domain> (separate Coolify app)
                                      │
                                      ▼
  ┌─ Hetzner CAX31 “suite all-in-one” (ARM, fsn1/nbg1) ──────────────────────────────────┐
  │  Coolify-managed Traefik · Let's Encrypt TLS · Hetzner Cloud Firewall 22/80/443       │
  │                                                                                       │
  │   [sophia-app]   SvelteKit adapter-node — Stoa dialogue (SSE), Learn, marketing,      │
  │                  Paddle checkout/webhooks. Long-lived process: SSE holds trivially.   │
  │                                                                                       │
  │   [sophia-worker] ingestion-job-poller + stage workers (replaces GCP/Railway).        │
  │                  Claims jobs, runs corpus ingest, writes graph. No platform timeout.  │
  │                                                                                       │
  │   (+ Restormel web/worker, plotbudget, allotmentology, Coolify, Forgejo, CI — §sizing)│
  └───────────────┬───────────────────┬───────────────────┬──────────────────────────────┘
                  │ Postgres/Auth      │ conversation docs │ graph read/write
                  ▼                    ▼                   ▼
            Neon (managed)       Firestore (managed)   BYO SurrealDB (workspace-scoped)
            eu-west-2            — unchanged            — unchanged
            — unchanged                                 Paddle (billing) — unchanged
```

**Shape:** same one-image/adapter-node pattern as Restormel. Sophia is the **heaviest** of the
four products (sustained SSE + corpus ingest), so its two containers carry the largest memory
limits on the shared box (§sizing §4: worker `2048m`, web `1536m`).

---

## 2. Why Coolify fits Sophia specifically

- **SSE dialogue wants a long-lived process.** Stoa streams model output; a serverless/edge
  host fights this the same way Vercel fought Restormel's ingest drain (F9). A persistent Node
  process on Coolify holds SSE connections for the length of a dialogue with no special work —
  the same win the Restormel plan §6 documents for ingest.
- **Ingest workers want no platform timeout.** The `ingestion-job-poller` + stage workers
  currently lean on GCP/Railway long-run scripts. On Coolify they are a `restart: always`
  worker container with lease/heartbeat claiming — identical to the Restormel ingest-worker
  design (`deploy/docker-compose.coolify.yml`), so the operational pattern is already proven.
- **State is already external.** Nothing Sophia must keep lives on the host — Firestore, Neon,
  Surreal, Paddle are all managed/BYO. The box is stateless for Sophia exactly as for Restormel.

---

## 3. What the app needs — inventory

> Paths/env below are from suite docs, not a Sophia-repo inspection (the `sophia` repo is not
> in this workspace). **Confirm each against `Allotment-Technology-Ltd/sophia` before Stage S2.**

### 3.1 Adapter
Sophia is SvelteKit. Apply the same env-selected adapter swap as Restormel §4.1
(`DEPLOY_TARGET=node` → `adapter-node`; keep the existing adapter as default so current
hosting/previews are byte-identical during transition). Set `ORIGIN`, `HOST=0.0.0.0`, `PORT`,
`BODY_SIZE_LIMIT` (corpus/source POSTs can be large), `NODE_ENV=production`.

### 3.2 Workers
Promote the `ingestion-job-poller` (and GCP/Railway stage scripts) to a Coolify worker
container — same image, daemon command, `restart: always`, no HTTP port. Mirror Restormel's
worker daemon (`apps/dashboard/scripts/connect-ingest-worker-daemon.ts`) as the reference
shape. Lease-based claiming makes a dead-worker backstop (Coolify Scheduled Task) safe.

### 3.3 State / external services (no migration — verify connectivity only)

| Store | Holds | Action at cutover |
|---|---|---|
| **Firestore** | Conversation/thread docs, `state_events` | None. Verify service-account creds in Coolify env; confirm egress from fsn1/nbg1. |
| **Neon (eu-west-2)** | `sophia_documents` (product state), Knowledge job tables (workspace-scoped) | None. Copy `DATABASE_URL`/`NEON_AUTH_BASE_URL`; add the new origin to Neon Auth trusted origins. |
| **BYO SurrealDB** | Graph (workspace-scoped per Keys `workspace_id`) | None. Confirm endpoint reachable; `RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT` if private. |
| **Paddle** | Billing/subscriptions | None. Update webhook URL **only if** it pointed at a Railway/GCP host; if it points at `sophia.<domain>`, no change. Verify `PADDLE_ENVIRONMENT`. |

### 3.4 Secrets
Same discipline as Restormel (`docs/infra/coolify-env-inventory.md`): names-only reference,
values pasted from the current host's env into Coolify (encrypted at rest, SSH-tunnel-only
access). Boot-blockers to confirm: Neon `DATABASE_URL` + `NEON_AUTH_BASE_URL`, Firestore
credentials, `RESTORMEL_CREDENTIALS_ENCRYPTION_KEY` (must match — re-keying orphans stored
credentials), Keys gateway/workspace vars, Paddle keys, `ORIGIN`/`HOST`/`PORT`/`DEPLOY_TARGET`.

### 3.5 Domains/TLS
New A record → box IP; Traefik Let's Encrypt HTTP-01 (proven on the box). Add
`staging.sophia.<domain>` first (additive, TTL 300). Lower the prod record TTL ≥24h before T0.

---

## 4. Migration stages

Mirrors the Restormel Stage-2 cadence. **OWNER-ACTION** = accounts/DNS/secrets only the owner
can do. Assumes the all-in-one box from `suite-server-sizing.md` already exists (it is the
Restormel prod box; Sophia is added as more Coolify applications on it).

### S0 — Pre-flight (OWNER-ACTION)
- Confirm §3 inventory against the `sophia` repo (env names, worker entrypoints, adapter).
- DNS: add `staging.sophia.<domain>` A → box IP, TTL 300.
- Pull current env from GCP/Railway; hold the names-only list ready; generate a fresh
  `CRON_SECRET`/worker backstop token for the box.
- **Gate:** staging DNS resolves; box has RAM headroom (sizing §3) for two more containers.

### S1 — Adapter + image readiness (agent run, zero prod risk)
- Env-selected `adapter-node` in Sophia's `svelte.config.js`; bump base image to
  `node:22`-class; healthcheck endpoint chosen (a cheap GET that doesn't hit an LLM).
- **Gate:** Sophia `pnpm check` + `pnpm test` green under both adapter selections; container
  builds and boots against a dev DB; SSE dialogue endpoint streams locally.

### S2 — Worker daemon (agent run, zero prod risk)
- Daemon entry for the ingest poller (loop + jitter + SIGTERM), modelled on Restormel's worker.
- **Gate:** daemon claims and completes a stub job locally; exits cleanly on SIGTERM.

### S3 — Staging on the box (OWNER-ACTION + agent verify)
- Coolify: two new applications from the Sophia repo (app + worker), Dockerfile build pack,
  target = all-in-one box, domain `staging.sophia.<domain>`, paste env (`DEPLOY_TARGET=node`,
  sandbox Paddle, staging Neon branch, **memory limits per sizing §4**).
- OWNER-ACTION: add `https://staging.sophia.<domain>` to Neon Auth trusted origins; confirm
  Firestore creds + Surreal endpoint reachable from the box.
- Verify: sign-in round-trip; a Stoa dialogue streams end-to-end; an ingest job runs in the
  **worker** container (not the app); kill -9 the worker mid-run → job is reclaimed.
- **Gate:** all of the above + warm TTFB beats the current host with no cold-start signature;
  Sophia's containers do not push the box past the sizing §3 budget under a concurrent ingest.

### S4 — CI deploy pipeline (agent run)
- Forgejo workflow: build the Sophia image on the runner (or on-box, arm64), push to the
  Forgejo registry, call the Coolify deploy webhook for staging. Prod via manual dispatch/tag.
- **Gate:** a push produces a fresh staging deploy with the new SHA visible, no human step.

### S5 — Production cutover (OWNER-ACTION — see §5)
- Bake on staging ≥1 week. Create prod Coolify apps (prod env, prod Neon, prod Paddle,
  domain `sophia.<domain>`); verify on the box via `curl --resolve`; flip the A record.
- **Gate/kill criteria:** §5.

### S6 — Post-cutover hardening (agent run + owner)
- Decommission GCP/Railway Sophia services once T+72h dual-run is clean.
- Uptime check on a Sophia health URL; Coolify healthcheck alerts; confirm the box's daily
  snapshot now also covers Sophia config (state is external, so config-only).

---

## 5. Cutover + rollback

Same construction as Restormel §8 — both stacks are stateless against the same external
services; ingest claiming is lease-based; cutover is one DNS record.

| Phase | State | Duration |
|---|---|---|
| T−7d | Staging baked, CI deploy green | ≥1 week |
| T−24h | Sophia prod record TTL → 300s | 24h |
| T0 | Flip A → box IP. Old host **stays live** as instant rollback | — |
| T0 → T+72h | Dual-run window. Watch: Neon Auth sign-ins, Stoa SSE health, Paddle webhook deliveries, ingest claim counts, Surreal writes | 72h |
| T+72h | Declare success → S6 (decommission old host) | — |

**Kill criteria (any one → revert the A record):** sign-in success rate drops; Stoa SSE
disconnects/stalls; Paddle webhook signature/delivery failures; ingest run corrupts graph
state staging didn't show; TLS issuance fails; warm TTFB worse than the old host for >1h.

**Rollback:** one DNS revert (≤5 min at TTL 300) to a host that never stopped serving.

---

## 6. Relationship to the connect-ingest cutover

This plan is **infra only** (where Sophia runs). `SOPHIA-CONNECT-INGEST-CUTOVER.md` is
**app-level** (Sophia's ingest moving from `scripts/ingest.ts` to `@restormel/connect-core` /
Connect hosted REST). They are independent and can land in either order:

- **Infra first (this plan), ingest cutover later:** Sophia's existing `scripts/ingest.ts`
  worker simply runs in the Coolify worker container instead of on Railway. Lowest coupling —
  **recommended PoC order.**
- **Ingest cutover first:** Sophia becomes a thin client of Connect REST before moving hosts;
  then the worker container is smaller (poll + POST only).

Either way, keep `CONNECT_INGEST_CUTOVER=0` as the documented rollback for the app-level path.

---

## 7. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Heaviest product on the shared all-in-one box (SSE + ingest) | Med | Coolify memory limits (sizing §4); Sophia is **Step 2** in the scale-out path — peel to its own box first when the box tightens |
| Firestore egress/latency from fsn1/nbg1 | Low–Med | Verify on staging (S3); Firestore is multi-region; conversation writes are small |
| Neon Auth origin/cookie behaviour on new host | Med | Proven on staging before prod (S3), exactly as Restormel gated it |
| Paddle webhook origin/signature after move | Med | Update webhook URL only if host-pinned; verify deliveries during the T+72h window |
| Surreal endpoint reachability/tenancy | Low–Med | Confirm endpoint + `workspace_id` scoping on staging; BYO target unchanged |
| Env/path drift vs assumptions in §3 | Med | S0 confirms the inventory against the real `sophia` repo before any prod step |

---

## 8. Decisions the owner must make

| # | Decision | Recommendation |
|---|---|---|
| SD1 | All-in-one box vs dedicated Sophia box | All-in-one now (sizing S1); peel Sophia out as scale-out Step 2 when needed |
| SD2 | Infra move vs ingest cutover ordering | **Infra first** (§6) — lowest coupling for PoC |
| SD3 | Firestore stays vs finish Firestore→Neon | Firestore **stays** for PoC; Firestore→Neon is its own runbook, not a cutover blocker |
| SD4 | Sophia domain (`sophia.<domain>` apex/subdomain) | Owner picks; staging subdomain proves the path first |
| SD5 | Staging bake duration + T0 | ≥1 week bake; owner picks T0 |

---

## 9. Related documents

| Topic | Document |
|---|---|
| Suite server sizing (all-in-one decision) | `docs/infra/suite-server-sizing.md` |
| Restormel Coolify migration (proven pattern) | `docs/infra/coolify-migration-plan-2026-06.md` |
| Coolify app config (two-container draft) | `deploy/docker-compose.coolify.yml` |
| Sophia connect-ingest cutover (app-level) | `docs/restormel/SOPHIA-CONNECT-INGEST-CUTOVER.md` |
| Suite architecture / Sophia roles | `docs/restormel/SUITE-ARCHITECTURE-MIGRATION.md` |
