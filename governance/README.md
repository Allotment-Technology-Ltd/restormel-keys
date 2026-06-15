---
id: REC-GOV-000
title: Governance — ISMS document home
class: governance
owner: founder
status: approved
approved-by: Adam Boon
approved-on: 2026-06-15
classification: internal
control-tier: 2
created: 2026-06-15
last-reviewed: 2026-06-15
review-interval: P12M
retention: P6Y-after-superseded
---

# /governance — ISMS governance home

Tier-2 governance documents for the Restormel ISMS (ISO 27001 target).
ISMS scope: **Restormel product and supporting infrastructure only.**
Controller: **Allotment Technology Ltd**, company no. 16925574.

## Contents

| File | ID | Review interval | Status |
|---|---|---|---|
| `information-security-policy.md` | REC-POL-001 | Annual | draft |
| `access-control-policy.md` | REC-POL-002 | Annual | draft |
| `cyber-security-policy.md` | REC-POL-003 | Annual | draft |
| `risk-register.yaml` | REC-GOV-002 | 6-monthly + event-triggered | draft |
| `ropa.yaml` | REC-GOV-003 | Annual + event-triggered | approved |
| `soa.md` | REC-GOV-004 | Annual | draft |
| `suppliers.yaml` | REC-GOV-005 | Annual + event-triggered | approved |
| `asset-inventory.yaml` | REC-GOV-006 | 6-monthly | approved |
| `data-inventory.yaml` | REC-GOV-007 | 6-monthly | approved |
| `ce-control-mapping.md` | REC-GOV-021 | 6-monthly + event-triggered | draft |

---

## Review cadence

Three scheduled Cowork tasks govern the review cycle:

| Task ID | Fires | Covers |
|---|---|---|
| `isms-mid-year-governance-check` | 15 June, 09:00 | Asset inventory, data inventory, suppliers, RoPA, risk register |
| `isms-audit-events-retention-review` | 15 June, 09:00 | DAT-010 audit_events retention enforcement |
| `isms-annual-management-review` | 15 December, 09:00 | All documents + policies + SoA + performance summary (ISO 27001 Cl. 9.3) |

Quarterly: `playbooks/quarterly-access-review.md` (manual, founder-led).

---

## Event-triggered update criteria

Any of the following events **must trigger an immediate update** to the relevant document(s),
outside the scheduled review cycle. Stage a cowork-outbox bundle on the same day as the event.

| Event | Documents to update |
|---|---|
| New sub-processor or tool adopted | `suppliers.yaml`, `ropa.yaml`, privacy notice |
| Sub-processor removed or decommissioned | `suppliers.yaml`, `ropa.yaml`, privacy notice |
| New data category collected or processing activity started | `data-inventory.yaml`, `ropa.yaml` |
| Infrastructure change (new host, region, domain) | `asset-inventory.yaml`, `suppliers.yaml` |
| Security incident (any severity) | `risk-register.yaml`; major incidents → all docs reviewed |
| New employee, contractor, or third-party access granted | `access-control-policy.md`, `asset-inventory.yaml` |
| Change in lawful basis or privacy notice | `ropa.yaml`, `information-security-policy.md` |
| UK GDPR / ICO guidance change relevant to the ISMS | `ropa.yaml`, `information-security-policy.md`, `soa.md` |
| Customer data subject request or complaint | `ropa.yaml` (verify accuracy); log in evidence/ |
| Sub-processor data breach notification received | `suppliers.yaml`, `risk-register.yaml` |
| API key or credential rotation (material change) | `asset-inventory.yaml` (AST-007 notes) |
| Change to a Cyber Essentials control (MFA, firewall, patching, device/host config) | `ce-control-mapping.md`, `cyber-security-policy.md`, `soa.md` |

---

## Proportionate to stage

Restormel is a solo-founder UK LTD. These are lean, evidence-based documents — not a
200-person compliance bureaucracy. Controls that are "N/A — justified" or "later, when
we have customers/staff" are legitimate and documented in `soa.md`.
