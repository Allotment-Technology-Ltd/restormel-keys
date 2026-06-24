# K3s cluster resilience audit — post-HA fix queue (2026-06-24)

**Type:** read-only audit (no cluster mutation). **Scope:** sovereign K3s cluster
(`restormel-sovereign-master1` .5 + `restormel-node2` .4), feeding the **post-HA fix queue**.
**Performed during** the concurrent 3-node etcd HA member-add. **Cluster state at audit:** 2 etcd
control-plane nodes Ready; data plane effectively single-node (see F1).

> Every fix below is **apply-AFTER 3-node etcd HA is stable** unless explicitly marked otherwise.
> This document changes nothing; it is the triage input for follow-up PRs/PBIs.

---

## TL;DR — the headline

The etcd HA work makes the **control plane** 3-node, but the **data plane is still 100 % on
`master1`**. `restormel-node2` joined the control plane but the Hetzner cloud-controller-manager
**never initialised it** (empty `providerID`, "server not found"), so:

- node2 carries the `node.cloudprovider.kubernetes.io/uninitialized:NoSchedule` taint → schedules
  **no** ordinary workload;
- node2's hcloud CSI node driver **crashloops** (can't reach the Hetzner metadata service) → node2
  can mount **no** hcloud PersistentVolume.

Net effect: after etcd HA completes you have **quorum redundancy but no workload/storage failover
target**. Every stateful service (all 3 CNPG Postgres clusters, Surreal, Prometheus, Grafana,
Alertmanager) and every single-replica Deployment still lives only on `master1`, which is at
**142 % memory-limit / 275 % CPU-limit overcommit** and holds **all 16 hcloud volumes — exactly at
the Hetzner per-node 16-volume cap.** Fixing node2's cloud init is the highest-leverage post-HA
action; it unblocks F2–F6.

---

## Prioritised findings

### P0 — blocks the entire point of HA

#### F1. `restormel-node2` is not cloud-initialised → no real failover target (data plane still single-node)
- **Severity: Critical.** **Apply-after-HA: yes** (do not touch the node while etcd is reconfiguring).
- **Evidence:**
  - `node restormel-node2`: `providerID` is **empty**; `master1` has `hcloud://143382025`.
  - Taint on node2: `node.cloudprovider.kubernetes.io/uninitialized=true:NoSchedule`.
  - `hcloud-cloud-controller-manager` log, repeating: `error syncing 'restormel-node2': … no
    matching server found for node 'restormel-node2': server not found, requeuing`.
  - `kube-system/hcloud-csi-node-nnq9p` (on node2) **CrashLoopBackOff** (driver 46 restarts,
    registrar 39): `could not determine default volume location: failed to get location from
    metadata service: Get "http://169.254.169.254/hetzner/v1/metadata/availability-zone": context
    deadline exceeded`.
  - `cluster-autoscaler` node group is `--nodes=0:2:CPX31:HEL1:restormel-sovereign-burst`; node2 is
    a manually-added box whose name/type the CCM cannot match → consistent with "server not found".
- **Why it matters:** with node2 NoSchedule + CSI-down, the scheduler has nowhere to move pods.
  master1 reboot/loss = full outage despite 3-node etcd. The HA is control-plane-only until fixed.
- **Likely cause (verify before fixing):** name/provider mismatch between the K8s node object and
  the Hetzner server (the CCM matches by server name; node2 may have been joined with a name the
  hcloud API doesn't have, or with a token that can't see it, or it lives in a different
  network/location than the CCM expects). It is **not** an app bug.
- **Fix (post-HA):**
  1. Confirm in the Hetzner console/API that a server named exactly `restormel-node2` exists in the
     same project/location and that the CCM's hcloud token can see it (`hcloud server list`).
  2. If the names differ, either rename the K8s node to match the Hetzner server or set the node's
     `providerID` to `hcloud://<server-id>` (k3s: `--kubelet-arg=provider-id=hcloud://<id>` /
     `--node-external-ip`), then let the CCM remove the uninitialized taint.
  3. Once initialised, the CSI node pod reaches `169.254.169.254` and the crashloop clears.
  4. **Validate** before trusting failover: cordon master1 briefly in a maintenance window and
     confirm a throwaway hcloud-PVC pod schedules + mounts on node2.

