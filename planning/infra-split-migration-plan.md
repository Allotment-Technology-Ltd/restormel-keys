---
id: REC-PLAN-012
title: "Hetzner Infrastructure Split + Migration — Agent Execution Plan"
class: planning
owner: founder
status: ready-for-execution
classification: internal
control-tier: 1
created: 2026-06-15
last-reviewed: 2026-06-15
review-interval: P3M
related: [REC-PLAN-011, REC-ADR-005, REC-ADR-006]
---

# Hetzner Infrastructure Split + Migration — Agent Execution Plan

**Status: ready for execution — target 2026-06-16.** Agent-led: Claude provisions + migrates, with the
owner's credentials/sign-offs at the marked **GATES**. Splits today's single-box "everything" topology
into a **prod-runtime plane** and a **build/ops plane**, provisions **Ory Hydra** correctly, and stays
cheap + EU-sovereign. Prerequisite for the verifying-proxy remote go-live ([[overnight-w2-run-2026-06-15]],
REC-PLAN-011, D1 = Ory Hydra).

## Why (context)

Everything runs on **one 8 GB Hetzner box** (`deploy@77.42.125.150`): Forgejo + CI runner, Coolify, the
prod dashboard, Postgres, monitoring. Consequences:
- **CI is the noisy neighbour** — Docker builds spike RAM/CPU/disk; already caused OOM + disk-full
  incidents that crashed Forgejo's Postgres ([[prod-box-disk-guard]]).
- **One blast radius** — a box problem takes down git **and** CI **and** prod **and** DB **and** (soon)
  the IdP together.
- **Evidence (2026-06-15):** the prod deploy failed because the CI runner's job container couldn't reach
  the Coolify localhost-bridge (`10.0.1.1:8000`) — a symptom of the cramped single-box wiring. Coolify
  deploying to a *separate* box over SSH removes that class of bug.
- Putting **Hydra** on this shared box would place auth in the same fragile domain. It must not.

## Target topology

| | **Box A — Prod runtime (NEW)** | **Box B — Build/ops (= current box, repurposed)** | **Box C** |
|---|---|---|---|
| Hosts | dashboard, worker, **app Postgres**, **Hydra + its DB**, allotmentology site | Forgejo, CI runner, **Coolify** (deploys → A over SSH), monitoring | SurrealDB (existing, per the self-host runbook) |
| Rationale | what users + auth depend on, isolated from CI noise | the bursty/noisy plane, off the prod failure domain | graph store; heavy; already separate |
| Size (ARM = cost lever) | Hetzner **CAX21** (4 vCPU / 8 GB) | existing | existing |

**Principle:** split by **blast-radius + noise**. Coolify (Box B) deploys Box A via SSH — the standard
multi-server pattern, and it kills tonight's bridge-deploy bug.

## Bill of materials + cost (CONFIRM live pricing in Phase 0)

- **Box A** — Hetzner CAX21 (ARM, 4 vCPU / 8 GB) ≈ **€8/mo**
- **Backups** — Hetzner Storage Box BX11 ≈ **€4/mo**
- **Box B** — existing, no new spend
- **New monthly delta ≈ €12/mo** (minimum-viable resilience). ARM (CAX) over x86 (CPX) ≈ 40% cheaper;
  the stack is Docker/Linux, ARM-safe. Scale Box A vertically (CAX21→31→41) as users grow before adding
  nodes.

## GATES — what I need from you (have ready at session start)

- **G1 — Hetzner access.** API token (Cloud Console → Security → API Tokens, read+write) so I can
  provision Box A + the Storage Box; *or* you create Box A and hand me SSH.
- **G2 — DNS control.** Add/repoint records: `auth.restormel.dev` (Hydra) and repoint the dashboard host
  to Box A at cutover. Provider API token, or you make records on cue (keep TTL low first).
- **G3 — Coolify admin + token fix.** Confirm I can add a destination server (tunnel works); **fix/confirm
  the `COOLIFY_TOKEN` Forgejo secret** — tonight's prod deploy failed on the CI→Coolify path.
- **G4 — Budget.** Approve ~€12/mo new spend (or pick smaller/larger boxes).
- **G5 — Hydra decisions** (from REC-PLAN-011): token→workspace mapping = **DB lookup (recommended)** vs
  Hydra claim; OAuth client policy = pre-registered vs dynamic registration (CIMD).
- **G6 — App-DB source of truth.** Confirm the app Postgres plan vs [[database-strategy]]
  (docs/infra/database-strategy-roadmap.md): migrate Neon → Box A Postgres now, or stand up fresh +
  dump/restore. This plan assumes **self-hosting the app DB on Box A**, coordinated with that roadmap.

## Execution phases (each: **do → verify → rollback**)

