---
id: REC-INC-022
title: "Alert — NodeMemoryLimitOvercommit (K3s memory limits >100% of node RAM)"
class: evidence
owner: founder
status: open
classification: internal
control-tier: 3
created: 2026-06-27
last-reviewed: 2026-06-27
review-interval: P12M
retention: P6Y
related: [REC-TPL-004]
---

# Alert — NodeMemoryLimitOvercommit (K3s)

> Filed from REC-TPL-004. Severity **low** — a capacity *limit*-overcommit warning, NOT a
> live OOM/outage. Memory *requests* (what the scheduler actually reserves) are healthy at
> 49–63% across all nodes; no pods evicted, no service degradation, no data/confidentiality/
> integrity impact. Append-only once filed.

- **Detected:** 2026-06-27 — Alertmanager → Telegram, rule `NodeMemoryLimitOvercommit` (warn).
  **Reported by:** monitoring stack (founder forwarded).
- **What happened:** Sum of pod memory *limits* on a node exceeded node RAM (alert: 153.5%;
  on audit master1 135%, node2 112%, node3 112%). Limits are ceilings, not reservations, so
  this is a "what if every pod spikes to its limit at once" risk, not current pressure.
- **Impact:** None observed. Requests 49% (master1) / 57% (node2) / 63% (node3) — healthy
  headroom. No OOMKills, no evictions, no endpoint degradation.
- **Root cause / triage:** A few pods carry large limit-to-request ratios that inflate the
  limit sum: `surreal-0` 6Gi limit / 1Gi req (ns `data`, on master1 — the "heavy stateful pod
  on master" the alert names), `forgejo-0` 2.5Gi/0.5Gi, `forgejo-runner` 2.5Gi/0.4Gi,
  `argocd-application-controller` 2Gi/1Gi. The existing `cluster/limits/` LimitRanges already
  cap the unbounded *controllers*; the residual overcommit is from these *tuned* large-limit
  pods. Precise right-sizing is blocked because **metrics-server is absent** (no
  `v1beta1.metrics.k8s.io` APIService; `kubectl top` fails) — real usage is unknown.
- **Response (in progress — live-cluster steps gated for founder apply):**
  1. metrics-server restore — gitops PR `restormel-gitops#64` (`cluster/metrics-server/`,
     auto-sync). Enabler for `kubectl top` + HPA + data-driven right-sizing. **Staged, not
     merged** (live-cluster change → founder consent required).
  2. HPA for stateless app workloads (dashboard/worker) — staged PR; functions once
     metrics-server is live.
  3. Right-sizing the big stateful limits (surreal/forgejo) — DEFERRED until metrics-server
     yields real usage. `surreal-0` is 504-sensitive (`cluster/limits` README: "size UP"),
     so any reduction needs data + founder OK.
- **Follow-ups:** merge #64 → verify `kubectl top` → collect ~24h usage → right-size limits
  via PR → add HPA → evaluate VPA recommender. Founder decision held: rescheduling/right-
  sizing `surreal-0` off master1 (downtime risk). Tracked: backlog task #28.
- **Closed:** open — pending founder apply of the staged remediation.
