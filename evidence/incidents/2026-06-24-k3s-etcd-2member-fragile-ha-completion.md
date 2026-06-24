---
id: REC-INC-014
title: "Incident — K3s control-plane left at fragile 2-member etcd; completed to 3-member HA + fixed node providerID CSI crashloop"
class: evidence
owner: founder
status: closed
classification: internal
control-tier: 3
created: 2026-06-24
last-reviewed: 2026-06-24
review-interval: P12M
retention: P6Y
approved-by: founder
approved-on: 2026-06-24
related: [REC-INC-011, REC-PLAN-012]
---

# Incident — K3s etcd left at fragile 2-member state; completed to 3-member HA + node providerID/CSI fix

> Filed from REC-TPL-004. Append-only once closed. Severity **low** — production
> (restormel.dev, PlotBudget, Sophia, monitoring) stayed GREEN throughout; no data loss, no
> confidentiality/integrity impact. The risk was an unsafe-but-contained control-plane availability
> posture (2-member etcd tolerates 0 failures), not a live outage.

- **Detected:** 2026-06-24 ~12:49 UTC — inherited state at session start. A prior agent, mid-surgery,
  had promoted the build box `restormel-node2` (.166 / 172.16.0.4) from k3s worker to a control-plane +
  etcd **server**, taking the embedded etcd from 1 member to **2 members**, then was cut off. 2-member
  etcd requires both members for quorum (tolerates **0** failures) — a fragile, non-HA state.
  **Reported by:** founder hand-off (single-threaded remediation, full authorization).
  **Severity:** low (posture/availability-risk; no impact realised).

- **What happened:** The cluster sat at 2 etcd members (master1 `172.16.0.5` + node2 `172.16.0.4`),
  both `started`/healthy, raft in sync, but with no failure tolerance. Separately, node2's
  `hcloud-csi-node` DaemonSet pod was in `CrashLoopBackOff` (~85–91 restarts): the .166 worker→server
  reinstall left the node with an **empty `.spec.providerID`** and the
  `node.cloudprovider.kubernetes.io/uninitialized` taint, because the Hetzner cloud-controller-manager
  (CCM) matches nodes **by name** and the Kubernetes node names (`restormel-node2/3`) do not match the
  Hetzner server names → CCM logged `no matching server found` and never initialised the node.

- **Impact:** **None realised on production.** restormel.dev (200), api.plotbudget.com OAuth authorize
  (302), usesophia.app (200), grafana/argo (307) were GREEN before, during, and after every step. The
  only degraded object was node2's CSI DaemonSet pod (no PVC-backed workload runs on node2, so no
  storage was affected). All production data remained in CNPG `pg-restormel` (in-cluster), not on the
  box being repurposed.

