---
id: REC-GOV-004
title: Statement of Applicability (ISO 27001 Annex A)
class: governance
owner: founder
status: draft
classification: internal
control-tier: 2
created: 2026-06-15
last-reviewed: 2026-06-15
review-interval: P12M
retention: P6Y-after-superseded
---

# Statement of Applicability (SoA)

> **Status: DRAFT skeleton.** ISO 27001:2022 Annex A has **93 controls** across 4 themes.
> This stub gives the structure and a few examples; **`[PLACEHOLDER — founder: complete all 93
> controls]`** with applicability (Y/N), justification, and implementation status.

Per-control row format: `control | title | applicable? | justification | status | evidence ref`.

## A.5 Organizational controls (37)
| Control | Title | Applicable | Justification | Status | Evidence |
|---|---|---|---|---|---|
| A.5.1 | Policies for information security | Yes | ISMS foundation | Drafted | `REC-POL-001` |
| A.5.19 | Information security in supplier relationships | Yes | Multiple sub-processors | Drafted | `suppliers.yaml` |
| … | `[PLACEHOLDER: A.5.2–A.5.37]` | | | | |

## A.6 People controls (8)
| A.6.x | `[PLACEHOLDER: A.6.1–A.6.8]` | | | | |

## A.7 Physical controls (14)
| A.7.x | `[PLACEHOLDER: A.7.1–A.7.14 — largely N/A for a remote solo founder; justify]` | | | | |

## A.8 Technological controls (34)
| Control | Title | Applicable | Justification | Status | Evidence |
|---|---|---|---|---|---|
| A.8.9 | Configuration management | Yes | Repo-anchored, CI-enforced | In progress | records CI |
| A.8.16 | Monitoring activities | Yes | Sentry + PostHog + posture agent | In progress | `evidence/posture/` |
| … | `[PLACEHOLDER: remaining A.8 controls]` | | | | |

> Complete the SoA against the full Annex A list before claiming ISO 27001 readiness. Keep each
> control's `evidence` pointer pointing at a real record.
