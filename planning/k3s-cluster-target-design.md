---
title: "K3s + CloudNativePG Target Architecture — Sovereign Stack Migration"
class: decision
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-19
last-reviewed: 2026-06-19
review-interval: P12M
related: [REC-PLAN-012, REC-PLAN-015, RISK-001, AST-003, AST-009, AST-010]
---

# K3s + CloudNativePG Target Architecture

**Migrate the sovereign Restormel/Allotment stack from Coolify-on-3-boxes onto a self-managed
K3s cluster (Hetzner EU, OSS-only), with CloudNativePG as the database plane and Hetzner Object
Storage for continuous backup/PITR. Solo-operator maintainable, near-zero new spend.**

Companion to [full-migration-plan-k3s.md](full-migration-plan-k3s.md). Produced by a dedicated design
pass (2026-06-19) against verified live infra; **read-only — no infra/config changed.** Built to the
founder's locked decisions (HA across the 3 boxes; Hetzner Object Storage for CNPG; UseSophia full
migration; cost-constrained Forgejo/CI placement).

> Per-product migration phasing + the PlotBudget Supabase ADR live in the overarching
> [full-migration-plan-k3s.md](full-migration-plan-k3s.md); the shared Decisions register there is authoritative.

> **Founder decisions (2026-06-19)** — refining §3.3/§3.4/§4.4 and resolving the first four §10 questions:
> **(1) Migration = Path A** — build the cluster on a temporary **Hetzner Cloud** node (**CX43**, shared vCPU, 8 vCPU / 16 GB, x86) on the **€20 "Hetzner Cloud Community" credit (redeem before 31 Aug 2026)** — NOT a Robot/dedicated
> server (€20 won't cover one; hetzner-k3s provisions Cloud) — migrate state onto it, fold the 3 boxes in,
> then retire the temp node (de-risks converting the live prod box).
> **(2) DNS = consolidate onto Hetzner DNS** (free) → cert-manager **DNS-01** (wildcards); **deSEC** is the
> fallback; **avoid Cloudflare**. Zones are currently spread across registrars + Vercel, so DNS migration
> is an explicit task of this work. **(3) DB cutover = short pg_dump maintenance window** (pre-launch, low
> traffic; logical replication deferred until live with real users). **(4) Public entry = single-node
> ingress, no LB.**

---

## 1. Executive summary

Today the stack runs on three Hetzner boxes in Helsinki orchestrated by **Coolify** (Traefik proxy +
Coolify API deploys driven from Forgejo Actions). Coolify is being retired. State lives in **5+
hand-rolled Postgres instances** and **one SurrealDB** across two boxes, backed up only by
restic→Storage Box. This is the single-region, single-orchestrator blast radius captured as **RISK-001**.

**Target:** a 3-node **K3s** cluster (embedded-etcd HA) using the **existing three boxes as schedulable
control-plane nodes**, with a **scale-to-zero burst agent pool** for CI/heavy builds. All Postgres
consolidates onto **CloudNativePG (CNPG)** with **continuous WAL + PITR to Hetzner Object Storage**
(~€5/mo, EU). SurrealDB runs as a 1-replica StatefulSet on Hetzner CSI. Secrets flow from the **existing
self-hosted Infisical via External Secrets Operator**. Deploys move to **GitOps with Argo CD**. Ingress
is **Traefik** (Helm-managed, not Coolify's) + **cert-manager**.

**Cost delta: ~+€7–9/mo** (object storage ~€5 + a few € of tight CSI block volumes). Everything else
reuses the three boxes; burst nodes scale to zero. **Forgejo + CI stay off-cluster** during migration
(bootstrap safety + zero new cost), rehomed after cutover if desired.

**Key principle:** the cluster is the deploy target; the thing that *builds and deploys* the cluster
(Forgejo + CI + the GitOps repo + Infisical) must not depend on the cluster being healthy. Hence those
stay off-cluster through cutover.

---

## 2. Node topology

```
                          INTERNET
                             │  :80 / :443 → Traefik ingress (DaemonSet on CP nodes)
   ┌─────────────────────────┼──────────────────────────────────────────────┐
   │  K3s CLUSTER  (embedded etcd quorum = 3, all CP nodes schedulable)       │
   │  private net 172.16.0.0/16 (existing) · CNI Cilium · cluster.local       │
   │  ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐   │
   │  │ node-a  .167       │ │ node-b .150        │ │ node-c .166        │   │
   │  │ 172.16.0.3  CX33   │ │ 172.16.0.2  CX33   │ │ 172.16.0.4  CX43   │   │
   │  │ 8GB/80GB           │ │ 8GB/80GB (tightest)│ │ 16GB/150GB (roomy) │   │
   │  │ CP+etcd SCHEDULABLE │ │ CP+etcd SCHEDULABLE │ │ CP+etcd SCHEDULABLE│   │
   │  │ role=prod          │ │ role=ops           │ │ role=data          │   │
   │  │ restormel dash+wkr │ │ allotmentology     │ │ CNPG primaries     │   │
   │  │ CNPG replica       │ │ staging/preview    │ │ SurrealDB STS      │   │
   │  │ Traefik, cert-mgr  │ │ Traefik, ESO, Argo │ │ Supabase (PhaseB)  │   │
   │  └────────────────────┘ └────────────────────┘ └────────────────────┘   │
   │  ┌─────────────── burst agent pool (autoscaled) ───────────────────┐     │
   │  │ cpx31/41 · min=0 max=2 · taint workload=burst · €0 at rest      │     │
   │  └─────────────────────────────────────────────────────────────────┘    │
   └─────────────────────────────────┬────────────────────────────────────────┘
                          ┌───────────▼───────────┐   ┌──────────▼───────────┐
                          │ Hetzner Object Storage │   │ BX11 Storage Box 1TB │
                          │ hel1.your-objectstorage│   │ restic cold copies + │
                          │ CNPG Barman WAL + PITR  │   │ Surreal export + PVC │
                          └────────────────────────┘   └──────────────────────┘
   OFF-CLUSTER through migration: Forgejo + its PG + Actions runner + Infisical
   (plain docker-compose on the host) — so CI/GitOps/secrets survive a cluster rebuild.
```

**Verified ground truth (2026-06-19):** boxes are Helsinki `hel1`, private net **`172.16.0.0/16`**
(`.150`=172.16.0.2, `.167`=172.16.0.3, `.166`=172.16.0.4). `.167` CX33 prod; `.150` CX33
Coolify+Forgejo+Postgres×3+**Surreal**+Infisical (tightest: 24 G disk free, 67% used); `.166` CX43 CI
runner (most headroom: 13 G RAM / 120 G disk free). (Note: SurrealDB currently lives on **`.150`**.)

### 2.1 Cluster HA (decision 1)
All **three boxes are control-plane with embedded etcd** → 3-member quorum tolerates one node loss. They
are **also schedulable** (`schedule_workloads_on_masters: true`) — these boxes *are* the workers; no
separate static worker pool (cost). Tradeoff: CP nodes carry prod load. Mitigations: requests/limits on
every workload; anti-affinity keeping CNPG WAL-heavy primaries (on `.166`, most disk) off etcd-pressured
nodes; swap stays on as the OOM cushion (`--kubelet-arg=fail-swap-on=false`).

### 2.2 Burst pool — scale to zero (decision 1)
One autoscaled pool, `min_instances: 0`, `NoSchedule` taint `workload=burst` → nothing lands there
unless explicitly tolerant; Cluster Autoscaler scales **back to zero** when idle → **€0 at rest**.
`cpx31` (~€16/mo *only while running*), `max_instances: 2`. **Opt-in only.**

### 2.3 Load balancer — default: skip
To hold near-zero spend, **no Hetzner LB (~€6/mo) by default**: point public A/AAAA at one node's IP
(Traefik DaemonSet answers on every node). Single-node ingress = a small availability dent; reversible
(add the LB later). See §10 open questions.

---

## 3. Networking & ingress

### 3.1 hetzner-k3s config shape (v2.5.0)
Reuse the **existing** private network — do not let the tool create one:
`networking.private_network.existing_network_name: "restormel-internal"`; `cni.mode: cilium`;
`schedule_workloads_on_masters: true`; `masters_pool.instance_count: 3` (embedded etcd); the burst pool
from §2.2 as the only `worker_node_pools` entry. Pin `k3s_version`; lock `allowed_networks.api/ssh` to
the operator IP.

### 3.2 CNI — Cilium
Over flannel: **NetworkPolicy** to isolate prod DB traffic from build/ops pods on shared nodes (the
whole point of leaving the one-blast-radius box), plus Hubble observability for a solo operator.
Flannel is the 1-line fallback if memory bites.

### 3.3 Adopting the existing boxes — Path A vs Path B
Boxes **run prod during migration**, so `hetzner-k3s` must not reprovision them.
- **Path B (€0, in-place):** manually `k3s install` on **`.166` first** (cluster-init, lowest risk), join,
  migrate least-critical workloads, free `.150`, join it, then `.167` last. hetzner-k3s then *manages* the
  hand-joined cluster (CCM/CSI/autoscaler). Keeps prod up, adds €0. **Order: `.166` → `.150` → `.167`.**
- **Path A — DECIDED (uses the €20 "Hetzner Cloud Community" credit):** stand the cluster up on a
  **temporary Hetzner Cloud node** (**CX43**, shared vCPU, 8 vCPU / 16 GB, x86 — NOT a Robot/dedicated server; hetzner-k3s
  provisions Cloud, and €20 won't cover a dedicated box), migrate state onto it, then fold the existing boxes
  in and retire the temp node. De-risks converting a live prod box in place. **Redeem the credit before its
  31 Aug 2026 expiry.** (This supersedes the Path-B default described above.)

The Hetzner **Cloud Controller Manager + CSI driver** install into the cluster regardless (need a
Hetzner API token from Infisical).

### 3.4 Ingress — Traefik (Helm) + cert-manager
**Traefik via its own Helm chart** (DaemonSet) — not Coolify's (retires with Coolify); operator already
knows Traefik's model, native K3s fit (ingress-nginx is the clean fallback). **cert-manager**
`ClusterIssuer` on **ACME**: prefer **DNS-01** (wildcards, works behind single-IP) if the DNS provider
has a solver, else **HTTP-01**. *Open question: DNS provider (§10).*

### 3.5 Hostname → Ingress map
`restormel.dev`→dashboard; `staging/preview.restormel.dev`→non-prod; **`surreal.restormel.dev`→SurrealDB
Service (HARD INVARIANT — Sophia cross-phase dependency, keep stable to cluster ingress)**;
`auth.restormel.dev`→auth plane; `secrets.restormel.dev`→Infisical (off-cluster initially);
`git.allotmentology.tech`→Forgejo (**off-cluster**, host record bypasses ingress); `allotmentology.tech`,
`usesophia.app` (Phase B), PlotBudget domain (TBD)→Supabase Kong.

---

## 4. CloudNativePG (database plane)

### 4.1 Topology — hybrid
Boxes are small (8 GB) → can't afford one cluster per DB. **One shared `pg-platform` cluster**
(`instances: 2` = primary + standby, anti-affinity) for mergeable DBs (allotmentology, staging/preview,
UseSophia in Phase B). **Dedicated `pg-restormel`** (`instances: 2`) for the live prod `restormel_ops`.
**Dedicated `pg-plotbudget`** for Supabase (needs `auth`/`storage`/`pgjwt`/`pg_graphql` roles+extensions
isolated). Replica count **2** (not 3) to fit RAM; single-instance only for staging/preview.

### 4.2 Storage — Hetzner CSI
`hcloud-volumes` storage class, `ReadWriteOnce`. Separate `walStorage:` volume per instance so WAL I/O
doesn't fight data I/O (matters with etcd co-resident). **Size tight (10–20 Gi)** — current footprints
are small; volumes are billed per GB.

### 4.3 Barman → Hetzner Object Storage
**Region-matched endpoint `https://hel1.your-objectstorage.com`** (mismatched region = empty
listings/errors), S3v4. Continuous WAL (`compression: gzip, maxParallel: 4`) + daily `ScheduledBackup` +
`retentionPolicy: 14d`. PITR/DR bootstraps a fresh cluster from the same object store via
`bootstrap.recovery` + `externalClusters`. S3 creds via ESO (§6), never plaintext.
**CNPG ≥1.26 deprecates native `barmanObjectStore` in favour of the Barman Cloud Plugin** — native is
fine to ship now; adopt the plugin at the next major bump.

### 4.4 Consolidating the existing Postgres
`restormel_ops` (live) → `pg-restormel` via **logical replication** (publication/subscription → seconds
of downtime; pg_dump/restore fallback). `allotmentology-postgres` + `restormel-postgres` → `pg-platform`
via `pg_dump`/restore in a short window. **Forgejo PG + Infisical PG stay off-cluster** (§4.5).

### 4.5 Bootstrap-sensitivity (Forgejo + Infisical PG)
**Do NOT move into CNPG during migration.** Infisical is the secret source for **ESO**, which delivers
the very S3 creds CNPG needs to back up + every pod's secrets → a cold start can't bootstrap if
Infisical's DB is in CNPG. Forgejo hosts the GitOps repo Argo syncs from → can't deploy a fix if it's
down inside the cluster. Migrate them in *after* cutover is proven, separately gated (consider leaving
Infisical's PG out permanently as a bootstrap anchor).

---

## 5. SurrealDB
**StatefulSet, 1 replica** (rocksdb = single-writer embedded; HA is restore-from-backup, not
multi-writer). Hetzner CSI PVC. In-cluster consumers use `surrealdb.data.svc.cluster.local:8000`;
external/Sophia use `surreal.restormel.dev` → ingress → Service (**keep this name resolving to the
cluster, never dark** — Sophia invariant). **Retire the shared root cred for scoped per-consumer users**
(dashboard, Sophia) via ESO→Infisical — *route this auth change through `restormel-high-risk-security`.*
Backup: `surreal export` CronJob → restic → BX11 (+ PVC snapshot).

---

## 6. Secrets — External Secrets Operator ← Infisical
**ESO backed by the existing self-hosted Infisical** (authoritative; AST-013), over sealed-secrets
(which would fork the source of truth). `SecretStore` (Infisical provider, machine-identity auth,
`projectSlug: restormel-ops`, `environmentSlug: prod`) → per-`ExternalSecret` rendering only the keys a
pod needs (e.g. `cnpg-s3-creds`). **No plaintext in git, ever**; the only out-of-band secret is the
Infisical machine-identity bootstrap. etcd encrypted at rest (`--secrets-encryption`).

---

## 7. Backups & DR
| Layer | Mechanism | Target | RPO | Restore |
|---|---|---|---|---|
| Postgres (all CNPG) | Barman continuous WAL + daily base | Hetzner Object Storage (hel1) | ~minutes (PITR) | bootstrap new cluster from store |
| SurrealDB | `surreal export` CronJob → restic | BX11 | daily | import into fresh STS |
| PVCs | restic / volume snapshot | BX11 | daily | restic restore |
| etcd | K3s etcd snapshots | Object Storage / BX11 | scheduled | `--cluster-reset` from snapshot |
| GitOps repo | it IS source of truth | Forgejo + GitHub mirror | n/a | re-sync |

**Velero: optional, not initial** (CNPG-Barman + restic + GitOps already cover state; add later if the
etcd-snapshot + re-apply DR drill proves too manual). **RTO anchor ≤ 2 h** prod from a clean cluster;
**RPO ≤ 5 min** Postgres, **≤ 24 h** Surreal/PVCs (founder to confirm, §10). DR drill reuses the
existing Phase-8 restore-drill muscle.

---

## 8. CI/CD rewrite
**GitOps = Argo CD** (over Flux — its web UI gives at-a-glance state/drift assurance for a solo
operator; Flux is the lighter fallback). `restormel-gitops` repo on Forgejo (manifests + Helm values, no
secrets). **Flow:** push → Forgejo Action builds image (off-cluster runner / burst node) → push to
**Forgejo's built-in registry** (€0) → bump tag in gitops repo → **Argo syncs**. Replaces the
Coolify-API deploy call. **Preserve the PBI lifecycle callbacks** — only the deploy *step* swaps. **Prod
sync stays manual/gated** (prod is never main-auto-deploy); migrations fail-closed.

**Forgejo + CI placement (decision 4, cost-constrained): stays OFF-cluster** on the `.166` host (16 GB,
most headroom) as docker-compose — bootstrap safety + €0 + keeps the noisy CI neighbour off the prod
nodes. Builds on the existing off-cluster runner; only overflow uses the scale-to-zero burst pool. No
paid registry, no paid LB. Move in-cluster later only once a second bootstrap path is proven.

---

## 9. Cost
| Item | Today | Target | Δ |
|---|---|---|---|
| 3 boxes (CX33×2 + CX43) | ~€45/mo | reused as K3s nodes | €0 |
| BX11 Storage Box 1 TB | ~€3.8/mo | unchanged | €0 |
| **Hetzner Object Storage** (1 TB + 1 TB egress incl.) | — | **~€5/mo** | +€5 |
| CSI volumes (CNPG/Surreal PVCs, tight) | — | ~€2–4/mo | +~€2–4 |
| Burst nodes | — | €0 at rest | €0 |
| **Total new spend** | | | **≈ +€7–9/mo** |

Watch-items: CSI volumes (size tight, 2 instances not 3, fold mergeable DBs); LB avoided by default;
object-storage egress (1 TB included ≫ footprint); burst bills only while running (and is taint-gated
off by default). The €20 one-off credit, if used (Path A, §3.3), is a transient migration cost, not
recurring.

---

## 10. Open questions (for the founder — see chat)
- **Migration approach:** Path B (in-place, €0, prod box last) **or** Path A (use the €20 temp-node
  credit to build alongside, then retire the temp node — de-risks converting a live prod box)?
- **DNS provider** for the zones — decides cert-manager DNS-01 (wildcards) vs HTTP-01.
- **Cutover downtime for `restormel.dev`** — near-zero (logical replication) vs short pg_dump window?
- **Public ingress** — single-node (no €6/mo LB) acceptable initially, or add the LB?
- **Unified auth plane** — Better Auth everywhere (matches Restormel + the Sophia decision) vs Ory Hydra
  (REC-PLAN-011)? Design `auth.restormel.dev` once.
- **Burst nodes day one?** (default: ship at `max_instances: 0`, add later — €0 either way).
- **RTO ≤ 2 h / RPO ≤ 5 min (PG), ≤ 24 h (Surreal)** — acceptable or stricter?
- **Object Storage region** — confirm **hel1** (same region as compute).
- **PlotBudget production domain** — needed for ingress + Supabase `SITE_URL`/JWT.
- **Forgejo/Infisical** — keep off-cluster permanently (bootstrap anchors) or migrate in post-cutover?

---

## Sources
hetzner-k3s v2.5.0 config reference; CloudNativePG 1.27 Barman object-store backup/recovery + ≥1.26
plugin-deprecation note; Hetzner Object Storage regional endpoints (`hel1/fsn1/nbg1.your-objectstorage.com`,
1 TB + 1 TB egress incl., 64 KB min billable object, S3v4); External Secrets Operator Infisical provider
(maintenance resumed 2026); self-hosted Supabase on K8s (GoTrue/PostgREST/Storage/Realtime/Kong) + CNPG.
