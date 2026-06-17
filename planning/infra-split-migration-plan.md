---
id: REC-PLAN-012
title: "Hetzner Infrastructure Split + Migration — Agent Execution Plan"
class: planning
owner: founder
status: ready-for-execution
classification: internal
control-tier: 1
created: 2026-06-15
last-reviewed: 2026-06-16
review-interval: P3M
related: [REC-PLAN-011, REC-ADR-005, REC-ADR-006]
---

# Hetzner Infrastructure Split + Migration — Agent Execution Plan

**Status: ready for execution — target 2026-06-16.** Agent-led: Claude prepares + migrates, with the
owner's credentials/sign-offs at the marked **GATES**. Splits today's single-box "everything" topology
into a **prod-runtime plane** and a **build/ops plane** over a **private network**, provisions **Ory
Hydra** correctly, and stays cheap + EU-sovereign. Prerequisite for the verifying-proxy remote go-live
(REC-PLAN-011, D1 = Ory Hydra).

**Locked decisions (2026-06-16):**
- **Existing infra only — €0 new spend** (two CX33s + a BX11 Storage Box already exist).
- **Option 1 placement:** the live product gets `.167` **to itself**; **SurrealDB moves to `.150`**
  alongside the build/ops plane (Surreal is lower-criticality than the live product).
- **Private network** (`restormel-internal`, `eu-central`, `10.10.0.0/16`) for all inter-box traffic.

## Why (context)

Everything runs on **one 8 GB box** (`77.42.125.150`): Forgejo + CI runner, Coolify, the prod dashboard,
Postgres, monitoring. CI is the **noisy neighbour** (Docker builds spike RAM/CPU/disk → OOM + disk-full
incidents that crashed Forgejo's Postgres). One **blast radius**. The 2026-06-15 prod deploy failed
because the CI runner's job container couldn't reach the Coolify localhost-bridge (`10.0.1.1:8000`) — a
private network removes that whole class of problem. Hydra must not land on this shared box.

## Available infrastructure (use this — do NOT provision new compute)

| Resource | Spec | Location | Role |
|---|---|---|---|
| `77.42.125.150` (`deploy@`) | **CX33** — 4 vCPU / 8 GB / 80 GB x86 shared | Helsinki | **Box B — build/ops** (+ SurrealDB) |
| `77.42.124.167` | **CX33** — 4 vCPU / 8 GB / 80 GB x86 shared (**currently hosts SurrealDB**) | Helsinki | **Box A — prod runtime** (after Surreal leaves) |
| `u613941.your-storagebox.de` | **BX11** — 1 TB Storage Box | Falkenstein | Backups |

No Ampere/ARM (CAX) availability; **x86 CX33 + swap** is the agreed posture. Upgrade path if Box B's CI
ever needs 16 GB: **CX43 (x86)**, in place — not now.

## Target topology (Option 1)

| | **Box A — `.167` Prod runtime (alone)** | **Box B — `.150` Build/ops** | private net |
|---|---|---|---|
| Runs | dashboard, worker, **app Postgres**, **Hydra + its DB** | Forgejo, CI runner, **Coolify** (deploys → A over the private net), monitoring, **SurrealDB** (migrated from `.167`) | `restormel-internal` |
| Why | the live product gets a clean, well-resourced box; CI noise fully off it | the bursty/noisy plane; risk concentrated on the non-prod box | inter-box traffic private |

**Principle:** the live product is alone; CI (bursty, OOM-prone) is the workload kept away from it;
SurrealDB (lower-criticality) shares the noisy box. Coolify deploys A from B over the private network.

## Private network

- **Create:** Name `restormel-internal`, Network Zone **`eu-central`** (Helsinki), IP range
  **`10.10.0.0/16`**, subnet **`10.10.1.0/24`**. Range chosen to avoid Coolify's `10.0.1.x` docker
  bridge and the `172.16–31` docker default.
  - **⚠️ Implemented (2026-06-17) as `172.16.0.0/16`** (`.150 → 172.16.0.2`, `.167 → 172.16.0.3`),
    not the proposed `10.10.0.0/16`. Verified clear of docker's address pool on both boxes (docker
    allocates upward from `172.17`); inter-box reachability confirmed. The operational rollback
    runbook (REC-PLAN-015) and asset-inventory use the implemented `172.16.x` addresses.
