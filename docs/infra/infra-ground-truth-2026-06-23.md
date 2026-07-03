---
title: Phase-1 Infrastructure Ground-Truth — Restormel / Allotment self-hosted estate
class: technical
owner: "@adam"
status: draft
classification: internal
control-tier: 1
created: 2026-06-23
last-reviewed: 2026-06-23
review-interval: P3M
related: [REC-GOV-006, REC-PLAN-012]
---

# Phase-1 Infrastructure Ground-Truth — Restormel / Allotment self-hosted estate

**As-of:** 2026-06-23 · **Method:** live-queried only (kubectl against the K3s cluster, Hetzner Cloud API, `rclone` against Object Storage S3 fsn1 + Storage Box BX11, Prometheus/node-exporter, ESO/CNPG/Argo CRDs), read-only · **Controller:** Allotment Technology Ltd (co. no. 16925574). Where two source sections disagree on a figure, the conflict is flagged inline rather than silently resolved.

> **Scope & status.** Phase 1 of the infra ground-truth → cost-optimisation program (Phase 2 = cost optimisation + scale signals, not started — this document changes nothing and proposes no fixes beyond the draft PBI titles in §6). Produced by a parallel read-only inventory swarm; figures are point-in-time and should be re-validated at production-data cutover.

---

## 1. Executive summary

1. The entire **production data-plane now runs on ONE K3s node** — `restormel-sovereign-master1` (Hetzner cx43, 8 vCPU / ~15.25 GiB, hel1, id 143382025, `135.181.25.76` / `172.16.0.5`): control-plane + etcd, Argo CD, Cilium, three CNPG Postgres clusters (each 2 instances, but both land on this node), SurrealDB, self-hosted Supabase (PlotBudget), Sophia, ESO and the kube-prometheus monitoring stack. Single-node loss = total estate outage.
2. **The old 3-box Coolify estate was never torn down** — all four Hetzner servers are `running` and billing simultaneously (the K3s master + `allotmentology-pilot` .150, `surreal-forgejo` .167, `restormel-build` .166); ~55% of the bill is legacy.
3. **Monthly burn: EUR 59.59 / GBP 50.65** (gross, incl. VAT) at an **EUR→GBP rate of 0.85**. Decommissioning the three legacy boxes (once cutover is confirmed) would drop this to ~EUR 26.62 / GBP 22.63.
4. Data is **bootstrapped but pre-cutover** — every CNPG application DB is 7–19 MB (empty schemas); production data still lives on the legacy/Neon estate. Live utilisation is light (node CPU 12.3%, RAM 48.4%, 0% steal) — the binding constraint is **availability/topology, not capacity**.
5. **CNPG Postgres backups are healthy** (barman-cloud → Hetzner S3 fsn1, 30-day retention, WAL archiving 0-failures, PITR chain intact). **SurrealDB has zero working backups** — its hourly cronjob is suspended, its one run Failed (DeadlineExceeded), and Argo `sophia-surreal-backup` is Missing.
6. **Top 3 findings:** (a) single-node SPOF carrying control-plane + etcd + all stateful data; (b) SurrealDB unprotected (no working backup); (c) the live K3s estate is **entirely absent from the ISMS asset inventory**, which still records only the dead Coolify topology — a material CIS-Control-1 inaccuracy compounded by the still-running zombie legacy fleet.

---

## 2. Infra map

### Hosts / nodes (Hetzner Cloud, all hel1-dc2, each 20 TiB included egress)

| Host | id | type | spec | public IPv4 | Role (live) |
|---|---|---|---|---|---|
| **restormel-sovereign-master1** | 143382025 | cx43 | 8 vCPU / 16 GB / 160 GB | 135.181.25.76 | **K3s single node** — control-plane + etcd + all workloads; holds all 16 CSI volumes |
| restormel-build (.166) | 142914745 | cx43 | 8 vCPU / 16 GB / 160 GB | 204.168.216.166 | Legacy Coolify build/CI box — still running |
| allotmentology-pilot (.150) | 138350520 | cx33 | 4 vCPU / 8 GB / 80 GB | 77.42.125.150 | Legacy Coolify box; also hosts **self-hosted Infisical** (`secrets.restormel.dev` → .150) |
| surreal-forgejo (.167) | 140639164 | cx33 | 4 vCPU / 8 GB / 80 GB | 77.42.124.167 | Legacy Coolify box (documented as live prod app box) — still running |

