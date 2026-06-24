---
id: REC-INC-015
title: "Incident — Argo CD application-controller chronic OOMKill crash-loop (exit 137, ~63 restarts over 3+ days) on the K3s sovereign cluster; the 512Mi memory limit was below the controller's working set while reconciling 13 managed Applications. Resolved by raising controller memory to req 1Gi / limit 2Gi via restormel-gitops PR #7 + helm upgrade."
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
related: [REC-TPL-004, REC-INC-011, REC-INC-010, REC-INC-009, RISK-001]
---

# Incident — Argo CD application-controller OOMKill crash-loop (memory limit below working set)

> Filed from REC-TPL-004. Append-only once closed. Severity **medium** — the GitOps control-plane
> component (`argocd-application-controller`) was crash-looping, but **no production data-plane
> service was affected**: the controller's churn only delays Application reconciliation, and on this
> cluster prod sync is manual/gated (never auto-synced). All live prod endpoints stayed green
> throughout (restormel.dev 200, api.plotbudget.com /authorize 302, usesophia.app 200, grafana/argo
> 307). Latent for 3+ days; remediated 2026-06-24.

- **Detected:** chronic, pre-existing — the controller had been OOMKilled **~59–63 times over 3+ days**
  (most recent kill 2026-06-24 13:00:04 UTC before the fix). Surfaced and triaged during K3s
  cluster-stability work after the 3-node etcd HA change completed. **Reported by:** infra operator /
  gitops triage (restormel-gitops PR #7). **Severity:** medium (control-plane only; no prod impact).
- **What happened:** `argocd-application-controller-0` (StatefulSet, single replica, ns `argocd`,
  Helm release `argocd`, chart `argo/argo-cd 9.5.22`, appVersion `v3.4.4`) was in a chronic
  **OOMKill crash-loop**: `lastState.terminated` showed **exit code 137**, `reason: Error`, roughly
  every ~30 minutes, with **restartCount climbing to 63**. The controller manages **13 Argo
  Applications** (kube-prometheus-stack, CNPG cluster + backups, the plotbudget-supabase Helm
  release, sophia, the restormel workloads, root app-of-apps, etc.), several of which sit
  `Progressing` / `Degraded` and keep the reconcile loop hot. The controller's cached resource
  working set exceeded its **512Mi** memory limit, so the kernel OOM-killed it repeatedly. Steady-state
  usage measured **344 MiB** post-fix (cgroup `memory.current`) — already two-thirds of the old 512Mi
  limit at rest, before any reconcile spike, which is consistent with the limit being below the true
  working set.
- **Impact:** **Availability of the GitOps control plane only** — degraded/delayed Application
  reconciliation while the controller restarted. **No confidentiality or integrity impact.** **No
  production data-plane impact:** the three prod surfaces (restormel.dev, api.plotbudget.com
  Google-OAuth authorize, usesophia.app) and the SSO-fronted control planes (grafana, argo) were
  verified healthy before, during, and after the change. Prod Applications on this cluster are
  **never auto-synced** (manual/gated), so controller churn did not risk a self-applied change.
- **Response (timeline, all UTC 2026-06-24):**
  - **Pre-change baseline captured** — `argocd-application-controller-0`: restartCount **63**, last
    terminated exit 137 at 13:00:04, resources `requests {cpu:100m, memory:256Mi}` / `limits
    {memory:512Mi}`. Live Helm release `argocd` rev 1 values confirmed to match exactly. Prod health
    probed green. Node memory headroom confirmed ample (master1/node2 ~16Gi, node3 ~8Gi allocatable).
  - **~13:35 — merged restormel-gitops PR #7** (`fix/argocd-controller-oom-memory` → `main`, head
    `6d6bda8`) on Forgejo (canonical origin). The diff is **solely** `bootstrap/argocd-values.yaml`
    `controller.resources`: `requests.memory 256Mi→1Gi`, `limits.memory 512Mi→2Gi`; CPU request
    unchanged (no CPU limit, by design, to avoid reconcile-loop throttling); `repoServer`, `server`,
    `applicationSet` untouched. Branch deleted on merge.
  - **Pre-apply guardrails** — the PR's "DO NOT sync now / hold until etcd HA is stable" gate was
    satisfied (cluster confirmed stable 3-node HA: master1 + node2 + node3 all Ready+schedulable,
    etcd 3 members) before applying. `helm upgrade --dry-run=client` rendered the controller
    StatefulSet with `limits.memory 2Gi` / `requests {cpu:100m, memory:1Gi}` and exited 0.
  - **13:39:33 — applied via Helm** (the documented out-of-band bootstrap path, not an auto-synced
    Application): `helm upgrade --install argocd argo/argo-cd --version 9.5.22 --namespace argocd
    --create-namespace -f bootstrap/argocd-values.yaml`. Result: release upgraded to **rev 2**,
    STATUS deployed. Helm rolled the `argocd-application-controller` StatefulSet (one clean restart);
    `argocd-server` and `argocd-repo-server` also rolled to fresh replicas as part of the rev-2
    reconcile (graceful, expected — the chart-version convergence; old replicas terminated cleanly).
  - **13:41:13 — new controller pod up** with the new resources, restartCount **0**, ready, no prior
    `lastState` (OOM history cleared). Controller logs showed it actively reconciling (root,
    monitoring, etc.), not crashing.
  - **13:42–13:45 — stability watch (~3.5 min):** polled the controller every 20s — restartCount
    stayed **frozen at 0**, ready=true the entire window (the controller was previously OOMing every
    ~30 min, so a stable 3.5 min window plus 4x headroom is the proof). Watch ended `regressed=0`,
    `lastState={}`.
  - **Throughout — prod health re-verified** green at every step (restormel.dev 200, plotbudget
    /authorize 302, usesophia.app 200, grafana 307, argo 307). No degradation, no new crash-loop, so
    **no rollback was triggered**.