- **Response (timeline, 2026-06-24 UTC):**
  - 12:49 — Baseline captured: etcd 2/2 healthy (raft index 1730998, no alarms); prod GREEN; fresh
    manual snapshot `pre-167-join-…-1782305378` (27 MB) saved + verified on disk.
  - **Data-safety gate (before repurposing the .167 rollback box):** confirmed (a) restormel.dev serves
    migrated data and the prod dashboard's `DATABASE_URL` points at
    `pg-restormel-rw.cnpg-system.svc.cluster.local/restormel_ops`, and (b) CNPG `pg-restormel` (2/2
    healthy) holds the data — 63 tables, 74 applied migrations, real rows (request_logs 2084,
    audit_events 365, models 254, routes 16, projects 4, api_keys 7). CNPG = data's home; .167's
    stopped Coolify `app-postgres` was only the rollback copy. Founder had released .167.
  - 12:54 — On `.167` (surreal-box, 172.16.0.3): stopped (not removed) the Coolify rollback stack
    (`coolify-proxy/sentinel`, `app-postgres`) preserving volumes; created `/etc/k8s-resolv.conf`;
    joined as a **server** mirroring node2's exact k3s flags (Cilium/flannel-none, kube-proxy &
    network-policy disabled, embedded-registry, external cloud-provider), node-ip 172.16.0.3.
  - ~12:57 — etcd reached **3 members**, all healthy, raft in sync → **fragile 2-member state escaped;
    true HA (quorum 2-of-3) achieved.**
  - **providerID / CSI fix (the durable, non-hack remediation):** master1 works because it carries
    `providerID=hcloud://143382025`; node2/node3 had none. Set each node's providerID via the kubelet
    (`--kubelet-arg=provider-id=hcloud://<server-id>`) in the systemd unit (persists across reboot) using
    the Hetzner server-ids from each box's own metadata service
    (node2 `142914745`, node3 `140639164`). On restart the CCM matches **by ID**, initialises the node,
    and clears the uninitialised taint.
  - node3 fixed cleanly on restart (Ready, providerID set, no taint). node2 required deleting its node
    object so it re-registered with the providerID; this caused k3s to remove node2's etcd member, so
    node2 was rejoined as a **fresh etcd member** (data-dir moved aside) — etcd returned to 3 healthy
    members (new member id `784fe28c8beb1065`). The 2-member window during node2's rejoin was covered by
    the other 2 healthy members (quorum held; prod GREEN).
  - node2's CSI then still crashlooped on `connect: no route to host` to the metadata service
    (`169.254.169.254`): the in-place node reset left **stale `OLD_CILIUM_*` iptables chains** and a
    masquerade rule pinned to node2's **old** pod CIDR `10.244.1.0/24`, while its reassigned CIDR was
    `10.244.5.0/24` → pod egress to the link-local metadata IP was not SNATed. Removed the stale
    `OLD_CILIUM_*` chains and restarted the Cilium agent; it regenerated `CILIUM_POST_nat` for the
    correct CIDR. Metadata then reachable from node2 pods (200); CSI → 3/3 Running, 0 restarts.
  - **Verification:** 3 nodes Ready (all providerID set, no taints); etcd 3 members all healthy + in
    sync (raft 1746574), 1 leader, no alarms; `/readyz/etcd` ok; all 3 `hcloud-csi-node` 3/3 Running 0
    restarts; zero crashlooping pods cluster-wide; PVC provision→attach→mount→write proven on **both**
    node2 and node3 (throwaway 10Gi PVCs, cleaned up — back to 16 PVs, all on master1); full prod
    health GREEN. Final snapshot `post-3node-ha-…-1782307573` saved. Forgejo CI runner on .166 stayed
    Up (k3s + Docker coexist).

- **Root cause:** Two compounding gaps in the K3s build-out. (1) **Node membership changes were left
  mid-transition**, parking etcd at an even-numbered 2-member quorum (the worst HA posture). (2) The
  cluster's nodes were joined **without a providerID** while the Hetzner CCM matches **by server name**,
  and the Kubernetes node names do not match the Hetzner server names — so every non-master node failed
  CCM initialisation (empty providerID, `uninitialized` taint, CSI crashloop), and a freshly-joined node
  was actively deleted by the CCM (`does not exist in the cloud provider`). The CSI's secondary failure
  on node2 was iptables/masquerade residue from an **in-place node-object reset** (stale Cilium chains
  bound to the old pod CIDR).

- **Follow-ups:**
  - **Bake `--kubelet-arg=provider-id=hcloud://<server-id>` into the standard node-join recipe** so new
    nodes initialise with the CCM by ID and never crashloop CSI. *(track via product-ops)*
  - **Reconcile Kubernetes node names ↔ Hetzner server names** (or standardise on providerID matching) so
    the CCM stops logging `no matching server found` for node2/node3 (route-creation and instance-metadata
    still error on name lookup even though providerID now works). *(founder decision; relates to the
    CCM autoscaler node-group naming)*
  - **Prefer node-recreation over in-place node-object delete** for nodes that have run pods, to avoid
    stale Cilium iptables/masquerade chains; if doing it in place, restart Cilium + flush `OLD_CILIUM_*`.
  - **Capacity note (not a fault):** all 16 hcloud volumes are attached to master1 (at the per-server
    ~16-volume cap); node2/node3 now being CSI-healthy means PVC-backed workloads can schedule onto them
    to relieve master1.
  - **Asset inventory:** `governance/asset-inventory.yaml` still describes the old Coolify .150/.167
    topology and does not yet track the K3s cluster/nodes — left for the founder reconciliation PR (not
    hand-edited here; another agent owns it). The cluster now has 3 control-plane+etcd nodes
    (master1 / .166 build box repurposed CP+etcd / .167 surreal-box repurposed CP+etcd from the
    cutover-rollback role).

- **Closed:** 2026-06-24.
</content>
</invoke>