Burst node group `restormel-sovereign-burst` = `--nodes=0:2:CPX31:HEL1`, currently **0 nodes, agents-only** — provides no control-plane/stateful HA.

### Platform / control-plane (all in-cluster on the master, k3s v1.34.8)

Argo CD (server, repo-server, applicationset, dex, redis, application-controller) · Cilium + cilium-envoy + Hubble (relay/ui) · CoreDNS · Traefik (ingress, DaemonSet) · cert-manager (+cainjector, webhook, webhook-hetzner) · external-secrets / ESO (controller, cert-controller, webhook) · cluster-autoscaler · hcloud-cloud-controller-manager + hcloud-csi (controller + node) · reflector · system-upgrade-controller · CNPG operator (`cnpg-cloudnative-pg` + barman-cloud plugin).

### Databases (all on the single node — see §1)

| Engine | Where | Detail |
|---|---|---|
| **CNPG Postgres 16.8** ×3 clusters | ns `cnpg-system` | `pg-restormel` (`restormel_ops` 7.3 MB) · `pg-platform` (`allotmentology`, `restormel_staging`, `usesophia`, ~7.2 MB each) · `pg-plotbudget` (`plotbudget`/Supabase DB, 19 MB). Each = 1 primary + 1 replica, **both pods on the same node** (no node-loss HA). 10 GB data + 10 GB WAL PVC per cluster. All `INSTANCES 2 READY 2`, healthy. |
| **SurrealDB v3.1.4** | ns `data`, STS `surreal` | Single replica `surreal-0`, 20 GB PVC, ~76 MiB used. NS `main` / DB `sophia`. No replication, no HA. |

### Product apps

- **PlotBudget — self-hosted Supabase** (ns `supabase`, 9 running Deployments): kong gateway, auth/gotrue, rest/postgrest, realtime, storage, imgproxy, meta, studio, send-resend-email (edge-runtime → Resend). Data in `pg-plotbudget`. Frontend hosted on **Vercel** (plotbudget.com).
- **Sophia** (ns `sophia`): 2 replicas; backs onto SurrealDB (NS main/DB sophia) + `usesophia` in `pg-platform`. Runtime LLM/inference sub-processors wired in `sophia-app-env` (AIZOLO gateway, Fireworks, Together, Voyage, ElevenLabs) + Paddle billing + Neon (legacy, still wired) + Zuplo (gateway refs still present).
- **Restormel product app:** **NOT deployed in-cluster.** `pg-restormel` exists but the Restormel SvelteKit/Keys workload remains on the legacy Coolify estate.

### Networking / ingress

Traefik DaemonSet = in-cluster ingress. **0 load balancers, 0 floating IPs.** 8 primary IPs (4× IPv4 + 4× IPv6), all attached → no charge. Private network `restormel-internal` — API shows parent range **`172.16.0.0/16`** (infra-access skill records `/24`; the subnet is a /24 within the /16 — minor doc drift). 2 firewalls: `surreal-box-fw` (3 servers), `restormel-sovereign` (1 server). Public DNS via Vercel (`restormel.dev`) and get.tech/Radix (`allotmentology.tech`).

### Storage / backup

- **Block storage:** 16 Hetzner CSI volumes (1×20 GB + 15×10 GB = 170 GB), **all bound to the single node = the hard 16/16-per-node cap**. This already forced **Loki onto emptyDir** (no PVC → log history lost on pod restart).
- **Object Storage S3 (fsn1)**, ~46 MB used of 1 TB+1 TB included: `restormel-cnpg-backups-fsn1` (336 objs, 46.1 MiB — CNPG barman backups) · `plotbudget-storage` (1 obj, 58.5 KiB — Supabase storage) · `restormel-loki-logs-fsn1` (2 objs, 398 B — Loki effectively not shipping to S3).
- **Storage Box BX11** (1 TB, 3.8 GiB / 0.37% used): restic repos `restic-app`, `restic-buildops`, `restic-surreal` — **all from the OLD Coolify topology**; no K3s/CNPG repo present.
- **Backup split:** CNPG → S3 fsn1 (cross-region from the hel1 node) via barman-cloud, **working** (6 completed runs, PITR intact; note: CNPG `Cluster.status.lastSuccessfulBackup` is cosmetically empty under the plugin method — alerts keyed on it false-positive). SurrealDB → BX11 via restic/rclone-sftp, **broken** (suspended + Failed).

