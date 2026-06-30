# Infrastructure Excellence Review — K3s estate, 2026-06-30

A five-dimension read-only review of the Restormel K3s cluster (resilience/DR, efficiency/right-sizing,
storage/S3, scaling-headroom, networking/observability), run overnight as a parallel agent swarm and
synthesised here. Scope: the live cluster + `restormel-gitops` + Hetzner (servers, volumes, S3 fsn1).
Convergent with **RES-68/69/70/71** and follows the **RES-123** alert-storm remediation.

> Cluster at review time: **3× cx43** (8 vCPU / 16 GiB) control-plane+etcd nodes in `hel1-dc2`
> (node2, node4, master1), Cilium CNI (kube-proxy-replacement), 5 CNPG Postgres clusters, SurrealDB,
> Huly, Supabase/PlotBudget, Loki/Prometheus/Alloy, Argo CD GitOps, fsn1 S3 for backups.

## Executive summary

The foundations are genuinely strong: 3-member etcd HA with S3 snapshots and a **proven** cold-start
restore drill (REC-EVID-006); CNPG with hard anti-affinity, PDBs, WAL archiving, daily object-locked
backups; a passing weekly DR drill; a thoughtfully-tuned Prometheus alert suite; a two-path dead-man's
switch; Cilium healthy with Hubble. After tonight's cx33→cx43 rescale the cluster is homogeneous.

The gaps are concentrated in four areas: **(1) public ingress is a single-IP SPOF on master1**;
**(2) node load is badly skewed** (node2 at 91% memory-requests, node4 at ~13%) from over-provisioned
requests + the fresh node4 never being rebalanced onto; **(3) NetworkPolicy segmentation is thin** (8
sensitive namespaces fully open, incl. `external-secrets`); **(4) S3 backup hygiene** (etcd snapshots
growing unbounded, 18.5 GiB orphaned restic, all PVs were `reclaimPolicy: Delete`).

None is a live outage. Several were fixed tonight; the rest are queued below.

## What's working well

- **etcd HA + DR:** 3 members (tolerates 1 loss), hourly S3 snapshots on all nodes, cold-start restore
  proven on real hardware (REC-EVID-006); weekly `dr-restore-drill` passing (last 2026-06-29, within SLA).
- **CNPG (5 clusters):** required hostname anti-affinity (primary↔replica on different nodes), per-primary
  PDBs, continuous WAL archiving, daily base backups to an **object-locked** bucket (30d retention / 25d
  lock), retention prune every 30 min.
- **SurrealDB** hourly restic backup with proper keep policy; **Loki** S3 chunks + 30d compactor retention.
- **Observability:** a deeply-tuned alert suite (node/etcd/CNPG/cert/Traefik/CronJob/OOM/CSI-cap/ESO/Argo/
  DR/egress + watchdog), Alertmanager→Telegram with inhibition rules, two independent dead-man's-switch
  paths, Cilium + Hubble healthy (eBPF TCX, kube-proxy-replacement).
- **Autoscaler is live:** `cluster-autoscaler` managing a `restormel-sovereign-burst` group (0–2 nodes).
- **Traefik DaemonSet** on every node; **restormel-dashboard/worker** correctly anti-affinity-spread.
- **Homogeneous nodes** after the cx33→cx43 rescale — removes the heterogeneous-overcommit alert class.

## Done tonight (merged + applied)

| Fix | Where |
|---|---|
| Loki `replication_factor` 3→1 (single-binary ring quorum bug → query 500s) | gitops #104 |
| Loki ruler `storage: s3→local` — **restored 5 silently-dead LogQL forensic alerts** | gitops #104 |
| Prometheus req/limit raised (was at 93% of limit → OOM risk) | gitops #104 |
| **`reclaimPolicy: Retain` on 12 crown-jewel data PVs** (CNPG×10 + Forgejo + Surreal) — accidental PVC delete can no longer destroy the block volumes | live patch |
| allotmentology-web → 2 replicas (HPA min 1→2 + PDB flip) — was a node2 SPOF | gitops #105 |
| restormel-dashboard/worker requests right-sized (3–6× over) — frees node2 | gitops #105 |
| (RES-123) pg-forgejo metrics netpol, ArgoSync counter-bug, cert cleanups, Loki→PVC, node rescale | #102/#103 |

## Risk & improvement register

Status key: ✅ done tonight · 🔶 staged for review · 🔑 founder-decision (cost/risk/judgement).