---

### P1 — single points of failure that survive etcd HA

#### F2. Every stateful workload is pinned to `master1`; CNPG anti-affinity is `preferred`, not `required`
- **Severity: High.** **Apply-after-HA: yes** (and only meaningful once F1 is fixed).
- **Evidence:** all of `pg-platform-{1,2}`, `pg-plotbudget-{1,2}`, `pg-restormel-{1,2}`,
  `surreal-0`, Prometheus/Grafana/Alertmanager/Loki pods are on `restormel-sovereign-master1`.
  CNPG cluster spec: `enablePodAntiAffinity:true, podAntiAffinityType:**preferred**,
  topologyKey:kubernetes.io/hostname`. "preferred" let both replicas of each PG cluster co-locate
  on master1 because node2 was the only alternative and is unschedulable (F1).
- **Why it matters:** a CNPG "replica" on the same node as its primary gives **zero** node-failure
  protection — losing master1 loses both. Same for Surreal/monitoring (single-instance anyway).
- **Fix (post-HA, after F1):** once node2 is schedulable, the `preferred` anti-affinity will *tend*
  to spread new pods, but existing replicas won't move on their own. Consider switching the CNPG
  clusters to `podAntiAffinityType: required` (hard spread) so a node can never hold both
  primary+replica, then do a controlled CNPG switchover/rolling-restart to redistribute. Sequence
  the three clusters one at a time; verify `readyInstances` returns to 2 before the next.

#### F3. Cluster-wide singletons with no second node / no PDB
- **Severity: High.** **Apply-after-HA: yes.**
- **Evidence:**
  - `coredns` Deployment **replicas: 1** — cluster DNS is a SPOF; if it lands on a failing node,
    everything's name resolution stalls.
  - `traefik` is a **DaemonSet with 1 scheduled** (only master1 is schedulable) — the only ingress
    path. `ingressclass: traefik` is the sole controller.
  - **Zero** PodDisruptionBudgets exist outside the 3 CNPG-managed ones (`pg-*-primary`,
    `minAvailable:1`). Single-replica Deployments (`argocd-server`, `argocd-repo-server`,
    `cert-manager`, `cert-manager-webhook`, `external-secrets-webhook`, all of `supabase/*`,
    `restormel-dashboard`, `restormel-worker`) have **no PDB** → a node drain can take them to zero.
- **Fix (post-HA):** scale `coredns` to 2 with anti-affinity; once node2 is schedulable, Traefik
  DS will auto-place a second instance (verify). Add `minAvailable:1` PDBs for the
  ingress-/auth-/control-critical single-replica Deployments so future drains/upgrades fail-closed
  rather than dropping the only pod. (PDBs are advisory-safe to add now, but stage with the rest.)

#### F4. `restormel-dashboard` (prod) and `restormel-worker` run single-replica
- **Severity: High (prod-facing).** **Apply-after-HA: yes.**
- **Evidence:** `restormel-prod/restormel-dashboard` replicas=1, strategy RollingUpdate;
  `restormel-worker` replicas=1. No HPA exists anywhere (`kubectl get hpa -A` → none). `sophia`
  is the only app at 2 replicas.
- **Why it matters:** a single dashboard pod = restormel.dev has no in-cluster redundancy; any pod
  eviction, node drain, or OOM is user-visible downtime.
- **Fix (post-HA, after F1):** raise dashboard to 2 replicas with pod anti-affinity + a PDB once
  there's a second schedulable node to actually place the second replica on (pre-F1 a second
  replica just stacks on master1 and adds no resilience). Evaluate the worker for 2 as well.

---

### P2 — resource governance / overcommit (the RISK-001 overcommit)

