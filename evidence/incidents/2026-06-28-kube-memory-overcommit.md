---
id: REC-INC-024
title: "Alert — KubeMemoryOvercommit (K3s memory requests can't tolerate one-node loss)"
class: evidence
owner: founder
status: open
classification: internal
control-tier: 3
created: 2026-06-28
last-reviewed: 2026-06-28
review-interval: P12M
retention: P6Y
related: [REC-TPL-004, REC-INC-022]
---

# Alert — KubeMemoryOvercommit (K3s)

> Filed from REC-TPL-004. Severity **low** — a scheduling-headroom *requests*-overcommit
> warning, NOT a live OOM/outage. Actual node RAM is healthy at 53–63%; zero pending pods,
> etcd quorum intact, no evictions, no service degradation, no data/confidentiality/integrity
> impact. **Direct sibling of [[REC-INC-022]]** (the *limits*-overcommit, 2026-06-27) — that
> incident's honest fix caused this one. Append-only once filed.

- **Detected:** 2026-06-28 — Alertmanager → Telegram, rule `KubeMemoryOvercommit` (warning).
  **Reported by:** monitoring stack (founder forwarded).
- **What happened:** The stock kube-prometheus-stack `KubeMemoryOvercommit` rule fired. It
  compares `sum(pod memory requests) / sum(node allocatable memory)` against `(n-1)/n` (= 0.667
  for a 3-node cluster) — i.e. "could the cluster reschedule everything onto an *average* node
  if one died." Live value on audit: **0.692** (requests 26.35 GiB / allocatable ≈38.1 GiB),
  just over the line.
- **Impact:** None observed. Actual memory use per `kubectl top nodes`: node2 63%, node3 53%,
  master1 61%. No OOMKills, no evictions, no pending/unschedulable pods (`FailedScheduling`
  events: none), no endpoint degradation. This is a forward-looking *scheduling-headroom*
  heuristic, not current pressure.
- **Root cause / triage:** Two compounding facts. (1) The stock rule assumes **homogeneous
  nodes**; ours are deliberately **heterogeneous** — `restormel-node3` (the old `.167`) is only
  ≈7.6 GiB allocatable vs ≈15.2 GiB on `node2`/`master1`. (2) The cluster is the **lean
  Package-C design** (£57/mo cap, `infra-direction-2026-06-23`), which knowingly trades away
  full one-node-failure memory-scheduling headroom. The threshold was crossed because **the
  remediation of [[REC-INC-022]] honestly raised `surreal-0`'s memory *request* 1 Gi → 3 Gi**
  (≈2.7 Gi steady-state; done to fix the *limits*-overcommit by dropping its limit 6 Gi → 4 Gi).
  That +2 Gi of cluster-wide *requests* tipped the *requests*-overcommit ratio from ~0.62 to
  0.692. Verified the alert is not merely a bad formula: total allocatable (38.1 GiB) − the
  *largest* node (15.25 GiB) = 22.8 GiB < 26.35 GiB requests, so the cluster genuinely could
  not reschedule everything onto remaining capacity if a *large* node were lost — a true (and
  accepted) property of a lean 3-node cluster. Neither candidate "waste" reservation was waste:
  `surreal-0` 3 Gi (REC-INC-022, ≈2.7 Gi steady) and `argocd-application-controller` 1 Gi
  (raised from 512Mi on 2026-06-24 after ~60 OOMKills) are both deliberate post-incident values.
- **Response (founder decision 2026-06-28: tune the alert to the lean posture, not spend):**
  1. Disable the stock rule via `defaultRules.disabled.KubeMemoryOvercommit` in the
     kube-prometheus-stack values.
  2. Replace it with `ClusterMemoryHeadroomLow` (group `scheduling.capacity` in
     `monitoring/rules/cluster-node-rules.yaml`): a topology-honest rule that fires only when
     total memory requests exceed `sum(allocatable) − the SMALLEST node`, `for: 30m`,
     `severity: warn` — i.e. we could not even absorb losing our *smallest* node (loss of a
     *large* node is the knowingly-accepted manual-recovery event on this lean cluster). It
     self-relaxes correctly if `node3` is later resized.
  3. Genuine signals retained, untouched: `PodsPendingUnschedulable` (actual scheduling
     failure) + `NodeMemoryPressure` (actual RAM + swap).
  - Filed as **gitops PR restormel-gitops#75** (`fix/kube-mem-overcommit-lean-tune`). Verified
    live with `promtool query instant` against Prometheus: new rule requests 26.35 GiB vs
    threshold 30.49 GiB → **not firing, 4.1 GiB headroom**; stock ratio 0.692 confirmed > 0.667.
    Validated by ruby YAML parse + `kubectl apply --dry-run=server` (PrometheusRule schema).
- **Follow-ups:** merge `restormel-gitops#75` → Argo whole-estate auto-sync re-renders default
  rules without `KubeMemoryOvercommit` and applies the replacement → confirm the Telegram alert
  clears and `ClusterMemoryHeadroomLow` is present + green. **Capacity option held for founder**
  (not actioned): resize `node3` 8 → 16 GiB for genuine one-node memory headroom + a homogeneous
  cluster (Hetzner cost delta to be quantified; £57/mo cap is the constraint). metrics-server is
  now live (REC-INC-022 enabler `restormel-gitops#64` merged), which made today's request-vs-actual
  triage possible.
- **Closed:** open — pending merge of `restormel-gitops#75` (remediation goes live on Argo sync).
