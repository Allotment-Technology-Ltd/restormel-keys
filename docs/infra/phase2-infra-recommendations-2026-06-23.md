---
title: Phase-2 Infra Recommendations — cost optimisation + scale signals
class: technical
owner: "@adam"
status: draft
classification: internal
control-tier: 1
created: 2026-06-23
last-reviewed: 2026-06-23
review-interval: P3M
related: [REC-PLAN-012]
---

# Phase 2 — Infra Recommendations

> **status:** recommendation-only / nothing applied · **date:** 2026-06-23
> **verification:** live read-only (Hetzner API, Infisical-scoped token, public DNS, in-cluster Prometheus API-proxy)
> **sovereignty:** all compute/storage stays on Hetzner EU (hel1 / fsn1); no verification-path, BYOK, or DB-credential traffic proposed for US-terminating SaaS

## 1. Executive summary

- **Headline savings:** EUR 24.48/mo (GBP 20.81) — EUR 293.76 / GBP 249.70 per year — by decommissioning the two genuinely dark Hetzner boxes (`.166` restormel-build, `.167` surreal-forgejo); drops the bill EUR 59.59 → EUR 35.11/mo. **All "apply-now" reversible cost is EUR ~0** — the only no-risk levers (backup add-on, S3/BX11, master right-size) yield nothing; every euro of saving is gated behind a cutover confirmation.
- **Correction to Phase-1:** `.150` is **NOT** a zombie — it actively serves Forgejo (primary CI/CD), Infisical (cluster-wide ESO bootstrap) and Coolify, so the recoverable legacy saving is EUR 24.48, not F4's EUR 32.97. The Hetzner automated-backup 20% surcharge is **already off estate-wide** (`backup_window=None` on all 4 servers) — nothing to cut there.
- **Monitoring/alerting added:** 14 new scale-trigger alert rules (1 disabled-by-comment pending an exporter), additive to the live 37-PrometheusRule kube-prometheus-stack; reuse the existing Telegram/page label contract so **no Alertmanager change** is needed. They close the gaps Phase-1 left open: sustained RAM, CPU-steal, the 16/16 CSI cap, egress allowance, overcommit ratio + eviction, and absent-backup guards.
- **Top 3 recommended actions:** (1) open the additive gitops PR for the scale rules (low-risk, no Alertmanager edit); (2) decommission `.166` (highest single saving, EUR 15.99/mo, snapshot-first, power-off-and-watch); (3) decommission `.167` (EUR 8.49/mo, after reconciling the dead `restic-surreal` repo).

---

## 2. Cost optimisation — ranked by saving-to-risk

**Verified live (2026-06-23, read-only):** Hetzner API `/servers` + `/volumes`, Infisical-scoped `HCLOUD_TOKEN`, public DNS, HTTP/TCP probes. EUR→GBP = 0.85. All four servers `running`. `backup_window=None` on every server → the Hetzner automated-backup add-on is **NOT** active anywhere (no 20% surcharge billed). 16/16 CSI volumes (170 GB) all bound to the master.

### Critical correction to the Phase-1 "zombie estate" framing (load-bearing)
The brief and F4 treat all three legacy boxes as decommissionable (EUR 32.97/mo). **Live probing disproves this for `.150`:** `secrets.restormel.dev` (Infisical), `git.allotmentology.tech` (Forgejo — serving `version 8.0.3+gitea-1.22.0`, the **primary CI/CD**) **and** `coolify.allotmentology.tech` all resolve to **77.42.125.150 = allotmentology-pilot (.150)** and return live HTTP 200/307. `.150` is production-critical, not a zombie. Only `.167` (surreal-forgejo) and `.166` (restormel-build) have **no public DNS** and are firewalled. So the realistically-recoverable legacy saving is **EUR 24.48/mo (.167 + .166)**, not EUR 32.97 — and `.150` (EUR 8.49/mo) cannot be removed until Forgejo + Infisical migrate into the cluster (out of Phase-2 scope; F8 ESO-bootstrap SPOF work).

### Ranked findings (highest saving + lowest risk first)