#### F5. master1 is at 142 % memory-limit / 275 % CPU-limit overcommit; 44 containers have **no memory limit**, 38 have **no requests**
- **Severity: High.** **Apply-after-HA: yes** (a sweeping LimitRange/quota change near an etcd
  reconfig is risky; stage it).
- **Evidence:** `kubectl describe node master1` → Allocated **CPU limits 275 %**, **memory limits
  142 %**, memory **requests 63 %**. **44** containers cluster-wide have no `memory` limit and **38**
  have no resource requests — including platform-critical ones: every `cilium-*`, `cnpg-*` manager,
  `barman-cloud`, all `cert-manager-*`, all `external-secrets-*`, `hcloud-csi-controller`,
  `hcloud-cloud-controller-manager`, `reflector`, `system-upgrade-controller`, `loki-0`,
  `alloy`, several monitoring sidecars, and all of `argocd/*`.
- **Why it matters:** 142 % memory-limit overcommit on a 16 GB box means concurrent spikes trigger
  the node OOM-killer; limitless containers are unbounded blast radius and are scheduled with
  best-effort/burstable QoS (first to be killed, or able to starve others). This is the concrete
  expression of register RISK-001's overcommit concern at the pod level.
- **Fix (post-HA):** introduce a per-namespace `LimitRange` (default request+limit) so new/limitless
  pods get sane bounds, and set explicit `requests`/`limits` on the critical control-plane
  Deployments above. Prioritise memory limits on `loki-0`, `alloy`, `cilium-agent`, `argocd/*`.
  Pair with F2/F4 spread so the overcommit isn't concentrated on one node.

#### F6. All 16 hcloud volumes are on `master1` — at the Hetzner 16-volumes-per-node hard cap
- **Severity: High (capacity wall).** **Apply-after-HA: yes (after F1).**
- **Evidence:** 16 bound PVs; **all 16 `VolumeAttachment`s have `nodeName=restormel-sovereign-master1`,
  attached=true**. Hetzner's limit is 16 attached volumes per server. master1 therefore **cannot mount
  one more hcloud PVC** — any new stateful workload, or any attempt to add a third CNPG replica /
  expand monitoring storage, will fail to attach **on master1** with no headroom.
- **Why it matters:** this is the storage-side of "everything on one node". It also means the data
  plane literally cannot grow on master1; growth *requires* F1 (a second mounting node).
- **Fix (post-HA, after F1):** fixing node2 init immediately relieves this — once node2 can mount,
  new PVCs (and rebalanced CNPG replicas from F2) attach there, moving master1 below the cap. Track
  per-node attached-volume count as an alert (warn at 14/16).

---

### P3 — crashloops / degraded components (lower blast radius, fix opportunistically)

#### F7. `argocd-application-controller-0` OOMKilled — 62 restarts, exit 137, 512Mi limit
- **Severity: Medium.** **Apply-after-HA: yes.**
- **Evidence:** lastState terminated `exitCode:137 reason:Error`; `Limits.memory: 512Mi`,
  `Requests.memory: 256Mi`. Restarts clustered in the last ~3h (the audit/etcd window) — reconcile
  load + memory ceiling. Readiness probe flapped (`:8082/healthz connection refused`).
- **Why it matters:** when the Argo app-controller is OOM-cycling, GitOps reconciliation is
  intermittent — drift isn't corrected and self-heal is unreliable, including for the very
  manifests that would fix the items above.
