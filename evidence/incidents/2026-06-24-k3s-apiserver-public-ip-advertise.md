---
id: REC-INC-013
title: "Incident — K3s control-plane flakiness: node2/node3 advertised PUBLIC IPs as kubernetes apiserver endpoints (in-cluster apiserver i/o-timeouts; blocked prod-DB HA spread); fixed via --advertise-address; no prod outage"
class: evidence
owner: "@adam"
approved-by: "@adam"
approved-on: 2026-06-24
status: closed
classification: internal
control-tier: 3
created: 2026-06-24
last-reviewed: 2026-06-24
review-interval: P12M
retention: P6Y
related: [REC-TPL-004, REC-INC-012, AST-022]
---

# Incident — K3s apiserver advertising PUBLIC node IPs (control-plane flap; blocked data-plane HA)

> Filed from REC-TPL-004. Append-only once closed. Severity **low/medium** — control-plane
> reconcile flakiness (Argo sync flaps) + a blocked HA-hardening task; **no production outage**:
> all public surfaces stayed healthy throughout detection and remediation. No data loss, no
> confidentiality or integrity impact (configuration defect, internal cluster networking only).

- **Detected:** 2026-06-24 ~15:10 UTC — single-threaded infra review of the 3-node etcd-HA K3s
  cluster (master1 + node2 + node3). `kubectl get endpoints kubernetes` returned
  `172.16.0.5:6443` (master1 private, correct) **+ `204.168.216.166:6443` (node2 PUBLIC, wrong) +
  `77.42.124.167:6443` (node3 PUBLIC, wrong)`. **Reported by:** operator (infra review).
  **Severity:** low/medium (degraded control-plane reconcile, no user-facing outage).

- **What happened:** node2 and node3 were started with `--node-ip=<private>` and
  `--node-external-ip=<public>` but **without `--kube-apiserver` `--advertise-address`**. K3s, when
  `--advertise-address` is unset, defaults the apiserver advertise-address to the node's
  **default-route source IP**. On both nodes the default route is via the public NIC `eth0`
  (`ip route get 1.1.1.1` → `src <public>`), so each apiserver advertised its **public** IP into the
  `kubernetes` (`default/kubernetes` → ClusterIP `10.43.0.1`) Endpoints. In-cluster pods scheduled on
  node2/node3 that reached the apiserver via the ClusterIP `10.43.0.1` were load-balanced to a public
  `:6443` and **intermittently timed out** (`dial tcp 10.43.0.1:443: i/o timeout`). This manifested as
  **Argo CD `cluster-addons` sync flaps** (`SyncFailed … i/o timeout`) and **blocked the deferred CNPG
  prod-DB HA spread** (the operator's apiserver calls during a reschedule were unreliable). Master1 was
  correct because its unit already carried `--advertise-address=172.16.0.5`. etcd itself was
  **unaffected** — `--node-ip` correctly set etcd peer/client URLs to the private IPs (verified all 3
  members `started`, peer addrs `172.16.0.x`), so this was an apiserver-advertising defect only, not an
  etcd-membership defect.

- **Impact:** Intermittent K3s control-plane reconcile flakiness — Argo CD application-controller
  (itself scheduled on node2) hit recurring `i/o timeout`/`connection refused` reaching the ClusterIP
  apiserver; `cluster-addons` flapped `Degraded`. The CNPG data-plane HA spread for `pg-restormel` and
  `pg-plotbudget` (the prod restormel.dev and api.plotbudget.com DBs) had been **deferred/blocked** by
  this flap, leaving both clusters with primary + standby **co-located on master1** (a single master1
  loss would lose the whole DB despite etcd-HA). **No production outage:** restormel.dev (200),
  api.plotbudget.com `/auth/v1/authorize` (302), usesophia.app (200), allotmentology.tech (200),
  grafana/argo (307) all healthy before, during, and after. Availability/reliability of the platform
  control plane only; no data, confidentiality, or integrity impact.

- **Response (timeline, 2026-06-24 UTC):**
  - ~15:10 — defect reproduced (`endpoints kubernetes` = 2 public IPs); baseline prod health all green.
  - 15:15 — root cause confirmed: node2/node3 missing `--advertise-address`; default route via public
    `eth0`; master1 (working) has `--advertise-address=172.16.0.5`. etcd confirmed healthy (3/3, private
    peers).
  - 15:15 — on-demand etcd snapshot taken on master1 (`pre-apiserver-fix-20260624-151547`) before any
    control-plane change.
  - 15:16 — **node2**: backed up `/etc/systemd/system/k3s.service`, inserted
    `--advertise-address=172.16.0.4` (matching master1 ordering; private IP already a `--tls-san`),
    `daemon-reload` + `systemctl restart k3s`. One server restarting = etcd 2-of-3, **quorum held** by
    master1 + node3. node2 Ready immediately; `endpoints kubernetes` dropped the node2 public IP for
    `172.16.0.4`; etcd 3/3 healthy; prod all green.
  - 15:17 — **node3**: same fix `--advertise-address=172.16.0.3`, restart (quorum held by master1 +
    node2). node3 Ready immediately; **endpoints now all-private** (`172.16.0.3/.4/.5`); etcd 3/3.
  - 15:18–15:20 — Argo application-controller `i/o timeout`/`connection refused` **stopped** (0 in
    repeated post-recovery windows; confirmed by a forced hard-refresh of `cluster-addons` that
    reconciled cleanly with no apiserver timeout).
  - 15:24–15:40 — with the control plane stable, **resumed the deferred CNPG data-plane HA spread**
    (Part 2 — see RISK/follow-ups): flipped `podAntiAffinityType: preferred → required` for
    `pg-restormel` (gitops PR #15) then `pg-plotbudget` (gitops PR #16), following the proven
    `pg-platform` pattern. CNPG rescheduled the standby off master1 (in-place, no switchover); both
    clusters returned to `healthy 2/2`, replication streaming/async/**zero lag**, primary identity
    stable. Final placement: all 3 prod DBs (`pg-platform`, `pg-restormel`, `pg-plotbudget`) spread
    across node2 + node3, **none co-located on a single node** → single-node-failure-safe.
  - During the `pg-plotbudget` primary in-place restart (~4 min) `api.plotbudget.com` authorize
    transiently returned 500/503 (Supabase write path during a Hetzner-CSI volume hand-off — a known
    CNPG primary-restart window), then recovered to a **stable 302**. Not reverted: the operator was
    actively progressing the volume re-attach; interrupting mid-handoff would have been more disruptive.

- **Root cause:** **K3s node-join provisioning for node2/node3 omitted `--advertise-address`.**
  `--node-ip` governs kubelet/flannel/etcd-peer addressing but **not** the apiserver advertise-address;
  with it unset K3s defaults to the default-route source IP, which on these Hetzner nodes is the public
  NIC. The fix is to pin `--advertise-address=<private>` explicitly (as master1 already did). The join
  automation/templates did not carry this flag to the worker control-plane nodes.

- **Follow-ups:**
  - **Codify `--advertise-address=<private-ip>` in the K3s node-join provisioning/templates** for every
    server node so re-provisioned/replacement nodes never re-introduce the public-advertise defect.
    (The two live nodes are fixed in-place; the systemd unit backups remain on each box.)
  - **Hetzner CCM `FailedToCreateRoute` (residual, non-blocking):** the cloud-controller's route
    controller logs `hcops/AllServersCache.ByName: restormel-node2/node3 … not found` — the k8s node
    names (`restormel-node2/3`) don't match the Hetzner server names (`restormel-build`,
    `surreal-forgejo`). **Not load-bearing** here: `flannel-backend=none` + Cilium owns the pod
    dataplane (`NetworkUnavailable=False` on all nodes, native VPC routes unused). Cosmetic log noise;
    track to reconcile node-name↔server-name (or disable the redundant route controller) separately.
  - Consider an alert/CI check asserting `endpoints kubernetes` contains **only** private `172.16.0.x`
    addresses, to catch any future public re-advertise immediately.

- **Closed:** 2026-06-24.