| Rank | Item | Saving EUR/GBP per mo | Risk | Exact change required | Reversible? |
|---|---|---|---|---|---|
| **1** | **Decommission `.166` restormel-build (cx43)** — legacy Coolify build/CI box; no public DNS, firewalled, CI now runs via Forgejo Actions on/around `.150`. | **EUR 15.99 / GBP 13.59** | **Low** *(after a confirmation gate)* — once verified no Forgejo Actions runner / cron / private-net dependency lives here. Highest single saving, dark from the internet. | (1) On `.166`: `systemctl list-units --type=service` + check for a registered Forgejo runner / Coolify agent. (2) Power off and observe 3–7 days (Forgejo CI + deploys stay green). (3) Snapshot, then `DELETE /servers/142914745`. | **Yes** — Hetzner image/snapshot first (~EUR 0.0119/GB/mo); rebuild if a hidden dependency surfaces. Power-off-and-watch fully reversible before final delete. |
| **2** | **Decommission `.167` surreal-forgejo (cx33)** — legacy Coolify box; no public DNS (`surreal.allotmentology.tech` unresolved), firewalled. SurrealDB now runs in-cluster (`ns data`, STS `surreal`); Forgejo serves from `.150`. | **EUR 8.49 / GBP 7.22** | **Low–Medium** — both former roles now live elsewhere, **but** confirm in-cluster Surreal holds authoritative data and nothing (e.g. the broken `restic-surreal` BX11 path, F5/F2) still reads from this box. | (1) Confirm in-cluster `surreal-0` is system of record and `.167` holds only stale data. (2) Reconcile the dead `restic-surreal` repo on BX11 first. (3) Power off, observe, snapshot, `DELETE /servers/140639164`. | **Yes** — snapshot before delete; power-off-and-watch reversible. Sequence **after** rank 1 so failures are isolated. |
| **3** | **Right-size the 16 CSI volumes** | **EUR ~0** (volumes EUR 0.0052/GB/mo ⇒ 170 GB ≈ EUR 0.88/mo; fullest PVC 2.92% used) | **Low** | Not a cost lever — flagged only re volume duplication. **The constraint is the 16/16 *count* cap, not GB cost.** Shrinking GB saves nothing; consolidating PVCs relieves the cap but is an availability/F5 change. No action for cost. | n/a |
| **4** | **Object-storage / volume duplication — orphaned BX11 restic repos** | **EUR ~0 direct** (BX11 flat EUR 3.81/mo for 1 TB; 0.37% used) | **Low** | `restic-app`, `restic-buildops`, `restic-surreal` reference the **dead Coolify topology**. Pruning frees space but not money (flat-rate). **Do NOT cancel BX11** — it's the *future* K3s/CNPG restic target (F6). The S3 fsn1 bucket (EUR 5.94/mo) is flat-rate within allowance. Action: keep, tidy as part of F6. | **Yes** — prune reversible until GC; recommend NOT pruning until live CNPG/Surreal backup paths proven (F2/F6). |
| **—** | **Hetzner AUTOMATED-BACKUP add-on (20% surcharge)** | **EUR 0 — already not billed** | n/a | Verified `backup_window=None` on all 4 servers ⇒ add-on OFF estate-wide. Brief's hypothesis disproven. **Corollary (a DR gap, not a cost item):** the only server-level protection is app-level barman (CNPG, working) + restic (Surreal, **broken** — F2). | n/a |
| **—** | **Right-size the cx43 master DOWN** (CPU 12%, RAM 48%, 0% steal idle) | Up to EUR 7.50/mo if cx43→cx33 | **HIGH — do NOT** | Single cx43 carries control-plane + etcd + all 3 CNPG + Surreal + Supabase + Sophia + monitoring at **131% mem-limit / 256% CPU-limit overcommit**. Downsizing removes the OOM headroom that is the binding constraint. Correct direction is HA spread (F1), which *adds* cost. | n/a — rejected trade-off, recorded. |
| **—** | **`.150` allotmentology-pilot (cx33)** | EUR 8.49/mo *(theoretical)* | **HIGH — NOT decommissionable now** | Serves live Forgejo (primary CI/CD), Infisical (cluster-wide ESO bootstrap for 5 ClusterSecretStores / 32 ExternalSecrets — F8), Coolify. Removing it breaks CI + estate-wide secret materialisation. Retire only **after** Forgejo + Infisical migrate in-cluster (separate program; tension with the 16/16 cap — F5). | Out of scope for Phase-2 cost cuts. |