- **Fix (post-HA):** raise the app-controller memory limit (e.g. 512Mi→1Gi, request 512Mi) and
  re-check restart count settles to 0. (Some restarts here may be collateral from the concurrent
  etcd/API blips; re-measure once HA is stable before assuming it's purely undersized.)

#### F8. `supabase/kong` restarting (4 restarts in ~4h)
- **Severity: Medium (gateway for Supabase/PlotBudget data API).** **Apply-after-HA: yes — re-measure first.**
- **Evidence:** `kong-54fccf6d-wwbrj` RESTARTS 4 (last 11m ago). Currently Running 1/1. Likely
  collateral from API/CNI blips during the etcd change, but worth confirming it settles.
- **Fix (post-HA):** re-check restart count an hour after HA stabilises; if still climbing, pull
  `kubectl -n supabase logs kong --previous` for the crash cause (commonly upstream-DNS/CoreDNS
  flaps — ties to F3 coredns singleton — or a failing readiness upstream).

#### F9. `argocd-server-tls` Certificate stuck `Ready=False` for 3+ days
- **Severity: Low–Medium.** **Apply-after-HA: yes.**
- **Evidence:** `argocd/argocd-server-tls` Ready=False, reason `DoesNotExist` ("Issuing certificate
  as Secret does not exist"), age 3d14h — i.e. it has been *Issuing* but never completed for days.
  All other certs (3 wildcards, supabase, barman, sophia) are Ready=True, so cert-manager + the
  Hetzner DNS-01 webhook work in general.
- **Why it matters:** the argocd-server UI may be serving a fallback/expired cert; low blast radius
  (internal tool) but a stuck issuance can mask a misconfigured Issuer/Ingress for argocd.
- **Fix (post-HA):** inspect the CertificateRequest/Order/Challenge chain for `argocd-server-tls`;
  usually a missing/incorrect `cert-manager.io/cluster-issuer` annotation or DNS-01 zone mismatch
  for the argocd host. Non-urgent.

---

## Things that are HEALTHY (explicitly cleared — no action)

- **CNPG backups: good.** All 3 clusters (`pg-platform`, `pg-plotbudget`, `pg-restormel`) report
  `Cluster in healthy state`, `readyInstances 2/2`, daily `scheduledbackup` (last backups 9–10h
  ago, all `completed`) via the `barman-cloud` plugin to object store `backups-fsn1`, with
  `isWALArchiver:true` (PITR/WAL archiving on). `barman-cloud-client/server` certs Ready.
- **Surreal backups: good.** `surreal-backup` CronJob hourly (`0 * * * *`), recent runs Completed;
  3 successful jobs visible in the last ~3h.
- **Dead-man's heartbeat: firing.** `monitoring/deadmans-heartbeat-…` CronJob completed minutes
  before audit — external alerting liveness intact.
- **Monitoring stack up:** Prometheus, Grafana (3/3), Alertmanager, Loki, Alloy (both nodes),
  blackbox-exporter all Running.
- **TLS:** wildcard certs for `restormel.dev`, `allotmentology.tech`, `usesophia.app`, plus
  supabase + sophia certs all Ready=True.
- **Note:** these backups protect against *data loss*, **not** against the *availability* gaps in
  F1–F4. Backups are healthy; failover is not.

---

## Suggested fix sequencing (after etcd HA is confirmed stable)

1. **F1** — cloud-init `restormel-node2` (set providerID / fix name match) → clears taint + CSI
   crashloop. *Unblocks everything below.*
2. **F6** auto-relieves as soon as node2 can mount; add a 14/16 attached-volume alert.
3. **F2** — flip CNPG anti-affinity to `required` + controlled switchover to spread replicas.
4. **F3/F4** — coredns→2, dashboard→2, add PDBs to single-replica critical Deployments.
5. **F5** — LimitRange per namespace + explicit limits on control-plane Deployments.
6. **F7 / F8 / F9** — re-measure post-HA (some restarts are etcd-window collateral); bump argocd
   app-controller memory; chase the kong restarts and argocd-server-tls issuance only if they
   persist after the cluster settles.

## Governance follow-up (ISMS)
- This audit substantiates and **extends register `RISK-001`** (single-host blast radius): the K3s
  migration is RISK-001's structural treatment, but F1–F4/F6 show the *current* cluster still has a
  single-node data plane. Recommend the owner update RISK-001's `treatment_status` to note "etcd
  control-plane HA in progress; data-plane failover still gated on node2 cloud-init (F1)" and track
  F1–F6 as treatment tasks (route via `restormel-product-ops` for PBIs).
- No incident record is required from this audit (no incident/outage occurred — read-only prep). If
  node2's storage gap had caused a *failed* failover it would be REC-TPL-004 territory; it did not.
