---
id: REC-INC-023
title: "Incident — Argo sync failure (ComparisonError) from broken staging+preview Application manifests"
class: evidence
owner: founder
status: closed
classification: internal
control-tier: 3
created: 2026-06-27
last-reviewed: 2026-06-27
review-interval: P12M
retention: P6Y
approved-by: founder
approved-on: 2026-06-27
related: [REC-TPL-004]
---

# Incident — Argo sync failure (ComparisonError) on staging + preview apps

> Filed from REC-TPL-004. Append-only once closed. Severity **low** — non-production control-plane
> noise, zero workload/data impact.

- **Detected:** 2026-06-27 ~09:xx UTC — Argo CD sync-failure alert (founder-relayed).
- **Reported by:** monitoring alert → founder.
- **Severity:** low.

## What happened

Two Argo CD `Application`s — **`restormel-dashboard-staging`** and **`restormel-preview`** (ns `argocd`) —
were reporting `sync: Unknown` with a `ComparisonError`:

> Failed to load target state: failed to generate manifest … error reading helm chart from
> `<cached>/charts/restormel-dashboard/Chart.yaml`: no such file or directory

i.e. Argo could not render their source, so the comparison failed and the apps showed perpetually
errored — which raised the sync-failure alert.

## Impact

**None on production or any workload.**
- All production Argo apps were `Synced` + `Healthy` throughout (`restormel-app-prod`,
  `allotmentology-prod`, `huly`, `huly-ingress`); `root`'s last sync **Succeeded**.
- Both broken apps managed **0 resources**; their destination namespaces
  (`restormel-staging`, `restormel-preview`) **do not exist**. No deployment, data, or user impact.
- Pure control-plane noise from never-functional apps.

## Root cause

Both apps (created 2026-06-22 during the K3s bootstrap) point at gitops path
`charts/restormel-dashboard`, which is an **incomplete chart stub** — only a `templates/` directory,
**no `Chart.yaml`** and a missing `values/restormel-dashboard-staging.yaml`. Manifest generation
therefore failed from day one (the chart was half-started and never completed; production deploys via
**raw manifests** in `applications/restormel-app-prod/`, not this chart). The condition was latent and
only surfaced as an alert now.

## Response / remediation

- Triaged read-only against the live cluster (Argo app status, conditions, managed-resource count,
  namespace existence) and the gitops repo (chart contents, app source paths, `root` syncPolicy).
- Confirmed `root` (app-of-apps) has `prune: true` + `selfHeal: true`, so removing the two app
  manifests from gitops makes `root` prune the two `Application` CRs on the next sync.
- **Remediation: restormel-gitops PR #73** — removes `applications/workloads/restormel-dashboard-staging.yaml`
  and `applications/workloads/restormel-preview.yaml`. On merge, `root` prunes the two CRs → the
  `ComparisonError` and the alert clear. (Founder-gated merge — prod-cluster control-plane change.)

This aligns with the founder-approved **Integration Train** plan (restormel-keys #351 / RES-114):
preview + staging are being consolidated into ONE pre-merge integration env, so the two separate
never-functional apps are removed rather than repaired.

## Follow-ups

- [ ] Merge gitops PR #73 → confirm `root` prunes both apps and the alert clears (founder).
- [ ] RES-114 (Integration Train) build: stand up the single integration env and clean up the orphaned
      incomplete `charts/restormel-dashboard` stub.
- [x] Incident record filed (this record, REC-INC-023).