### 2a. APPLY-NOW (low-risk, reversible)
**Net cash saving from apply-now actions: EUR ~0.** The genuinely low-risk, reversible levers all turn out to yield nothing material:
- **Backup add-on** — already off; nothing to remove.
- **CSI volume right-size (GB)** — saves ~EUR 0; the binding constraint is the attachment *count*, not GB.
- **BX11 / S3 object storage** — flat-rate within allowance; pruning frees space, not money — and must not be pruned until F2/F6 prove the live backup paths.

Apply-now action that *is* worth taking (no cash, but no cutover risk and high value): **open the additive gitops PR for the scale-trigger PrometheusRules** (Section 3) — additive, no Alertmanager change, Argo-synced.

### 2b. PROPOSE-FOR-SIGN-OFF (higher-risk, needs cutover confirmation)
All real cash saving is here, behind a human gate:
- **Rank 1 — decommission `.166`** (EUR 15.99/mo): confirm no Forgejo runner/cron/private-net dep → snapshot → power off → observe CI/deploys green 3–7 days → `DELETE /servers/142914745`.
- **Rank 2 — decommission `.167`** (EUR 8.49/mo): confirm in-cluster Surreal is system of record → reconcile the dead `restic-surreal` BX11 repo → snapshot → power off → observe → `DELETE /servers/140639164`. **Sequence after rank 1.**
- **`.150`** — explicitly **not** proposed for Phase-2; only retire as part of the F8 in-cluster Forgejo/Infisical migration.

### Net realisable Phase-2 saving
Ranks 1+2 only: **EUR 24.48/mo (GBP 20.81)** = **EUR 293.76 / GBP 249.70 per year** — bill EUR 59.59 → EUR 35.11/mo (GBP 50.65 → GBP 29.84). EUR 8.49/mo less than F4's EUR 32.97 because **`.150` must be retained**. No saving from the backup add-on (off), S3/BX11 (flat-rate, within allowance), or right-sizing the master (constrained by HA/overcommit). **Sovereignty constraint respected:** no proposal moves the verification path, BYOK secrets, DB credentials, Infisical, or Forgejo onto US-terminating SaaS — all savings are pure decommissioning of dark Hetzner (DE/FI) capacity; nothing is relocated off-sovereign.

**Recommended sequence (each behind a human gate, snapshot-first, power-off-and-observe before delete):** rank 1 (`.166`) → observe CI/deploys green 3–7 days → rank 2 (`.167`, after reconciling the dead `restic-surreal` repo) → revisit `.150` only as part of the F8 in-cluster migration. **All actions are analysis/recommendation only — nothing was applied to the cluster or any server; no manifests pushed.**

---

## 3. Monitoring + alerting — scale-trigger rules (ready-to-commit)

### 3.1 What alerting exists live (audited 2026-06-23, read-only)
`kube-prometheus-stack` is live in ns `monitoring` with **37 PrometheusRules** — upstream defaults **plus 7 hand-written `restormel-monitoring` groups** (`cluster-node-alerts`, `cnpg-backup-alerts`, `surreal-alerts`, `edge-alerts`, `secrets-delivery-alerts`, `workload-app-alerts`, `watchdog`).

| Brief trigger | Already covered? | Existing alert(s) |
|---|---|---|
| node disk >80% | **Yes** | `NodeDiskPressureHigh` (>75%/10m, warn) + `NodeDiskPressureCritical` (>88%/5m, page) |
| any PVC >80% | **Yes** | `PVCNearFull` (>80%, page) + `CNPGWalStorageNearFull` (WAL >70%, page) |
| node NotReady / kubelet down | **Yes** | `NodeNotReady`, `KubeletDown`, `TargetDown`, `EtcdNoLeader`, `EtcdSnapshotStale` |
| mem overcommit OOM/eviction | **Partial** | `ContainerOOMKilled` (warn), `NodeMemoryPressure` (warn) — no *limit-overcommit ratio* nor *eviction* alert |
| Surreal/CNPG backup stale | **Yes** | `SurrealExportStale` (>70m, page), `CNPGBaseBackupStale` (>26h, page), `CNPGWalArchiveStalled` (>15m, page), `CronJobFailed` (page) |

**Gaps NOT yet covered (drafted below):** sustained node-RAM-%; CPU-steal-sustained; the 16/16 CSI cap; Storage Box BX11 fill; S3 egress allowance; and the *overcommit-ratio* refinement.

