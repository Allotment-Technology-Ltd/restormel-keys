---
id: REC-INC-016
title: "Incident — Argo CD gitops sync blocked cluster-wide by an intermittent pod→apiserver ClusterIP (10.43.0.1:443) timeout from the newly-joined K3s control-plane nodes (node2/node3), which registered their PUBLIC IPs as kubernetes-service endpoints; halted the planned CNPG pod-anti-affinity HA hardening (preferred→required) mid-task before any live data-plane change"
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
related: [REC-TPL-004, REC-INC-011, RISK-001]
---

# Incident — Argo CD sync flap blocks CNPG anti-affinity HA hardening (apiserver ClusterIP timeout from new nodes)

> Filed from REC-TPL-004. Append-only once closed. Severity **low** — an *infrastructure-internal*
> control-plane defect that blocked a planned change; **no production user impact** and **no live
> data-plane change** was made. Captured while fresh because it is a genuine HA-relevant cluster
> defect and the proximate blocker of the RISK-001 HA mitigation work.

- **Detected:** 2026-06-24 ~13:55 UTC, during the planned CNPG data-plane HA hardening (enforcing
  replica spread across the new 3-node HA cluster). **Reported by:** infra agent (this run).
  **Severity:** low (no prod degradation; planned change halted by a pre-existing cluster fault).

- **OUTCOME (one of three clusters hardened; two deferred):** `pg-platform` **was** successfully
  hardened — Argo applied `required` during a transient stable window, CNPG cleanly rescheduled the
  replica, and the cluster is now **fully spread off master1** (primary `pg-platform-1` on **node3**,
  replica `pg-platform-2` on **node2**), 2/2 ready, **zero-lag** streaming replication, primary
  identity unchanged, `allotmentology.tech` → 200. **`pg-restormel` (prod) and `pg-plotbudget`
  (recent P0, REC-INC-011) were deliberately DEFERRED** — driving their replica reschedule through an
  *actively-flapping* control plane risks a stuck/degraded replica on a production DB (the exact
  failure mode the procedure forbids). They remain untouched, healthy, zero-lag, both instances on
  master1. They will be hardened after the gating node-IP fix lands.

