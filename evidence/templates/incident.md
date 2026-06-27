---
id: REC-TPL-004
title: "Template — Incident record"
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-15
last-reviewed: 2026-06-15
review-interval: P12M
retention: review-only
---

# Template — Incident record

> Copy to `evidence/incidents/<date>-<slug>.md` as `class: evidence`, `control-tier: 3`.
> Capture while fresh (incident-capture playbook). Append-only once filed.
> On **close**, set `status: closed` **and** `approved-by` + `approved-on` (the person who
> signed off the RCA + the date) — these become a CI-blocking requirement once finalized.

- **Detected:** `<datetime>`   **Reported by:** `<…>`   **Severity:** `<low|med|high>`
- **What happened:** `<…>`
- **Impact:** `<systems / data / people affected>`
- **Response:** `<actions + timeline>`
- **Root cause:** `<…>`
- **Follow-ups:** `<…>`   **Closed:** `<date>`