---

## 3. Cost table

**EUR→GBP rate = 0.85.** Server EUR = exact `price_monthly.gross` from each `/servers` object; volume/S3/Storage-Box are Hetzner published gross list prices (no price block on those API objects). Figures gross / incl. VAT.

| Resource | Spec | Qty | EUR/mo | GBP/mo |
|---|---|---:|---:|---:|
| Server cx43 restormel-sovereign-master1 (K3s) | 8 vCPU/16 GB/160 GB hel1 | 1 | 15.99 | 13.59 |
| Server cx43 restormel-build (.166) | 8 vCPU/16 GB/160 GB hel1 | 1 | 15.99 | 13.59 |
| Server cx33 allotmentology-pilot (.150) | 4 vCPU/8 GB/80 GB hel1 | 1 | 8.49 | 7.22 |
| Server cx33 surreal-forgejo (.167) | 4 vCPU/8 GB/80 GB hel1 | 1 | 8.49 | 7.22 |
| Block volumes (CSI PVCs) | 170 GB, 16 vols @ 16/16 cap | 16 | 0.88 | 0.75 |
| Object Storage S3 fsn1 | 3 buckets, ~46 MB used; 1 TB+1 TB incl | 1 | 5.94 | 5.05 |
| Storage Box BX11 | 3.8 GiB/1024 GiB used; 3 repos, 21 snaps | 1 | 3.81 | 3.24 |
| Primary IPs | 4× IPv4 + 4× IPv6, all attached | 8 | 0.00 | 0.00 |
| Private network restormel-internal | 172.16.0.0/16, 4 servers | 1 | 0.00 | 0.00 |
| Firewalls | surreal-box-fw, restormel-sovereign | 2 | 0.00 | 0.00 |
| **TOTAL** | | | **59.59** | **50.65** |

**Monthly total: EUR 59.59 / GBP 50.65.** Legacy 3-box subtotal = EUR 32.97/mo (~55%); retiring them → **EUR 26.62 / GBP 22.63**.

**Conflicts noted (not silently resolved):**
- *Volume cost:* §3 (Hetzner-cost) computes **EUR 0.88/mo** from the API-published block rate EUR 0.0052/GB/mo (170 GB). §5 (saas-subproc) estimated **~EUR 6.80/mo** at an assumed EUR 0.04/GB. The table uses the published-rate figure (EUR 0.88); the ~EUR 6.80 figure appears to use a wrong per-GB rate. Worth a billing-console confirmation.
- *Server compute subtotal:* the per-server gross lines sum to EUR 48.96/mo; the EUR 59.59 grand total is authoritative for budgeting.
- *SaaS lines:* Paddle, PostHog EU, Resend, AIZOLO/Fireworks/Together/Voyage/ElevenLabs, Neon (~$10 cap), Zuplo, Google Workspace, registrars — all usage-metered or low fixed and **not separately quantified here** (no invoices queried); they sit on top of the Hetzner total above.

---

## 4. Live utilisation snapshot

Node uptime ~67.6 h at query time (short-window counters). `metrics-server` **NOT installed** → live data via Prometheus/node-exporter + Hetzner API only.

| Dimension | Live value | vs allowance |
|---|---|---|
| Node CPU | **12.3%** of 8 vCPU | far below req 49% / limit 256% overcommit |
| CPU steal (shared cx43) | **0%** (avg & max) | no noisy-neighbour pressure now |
| Memory used | **48.4%** (~7.4 GiB of ~15.25 GiB) | req 58% / **limit 131% overcommit** (OOM risk at correlated peak) |
| Root disk `/` | 19.4% used | ample |
| Volumes | 16/16 PVCs bound = **HARD CAP**; fullest = Prometheus DB **2.92%** | all effectively empty; no headroom to add a PVC |
| Net (eth0) | TX ~3.69 KB/s, RX ~4.28 KB/s | trivial |
| Egress (Hetzner billing counter) | outgoing **225.26 MB** of 20 TiB included | **~0.001%** — no overage risk |
| Object Storage S3 fsn1 | ~46.2 MiB stored | <0.005% of 1 TB |
| Storage Box BX11 | 3.8 GiB of 1024 GiB | 0.37% |

