---
id: REC-PLAN-003
title: Planning migration log — project knowledge → repo
class: planning
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-15
last-reviewed: 2026-06-15
review-interval: P12M
approved-by: founder
approved-on: 2026-06-15
retention: permanent
related: [REC-PLAN-001, REC-PLAN-002]
---

# Planning migration log

Records the move of planning artefacts out of the Claude project knowledge (US-SaaS) and into
the repo (Phase 3), and the retirement of the now-duplicate standalone copies — so there is
exactly one canonical source per `01-doc-governance`.

| Project-knowledge file | Repo canonical | Action | Status |
|---|---|---|---|
| `restormel-planning-context.md` | `/planning/planning-context.md` (REC-PLAN-001) | Retire from project knowledge | _pending founder_ |
| IA plan (uploaded to chat) | `/planning/records-architecture-implementation-plan.md` (REC-PLAN-002) | Already home; remove any standalone copy | _pending founder_ |
| `restormel-competitive-analysis.md` | — (not yet migrated) | Keep; migrate to `/planning` later, then retire | open |
| `Restormel Competitive and Market Landscape…md` | — (not yet migrated) | Keep; migrate to `/planning` later, then retire | open |
| `CE 2026 Danzell Question Set.md` | — (governance, not yet migrated) | Keep; migrate to `/governance` later, then retire | open |
| `restormel-project-instructions.md` | `AGENTS.md` + `restormel-ops/OPERATING-MANUAL.md` | Review — superseded; slim to a pointer or remove | review |

**Re-point:** the Claude project knowledge should ingest from `/planning` (a projection), not
hold standalone copies. See `planning/README.md`.

> When a file is retired from the project knowledge, update its Status to `retired <date>`.