- **Attach** both servers (e.g. `.150 → 10.10.1.2`, `.167 → 10.10.1.3`).
- **Uses:** Coolify (`.150`) → manage/deploy `.167` privately; dashboard (`.167`) → SurrealDB (`.150`)
  privately; SSH/management private-only.
- **Then harden public firewall:** drop public SSH (port 22) entirely once private SSH works; keep
  public only 80 (ACME) + 443 (services). Retires the "SSH only from `.150`" rule and the key-access
  friction.
- Free; no egress cost intra-zone.

## Cost
**€0 new monthly spend.** Existing boxes + BX11 + a free private network. Only lever pulled is **swap**
(disk-backed cushion so the 8 GB boxes don't OOM — the prior failure mode).

## GATES — what I need from you (have ready at session start)

- **G1 — Access to `.167`.** It currently rejects my key (Coolify-managed; SSH only from `.150`). Either
  add my pubkey `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAzfrnIlHhncDz9FBaC3CeJNJ8c9rgq9/6lqom+eOWLn`
  to `.167`'s `authorized_keys`, or I drive `.167` via Coolify. The **private network** makes this clean
  going forward.
- **G2 — Hetzner Console/API** to create the private network + attach servers (+ optional snapshots).
  Console is a few clicks; an API token lets me do it.
- **G3 — DNS control** — `auth.restormel.dev` (Hydra); repoint the dashboard host to `.167`; repoint
  `surreal.restormel.dev` to `.150` after the Surreal move. Provider API token, or you make records on cue.
- **G4 — Coolify admin + `COOLIFY_TOKEN` fix** (2026-06-15's deploy failed on it).
- **G5 — Hydra decisions** (REC-PLAN-011): token→workspace mapping = **DB lookup (recommended)**; OAuth
  client policy (pre-registered vs dynamic/CIMD).
- **G6 — App-DB source of truth** vs [[database-strategy]]: migrate Neon → `.167` Postgres now, or fresh
  + dump/restore. Plan assumes **self-hosting the app DB on `.167`**.

## Execution phases (each: **do → verify → rollback**)

### Phase 0 — Pre-flight & safety net
- Confirm G1–G6. Resolve `.167` access. **Measure SurrealDB's footprint** (RAM/disk) to size its move
  onto `.150`.
- **Back up everything first:** SurrealDB export; `pg_dump` app DB (Neon/current) + Forgejo DB; export
  Coolify config; record Box B inventory; verify BX11 is writable.
- **Verify:** test-restore the app dump + a Surreal export into scratch. **Rollback:** n/a (read-only).

### Phase 1 — Private network + swap
- Create `restormel-internal` (`10.10.0.0/16`, `eu-central`); attach `.150` + `.167`; confirm they ping
  over `10.10.1.x`.
- **Add swap** to both boxes (e.g. 8 GB swapfile, `vm.swappiness=10`).
- **Verify:** private ping both ways; `free -h` shows swap. **Rollback:** detach network (non-destructive).

### Phase 2 — Migrate SurrealDB `.167 → .150`
- Stand up SurrealDB on `.150` (per the self-host runbook); import the export; repoint
  `surreal.restormel.dev` → `.150` (and prefer the **private IP** for our own dashboard's connection).
- **Verify:** graph queries succeed against `.150`; our dashboard's BYO-Surreal connection works
  (incl. the `wss://` path once the app is deployed). **Rollback:** repoint DNS back to `.167` (Surreal
  there untouched until cutover confirmed). **`.167` is now free for prod.**

### Phase 3 — Prepare `.167` as prod box + Coolify destination
- Harden `.167` (key-only SSH, UFW, fail2ban, disk-prune cron); add as a **Coolify destination server**
  reachable over the private net.
- **Verify:** Coolify shows `.167` healthy over `10.10.1.x`. **Rollback:** remove from Coolify (no prod
  data yet).

### Phase 4 — App Postgres on `.167`
- Deploy Postgres on `.167`; create `app` + `hydra` databases; restore app data per G6; run dashboard
  migrations from scratch (incl. **069**); nightly `pg_dump` → BX11.
- **Verify:** schema present, row counts match, backup lands on BX11. **Rollback:** drop DBs; keep
  Neon/current authoritative until cutover.

### Phase 5 — Cut dashboard + worker over to `.167`
- Coolify: destination = `.167`; `DATABASE_URL` → `.167` Postgres (`coolify-env-cutover` skill);
  Surreal connection → `.150` over the private net. Deploy from latest `main` — **ships the wss:// fix +
  all of 2026-06-15's work**. Lower DNS TTL; repoint the dashboard host to `.167` (mind the 127.0.0.1
  healthcheck gotcha).
- **Verify:** dashboard live on `.167`; `/keys/dashboard/sources` **saves a `wss://` endpoint** (closes
  the open bug); worker processing; writes on `.167` Postgres. **Rollback:** DNS + `DATABASE_URL` back to
  `.150` (old deployment retained).

### Phase 6 — Hydra on `.167`
- Deploy Ory Hydra against the `hydra` DB; public `auth.restormel.dev` (TLS via Coolify proxy), admin
  internal-only over the private net. Set dashboard `ORY_HYDRA_*` env; keep
  `RESTORMEL_VERIFYING_PROXY_REMOTE` = **OFF**.
- **Verify:** Hydra healthy; JWKS reachable; a test token validates via `verifyAccessToken`. **Rollback:**
  remove Hydra (no dependents; flag OFF).

### Phase 7 — Finalise `.150` as build/ops, harden, fix deploy path
- Remove the migrated dashboard/worker/app-DB from `.150`; keep Forgejo + runner + Coolify + monitoring +
  SurrealDB. Repair `deploy-dashboard.yml` to deploy `.167` over the **private net** (drop the
  `10.0.1.1` bridge). **Drop public SSH** on both boxes once private SSH is proven.
- **Verify:** a heavy CI build no longer touches prod; deploy-to-`.167` works privately. **Rollback:**
  keep old containers until proven.

### Phase 8 — Resilience verification
- Run a heavy CI build on `.150`; confirm `.167` unaffected. DB restore drill from BX11. Confirm
  monitoring (`.150` + external dead-man's-switch) watches `.167`.

## CI capacity (build parallelism)

The build/ops box currently runs a **single-task Forgejo runner**, so CI serialises — and the new
full-build merge gate (the dashboard `vite build` needs a ~4 GB Node heap) makes the queue the long
pole. Folded into this migration because **the split itself frees the capacity**: once the dashboard
+ Postgres + Hydra move to `.167`, Box B (`.150`) is dedicated to build/ops and can give CI real
headroom.

- **Raise runner concurrency** (act_runner `capacity`) from 1 → ~2-3, **bounded by RAM**: the
  dashboard build alone wants ~4 GB heap, so on an 8 GB box keep heavy builds to ~1-2 concurrent
  (lighter jobs — tests, security, migrations — run alongside). Swap is the cushion, not the answer.
- **Escape hatch** if CI is still the bottleneck: upgrade Box B to **CX43 (16 GB)** (already the
  documented upgrade path) and/or add a second / ephemeral runner. Never run CI on the prod-runtime box.
- *Verify:* a PR's jobs run in parallel without OOMing the build; the full-build gate stays green under load.

## Risks
- **SurrealDB migration** (Phase 2) — it's a live BYO-graph dependency; export/import + verify before the
  DNS repoint; keep `.167`'s copy until confirmed.
- **App-DB / Neon cutover** — coordinate with [[database-strategy]]; verify before DNS cutover.
- **`.150` density** — CI + Forgejo + Coolify + SurrealDB on 8 GB + swap; watch memory in Phase 8; CX43 is
  the escape hatch.
- **DNS propagation** — low TTL first; keep old sources warm.
- **Hydra misconfig** — validate JWKS/issuer before any dependent; flag stays OFF.

## Out of scope (separate, gated)
- Verifying-proxy **remote go-live** (live `/mcp` route + flag flip) — REC-PLAN-011; needs Hydra up +
  a high-risk-security review.
- The wss fix can ship **independently** via a one-click Coolify UI deploy before this migration.

## Immediate next action (start of session)
Confirm **G1–G6**; create the **private network**; run **Phase 0** (resolve `.167` access, measure Surreal,
full backups to BX11). Fastest parallel unblock for the live wss bug: one-click Coolify UI deploy of the
dashboard from latest `main`.