**Reading:** capacity is fine at idle, fragile at peak. The 131% memory-limit overcommit on a single 16 GB node sharing etcd risks an OOM/eviction cascade with no second node to absorb eviction. Loki on emptyDir = observability/forensics gap. Steal is 0% now but the instance is shared — worth a standing alert.

---

## 5. Divergence table (documentation vs reality)

| # | Doc of record says | Reality (live) | Severity |
|---|---|---|---|
| D1 | asset-inventory = 17 assets (AST-001..017); **no K3s entry of any kind** | A live K3s cluster runs the entire production data-plane (3 CNPG clusters, Supabase, SurrealDB, Sophia, monitoring, ESO, S3 backups). Zero asset records for it. | **Critical** |
| D2 | Prod = 2-server Coolify cluster on .167 + .150, net `172.16.0.0/24` | Prod = single K3s node `135.181.25.76` / `172.16.0.5`; net parent is `/16` | **Critical** |
| D3 | Legacy Coolify boxes were the intended prod plane; no decommission recorded | **4 servers all running + billing**; old estate never torn down (note: .166 live IP 204.168.216.166 differs from inventory's AST-010 ".166") | **High** |
| D4 | Backups = restic → Storage Box BX11 (repos restic-surreal/restic-buildops) | CNPG backups go to **S3 `restormel-cnpg-backups-fsn1` via barman-cloud** — different mechanism, target type, and bucket | **High** |
| D5 | SurrealDB backed up via `restic-surreal` → BX11 | `surreal-backup` CronJob **suspended**, only Job **Failed (DeadlineExceeded)**, Argo `sophia-surreal-backup` **Missing** → no working Surreal backup | **Critical** |
| D6 | Infisical = single secret store; ESO not mentioned | **5 Infisical ClusterSecretStores** feeding **32 ExternalSecrets** via ESO — a hard cluster-wide bootstrap dependency, broader than documented | **Medium** |
| D7 | Plot + Sophia OUT of scope until their phases | `pg-plotbudget`, full Supabase stack, Sophia all **live on the shared in-scope node/etcd/ESO/backup plane** — out-of-scope products share the in-scope blast radius | **Medium** |
| D8 | RISK-005/004: host = Vercel/Coolify, Neon active DB, Neon decommission by 2026-06-30 | Real host = K3s/CNPG on 135.181.25.76; Neon still wired live (`NEON_API_KEY` + Neon Auth in Sophia env); decommission not executed | **Medium** |
| D9 | `deploy/k3s/` GitOps manifests = deployment of record | `deploy/k3s/` is **untracked in git**; Argo apps `cluster-addons`/`monitoring` Degraded, `plotbudget-supabase`/`sophia-surreal-backup` OutOfSync — live drift from any committed desired-state | **Medium** |
| D10 | suppliers.yaml: "Hetzner … Falkenstein storage box backups"; no S3 line; **Resend, Telegram, AIZOLO, Fireworks, Together, Voyage, ElevenLabs MISSING**; Sentry listed but never deployed; Migadu listed but live email is Resend; Zuplo dev portal "retired" but gateway keys still live; Vercel recorded only as registrar (also hosts PlotBudget frontend); Infisical (self-hosted on .150) unlisted | Backup sub-processor is now **Hetzner Object Storage S3 fsn1** (distinct product/bucket, not in register); 7 live GDPR sub-processors absent from `suppliers.yaml`; Sentry stale; Migadu stale; Zuplo persists; Vercel scope under-recorded | **Low–Medium** |

---

## 6. Prioritised findings (with draft PBI titles)

| # | Finding (SPOF / hard cap / drift / DR) | Severity | Draft PBI title |
|---|---|---|---|
| F1 | **Single-node SPOF** — one cx43 holds control-plane + etcd + all 3 CNPG clusters (replicas co-located) + SurrealDB + Supabase + Sophia + monitoring. Burst group is agents-only/0. Node loss = total outage. | **Critical** | Eliminate single-node SPOF: add control-plane/etcd HA and spread stateful workloads off the one cx43 master |
| F2 | **SurrealDB has no working backup** — cronjob suspended, only run Failed (DeadlineExceeded), Argo `sophia-surreal-backup` Missing; 20 GB knowledge-graph store unprotected. | **Critical** | Restore SurrealDB backups on K3s — un-suspend/fix `surreal-backup`, repair Argo `sophia-surreal-backup` (Missing), verify a restore |
| F3 | **K3s estate absent from ISMS asset inventory** — entire production plane unrecorded; inventory still describes the dead Coolify topology (CIS Control 1 materially inaccurate). | **Critical** | Add the K3s sovereign cluster (node, CNPG, Supabase, SurrealDB, Sophia, ESO, S3 backups) to asset-inventory.yaml and supersede the dead .150/.167 Coolify assets |
| F4 | **Zombie legacy estate** — 3 old Coolify servers still running/billing (EUR 32.97/mo, ~55% of bill) = cost leak + unpatched attack surface + ambiguous system-of-record. | **High** | Decommission or document the 3 still-running legacy Coolify servers (.150/.167/.166) — stop the cost/attack-surface leak |
| F5 | **16/16 CSI volume hard cap** on the single node — no new PVC-backed workload can schedule; already forced Loki onto emptyDir (log loss on restart). Burst group is agents-only and cannot relieve it. | **High** | Address the 16/16 Hetzner CSI volume cap (and move Loki off emptyDir) — capacity / second node / storage strategy |
| F6 | **Backup record divergence + unverified DR path** — live CNPG backups are S3/barman (not BX11/restic); no restore drill run against the live path; DR runbook targets the wrong mechanism. | **High** | Reconcile backup record (S3 barman vs BX11 restic) and run a real CNPG restore/DR drill against the live path |
| F7 | **Memory-limit overcommit 131%** (+ CPU-limit 256%) on the single 16 GB node sharing etcd — correlated spike risks OOM/eviction cascade; several workloads (sophia, argocd, operators, cilium) have **no limits at all**. | **High** | Right-size limits and overcommit on the single node (131% mem / 256% CPU); bound the unlimited workloads |
| F8 | **Infisical + ESO cluster-wide bootstrap SPOF** — 5 ClusterSecretStores / 32 ExternalSecrets against a single self-hosted Infisical co-located on the .150 box; outage/identity-revoke stalls secret materialisation estate-wide. | **High** | Document and harden the Infisical+ESO bootstrap SPOF (5 stores / 32 ExternalSecrets); enable Infisical admin MFA |
| F9 | **Single AZ (hel1)** — every server + the CNPG S3 backup bucket in one Hetzner location; no cross-region/AZ DR. | **High** | Plan cross-region/AZ DR posture (currently all hel1, including the backup bucket) |
| F10 | **Live sub-processors missing from suppliers.yaml** — Resend, Telegram, AIZOLO, Fireworks, Together, Voyage, ElevenLabs (+ S3 fsn1) all live and GDPR-relevant; Sentry/Migadu stale; Neon/Zuplo not retired; Vercel scope under-recorded. | **Medium** | Reconcile suppliers.yaml/ROPA: add live sub-processors (Resend, Telegram, LLM fleet, S3 fsn1), remove stale (Sentry/Migadu), correct Neon/Zuplo/Vercel |
| F11 | **Argo / GitOps drift** — `deploy/k3s/` untracked; `cluster-addons`/`monitoring` Degraded, `plotbudget-supabase`/`sophia-surreal-backup` OutOfSync. | **Medium** | Resolve Argo drift and commit untracked `deploy/k3s/` as the GitOps record |
| F12 | **Shared-cluster ISMS scope** — Plot/Sophia/Supabase (declared out-of-scope) now share the in-scope node/etcd/ESO/backup plane; blast radius wider than RISK-001 records. | **Medium** | Re-scope ISMS for the shared cluster (update scope notes + RISK-001 blast radius) |
| F13 | **No data migrated yet** — CNPG app DBs are 7–19 MB empty schemas; backups protect near-empty DBs; the real DR test comes at cutover. | **Low (watch)** | Track data-cutover readiness; re-validate backup/restore once production data lands |
| F14 | **Network doc drift** — private net is `/16` (API) not `/24` (skill). | **Low** | Correct private-network range in infra-access skill (/16 parent, /24 subnet) |

> **Phase-2 note:** per CLAUDE.md the F3 inventory gap is also an ISMS record-keeping obligation (REC-GOV-006 / CIS Control 1) — route remediation through `restormel-isms-governance` when Phase-2 filing begins. This document names findings only; it does not propose Phase-2 fixes beyond the draft PBI titles above.