### Phase 0 — Pre-flight & safety net
- Confirm G1–G6; pull live Hetzner pricing; finalise BOM.
- **Back up everything BEFORE touching anything:** `pg_dump` app DB (Neon/current) + Forgejo DB; export
  Coolify config/resources; take a Hetzner snapshot of the current box; record the container/commit
  inventory.
- **Verify:** test-restore the app dump into a scratch DB (row counts match). **Rollback:** n/a (read-only).

### Phase 1 — Provision Box A + harden
- Create CAX21 (Hetzner API), Ubuntu LTS. SSH key-only; UFW (22 from me, 80/443 public, **Postgres NOT
  public**); fail2ban; disk-prune cron backstop ([[security-monitoring-build]], [[prod-box-disk-guard]]).
- Add Box A as a **Coolify destination server** (install Docker via Coolify).
- **Verify:** Coolify shows Box A healthy; firewall correct. **Rollback:** destroy the box (no data yet).

### Phase 2 — App Postgres on Box A
- Deploy Postgres on Box A; create **`app`** + **`hydra`** databases with least-priv roles.
- Restore app data per G6; run dashboard migrations from scratch (incl. **069**).
- Nightly `pg_dump` → Storage Box (cron + retention); test one restore.
- **Verify:** schema present, row counts match the dump, backup lands on the Storage Box. **Rollback:**
  drop DBs; keep Neon/current as source of truth until cutover.

### Phase 3 — Migrate dashboard + worker to Box A (the cutover)
- In Coolify set dashboard + worker destination = Box A; set `DATABASE_URL` → Box A Postgres using the
  **`coolify-env-cutover`** skill (safe change + verify + auto-rollback). Deploy from latest `main` — this
  **ships the wss:// fix + all of tonight's work**.
- Lower DNS TTL first; repoint the dashboard host to Box A; verify health (mind the 127.0.0.1 healthcheck
  gotcha, [[coolify-migration]]).
- **Verify:** dashboard live on Box A; `/keys/dashboard/sources` **saves a `wss://` endpoint** (closes
  tonight's bug); worker processing; writes landing on Box A Postgres. **Rollback:** repoint DNS to the
  old box (old deployment retained); `DATABASE_URL` back.

### Phase 4 — Provision Hydra on Box A
- Deploy Ory Hydra against the `hydra` DB; public at `auth.restormel.dev` (TLS via Coolify proxy), admin
  **internal only**. Configure issuer / JWKS.
- Set dashboard prod env `ORY_HYDRA_ISSUER` / `_JWKS_URI` / `_ADMIN_URL` + audience. Keep
  **`RESTORMEL_VERIFYING_PROXY_REMOTE` = OFF** (remote go-live is a later, security-reviewed step).
- **Verify:** Hydra healthy; JWKS reachable; a test token validates via `verifyAccessToken`. **Rollback:**
  remove Hydra (no dependents; flag stays OFF).

### Phase 5 — Allotmentology site
- Move the small app to Box A (or Box B if headroom there); repoint DNS. **Rollback:** DNS back.

### Phase 6 — Repurpose current box as Box B (build/ops)
- Remove the migrated dashboard/worker/app-DB containers from the old box; keep Forgejo + runner + Coolify
  + monitoring.
- **Fix the deploy path:** Coolify now deploys to Box A over **SSH** — repair `deploy-dashboard.yml`
  accordingly and drop the `10.0.1.1` bridge dependency (root cause of tonight's failure).
- **Verify:** a heavy CI build no longer touches prod; deploy-to-A works. **Rollback:** keep old containers
  until A is proven.

### Phase 7 — Resilience verification
- Run a heavy CI build on Box B; confirm Box A unaffected. Test a DB restore drill. Confirm monitoring
  (Box B + the external dead-man's-switch) watches Box A.

## Risks
- **App-DB migration / Neon cutover** — coordinate with [[database-strategy]]; dump/restore + verify
  **before** DNS cutover; keep the old source warm for rollback.
- **DNS propagation** — lower TTL first; old box stays warm.
- **Hydra misconfig** — validate JWKS/issuer before any dependent goes live; flag stays OFF.
- **Cost creep** — ARM + one new box; review monthly.
- **Coupling with the in-flight database-strategy migration** — confirm sequencing with the owner at G6.

## Out of scope (separate, gated)
- Verifying-proxy **remote go-live** (live `/mcp` route + flag flip) — REC-PLAN-011; needs Hydra up +
  a high-risk-security review.
- SurrealDB (Box C) changes — stays per its runbook.
- Tonight's wss fix can ship **independently** via a one-click Coolify UI deploy before this migration.

## Immediate next action (start of 2026-06-16 session)
Confirm **G1–G6**, then run **Phase 0**. In parallel, fastest unblock for the live wss bug: one-click
Coolify UI deploy of the dashboard from latest `main`.
