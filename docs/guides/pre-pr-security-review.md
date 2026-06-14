---
title: Pre-PR security review
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-05
last-reviewed: 2026-06-13
review-interval: P12M
---

# Pre-PR security review

**Status:** Canonical gate before opening a PR on Restormel Keys. Product rules remain [security-baseline.md](../governance/security-baseline.md) and [threat-model-starter.md](../governance/threat-model-starter.md).

## Why local before CI?

User API keys and database connection material make this a **high-trust** product. Running security checks **before** `gh pr create` avoids:

- Failed CI `security` jobs after review has already started
- Secret or BYOK regressions sitting in PR history
- Rework loops that could have been caught in Agent mode locally

**CI still runs** — see [Local vs CI](#local-vs-ci) below.

## How to run

### Option A — Cursor Agent (recommended)

In **Agent** mode, before every PR that touches code or security-sensitive docs:

```text
Run the restormel-high-risk-security skill on my branch vs main. Pre-PR gate must PASS before I open a PR.
```

Skill location: [.cursor/skills/restormel-high-risk-security/SKILL.md](../../.cursor/skills/restormel-high-risk-security/SKILL.md).

Requires **Aikido MCP** connected for full coverage ([aikido-cursor-mcp.md](./aikido-cursor-mcp.md)).

### Option B — Scripts only (minimal)

From repo root:

```bash
bash scripts/check-secrets.sh
bash scripts/check-repo-hygiene.sh
bash scripts/check-dependency-policy.sh
```

Then manually review the diff against [security-baseline.md](../governance/security-baseline.md) for BYOK paths.

## Local vs CI

| Check | Local (skill + scripts) | CI (`security` job) |
|-------|-------------------------|---------------------|
| BYOK / threat model / authZ | Yes (agent + baseline) | No (not duplicated) |
| TruffleHog verified secrets | Optional via Aikido | Yes |
| `pnpm audit` critical | Optional | Yes |
| Deterministic on fresh checkout | No | Yes |
| Requires Aikido MCP / token | Optional local | No |

Keep both: **local** for fast, context-aware BYOK review; **CI** for secrets/dependencies every PR regardless of developer setup.

## PR template

Use [.github/pull_request_template.md](../../.github/pull_request_template.md) — confirm **Pre-PR security gate** and **Security impact**.

## Neon organization 2FA (operators)

Not enforced in application code. For any admin who can read production `DATABASE_URL` or org settings:

1. Enable personal 2FA: [Neon account 2FA](https://neon.com/docs/manage/accounts#two-factor-authentication)
2. Require org-wide 2FA: [Organization settings](https://neon.com/docs/manage/orgs-manage#require-2fa-for-organization-members)

Detail: [neon-operator-security.md](../../.cursor/skills/restormel-high-risk-security/references/neon-operator-security.md).

## Related

- [aikido-cursor-mcp.md](./aikido-cursor-mcp.md)
- [subagents/security-reviewer.md](../../subagents/security-reviewer.md) — narrow baseline table
- [SECURITY.md](../../SECURITY.md)
