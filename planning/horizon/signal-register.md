---
id: REC-PLAN-024
title: "Horizon Signal Register — 2026 H1 scan"
class: planning
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-07-01
last-reviewed: 2026-07-01
review-interval: P3M
retention: review-only
related: [REC-PLAN-022, REC-PLAN-025, REC-GOV-022, REC-ADR-008]
---

> **Filed via Cowork horizon handover, 2026-07-01.** **Placement decision:** the SCHEMA has no explicit home for a standing signal register, so per the brief this is placed at `planning/horizon/` as a Tier-1 planning record — reconcile at merge. **ID mapping:** `SIG-NNN` are chat-local working labels; this register assigns canonical within-register entry IDs `HS-NNN`. The `HS-NNN` scheme and the `REC-PLAN-024` id are **proposed — confirm against `records/register.yaml` at merge** (founder may instead prefer each Keeper as its own `REC-PLAN-*` record — that would be a deliberate re-key).

## SIG → canonical-ID mapping

| Chat-local | Canonical | Verdict |
|---|---|---|
| SIG-001 | HS-001 | Keep (watch) |
| SIG-002 | HS-002 | Drop |
| SIG-003 | HS-003 | Drop |
| SIG-004 | HS-004 | Park |
| SIG-005 | HS-005 | Keep (watch) — named harness-wrap target |
| SIG-006 | HS-006 | Keep (watch) |
| SIG-007 | HS-007 | Keep (watch) |
| SIG-008 | HS-008 | Drop |
| SIG-009 | HS-009 | Drop (ops) |
| SIG-010 | HS-010 | Park (ops) |
| SIG-011 | HS-011 | Park (dist) |
| SIG-012 | HS-012 | Park (ACTIONABLE) |
| SIG-013 | HS-013 | Drop |
| SIG-014 | HS-014 | Keep (watch) |
| SIG-015 | HS-015 | Keep (watch) |

## Keepers (full entries)

| Canonical | Source | Date | Verdict | Tags |
|---|---|---|---|---|
| HS-001 | SpaceX buys Cursor $60B — Kilo/HackerNoon | 2026-06-17 | Keep (watch) | CATEGORY/GTM, MCP-ECOSYSTEM |
| HS-004 | The AI Clarity Gap — INSEAD Knowledge | 2026-02-17 | Park | CUSTOMER/DEMAND, CATEGORY/GTM |
| HS-005 | Context quality beats size + Redis Iris — Redis | 2026-06-07 | Keep (watch) — **named harness wrap target** (backlog item 2) | COMPETITOR, MCP-ECOSYSTEM, CATEGORY/GTM, TECH/RESEARCH |
| HS-006 | Validation will define HPC & AI — Data Center Knowledge | 2026-06-17 | Keep (watch) | CATEGORY/GTM, CUSTOMER/DEMAND |
| HS-007 | Beyond Verification — MIT SMR × BCG | 2026-05-12 | Keep (watch) | CATEGORY/GTM, CUSTOMER/DEMAND |
| HS-010 | Monorepo vs Multi-Repo — Dortort | 2026-05-20 | Park (ops) | TECH/RESEARCH |
| HS-011 | Introduction to Swarms — docs.swarms.world | 2026 | Park (dist) | MCP-ECOSYSTEM, CATEGORY/GTM |
| HS-012 | OpenSSF — openssf.org | n/a | Park (ACTIONABLE) — OSS-security credentials backlog item | SOVEREIGNTY, CATEGORY/GTM, TECH/RESEARCH |
| HS-014 | Mistral OCR 4 — VentureBeat/Mistral | 2026-06-23 | Keep (watch) — **connector + distribution + competitive hedge, NOT a COGS line**; flagship curated extraction alternative; bounding boxes enable span provenance, confidence enables ingest-abstention; co-opetition with Mistral Search Toolkit | SOVEREIGNTY, TECH/RESEARCH, COMPETITOR |
| HS-015 | voyage-context-4 — Voyage/MongoDB | 2026-06-29 | Keep (watch) — lead candidate for connector instance #2 (embedding/retrieval) | COMPETITOR, TECH/RESEARCH, CATEGORY/GTM |

## Drops (ledger — one line each, for the audit trail)

- **HS-002** (SIG-002) — *The AI knowledge gap challenge*, FM Magazine, 2025-10-13 — Drop: adjacent framing, no verification angle.
- **HS-003** (SIG-003) — *AI & institutional knowledge*, TechNative (SAP), 2025-12-22 — Drop: vendor-adjacent, no signal.
- **HS-008** (SIG-008) — *Solving AI Amnesia at Scale*, HackerNoon (AI-assisted), 2026-06-21 — Drop: low-quality, AI-assisted.
- **HS-009** (SIG-009) — *github-multi-repo skill*, Claude marketplace, 2026-06-11 — Drop (ops): not strategic.
- **HS-013** (SIG-013) — *Open Source Software Trends*, InMotion Hosting, 2026 — Drop: generic listicle.

## Emergent pattern

Captured in the synthesis record (**REC-PLAN-022**), not as a separate signal: HS-002/003/004/006 converge on "production AI stalls on trust/clarity/validation of inputs-and-outputs, not model quality" — none names verification as the answer. That convergence is the GTM opening; HS-005/007 are the on-wedge positioning anchors.
