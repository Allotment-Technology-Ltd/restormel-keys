# Agent prompt pack — Restormel / Testing

First-party prompts for **coding agents** (Cursor, Claude Code, etc.) to author and refine **Restormel / Testing** suites in **your** repository.

## Why this exists

Restormel / Testing is **repo-first**: suites live in **`restormel-testing.yaml`** (plus optional adapter scripts). There is no requirement to use a hosted UI to author tests.

Coding agents do not automatically know:

- how Restormel / Testing models **suites, goals, and success criteria**;
- when to prefer **deterministic** checks vs **judge** rubrics;
- how to avoid **vague goals** and **needless rewrites** of your app.

This pack gives **copy-paste prompts** that are **specific to Restormel / Testing**, not generic “write tests” advice.

## Source of truth

- **`restormel-testing.yaml`** (and your adapter scripts) in **your repo** remain authoritative.
- These prompts are **helpers**. Always run **`testing validate`** / **`testing run --suite …`** (or your CI job) after changes.

> **Note:** `docs/restormel-testing-agent-prompt-pack.md` is a short index; the **maintained prompts** live in this folder.

## How to use with Cursor

1. Open **your app repo** (not necessarily this `restormel-testing` scaffold repo).
2. Read **[Writing good goals](../writing-good-goals.md)** once (or ask the agent to read it first).
3. Pick a prompt file below and **paste the entire “Paste into Cursor” block** into the agent chat.
4. Adjust any placeholders in your message (suite id, config path, branch-specific URLs) before sending.
5. Review the agent’s diff; reject broad unrelated edits.

## Suggested order

| Order | Prompt | Use when |
|------|--------|----------|
| 1 | — | Read [Writing good goals](../writing-good-goals.md) |
| 2 | [Write a new suite](write-new-suite.md) | No suite or only a stub config |
| 3 | [Extend an existing suite](extend-existing-suite.md) | Config exists; add a few goals |
| 4 | [Tighten success criteria](tighten-success-criteria.md) | Goals are vague or overuse judging |
| 5 | [Review suite quality](review-suite-quality.md) | Before making the suite CI-blocking |
| 6 | [Migrate from Playwright](migrate-from-playwright.md) | You have Playwright specs to map to goals |

## Repo references (this repository)

When working **inside the `restormel-testing` module repo**, useful examples:

- [`examples/testing-basic-web/restormel-testing.yaml`](../../examples/testing-basic-web/restormel-testing.yaml) — sample suite + environments.
- [`examples/testing-github-actions/`](../../examples/testing-github-actions/) — CI wiring patterns.

In **your product repo**, point the agent at your real config path and app routes.

## Product docs (conceptual)

- [MVP config reference — supported vs rejected fields](../config-reference-mvp.md)
- [MVP spec — test definition](../restormel-testing-mvp-spec.md#7-test-definition-model)
- [Technical architecture — CI / action](../restormel-testing-technical-architecture.md#11-ci-execution-architecture)
- [Product definition brief](../restormel-testing-product-definition-brief.md)
- [OSS consumption](../oss-consumption.md)

`docs/restormel-agentic-testing-requirements.md` is not in this repo yet; link it here when added.

## Prompt index

- [write-new-suite.md](write-new-suite.md)
- [extend-existing-suite.md](extend-existing-suite.md)
- [migrate-from-playwright.md](migrate-from-playwright.md)
- [tighten-success-criteria.md](tighten-success-criteria.md)
- [review-suite-quality.md](review-suite-quality.md)