### 3.2 Metric availability (verified against live Prometheus)
- **Present:** `node_memory_*`, `node_cpu_seconds_total{mode="steal"}` (8 series), `kube_volumeattachment_info` (**= 16** — the live proof of the cap), `kubelet_volume_stats_*` (32 series), `kube_pod_container_status_last_terminated_reason{reason="OOMKilled"}`, `kube_pod_container_resource_limits`, `node_network_transmit_bytes_total{device="eth0"}`, CNPG/Surreal freshness collectors.
- **NOT scrapeable today (no exporter):** Hetzner billing egress, the S3 fsn1 egress allowance, and Storage Box BX11 fill. Triggers (6) Storage Box and the billing-accurate (7) egress therefore can't be evaluated from current metrics — drafted as an **in-cluster proxy** (node egress bytes — works today) plus a commented exporter-dependent form (a prerequisite PBI).

### 3.3 The rules (ready to commit)
Consolidated, ready-to-commit YAML: **`phase2-scale-alert-rules.yaml`** (commit target `restormel-gitops/monitoring/rules/scale-trigger-rules.yaml`). **14 alert rules across 10 groups** (plus 1 disabled-by-comment Storage Box rule pending the exporter). Additive (all-new alert names, no edits to existing groups), Argo-synced via the same `monitoring` app. **Not applied.**

| # | Trigger | Alert(s) | Threshold | severity / area |
|---|---|---|---|---|
| 1 | Node RAM sustained-high → add agent node | `NodeMemorySustainedHigh` | >80% used / 30m | warn / scale |
| 2 | CPU steal sustained → ARM/dedicated | `NodeCPUStealSustained` | >5% per-vCPU / 30m | warn / scale |
| 3 | Node disk >80% (mid-band marker, redundant w/ live) | `NodeDiskAboveEighty` | >80% / 10m | warn / scale |
| 4 | PVC sustained >80% (growth lens) | `PVCSustainedAboveEighty` | >80% / 30m | warn / scale |
| 5 | 16/16 CSI cap → no new PVC schedules | `CSIVolumeAttachmentCapReached` (>=16) / `CSIVolumeAttachmentCapNear` (==15) | 16 / 15 attach | page+highest / warn |
| 6 | Storage Box BX11 >80% | *(disabled — needs exporter)* | >80% | warn / scale |
| 7 | S3 egress → 80% allowance (proxy) | `NodeEgressApproachingAllowance` | >0.8 TiB / 30d | warn / scale |
| 8 | Single-node data-plane down | `SingleNodeDataPlaneDown` | NotReady / 2m | page+highest / scale |
| 9 | Mem-limit overcommit + eviction | `NodeMemoryLimitOvercommit` (>120%) / `NodeMemoryEvictions` | >1.2 / any evict | warn / page+highest |
| 10 | Backup job absent (belt-and-braces) | `SurrealBackupJobAbsent` / `CNPGBackupCoverageAbsent` | absent() / 15–30m | page+highest |

**Additive / low-risk note:** every rule uses the established label contract (`severity: page|warn`, `area`, optional `priority: highest`, the four annotations `summary`/`description`/`first_action`/`runbook_url`) so it routes through the **existing** `alertmanager-telegram` config with **no Alertmanager change**. `area: scale` is a new value of the existing `area` label and slots cleanly into the live `group_by: ['alertname','area']`. `send_resolved: true` is already global, so all auto-send a RESOLVED. Rules 3 and 4 overlap deliberately with live point-in-time pages and can be dropped at review.

### 3.4 Two follow-up dependencies (flag on the PR, do not block)
1. **Exporter PBI** — trigger (6) Storage Box BX11 and the billing-accurate (7) S3 egress need a Hetzner/Storage-Box/S3 usage exporter scraped into Prometheus. Shipped here as a disabled-by-comment Storage Box rule + a live in-cluster egress *proxy*; swap to exporter forms once it exists.
2. **Runbook anchors** — the new `runbook_url` anchors (`#scale-node-memory`, `#scale-cpu-steal`, `#csi-volume-cap`, `#egress-allowance`, `#mem-overcommit`, `#storagebox-full`) should be added to `docs/runbooks/infra-alert-response.md` in the same PR so the Telegram "↳ runbook" links resolve.

**Sovereignty check:** the only remediation touching the network path is the egress alert's suggested mitigation, explicitly scoped to *a CDN/cache in front of STATIC assets only* — the verification path, BYOK secrets, and DB credentials are never proposed for US-terminating SaaS.