- **Root cause:** the Helm-managed `controller.resources` memory **limit (512Mi) was set below the
  application-controller's real working set**. As Argo CD took on 13 managed Applications — several
  perpetually `Progressing`/`Degraded`, which keeps the reconcile loop and the in-memory resource
  cache hot — steady-state usage (~344 MiB) plus reconcile spikes crossed 512Mi and the kernel OOM-
  killed the container (exit 137) on a ~30-minute cadence. The under-sized limit was a sizing defect
  in the original lean bootstrap values, not a leak or a regression from the concurrent etcd HA work
  (the restart count was pre-existing).
- **Follow-ups:**
  - [x] **restormel-gitops PR #7 merged** — git `main` (`bootstrap/argocd-values.yaml`) now matches
    the live Helm release (rev 2). No drift between source and cluster for this change.
  - [ ] **Wire memory/OOM alerting for the Argo control plane** — there is currently no alert when
    `argocd-application-controller` (or any control-plane pod) OOMKills; this crash-loop ran latent
    for 3+ days unnoticed. Add a kube-prometheus-stack / Alertmanager rule on container restarts +
    `reason=OOMKilled` for ns `argocd` (and ideally cluster-wide), routed to the existing
    Telegram/PostHog path. Owner: @adam.
  - [ ] **Right-size the other Argo CD components** — `repoServer` (384Mi limit) and `server`
    (256Mi limit) were left untouched and have not OOMed, but should be re-checked against live
    `kubectl top` once a metrics-server is available (see next item). No change made here.
  - [ ] **Install metrics-server** — `kubectl top` was unavailable during this incident ("Metrics API
    not available"), so live memory had to be read from the cgroup directly. A metrics-server would
    make future right-sizing and OOM triage faster. Owner: @adam.
  - [ ] **RISK-001 (single-node SPOF / memory over-commit):** no register change required — this
    incident is consistent with the already-open treatment gap (right-sizing / workload-spread on the
    contended nodes). The added headroom reduces this component's OOM sensitivity; the durable fix
    remains the HA / workload-spread mitigations already tracked under RISK-001.
  - **Closed:** 2026-06-24 — controller running clean with req 1Gi / limit 2Gi, restartCount frozen at
    0 across the verification window, Argo reconciling, all prod surfaces green, and git `main` ==
    live release.
