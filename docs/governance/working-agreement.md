---
title: Working Agreement
class: governance
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-13
last-reviewed: 2026-06-13
review-interval: P12M
---

# Working Agreement

Repo norms and operating model. **Single source** for “how we work”; do not duplicate in other docs.

**Phase 00:** Bootstrap only. No provider, billing, or hosted logic. Plan Mode before non-trivial work (multi-file, security-sensitive, repo structure, CI, rules/skills/subagents).

**Docs:** One canonical source per topic. Canonical vs reference vs archive: [prompt-governance.md](prompt-governance.md). When process or structure changes, update STATUS, ROADMAP, CHANGELOG, and the owning canonical doc.

**Cursor:** Rules = repo law. Skills = repeatable workflows. Subagents = narrow specialist passes. Exact file targets; prefer scripts/CI over repeated agent reasoning.

**Security:** No committed secrets; no raw key logging. [security-baseline.md](security-baseline.md).

**Credits:** Smallest useful prompt; avoid duplicate passes; prefer deterministic scripts.