### Resilience / HA
- 🔑 **[P0] Ingress single-IP SPOF.** All DNS → master1's IP; master1 loss = total HTTP/CI/secrets
  blackout though node2/node4 Traefik are healthy. Fix: **Hetzner LB (~€6/mo)** → all 3 node IPs, flip
  DNS to the LB IP (the Traefik values already call this out as reversible). *Highest-leverage single
  change.* Interim: a documented 2-command DNS re-point runbook to node2. **Not auto-done — a DNS
  cutover of git/secrets/prod unattended is too high-blast-radius.**
- 🔑 **[P0] No Hetzner placement group** → all 3 nodes may share a physical host → one hypervisor failure
  loses etcd quorum. Fix: `hcloud placement-group create --type spread` + attach all 3 (needs a rolling
  one-at-a-time reboot — supervised).
- 🔶 **[P1] Sophia: 2 replicas both on master1, no anti-affinity, no PDB.** (Deployment is in the sophia
  app's own repo, not gitops — fix there: required hostname anti-affinity + PDB.)
- 🔶 **[P1] Missing PDBs:** Forgejo (single pod, master1), argocd-application-controller (node2), Grafana,
  Alertmanager. Add `minAvailable: 1`.
- 🔑 **[P2] CNPG has zero instances on node4** → simultaneous master1+node2 loss drops all DB replicas.
  Options: 3 instances/cluster (one per node; +150 GiB storage) and/or `maxSyncReplicas: 1` on
  pg-restormel for zero-RPO on the prod DB (write-latency cost).
- ✅ allotmentology-web HA done; ✅ crown-jewel PV Retain done.

### Efficiency / right-sizing (RES-70 — note: the ticket's "single node 131%/256%" framing is STALE; now 3× cx43, overcommit alerts resolved)
- ✅ dashboard/worker/prometheus/loki right-sized.
- 🔶 **[P0] supabase/kong: 22 OOMKills**, at 99% of a 512Mi limit. Raise limit→1Gi, request→512Mi.
  (Kong is in the Supabase Helm release — fix in its values.)
- 🔶 **[P0] forgejo-runner: 3 OOMKills** on the runner container — limit 512Mi→1Gi.
- 🔶 **[P1] Over-provisioned requests packing node2 to 91%:** CNPG instances (250m/512Mi req vs ~20m/100Mi
  actual — 7–22× CPU over), Huly `req=limit` pods (~2.8 GiB reserved vs ~730 MiB used), sophia (250×
  CPU over). Reduce requests (stateful → supervised rolling). **infisical req is *under* actual
  (726 MiB vs 512 MiB req)** — raise to 768 MiB so the scheduler counts node headroom honestly.
- 🔶 **[P1] Node imbalance:** node4 ~13% used. After right-sizing, roll stateless deployments so the
  scheduler places replicas on node4; or deploy the **Descheduler** (`LowNodeUtilization`) for automatic
  rebalancing (respects PDBs/anti-affinity, skips PVC-bound pods).
- 🔶 **[P2] Huly best-effort pods** (front/kvs/transactor have no resources → first evicted under pressure) — add minimal requests.

### Storage / S3
- ✅ **All crown-jewel PVs → Retain** (was the single biggest data-loss exposure).
- 🔑 **[P0] etcd S3 snapshots unbounded** (~2.9 GiB/day; ~87 GiB at 30d). K3s prunes only local disk, not
  S3. Fix: reduce to every-6h cron (4× less) AND/OR an S3 lifecycle expiry at 21d (object-lock is 14d).
  *Not auto-applied — modifying a DR backup bucket's lifecycle unattended is risky; commands documented.*
- 🔑 **[P0] registry-mirror bucket** is additive-only (`aws s3 sync` without `--delete`) + object-locked
  30d → unbounded layer accumulation. Remove object-lock (it's a convenience mirror, not a jewel) + add `--delete`.
- 🔑 **[P1] 18.5 GiB orphaned restic** (`restic-buildops` 7.1 GiB, `forgejo-data-k3s` 11.2 GiB — the .150→K3s
  migration backup, migration long complete; `restic-surreal` 168 MiB). Delete after you confirm the
  migrations are settled.
- 🔑 **[P1] No S3 lifecycle backstops** on any bucket; **[P2]** orphaned `backups-fsn1` ObjectStore;
  **[P2]** huly/plotbudget content buckets have no versioning (a stray `s3 rm` loses user content).

### Scaling headroom
- 🔶 **[P1] Burst node group misconfigured:** CPX31 (half the cluster node size) + **no taint** → a
  stateful pod could pin a PVC to a scale-to-zero node. Fix: cx43 + `workload=burst:NoSchedule` taint +
  tolerations on stateless deployments. Raise max to 5.
- 🔑 **[P1] No ResourceQuota/LimitRange** on prod namespaces (restormel-prod, allotmentology-prod, sophia,
  data) → noisy-neighbour risk. Add quotas + default LimitRanges.
- 🔑 **[P2] CSINode.volumeLimits is null** → the scheduler can't pre-enforce the Hetzner 16-volume/node cap;
  master1+node2 are at 14/16 → a 2nd new PVC on either node will silently wedge in `ContainerCreating`.
  Prefer node4 for new PVC workloads; rebalance a CNPG replica to node4 when convenient.
- 🔑 **[P2] Scale-up path** (cx43→cx53 rolling, one node at a time) documented in the playbook below.

### Networking / observability
- ✅ Loki ruler + RF fixed; pg-forgejo scrape + ArgoSync bug fixed (RES-123).
- 🔑 **[P1] 8 sensitive namespaces have NO NetworkPolicy** (restormel-prod, sophia, data, supabase,
  **external-secrets**, argocd, allotmentology-prod, + pg-platform/plotbudget/restormel unrestricted).
  Any compromised pod can reach the Postgres primaries or ESO (full-secret exfil). Add default-deny +
  selective-allow per the Forgejo/Infisical pattern. **Med risk — test in restormel-integration first.**
- 🔶 **[P1] No Loki ingestion/canary alert** — tonight's ring failure was silent. Add `LokiCanaryFailing` / 5xx-rate rules.
- 🔶 **[P2] Redundant `NodeDiskAboveEighty`** alert (overlaps NodeDiskPressure*) → Telegram noise. Remove.
- 🔑 **[P2] Cilium encryption disabled** — east-west (app↔DB, CNPG replication) is unencrypted on the
  overlay. Consider WireGuard (`encryption.type: wireguard`) given the sovereignty posture.
- 🔶 **[P2] Node label inconsistency:** master1 uses `restormel.dev/role=data`; node2/node4 use bare
  `role=data`. Standardise (add `role=data` to master1 as a quick live fix).

### Security (RES-69)
- 🔑 **[P1] Infisical + ESO bootstrap SPOF:** the `external-secrets/infisical-machine-identity` Secret is
  the cold-start root for all 5 ClusterSecretStores / 32 ExternalSecrets and cannot be synced *from*
  Infisical. Document the recovery path + escrow it; add a `default-deny-ingress` NetworkPolicy to the
  external-secrets ns (ESO is outbound-only). **Enable Infisical admin MFA** (founder action).

## 2× / 5× scaling playbook

**To 2× (within a week):** ① Hetzner LB → DNS (kills the ingress SPOF) · ② move 1–2 CNPG replicas to
node4 (frees CSI slots on master1/node2) · ③ Descheduler (evens spread) · ④ taint+resize burst nodes.
Outcome: stateless tier HPAs to 3/node across 3 nodes, CNPG redistributed, ingress genuinely HA, master1
mem-requests 91%→~75%.

**To 5× (within a month):** all of 2× · roll all nodes cx43→cx53 (16 vCPU/32 GiB, one at a time, quorum
held) · raise HPA maxima · add 2 dedicated cx43 *worker* nodes (no control-plane) and push stateless
workloads onto them · CNPG 3rd replica per cluster for read scale-out · consider ccx33 dedicated-CPU for
CNPG primaries if `NodeCPUStealSustained` fires.

## Convergence with the RES backlog
- **RES-70** (right-size/overcommit): the acute overcommit is *resolved* by the homogeneous rescale; the
  app-tier right-sizing is *done*; CNPG/Huly/sophia/kong right-sizing is queued above. → In Progress.
- **RES-71** (backup reconcile + CNPG restore drill, Urgent): the drill *passes weekly* and barman→S3
  *works*; residual = delete the orphaned restic (BX11-era) + file the backup-record doc. → near-done.
- **RES-68** (cross-region DR): single-region (hel1) is the deliberate Package-C choice; the *immediate*
  sub-risk is the missing **placement group** (physical-host spread within hel1) — do that first; full
  cross-region remains a founder cost/architecture decision.
- **RES-69** (Infisical/ESO SPOF + MFA): documented above; MFA + escrow are founder actions.
