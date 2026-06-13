---
name: restormel-high-risk-security
description: >-
  Restormel Keys high-risk security review before PRs: BYOK, encrypted credentials, auth, MCP/Connect,
  SvelteKit server routes, Neon/Postgres. Runs baseline/threat-model pass, repo hygiene scripts, Aikido MCP
  when connected, and stack-specific checks. Use before opening a PR, when the user mentions security review,
  or when changes touch keys, secrets, auth, logging, encryption, Connect, gateway, or database credentials.
---

# Restormel high-risk security

Orchestrates **local, pre-PR** security review for Restormel Keys. Canonical human runbook: [docs/guides/pre-pr-security-review.md](../../../docs/guides/pre-pr-security-review.md). Product rules: [docs/governance/security-baseline.md](../../../docs/governance/security-baseline.md), [docs/governance/threat-model-starter.md](../../../docs/governance/threat-model-starter.md).

**Do not** implement product fixes unless the user asks; default is **review + findings + gate recommendation**.

## When to invoke (mandatory before PR if any match)

Invoke this skill when the user will **open or update a PR**, says **“security review”**, or changes touch **high-risk** areas (see [references/high-risk-paths.md](references/high-risk-paths.md)).

Also invoke for: Connect/MCP/agent setup, gateway keys, `provider_integrations`, encryption helpers, auth/session, admin routes, migrations holding secrets/PII, webhook signing, routing resolve/simulate, Zuplo/gateway config, env examples, or docs with credential placeholders.

## Pre-PR gate (run in order)

Stop and report blockers if any step finds **Critical** issues. Summarize all findings in a **Pre-PR security report** (template below).

### 1. Scope the diff

- `git diff main...HEAD --name-only` (or user-provided base branch).
- Classify each path: **high-risk** / **medium** / **low** using [references/high-risk-paths.md](references/high-risk-paths.md).
- If **no high-risk** paths: still run step 4 (hygiene scripts); skip Aikido deep scan unless user requests full scan.

### 2. Read canonical product security (required for high-risk)

Read fully (do not paraphrase from memory):

- [docs/governance/security-baseline.md](../../../docs/governance/security-baseline.md)
- [docs/governance/threat-model-starter.md](../../../docs/governance/threat-model-starter.md)

For Connect/MCP/agent routes also skim [docs/guides/restormel-environment-vocabulary.md](../../../docs/guides/restormel-environment-vocabulary.md) and [docs/runbooks/mcp-implementation-workflow.md](../../../docs/runbooks/mcp-implementation-workflow.md).

### 3. BYOK / Restormel-specific checklist (high-risk diff)

For every changed file in scope, verify:

| Check | Pass criteria |
|-------|----------------|
| No committed secrets | No API keys, connection strings, JWTs, `rk_`/`sk-` literals, realistic placeholders |
| No raw key logging | No `console.log`/logger of gateway keys, provider keys, encryption keys, session tokens, `pending_raw_key` |
| Storage | Provider/connection secrets only as **ciphertext**; list APIs return **masked** ids only |
| Trust boundaries | Server-only secret access; no secrets in client bundles, `+page.svelte` loads exposing keys, or public env without `PUBLIC_` prefix |
| AuthZ | Protected routes check session/project scope; no privilege escalation via IDs in query/body |
| MCP / invoke | No secrets in tool descriptions, snippets, or error messages; env-only credential reads |
| Examples/docs | Obvious placeholders only; redaction in tests and fixtures |
| Data minimisation | No unnecessary PII in logs, webhooks, or analytics payloads |

Map each failure to **Critical / High / Medium / Low** and a single **Action** (Remove | Redact | Restrict | Encrypt | Document | Test).

Optional narrow pass: [subagents/security-reviewer.md](../../../subagents/security-reviewer.md) table format for baseline-only confirmation.

### 4. Repo hygiene scripts (all PRs)

From repo root, run and capture exit codes:

```bash
bash scripts/check-secrets.sh
bash scripts/check-repo-hygiene.sh
bash scripts/check-dependency-policy.sh
```

If the change touches docs/process: `bash scripts/review-docs.sh`.

For dashboard/packages code: `pnpm --filter dashboard run check` only when user wants type safety in the same pass (not a substitute for security).

### 5. Aikido MCP (when connected)

Requires **Agent mode** and `aikido` MCP connected ([docs/guides/aikido-cursor-mcp.md](../../../docs/guides/aikido-cursor-mcp.md)).

1. Call **`aikido_full_scan`** on **staged + unstaged** paths in the diff (or explicit file list). Focus on SAST and **leaked secrets**.
2. If the repo is linked in Aikido, optionally **`aikido_issues_list`** filtered by repo name `restormel-keys` (or user-supplied) for open **critical** SAST / `leaked_secret` — compare with touched areas.