---

## 4. Scale runbook (per-resource: signal → threshold → action)

Each row is a minimal operation against the single-node cx43 (`restormel-sovereign-master1`, hel1, id 143382025), not a re-architecture. Thresholds key off the Section-3 alerts. **Sovereignty guard:** every action keeps the verification path, BYOK secrets, and DB credentials on Hetzner EU (hel1/fsn1); only static-asset caching may sit in front, flagged where it appears.

| Signal (Section 3 alert) | Threshold | Action (minimal concrete op) | Reversible / notes |
|---|---|---|---|
| **`NodeMemorySustainedHigh`** (mem-limit overcommit already 131% on one 16 GB node) | Working-set RAM >85% for 15 min, **or** any OOMKill on a CNPG/Surreal/etcd pod | 1. Confirm burst group `restormel-sovereign-burst` is `0:2 CPX31`. 2. Scale on: bump autoscaler min to `1:2` so one CPX31 agent joins. 3. Evict **stateless** load first (Sophia 2 replicas, Supabase studio/imgproxy/meta) onto the new agent; keep CNPG/etcd on master. 4. Confirm node Ready, pods rescheduled. | **Reversible** — drain agent, set min back to `0` (~EUR 8.21/mo CPX31 while up). Agents-only: RAM headroom, **not** control-plane HA. Do NOT move CNPG primaries here without a PDB review (F1/F7). |
| **`NodeCPUStealSustained`** (shared cx43; steal 0% now) | CPU steal >10% avg over 30 min, **or** p99 latency regression traced to scheduler wait | 1. Provision a **dedicated/ARM** server in hel1: `ccx23` (x86) or `cax21/cax31` (Ampere ARM) — confirm node-arch + image compat first (CNPG/Surreal/Cilium all have arm64). 2. Join as new master-eligible node. 3. Drain `master1`, migrate, then resize/retire cx43. | **Reversible up to cutover** — keep cx43 until the dedicated node is verified. ARM = best EUR/perf but validate multi-arch before data moves (one-way once data moves). Stays hel1 (sovereignty-safe). |
| **`StorageBoxNearFull`** (BX11, 0.37% now) | BX11 >80% of 1 TB | 1. `restic -r <bx11-repo> snapshots`. 2. `restic copy` snapshots older than retention to **S3 fsn1** (cold/archival), then 3. `restic forget --keep-within <window> --prune` on BX11. 4. `restic check`. | **Reversible** — archived snapshots restorable from S3 before prune; never prune until the S3 copy verifies. Both targets Hetzner EU. Cheaper than enlarging BX11. |
| **`NodeEgressApproachingAllowance`** (~0.001% now) | Egress sustained >80% of allowance, **or** cross-region pull cost climbing | 1. **Diagnose first:** check what is pulling — most S3 reads are CNPG WAL restore + Loki; a spike is usually a restore loop or mis-shipped logs. 2. If **static asset** traffic, put a CDN/cache (Hetzner/Bunny EU PoP) in front of the static bucket only. 3. If backup/WAL traffic, fix the cause (crash-looping restore). | **Reversible** — CDN additive/removable. **Sovereignty flag:** CDN for *static assets only*; never front the verification path, BYOK, or DB-credential traffic — that is a US-terminating-SaaS trade-off, reject it. |
| **`CSIVolumeAttachmentCapReached`** (16/16 hard cap; Loki on emptyDir) | New PVC stuck `Pending` (`FailedAttachVolume`), **or** a workload needs a volume and none can bind | 1. **Add a second node** so new PVCs attach there — the 16-vol limit is **per node**. 2. **Or consolidate:** merge under-used PVCs (co-tenant CNPG WAL/data where safe) to free slots. 3. **Move Loki off emptyDir → S3-backed** (`restormel-loki-logs-fsn1`, `boltdb-shipper`/object-store) so it needs no PVC and stops losing history. | **Reversible** — Loki→S3 is config (revertible); node add reversible. Consolidation **not** trivially reversible (data move) — snapshot PVCs first. Frees the binding constraint without re-architecting. |
| **`SingleNodeDataPlaneDown`** / DeadMansSwitch / probe down (single-node = total outage) | Master `NotReady`/unreachable, dead-man's-switch fires, or all ingress probes down | **DR/restore path:** 1. Provision replacement node (hel1, cx43/dedicated) + re-bootstrap K3s control-plane from etcd snapshot (or fresh + Argo app-of-apps re-sync). 2. **CNPG:** PITR each cluster via barman-cloud from `restormel-cnpg-backups-fsn1` to last good LSN; verify WAL chain. 3. **Surreal:** restore from backup **once F2 is fixed** (cronjob un-suspended + Argo `sophia-surreal-backup` repaired) — *today this path is broken; restore is best-effort from last manual snapshot*. 4. Re-point Traefik/DNS, smoke probes. | **Recovery, not reversible** — cold-restore drill. Single-AZ (all hel1 incl. backup bucket, F9) ⇒ a region event is uncovered. **Run a restore drill against the live S3/barman path before relying on stated RTO (F6).** Surreal RPO is ∞ until F2 lands. |
| **`NodeMemoryLimitOvercommit`** (131% mem, 256% CPU; sophia/argocd/operators/cilium unbounded) | Cluster mem-limit overcommit >120% **or** any unbounded workload's RSS in top-3 node consumers | 1. Identify unbounded pods (`resources.limits==null`). 2. Set conservative `limits`/`requests` from observed p95 (Prometheus) so committed limits fit one node's 16 GB. 3. Add/verify a `PriorityClass` so etcd/CNPG primaries evict **last**. 4. Roll via GitOps PR (additive, sign-off). | **Reversible** — limits declarative; revert in git. Bounding the unlimited workloads removes the OOM-cascade risk (F7) **without** adding cost; do this *before* paying for a second node where possible. |

