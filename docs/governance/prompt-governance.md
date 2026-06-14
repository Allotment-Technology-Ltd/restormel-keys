---
title: Prompt Governance
class: governance
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-13
last-reviewed: 2026-06-13
review-interval: P12M
---

# Prompt Governance

Prompt lifecycle and classification rules. **Single source** for how prompts are governed; inventory in [prompts-reference.md](prompts-reference.md).

**Classes:** Canonical (authority) · Reference (not authoritative) · Archive (superseded).

- If prompts are intended to be **public**, store under `prompts/canonical|reference|archive` (and inventory them).
- If prompts are **internal-only**, keep them under `internal/prompts/` (local-only; not published in the public repo).

**Rules:** Every prompt has purpose and status. Repeated workflows → Skills; stable repo law → Rules; specialist review → Subagents. Packs are inventoried; they do not become repo law without governance.

**Locations:** `prompts/canonical/`, `prompts/reference/`, `prompts/archive/` (public) and `internal/prompts/` (local-only).