Do **not** paste scan output containing secret literals into the report; reference file paths and rule IDs only.

If MCP is unavailable: note **“Aikido skipped (MCP not connected)”** and rely on steps 3–4 + 6.

### 6. Stack-specific application review (SvelteKit / TypeScript)

Restormel dashboard is **SvelteKit 2 + Svelte 5 + Node 20 + Neon Postgres**, not Next.js. Apply these **normative** checks (aligned with OWASP and Express-style server patterns):

**Server (`hooks.server.ts`, `+server.ts`, `+page.server.ts`, `*.server.ts`):**

- Authenticate before mutations; validate CSRF/session on state-changing actions.
- Treat all `request` body, params, headers, and `cookies` as hostile; runtime validate (types ≠ security).
- Parameterized DB queries; no string-built SQL.
- No open redirects; validate `redirect()` targets.
- Rate-limit or abuse-guard sensitive endpoints (device linking, key creation, invoke).

**Client / UI:**

- Never render or store raw BYOK keys; masked prefixes only ([.cursor/rules/04-ux-safety.mdc](../../../.cursor/rules/04-ux-safety.mdc)).
- No secrets in `localStorage` as default.

**Dependencies:** note if diff adds packages — flag supply-chain risk; CI runs `pnpm audit --audit-level critical`.

**Optional depth:** If user has `~/.codex/skills/security-best-practices`, load `references/javascript-general-web-frontend-security.md` and `references/javascript-express-web-server-security.md` from that skill for extra audit rules (SvelteKit maps to Express-like server handlers).

**MCP / agent / LLM surfaces:** mentally map to OWASP LLM Top 10 — tool over-permissioning, prompt injection via untrusted graph content, data exfil in tool results. Reference [OWASP secure-agent-playbook](https://github.com/OWASP/secure-agent-playbook) plays `mcp-server-review` and `agentic-ai-risk-assess` for narrative (no install required).

### 7. Operator infrastructure (Neon / org admin)

When the change affects **production data paths**, **migrations**, or **operator access**, include the **Neon operator checklist** from [references/neon-operator-security.md](references/neon-operator-security.md) in the report (human actions — agent cannot toggle Neon 2FA via API).

### 8. Gate decision

| Result | Meaning |
|--------|---------|
| **PASS** | No Critical/High open issues; hygiene scripts green; Aikido (if run) has no blocking secret/SAST on touched files |
| **PASS WITH NOTES** | Only Medium/Low; document in PR |
| **BLOCK PR** | Any Critical/High or failed hygiene script — list fixes before `gh pr create` |

Tell the user explicitly: **“Pre-PR security gate: PASS | BLOCK”**.

## Pre-PR security report template

```markdown
## Pre-PR security report

**Gate:** PASS | PASS WITH NOTES | BLOCK PR
**Scope:** <branch>, N files (<count> high-risk)
**Baseline/threat model:** <aligns | N findings>
**Hygiene scripts:** check-secrets / hygiene / deps-policy — pass | fail
**Aikido:** pass | findings | skipped
**Stack review:** <summary>
**Neon operator:** <N/A | see checklist>

### Findings
| ID | Sev | File/area | Issue | Action |
|----|-----|-----------|-------|--------|
| 1 | Critical | ... | ... | Remove |

### CI note
Local review does not replace CI `security` job (TruffleHog + pnpm audit). See pre-pr guide.
```

## CI/CD: keep pipeline checks

**Yes — retain CI security** ([.github/workflows/ci.yml](../../../.github/workflows/ci.yml) `security` job → [js-security-scan](../../../.github/actions/js-security-scan/action.yml)):

| Layer | Role |
|-------|------|
| **Local (this skill)** | Fast feedback, BYOK/threat-model, Aikido on touched code, fix before review noise |
| **CI** | Deterministic **TruffleHog** (verified secrets) + **pnpm audit critical** on clean checkout; proves PR branch without relying on developer MCP setup |
| **Future** | Optional Aikido in CI if org wires GitHub integration — does not remove local pass |

Local pass **reduces** CI failures; CI **catches** secrets committed from other machines, dependency regressions, and contributors without Aikido.

## Related skills and docs

| Resource | Use |
|----------|-----|
| [docs/guides/aikido-cursor-mcp.md](../../../docs/guides/aikido-cursor-mcp.md) | MCP setup |
| [skills/security-review/SKILL.md](../../../skills/security-review/SKILL.md) | Legacy pointer → this skill |
| [subagents/security-reviewer.md](../../../subagents/security-reviewer.md) | Narrow baseline table |
| [SECURITY.md](../../../SECURITY.md) | Vulnerability reporting |

## Credit discipline

- Review **only** diff scope + listed high-risk neighbors (imports/callers).
- Do not run broad repo refactors under the guise of security.
- Never output raw secrets, tokens, or ciphertext from the codebase.
