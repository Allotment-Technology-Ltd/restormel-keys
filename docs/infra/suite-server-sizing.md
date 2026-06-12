# Suite server sizing — PoC topology for the four products

**Date:** 2026-06-12 · **Status:** decided (product owner, 2026-06-12)
**Scope:** Hetzner + Coolify hosting for **Restormel**, **Sophia**, **plotbudget**, and
**allotmentology** during the proof-of-concept window (≥3 months).
**Builds on:** `docs/infra/coolify-migration-plan-2026-06.md` (Restormel Stage 2) and the
executed Stage 1 self-host migration (Forgejo git+CI on the shared box).

> **One-paragraph summary:** at PoC traffic (a handful of page-views/hour per product),
> the cost-optimal move is **one box for everything** — control plane plus all four product
> runtimes — on a **Hetzner CAX31 (8 vCPU / 16 GB ARM, ~€12.49/mo)**, with Coolify building
> images natively on the box (arm64, no QEMU). All durable state stays in managed services
> (Neon, Firestore, BYO Surreal, Paddle), so the box is near-stateless and resizes/peels
> apart in minutes when any one product outgrows it. This trades blast-radius isolation for
> cost; the guardrails in §4 make that trade safe for PoC.

---

## 1. Decision

| # | Question | Decision | Rationale |
|---|---|---|---|
| S1 | **How many boxes?** | **One** (all-in-one) | At PoC we buy RAM headroom, not throughput. Coolify multiplexes many apps per host; a box-per-product is ~€50+/mo for isolation we don't need yet. |
| S2 | **Which box?** | **CAX31** — 8 vCPU / 16 GB / 160 GB ARM, ~€12.49/mo | Best RAM-per-pound. Node/SvelteKit/Surreal all run on arm64. |
| S3 | **Build strategy** | **Build on the box** (Coolify default) | Native arm64 build — no QEMU, no x86 cross-build pipeline. Removes the only reason the Restormel plan rejected ARM. |
| S4 | **Databases** | **All managed/external, free-tier** | Neon (Postgres/Auth), Firestore (Sophia conversation docs), BYO Surreal (graph), Paddle (billing). The box stays stateless and snapshot-rebuildable. |
| S5 | **Region** | **fsn1 or nbg1** | Same region as the existing shared box; ~10–17 ms to Neon eu-west-2 (see Restormel plan §3). No UK Hetzner DC; revisit only on a data-locality requirement. |

**Total new monthly spend to host all four products: ~€12.49 (≈ £11) + ~€0.50 IPv4.**
Everything else is existing or free-tier.

> **SKU note:** Hetzner's real shared-vCPU lines are **CX22/CX32/CX42/CX52** (Intel),
> **CPX11–51** (AMD), **CAX11/21/31/41** (Ampere ARM). The "CX33/CX43" naming in the
> Restormel plan maps to **CX32/CX42**; **CAX31** is a real SKU. Verify pricing at order time.

---

## 2. What lands on the box

| Layer | Component | Containers | Notes |
|---|---|---|---|
| Control plane | Coolify | 1 | Manages every app below on the same host. |
| Control plane | Forgejo (git + Actions + registry) | 1 (+ db) | Stage 1, already running on the existing shared box — folds onto this box in the all-in-one model. |
| Control plane | act_runner (CI) | 1 | Idle most of the time; spikes 2–4 GB during a build (§4). |
| Edge | Traefik (Coolify-managed) | 1 | Let's Encrypt HTTP-01 TLS for all product domains. |
| **Restormel** | dashboard (SvelteKit adapter-node) | 1 | Per `coolify-migration-plan-2026-06.md` §1. |
| **Restormel** | ingest-worker | 1 | F9 fix — dedicated process; `deploy/docker-compose.coolify.yml`. |
| **Sophia** | app (SvelteKit adapter-node) | 1 | Stoa SSE dialogue + Learn + Paddle. See `sophia-coolify-migration-plan.md`. |
| **Sophia** | ingest poller/worker | 1 | Replaces today's GCP/Railway `ingestion-job-poller`. |
| **allotmentology** | portal/docs | 1 | Consumes `/keys/v1/catalog`. *Footprint assumption — confirm (§5).* |
| **plotbudget** | app | 1 | Consumes Keys/Testing via MCP. *Footprint assumption — confirm (§5).* |

---

## 3. RAM budget (16 GB)

