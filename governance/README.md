---
id: REC-GOV-000
title: Governance — ISMS document home
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

# /governance — ISMS governance home

Tier-2 governance documents for the Restormel ISMS (ISO 27001 target). Everything here is a
**skeleton seeded in Phase 4** — structure plus `[PLACEHOLDER — founder/counsel]` markers, not
finished policy. Real content (commitments, control statuses, retention specifics, legal text)
comes from the founder and, where flagged, counsel.

> **CI note:** these drafts will warn under `frontmatter-validate` (Tier 2 needs `approved-by`
> / `approved-on`, deliberately omitted until a real approval). That's expected — complete and
> approve a document, set those fields, *then* the Phase 4 blocking-flip can enforce it.

## Contents
| File | id | What |
|---|---|---|
| `information-security-policy.md` | REC-POL-001 | Top-level ISMS policy |
| `access-control-policy.md` | REC-POL-002 | Access control policy |
| `risk-register.yaml` | REC-GOV-002 | Living risk register |
| `ropa.yaml` | REC-GOV-003 | Record of Processing Activities (GDPR Art 30) |
| `soa.md` | REC-GOV-004 | Statement of Applicability (Annex A) |
| `suppliers.yaml` | REC-GOV-005 | Supplier / sub-processor register |
| `asset-inventory.yaml` | REC-GOV-006 | Asset inventory (CIS Control 1) |
| `data-inventory.yaml` | REC-GOV-007 | Data inventory (CIS Control 2; feeds RoPA) |

## Proportionate to stage
Restormel is a solo-founder UK LTD. These are lean templates — not a 200-person compliance
bureaucracy. Complete what a real ISMS needs; mark everything else "later / when customers
require it".
