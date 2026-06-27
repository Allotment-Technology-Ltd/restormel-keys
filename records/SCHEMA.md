---
id: REC-GOV-001
title: Records metadata convention (SCHEMA)
class: governance
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-14
last-reviewed: 2026-06-14
review-interval: P12M
approved-by: founder
approved-on: 2026-06-14
retention: permanent
related: [REC-ADR-001]
---

# records/SCHEMA.md — front-matter specification

The single source of truth for the records metadata convention. Every managed Markdown
record carries the YAML front-matter below. This convention serves four consumers at
once — date-stamping, the records register, the compliance/evidence agent, and eventual
Connect ingest — so getting the controlled vocabularies right **before** backfilling is
the single highest-leverage thing in the whole records architecture. Re-keying later is
the one genuinely expensive mistake.

```yaml
id:              # e.g. REC-POL-001 — see ID scheme. Stable, unique, never reused.
title:           # Human-readable title.
class:           # technical | decision | planning | governance | evidence | legal | people
owner:           # Must match a CODEOWNERS entry (a person/handle, not a team alias).
status:          # draft | approved | deprecated | superseded
classification:  # public | internal | confidential | restricted
control-tier:    # 0 | 1 | 2 | 3
created:         # YYYY-MM-DD
last-reviewed:   # YYYY-MM-DD
review-interval: # ISO 8601 duration, e.g. P12M. CI computes next-review = last-reviewed + interval.
approved-by:     # The named approver. REQUIRED once a tier>=2 record is FINALIZED
                 # (status approved|deprecated|superseded|closed); a draft/open record has no
                 # approver yet, so it is only required at finalization (warn until then).
approved-on:     # YYYY-MM-DD. Same rule as approved-by (required once finalized).
retention:       # Controlled vocabulary — see retention grammar.
supersedes:      # OPTIONAL — id of the record this replaces (lineage).
related:         # OPTIONAL — list of related ids.
```

**`classification` does triple duty** — it is the ISO access-control attribute, the
per-document ACL that Connect will eventually enforce, *and* the publish gate (only
`public` ever renders to the public site). The compliance metadata and the
retrieval/ACL metadata are the same metadata; that is why one convention works.

## ID scheme

`REC-<TYPE>-<NNN>`, zero-padded, never reused even after disposition:

| class | TYPE code | example |
|-------|-----------|---------|
| technical | `TECH` | REC-TECH-001 |
| decision | `ADR` (architecture) / `DEC` (business) | REC-ADR-001 |
| planning | `PLAN` | REC-PLAN-001 |
| governance | `GOV` (or `POL` for a policy specifically) | REC-POL-001 |
| evidence | `EVID` | REC-EVID-001 |
| legal | `LEG` | REC-LEG-001 |
| people | `PPL` | REC-PPL-001 |

## Retention grammar

Controlled vocabulary, not free text:

- `P<duration>` — keep for a fixed period from `created` (e.g. `P3Y`).
- `P<duration>-after-<trigger>` where `<trigger>` ∈ `superseded` | `no-longer-in-force` |
  `processing-ends` (e.g. `P6Y-after-superseded`).
- `life-of-processing` — keep while the processing it documents is active (RoPA, DPIA).
- `permanent` — never disposed.
- `review-only` — no retention obligation; kept at owner's discretion.

## Control tiers

The `control-tier` field sets how strictly the record is governed (see ADR
`REC-ADR-001`):

- **0 — uncontrolled / ephemeral.** Scratch, drafts, scaffolding. Minimal/no enforcement.
- **1 — managed.** Technical, planning, decision docs. Metadata + register; CI advisory.
- **2 — governed.** Policies, RoPA, SoA, supplier/asset registers. `owner` + `retention`
  are **always required**; `approved-by` / `approved-on` are **required once the record is
  finalized** (status approved|deprecated|superseded) — a `draft` carries no approver yet.
  CI blocking for schema + freshness.
- **3 — evidence.** Access reviews, posture reports, incidents, the ledger. Append-only /
  immutable intent; CI blocking, including the append-only guard.

## Binaries

Binaries can't carry front-matter. A binary record (a signed PDF, an exported report)
gets a **sidecar** `<filename>.meta.yaml` carrying the same fields, plus a register
entry. Example: `evidence/q1-access-review.pdf` + `evidence/q1-access-review.pdf.meta.yaml`.

## Maintenance norm — records keep themselves current

Records and registers must not drift from reality. **When any agent (Cowork, the chat project,
or Claude Code) takes an action that introduces or changes a managed fact — a new asset,
sub-processor/connector, data flow, capability, or decision, or a material change to an existing
one — it stages the matching register/document update in the SAME turn, without waiting to be
asked.** Examples: connecting a new tool → `governance/suppliers.yaml` + `asset-inventory.yaml`;
a new data flow → `data-inventory.yaml` + `ropa.yaml`; a settled choice → the decision log / an ADR.

Rules:
- **Route through the relay / PR / CI** like any record — never silently hand-edit an approved
  document; the PR plus founder merge is the review gate.
- **Identify every affected register**, not just the obvious one.
- **If unsure which record applies, flag it** rather than skipping.
- Anything *derivable from source* is **generated, not hand-maintained** (e.g. the register via
  `scripts/records/register.mjs`).

The scheduled reconciliation (Phase 6 evidence agent) is the safety net: it flags
register-vs-reality drift and opens issues for whatever this norm misses.
