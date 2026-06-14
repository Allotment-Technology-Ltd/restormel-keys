---
title: Prompts Reference
class: governance
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-13
last-reviewed: 2026-06-13
review-interval: P12M
---

# Prompts Reference

Prompt inventory. **Single source** for what exists and its class; rules in [prompt-governance.md](prompt-governance.md).

**Classes:** Canonical (approved operational) · Reference (useful, not authoritative) · Archive (superseded, traceability).

**Phase 00 inventory:** Prompt packs and internal implementation prompts are kept **local-only** under `internal/prompts/` (not published in the public repo). If any prompt becomes stable, reusable “repo law”, promote it into `prompts/canonical/` and inventory it here.

**Locations:** `prompts/canonical/`, `prompts/reference/`, `prompts/archive/` (public) and `internal/prompts/` (local-only).

**Manual steps (implementation checklists):** Public checklists live under `docs/reference/*manual-steps.md`. Any additional phase checklists and prompt packs are kept **local-only** under `internal/prompts/` (not published in the public repo).

**Cursor Agent Skills vs prompts:** Repeated agent workflows live in **`.cursor/skills/<name>/SKILL.md`** (mirrored under `.agents/skills/`). Do not copy skill bodies into `prompts/reference` packs; **link** the skill or the canonical doc (for Keys routing: `docs/architecture/keys-routing-contract.md`). If a skill and a prompt pack would say the same operational truth, keep **one** authority per [prompt-governance.md](prompt-governance.md).