- **What happened:**
  - **Planned work:** the audit found all three CNPG clusters (`pg-platform`, `pg-restormel`,
    `pg-plotbudget`, ns `cnpg-system`) use `affinity.podAntiAffinityType: preferred`, so for every
    cluster BOTH the primary and the hot standby were co-located on `restormel-sovereign-master1`
    (verified: all 6 pods on master1). A master1 loss would therefore lose each DB despite etcd-HA —
    i.e. the etcd-HA gain was not extended to the data plane. The remediation is to flip anti-affinity
    to `required` (3 schedulable nodes, `instances: 2` → a free node always exists, so `required`
    cannot wedge scheduling) and let CNPG reschedule a replica onto node2/node3, **one cluster at a
    time**, with full health verification between each.
  - **Blocker:** the first cluster's change (`pg-platform`) was committed and merged to the gitops
    repo (`restormel-gitops` PR #8, merged), but **Argo CD never managed to apply it.** The Argo
    `cluster-addons` Application (auto-sync, `selfHeal: true`, `prune: true`) entered a sync **retry
    loop** that repeatedly failed with, e.g.:
    - `namespace auto creation failed: failed to get api resource: failed to discover server
      resources for group version v1: Get "https://10.43.0.1:443/api/v1?timeout=32s": dial tcp
      10.43.0.1:443: i/o timeout`
    - `failed to get API resource info for cert-manager.io/Certificate: unable to verify permissions`
      (same root cause — API discovery against the ClusterIP intermittently times out mid-sync).
    The Argo controller, repo-server and server pods are all scheduled on **node2**
    (`argocd-application-controller-0`, podIP 10.244.5.180). **5 such `i/o timeout` events to
    `10.43.0.1:443` were observed in a 6-minute window** → the path is flapping, not down.

- **Impact:**
  - **Production: NONE.** All public surfaces stayed green throughout (verified at baseline, after the
    PR merge, and at close): `restormel.dev` → 200, `api.plotbudget.com /auth/v1/authorize?provider=
    google` → 302, `usesophia.app` → 200, `grafana.allotmentology.tech` → 307,
    `argo.allotmentology.tech` → 307. The running apps talk to their backends directly (ingress /
    direct service paths), not via the Argo controller, so the controller's ClusterIP flap does not
    touch the serving path.
  - **Data plane: HEALTHY throughout.** All three CNPG clusters stayed `Cluster in healthy state`,
    2/2 ready, streaming replication `streaming`/`async`/**zero lag** at every checkpoint.
    `pg-platform` **did** converge to `required` during a transient stable sync window and CNPG
    cleanly moved its replica onto node2 (and primary onto node3) — a successful HA improvement with
    zero data-plane harm. `pg-restormel` and `pg-plotbudget` were left unmodified (still `preferred`,
    both instances on master1) by deliberate choice, not converged by Argo, so they carry no risk from
    this run.
  - **Control plane (the actual fault):** Argo gitops sync is **unreliable cluster-wide** while the
    flap persists. The `cluster-addons` Application is stuck `OutOfSync` / `Degraded` and cannot
    complete a sync; the `monitoring` and `root` Applications were observed reaching `Succeeded` only
    in transient windows where the network was up. **Any gitops change (not just this one) is at risk
    of not converging** until the apiserver-endpoint path is fixed.

- **Response (timeline, all UTC 2026-06-24):**
  - 13:50 — baseline captured: 3 CNPG clusters healthy, all replicas on master1, all `preferred`,
    zero replication lag; all 5 prod surfaces green.
  - 13:53 — `pg-platform` manifest edited `preferred`→`required` in a gitops branch; PR
    [restormel-gitops #8](https://git.allotmentology.tech/Allotment-Technology-Ltd/restormel-gitops/pulls/8)
    opened and **merged** (config-only; gitops repo has no required status checks).
  - 13:53–14:03 — Argo `cluster-addons` picked up the new revision (`4a6e321`) but its auto-sync
    operation looped on **retry attempts #1–#4**, each failing on the `10.43.0.1:443` i/o-timeout /
    "unable to verify permissions" discovery error. The live `pg-platform` affinity stayed
    `preferred` (change never applied).
  - ~14:00 — root-caused (read-only): the `kubernetes` service has **three** apiserver endpoints —
    `172.16.0.5` (master1, **private**), `204.168.216.166` (node2, **PUBLIC**), `77.42.124.167`
    (node3, **PUBLIC**). The two newly-joined control-plane nodes registered their **public** IPs as
    apiserver endpoints. When a pod's connection to ClusterIP `10.43.0.1:443` is balanced onto a
    node2/node3 endpoint, the path egresses to a public IP and **intermittently times out** (public
    routing / Hetzner firewall), producing the flap. master1's private-IP endpoint is reliable.
    A correlated `Warning FailedToCreateRoute … hcloud/CreateRoute: hcops/AllServersCache.ByName:
    restormel-node2 … not found` on node2 shows the Hetzner CCM has **not** fully registered the new
    nodes for routing — the same incomplete new-node network integration.
  - ~14:05 — **DECISION: STOP and do NOT force the change.** Per the run's hard guardrails, performing
    manual `kubectl apply` / CNPG replica `pod delete` surgery while the pod→apiserver path is flapping
    risks a reschedule that cannot complete cleanly (the exact replication-lag / unhealthy-replica /
    app-degradation failure mode the task forbids). The desired state is already correctly committed
    to git and is **idempotent** — it will converge on its own the moment a stable sync window opens,
    with no further action. Left as-is; no rollback needed because **no live change was made**.
  - 14:06 — close-out verification: all 3 CNPG clusters still healthy / 2-ready / zero-lag, replicas
    still on master1, live affinity still `preferred`; all 5 prod surfaces still green.

- **Root cause:**
  - **Primary (the sync blocker):** the **newly-joined K3s control-plane nodes (node2 = .166,
    node3 = .167) advertise their PUBLIC IPs as `kubernetes`-service apiserver endpoints**, so
    in-cluster pod traffic to the apiserver ClusterIP `10.43.0.1:443` is intermittently load-balanced
    over a public path that times out. This is a **node-join / k3s `--advertise-address` /
    `--node-ip` / kubelet-node-IP misconfiguration** on the expansion nodes (they should advertise the
    private `172.16.0.0/24` addresses, like master1's `172.16.0.5`), compounded by the Hetzner CCM not
    having registered the new nodes for pod-network routing (`FailedToCreateRoute`,
    `AllServersCache … not found`). Pre-existing from the 3-node expansion; **not** introduced by this
    change.
  - **Secondary (why it surfaced now):** the planned gitops change required Argo to complete a full
    `cluster-addons` sync, which is the first operation that depends on the controller pod (on node2)
    reliably reaching the apiserver ClusterIP. The flap had been latent (cosmetic `OutOfSync` on
    ExternalSecrets etc.) but only became blocking when a real apply was attempted.

- **Follow-ups:**
  - [ ] **Fix the apiserver-endpoint advertisement on node2/node3** so they register their **private**
    `172.16.0.x` IPs (k3s server `--advertise-address` / `--node-ip` / `kubelet --node-ip`), and
    confirm the Hetzner CCM registers routes for both new nodes (clears `FailedToCreateRoute`). Then
    `kubectl get endpoints kubernetes` should show three **private** IPs and the controller's
    `10.43.0.1:443` i/o-timeouts should stop. Owner: @adam. **This is the gating fix — it blocks all
    reliable gitops sync, not just CNPG.**
  - [x] **`pg-platform` hardened** — `restormel-gitops` PR #8 merged, Argo converged it to `required`,
    CNPG spread it (primary node3 / replica node2), verified healthy + zero-lag + `allotmentology.tech`
    200. Done this run.
  - [ ] **Resume CNPG hardening for the two prod DBs once the apiserver flap is fixed.** Apply the same
    `preferred`→`required` change, one cluster at a time, to **`pg-restormel`** (prod, restormel.dev)
    then **`pg-plotbudget`** (EXTRA care — recent P0 REC-INC-011; verify `api.plotbudget.com`
    authorize 302 after). Deferred deliberately because the reschedule must not run through a flapping
    control plane. Until done, **both `pg-restormel` and `pg-plotbudget` remain a master1 data-plane
    SPOF.**
  - [ ] **Interim de-risk option (optional, if HA is wanted before the node fix lands):** as a
    workaround the Argo controller could be pinned to master1 (whose private-IP apiserver endpoint is
    reliable) so syncs complete — but the correct fix is the node-IP advertisement above; do not treat
    pinning as the resolution.
  - [ ] **RISK-001 (single-node SPOF / overcommit):** no register change required. This incident is
    the *blocker* to the RISK-001 data-plane HA mitigation (CNPG replica spread). Note in the RISK-001
    treatment thread that the etcd control-plane is HA but the **CNPG data plane is still
    single-node** until both this node-IP fix and PR #8 (+ pg-restormel / pg-plotbudget equivalents)
    land.
  - **Closed:** 2026-06-24 (incident closed: blocker diagnosed, change safely staged in git, no prod
    or data-plane impact; remediation tracked in the follow-ups above).
