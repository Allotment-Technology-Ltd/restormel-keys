---
id: REC-PLAN-000
title: Planning — home for Restormel planning context
class: planning
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-14
last-reviewed: 2026-06-14
review-interval: P12M
approved-by: founder
approved-on: 2026-06-14
retention: review-only
---

# /planning — planning context home

Canonical home for Restormel's cross-cutting planning context. These artefacts previously
lived **only in the Claude project knowledge (US-SaaS)**; Phase 3 brings them into the repo so
the repo is the single source of truth and the Claude Project becomes a *projection* — closing
the sovereignty gap.

## Contents
- `planning-context.md` (`REC-PLAN-001`) — the planning context pack (USP, suite, stack,
  strategy, programme plan, guardrails).
- `records-architecture-implementation-plan.md` (`REC-PLAN-002`) — the records & IA build plan
  (the ADR `REC-ADR-001` references this; now home as promised).

## Relationship to `docs/`
Product PRDs, positioning, and requirements stay canonical under `docs/product`,
`docs/requirements`, etc. `/planning` is the **strategy/context layer**, not a duplicate of
those — one canonical source per topic (`01-doc-governance`).

## Re-point Claude Projects (the sovereignty fix — founder action)
The Claude project knowledge must become a **projection of `/planning`**, edited here, never
there. Since a direct Forgejo→Projects sync may not be available, use whichever applies:
1. **Edit planning facts only in this folder** (repo is canonical).
2. Refresh the Project knowledge from here by either: (a) pointing the Project's knowledge sync
   at this repo path if supported; (b) mirroring `/planning` to a synced Google Drive folder the
   Project ingests; or (c) manually re-uploading these files after changes.
3. **Remove the old standalone copies** from the Project knowledge so there is exactly one source.

## Interim note
The planning context pack is a **dated snapshot**. Per the IA plan it will eventually be replaced
by the dog-food Connect MCP serving always-current, verified context (a later milestone). Until
then, keep it current here and re-project to the Claude Project.
