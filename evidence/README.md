---
id: REC-TPL-000
title: Evidence — append-only evidence area
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

# /evidence — append-only ISMS evidence

Point-in-time **records** (Tier 3) proving the ISMS is operated: access reviews, posture
reports, incidents, DPIAs, and the event ledger. **Immutable intent** — write once, never
silently edit; disposition is deliberate and logged, never a `git rm`.

## Layout
- `ledger.jsonl` — append-only line-per-event log for small events that don't warrant a file.
  Enforced by `ledger-append-guard` (a changed/removed prior line fails the check).
- `templates/` — copy these to create a real record (`access-review`, `posture-report`,
  `dpia`, `incident`).
- `posture/` — dated posture reports (the Phase 6 evidence agent writes here).
- `access-reviews/`, `management-reviews/`, `incidents/` — created on first use by the playbooks.

## Creating a record
Copy the matching template, set the **Tier-3** front-matter (`class: evidence`,
`control-tier: 3`, `approved-by`, `approved-on`, `retention`), fill it, and ship via the relay.
A new record is a new file; the ledger gets new lines appended at the end.

## Binary evidence (object storage)
Signed PDFs / exported reports use **Forgejo LFS** (Decision #3 default) — `.gitattributes`
tracks `evidence/**` binaries via LFS — plus a sidecar `<file>.meta.yaml` carrying the record
fields and a register entry. (LFS `.gitattributes` wired by Claude Code; see the prompt.)
