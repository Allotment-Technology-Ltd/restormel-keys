# Restormel / Testing — Agent prompt pack (index)

**Status:** MVP documentation  
**Canonical location:** [`docs/agent-prompts/README.md`](agent-prompts/README.md)

This file is a **stable entry point** and short summary. **Copy-paste prompts** and the full pack index live under **`docs/agent-prompts/`** so each workflow fits one reviewable page.

## Contents

| Doc | Purpose |
|-----|---------|
| [agent-prompts/README.md](agent-prompts/README.md) | Why the pack exists, how to use with Cursor, suggested order |
| [writing-good-goals.md](writing-good-goals.md) | What good goals look like; deterministic vs `judge_rubric`; suites and hooks |
| [agent-prompts/write-new-suite.md](agent-prompts/write-new-suite.md) | First suite (`web-critical`-style) |
| [agent-prompts/extend-existing-suite.md](agent-prompts/extend-existing-suite.md) | Add goals safely |
| [agent-prompts/migrate-from-playwright.md](agent-prompts/migrate-from-playwright.md) | Map Playwright specs to goals |
| [agent-prompts/tighten-success-criteria.md](agent-prompts/tighten-success-criteria.md) | Reduce vagueness and unnecessary judging |
| [agent-prompts/review-suite-quality.md](agent-prompts/review-suite-quality.md) | Audit ambiguity, flake, overreach |

## Product context (one paragraph)

Restormel / Testing is **repo-first** agentic testing: **`restormel-testing.yaml`** (or `.json`) holds **suites**, **goals**, and **`success_criteria`**, with **BYOK** via Restormel / Keys logical refs—**never** raw secrets in config. The CLI is published as **`testing`** and **`restormel-testing`** (`testing validate`, `testing run --suite <id>`).

## Examples in this repository

- [`examples/testing-basic-web/restormel-testing.yaml`](../examples/testing-basic-web/restormel-testing.yaml)
- [`examples/testing-github-actions/`](../examples/testing-github-actions/)

## Related specs

- [Config reference — MVP runner](config-reference-mvp.md) — supported vs rejected YAML
- [MVP spec](restormel-testing-mvp-spec.md) — test definition model, CLI shape
- [Technical architecture](restormel-testing-technical-architecture.md)
- [Product definition brief](restormel-testing-product-definition-brief.md)

**Note:** `docs/restormel-agentic-testing-requirements.md` is not in this repository yet. Until it exists, treat the **MVP spec** and **product brief** as the authoritative requirements-shaped context for agentic testing scope.
