---
id: REC-INC-022
title: "Alert — NodeMemoryLimitOvercommit (K3s memory limits >100% of node RAM)"
class: evidence
owner: founder
status: closed
classification: internal
control-tier: 3
created: 2026-06-27
last-reviewed: 2026-06-28
review-interval: P12M
retention: P6Y
approved-by: founder
approved-on: 2026-06-28
related: [REC-TPL-004, REC-INC-024]
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

## Resolution (2026-06-28) — root cause revised: the rule counted DEAD limits

While verifying the sibling requests-overcommit fix ([[REC-INC-024]]), `NodeMemoryLimitOvercommit`
was found still firing at **131.2%**. With metrics-server now live (#64 merged), the real driver
turned out **not** to be under-sized live limits but the rule itself: `sum(kube_pod_container_resource_limits)`
counted **Completed/Succeeded pods**, which reserve nothing and cannot burst. **~3.5 GiB of phantom
dead limit** was inflating the sum:

- `supabase/*-migration` ×2 = **2.0 GiB** — orphan one-time Jobs (PlotBudget cutover, complete 5 d ago,
  unmanaged by Argo/Helm, no `ttlSecondsAfterFinished`).
- `registry-mirror/*` ×3 = **1.5 GiB** — normal retained CronJob history; backups/heartbeat ≈0.

Real **running-pod** limit-overcommit is **122.0%** — comfortably inside the founder-approved 130%
envelope. The big stateful limits are *not* the problem: 24 h-peak actuals (now measurable) sit well
under their ceilings (`surreal-0` 1.8/4 Gi, `forgejo-0` 0.56/2.5 Gi, `argocd` 0.87/2 Gi) and their
burst headroom is deliberate (REC-INC-022 original triage; argocd raised post-OOM 2026-06-24; surreal
504-sensitive). So the prior "right-size the big limits" plan is **not required** to clear this alert.

- **Remediation:** `restormel-gitops#76` — `NodeMemoryLimitOvercommit` now counts **RUNNING pods only**
  (`* on(namespace,pod) group_left() (kube_pod_status_phase{phase="Running"} == 1)`), threshold
  unchanged at 130%. Honest measure of the real correlated-burst blast radius; auto-excludes all
  finished-pod residue forever (no CronJob whack-a-mole). Verified live: raw 131.2% → running-only
  122.0% → does not fire. **Open for founder merge** (auto-syncs to the shared cluster).
- **Hygiene (optional, founder):** delete the 2 orphan `supabase` migration Jobs (unmanaged, complete) —
  now cosmetic since the rule excludes them; recommend setting `ttlSecondsAfterFinished` on future
  one-time Jobs.
- **Superseded plan items:** HPA-for-stateless and the `surreal-0`-off-master reschedule (backlog #28)
  remain as separate *capacity/hygiene* items, not blockers for this alert. The real capacity lever
  (node3 8→16 GiB) is held under [[REC-INC-024]]. metrics-server (#64) is live and retained.
- **Closed:** 2026-06-28 — resolved by `restormel-gitops#76` (running-only rule), verified live;
  founder-approved. Pending only the founder merge of #76 to deploy.
