---
id: REC-ADR-001
title: Records & Information Architecture — federated, repo-anchored
class: decision
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
related: [REC-GOV-001]
---

# ADR: Records & Information Architecture — federated, repo-anchored

**Status:** **Approved 2026-06-14** (founder). Records a decision already taken in the
records & information-architecture design consultation. This ADR is the *decision of
record*; the authoritative rationale ("the why") lives in that design write-up, and the
build steps ("the how") in the Records & Information Architecture — Implementation Plan
(founder, 2026-06-14, to be brought into the repo under planning in Phase 3).

> **Phase 0 scope:** decide and record only. **No files are moved or renamed by this
> ADR.** Implementation follows in later phases (SCHEMA, register, CI, planning home,
> governance/evidence greenfield, publish layer, evidence agent).

## Context

Operational documents currently live inside the product code repo with no controlled-
records convention: no stable IDs, no ownership/approval metadata, no review cadence, no
register. ISO 27001 clause 7.5 expects *documented information* to be identified, owned,
classified, version-controlled, approved, and reviewed — and for evidence to be
attributable and tamper-evident. Restormel is a solo-founder UK company (Allotment
Technology Ltd) running sovereign infrastructure on Forgejo; the records system must be
proportionate to that stage, not a compliance bureaucracy with no headcount to feed.

## Decision

**1. Federated, repo-anchored architecture.** Records live *in the repo*, governed by a
single front-matter convention (`records/SCHEMA.md`). **Forgejo is the single governance
plane; GitHub is a push-only mirror** (never written to directly). A generated register
(`records/register.yaml`) is compiled from source and cannot drift. CI enforces schema,
freshness, append-only evidence, and mirror discipline. SvelteKit is the publish layer,
gated by `classification`. A wiki and a dedicated GRC SaaS are **deferred** (below).

**2. Documents vs Records.** Two kinds of managed information, one convention:
- **Documents** — living artefacts that carry *current authority* and are revised in
  place (policies, `SCHEMA.md`, `ARCHITECTURE.md`, runbooks). Lineage via `supersedes`.
- **Records** — point-in-time *evidence that something happened*, written once and kept
  with **append-only / immutable intent** (access reviews, posture reports, incident
  records, the evidence ledger). Disposition is deliberate and logged, never a silent
  delete.

**3. Four control tiers** (the `control-tier` field), increasing rigour:
- **Tier 0 — uncontrolled / ephemeral.** Scratch, drafts, scaffolding. Minimal or no
  enforcement.
- **Tier 1 — managed.** Technical, planning and decision docs. Metadata + register
  entry; CI is **advisory**.
- **Tier 2 — governed.** Policies, RoPA, SoA, supplier/asset registers. **Requires a
  named approver and a retention rule**; CI for schema + freshness is **blocking**.
- **Tier 3 — evidence.** Access reviews, posture reports, incidents, the ledger.
  Append-only / immutable intent; CI **blocking**, including the append-only guard.

*(Tier semantics are consolidated from the implementation plan's Phase 2/4 behaviour;
to be confirmed against the design consultation write-up.)*

**4. Deferrals.** A **wiki** and a **dedicated GRC SaaS** are explicitly out of scope for
now. Rationale: the repo plus CI already gives attributable, versioned, reviewable
history without a new service, cost, or sovereignty trade-off. Revisit when scale or a
customer/audit requirement justifies the addition — by a superseding ADR, not silently.

## Consequences

- A single source of truth per record, with stable IDs and a generated register, makes
  the ISMS auditable and the publish surface safe (only `classification: public` renders).
- Early phases are **additive** (metadata first; vocabularies frozen before any backfill).
  Moves happen later and deliberately (planning home in Phase 3; governance/evidence are
  greenfield in Phase 4).
- The GitHub mirror must remain push-only and branch-protected; a `mirror-verify` job
  asserts it.

## References

- Records & Information Architecture — Implementation Plan (founder, 2026-06-14).
- `records/SCHEMA.md` — the metadata convention (Phase 1; `REC-GOV-001`).
- `STATUS.md`, `ARCHITECTURE.md` — current phase and structure summary.

> Append-only intent: supersede this ADR with another ADR rather than rewriting it.
