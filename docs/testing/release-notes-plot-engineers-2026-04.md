# Restormel Testing — release note for Plot engineers (April 2026)

**Audience:** Engineers adopting Restormel Testing in Plot-style repos (deterministic browser goals, CI-first, optional Keys for rubrics).  
**Status:** Reference (communication aid). Canonical behaviour and env names live in the linked docs below.

This note summarises what shipped in response to **Plotbudget-class adoption feedback** ([plotbudget-testing-adoption-feedback.md](plotbudget-testing-adoption-feedback.md)) and related follow-up (Keys + Testing integration, docs, packaging). It is **not** a substitute for the spec: use [config-reference-mvp.md](config-reference-mvp.md) when writing YAML.

---

## What you can do now that you could not do before


| Area                              | Before                                                                                               | Now                                                                                                                                                                                                                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Success criteria**              | Multiple DOM signals were effectively **AND-only**.                                                  | **OR-style** criteria via `success_criteria.any_of` / `anyOf` in config.                                                                                                                                                                                                                                 |
| **Navigation**                    | Runner effectively assumed **suite `base_url` only** for goals.                                      | **Per-goal** entry via `start_path` / `startPath` (relative to base URL).                                                                                                                                                                                                                                |
| **Guards / setup / teardown**     | `adapter_hooks`, goal `preconditions`, and `cleanup` were not executed as first-class shell steps.   | **Shell hooks run** with documented skip/timeout: `RESTORMEL_TESTING_SKIP_SHELL_HOOKS`, `RESTORMEL_TESTING_SHELL_HOOK_TIMEOUT_MS`.                                                                                                                                                                       |
| **Performance / Vitals**          | Performance goals and “real” Web Vitals-style checks were awkward to express in one contract.        | **Web Vitals paths** in the Playwright session (`vital:lcp`, `web_vitals:lcp` / `fcp` / `cls`); `**lighthouse:*` / `lh:*`** category audits in a **separate** Chrome (with opt-out `RESTORMEL_TESTING_SKIP_LIGHTHOUSE`). `**performance` goals share navigation** with `browser` goals where configured. |
| **Multi-suite CI**                | Running several suites from one job risked artefact/summary footguns; CLI/Action were suite-centric. | **CLI:** `--suite` (repeatable) and `--suites`. **GitHub Action:** `suite` / `suites` inputs and `**RESTORMEL_TESTING_SUITES`** env. You can still use distinct `**RESTORMEL_TESTING_ARTIFACT_DIR**` per step if you prefer.                                                                             |
| **Install story**                 | Multiple `@restormel/testing-*` packages to reason about.                                            | `**@restormel/testing-bundle`** meta-package pulls the CLI and declares the browser adaptor dependency (still install Playwright browsers as documented).                                                                                                                                                |
| **Keys in CI clarity**            | Easy to guess wrong env names or fork-PR behaviour.                                                  | `**testing doctor`** can perform an optional **Keys resolve probe** (HTTP status only) when URL + token are set; dashboard **Keys in CI** checklist and onboarding copy.                                                                                                                                 |
| **Hosted keys + Testing project** | Provider material lived only in CI secrets / local env.                                              | Optional **encrypted** provider keys under dashboard **Connections**; `**POST /v1/testing/resolve-model`** for `ref:restormel-keys:…` when you wire the adapter; dashboard **Restormel Testing** hub for `**RESTORMEL_PROJECT_ID`** and env snippets.                                                    |
| **Public documentation**          | Some `/testing/docs/*` pages were unreliable on the live site.                                       | **SSR fix** shipped; guides below are safe to share as **[https://restormel.dev/testing/docs/](https://restormel.dev/testing/docs/)...** links.                                                                                                                                                          |


---

## Install and run (quick pointers)

- **npm:** `pnpm add -D @restormel/testing-bundle@^0.1.3` (or pin CLI + peers per [oss-consumption.md](oss-consumption.md)).
- **Playwright:** install Chromium for the browser adaptor (see oss-consumption).
- **CI:** prefer `**@restormel/testing-github-action`** or `pnpm exec testing run` — not an unsupported HTTP “runs” poller; see [HTTP runs vs Action](https://restormel.dev/testing/docs/guides/http-runs-and-actions).
- **Forks / secrets:** [Fork PRs and workflow triggers](https://restormel.dev/testing/docs/guides/ci-security).

---

## Documentation map (start here)

### Live dashboard docs (Restormel suite)


| Topic                                                        | URL                                                                                                                                    |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Testing docs home                                            | [https://restormel.dev/testing/docs](https://restormel.dev/testing/docs)                                                               |
| Configuration (`restormel-testing.yaml`)                     | [https://restormel.dev/testing/docs/guides/config](https://restormel.dev/testing/docs/guides/config)                                   |
| Test definition (suites, goals, success criteria)            | [https://restormel.dev/testing/docs/guides/test-definition](https://restormel.dev/testing/docs/guides/test-definition)                 |
| Performance goals (Vitals, Lighthouse, sharing with browser) | [https://restormel.dev/testing/docs/guides/performance-goals](https://restormel.dev/testing/docs/guides/performance-goals)             |
| CI / GitHub Actions                                          | [https://restormel.dev/testing/docs/guides/ci](https://restormel.dev/testing/docs/guides/ci)                                           |
| Keys in CI (checklist, env, forks)                           | [https://restormel.dev/testing/docs/guides/keys-ci-checklist](https://restormel.dev/testing/docs/guides/keys-ci-checklist)             |
| HTTP runs vs Action                                          | [https://restormel.dev/testing/docs/guides/http-runs-and-actions](https://restormel.dev/testing/docs/guides/http-runs-and-actions)     |
| Fork PRs and workflow triggers                               | [https://restormel.dev/testing/docs/guides/ci-security](https://restormel.dev/testing/docs/guides/ci-security)                         |
| Keys integration (BYOK / logical refs)                       | [https://restormel.dev/testing/docs/integrations/keys](https://restormel.dev/testing/docs/integrations/keys)                           |
| Monorepo / existing Playwright stack                         | [https://restormel.dev/testing/docs/getting-started/existing-stack](https://restormel.dev/testing/docs/getting-started/existing-stack) |
| Walkthrough (phased onboarding)                              | [https://restormel.dev/testing/docs/walkthrough](https://restormel.dev/testing/docs/walkthrough)                                       |


### Keys dashboard + hosted path


| Topic                                             | URL                                                                                                                              |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| In-product Keys + Testing onboarding              | [https://restormel.dev/keys/docs/guides/keys-testing-onboarding](https://restormel.dev/keys/docs/guides/keys-testing-onboarding) |
| Restormel Testing hub (project/env IDs, snippets) | [https://restormel.dev/keys/dashboard/testing](https://restormel.dev/keys/dashboard/testing)                                     |


### Repo canonical specs (this repository)


| Topic                                                             | Path                                                                                         |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Full YAML/env contract                                            | [config-reference-mvp.md](config-reference-mvp.md)                                           |
| Consuming from npm / CI patterns                                  | [oss-consumption.md](oss-consumption.md)                                                     |
| Original Plot feedback (traceability)                             | [plotbudget-testing-adoption-feedback.md](plotbudget-testing-adoption-feedback.md)           |
| Keys + Testing walkthrough (Connections, resolve, security notes) | [keys-testing-onboarding.md](../keys-testing-onboarding.md)                                  |
| GitHub Action README                                              | [packages/testing-github-action/README.md](../../packages/testing-github-action/README.md)   |
| Example workflow                                                  | [examples/testing-github-actions/README.md](../../examples/testing-github-actions/README.md) |
| Agent-oriented prompts (optional)                                 | [docs/testing/agent-prompts/](agent-prompts/)                                                |


---

## Still on the roadmap (not claimed as done)

The feedback doc’s **“Functionality to move beyond MVP”** table still applies for deeper browser orchestration, full **native** adaptor parity, richer judge+Keys-in-CI defaults, and parity tooling. This release closes the **structural** gaps called out for deterministic MVP-style adoption (hooks, per-goal paths, OR criteria, multi-suite, docs/bundle, clearer Keys CI story).

---

## Changelog pointer

Repo-level detail: [CHANGELOG.md](../../CHANGELOG.md) (section **Repo (2026-04-08)**).