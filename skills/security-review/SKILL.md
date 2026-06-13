# security-review

**Superseded for Cursor:** use project skill **[restormel-high-risk-security](../../.cursor/skills/restormel-high-risk-security/SKILL.md)** and runbook **[docs/guides/pre-pr-security-review.md](../../docs/guides/pre-pr-security-review.md)** before PRs.

This file remains for Codex `$CODEX_HOME/skills` installs and [docs/governance/skills.md](../../docs/governance/skills.md) inventory. When invoked, follow the **restormel-high-risk-security** workflow (baseline + threat model + hygiene scripts + Aikido when available).

## Purpose

Apply [docs/governance/security-baseline.md](../../docs/governance/security-baseline.md) and [docs/governance/threat-model-starter.md](../../docs/governance/threat-model-starter.md) to scoped changes. Review only; no implementation unless asked.

## When to use

- Before opening a PR that touches keys, secrets, auth, encryption, Connect, MCP, or credential storage.
- After security-sensitive edits (confirm gate).

## Done criteria

Pre-PR gate **PASS** per [pre-pr-security-review.md](../../docs/guides/pre-pr-security-review.md); no secrets in output.