**Operating notes (apply across all rows):**
- **Order of preference at any capacity trigger:** (1) bound/right-size limits (free, F7) → (2) move Loki off emptyDir to S3 (free, F5) → (3) scale the burst group on for *stateless* headroom (cheap, reversible) → (4) add a dedicated/ARM node only when steal or true growth justifies it. Multi-node HA (F1) is a planned program, never a runbook reflex.
- **All actions are GitOps-first:** node/limit/Loki changes land as a manifest PR for human sign-off — nothing applied directly to the cluster from this runbook.
- **Sovereignty invariant:** every scale target stays on Hetzner EU (hel1 compute, fsn1 S3, BX11). The only off-cluster addition permitted is a static-asset CDN/cache; anything terminating the verification path, BYOK secrets, or DB credentials on US SaaS is out of scope and must be escalated as a trade-off.
- **Prerequisite debt that caps real RTO:** the single-node-down row depends on F2 (Surreal backup) being fixed and F6 (a real CNPG restore drill) being run; until then the DR action is documented but unverified.

---

## 5. Gated actions awaiting sign-off

All of the following are recommendation-only — **nothing was applied to the cluster or any server, and no manifests were pushed.** Each needs explicit human sign-off:

1. **GitOps PR — scale-trigger PrometheusRules** *(low-risk, additive)*. Commit `phase2-scale-alert-rules.yaml` → `restormel-gitops/monitoring/rules/scale-trigger-rules.yaml`. Additive (all-new alert names), no Alertmanager change, Argo-synced via the `monitoring` app. Bundle the runbook-anchor additions to `docs/runbooks/infra-alert-response.md` and raise the exporter PBI (Storage Box + S3 usage) so triggers (6)/(7) can move from proxy to billing-accurate.
2. **Decommission `.166` restormel-build (cx43)** — EUR 15.99/mo. Gate: confirm no Forgejo runner/cron/private-net dep → snapshot → power off → observe CI/deploys green 3–7 days → `DELETE /servers/142914745`.
3. **Decommission `.167` surreal-forgejo (cx33)** — EUR 8.49/mo. Gate: confirm in-cluster Surreal is system of record → reconcile the dead `restic-surreal` BX11 repo → snapshot → power off → observe → `DELETE /servers/140639164`. **Sequence after action 2.**
4. **Any Hetzner API mutation** (snapshot/power-off/`DELETE`) and **`.150` retirement** — `.150` is explicitly out of Phase-2 scope; only retire as part of the F8 in-cluster Forgejo/Infisical migration.

**Sovereignty constraint (whole deliverable):** all savings are pure decommissioning of dark Hetzner EU capacity; no proposal relocates the verification path, BYOK secrets, DB credentials, Infisical, or Forgejo onto US-terminating SaaS. The only permitted off-cluster addition is a static-asset CDN/cache.
</content>
</invoke>