| Component | Steady | Peak |
|---|---|---|
| OS + Docker + Traefik | ~1.0 GB | ~1.0 GB |
| Coolify | ~0.5 GB | ~0.5 GB |
| Forgejo (+ db) | ~0.7 GB | ~0.7 GB |
| act_runner | ~0.1 GB | **+2–4 GB during a build** |
| Restormel web | ~1.0 GB | ~1.0 GB |
| Restormel ingest worker | ~0.3 GB idle | ~2.0 GB (parsing multi-MB LLM responses) |
| Sophia web | ~1.0 GB | ~1.2 GB (concurrent SSE) |
| Sophia ingest/poller | ~0.3 GB idle | ~2.0 GB |
| allotmentology | ~0.4 GB | ~0.6 GB |
| plotbudget | ~0.5 GB | ~1.0 GB |
| **Total** | **~6–7 GB** | **~9 GB (one ingest peak) … ~13 GB (build + both ingest peaks)** |

**Verdict:** 16 GB is adequate with ~3 GB of headroom in the realistic case. The only way to
brush the ceiling is a CI build coinciding with both ingest workers peaking — which the §4
guardrails (memory limits + swap + serialized, manual-dispatch builds) contain. An 8 GB box
would *not* survive that combination, which is why CAX31 (16 GB) is the floor, not CAX21 (8 GB).

---

## 4. Guardrails (what makes one box safe at PoC)

1. **Per-container memory limits in Coolify** (Advanced → Memory limit), so no single
   container can OOM-kill its neighbours:
   - Restormel worker `2048m`, Sophia worker `2048m`
   - Restormel web `1536m`, Sophia web `1536m`
   - plotbudget `1024m`, allotmentology `768m`
2. **4 GB swapfile** on the 160 GB disk — cheap insurance against a transient build+ingest
   collision (swap is a safety valve, not a runtime plan).
3. **Serialized, manual-dispatch deploys.** The Restormel plan already gates prod deploys on
   `workflow_dispatch` (§Stage 2.4 / D8). Keep that for all four; never build all products at
   once, and avoid building during a known ingest window.
4. **Hetzner Cloud Firewall** inbound 22/80/443 only — Docker publishes ports past `ufw`, so
   the Cloud Firewall (outside the VM) is the enforcement layer (Restormel plan §9 / runbook §0.0).
5. **Daily Hetzner snapshot.** The box is near-stateless (all product state is external), so a
   snapshot + rebuild is the entire DR story; runbook-driven rebuild ≈ 1h.
6. **Coolify locked to SSH-tunnel access** (port 8000/8080 firewalled), secrets stored
   per-application, `CRON_SECRET` rotated per product.

---

## 5. Assumptions to confirm

The two lighter products are sized from suite docs, not a repo inspection (their repos aren't
in this workspace). Confirm before order:

- **allotmentology** — assumed a lightweight SvelteKit/static portal+docs consuming
  `/keys/v1/catalog`, **no self-hosted database**. If it runs its own background jobs or DB,
  add ~0.5–1 GB.
- **plotbudget** — assumed a single web app consuming Keys/Testing via MCP, with its **own
  managed DB (Neon)**. If it self-hosts Postgres or runs heavy jobs, it becomes the first
  candidate to peel onto a second box.

If either is heavier than "a web app + external DB," jump straight to the §6 Step-1 split.

---

## 6. Scale-out path (the thesis: easy on Hetzner/Coolify)

When the box gets tight, each step is minutes of work, not a migration — because state is
external and Coolify re-targets apps to servers by config:

| Trigger | Move | New cost |
|---|---|---|
| Build pressure / control-plane noise | **Step 1:** peel control plane + Forgejo + CI runner onto a small second box (CX22 / CAX11, ~€4/mo); the CAX31 becomes a pure apps box. | +~€4/mo |
| One product's load starves the rest | **Step 2:** peel the heaviest product (Sophia first) onto its own box; re-target in Coolify, redeploy, flip DNS. | +~€12/mo |
| Whole-box RAM/CPU ceiling | **Step 3:** resize CAX31 → **CAX41 (16 vCPU / 32 GB, ~€24/mo)** — a reboot, one click, no rebuild. | delta only |

Start at one box. Buy the next box only when a metric (sustained >80% RAM, build-induced OOM,
or a product SLA) demands it.

---

## 7. Related documents

| Topic | Document |
|---|---|
| Restormel Coolify migration (Stage 2) | `docs/infra/coolify-migration-plan-2026-06.md` |
| Restormel env inventory | `docs/infra/coolify-env-inventory.md` |
| Restormel cutover runbook | `docs/infra/coolify-cutover-runbook.md` |
| Coolify app config (two-container draft) | `deploy/docker-compose.coolify.yml` |
| **Sophia migration plan** | `docs/infra/sophia-coolify-migration-plan.md` |
| Suite architecture / Sophia roles | `docs/restormel/SUITE-ARCHITECTURE-MIGRATION.md` |
