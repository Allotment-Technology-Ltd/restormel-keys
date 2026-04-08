# Config reference — MVP runner behaviour

**Canonical machine schema:** YAML or JSON `restormel-testing.*` validated by `@restormel/testing-config`.  
**This doc:** what the **current** open-source runner executes vs rejects.

## Executed today

| Area | Behaviour |
|------|------------|
| **Environments** | `base_url`, per-env `keys`, `auth_mode`, `auth_ref` (see below) |
| **Suites** | `id`, `environment`, `goals`, `timeouts` / `retries` / `defaults` merge |
| **Goals (`type: browser`)** | Navigate to resolved `base_url`, evaluate `success_criteria` |
| **Success criteria** | `url_matches`, `dom_signals`, `text_present` / `text_absent`, `structured_checks` (`css:`…), `judge_rubric` (needs Keys HTTP or opt-in OpenAI fallback — see env table) |
| **Auth** | `auth_mode: storage_state` + `auth_ref`: filesystem path relative to config file, or `env:VAR` where VAR is a path to Playwright `storageState` JSON |
| **Artefacts** | `run.json`, `traces.json`, `report.json`, Markdown summaries, JUnit, optional screenshots |
| **CLI `--json` + `run`** | On success: stdout JSON with `verdict`, `run_id`, `artifact_dir`. On **pre-run** failure (bad config, unknown suite, etc., before a `RunRecord` exists): stdout JSON with `ok: false`, `errors`, `artifact_dir`, `partial_artifacts`; the directory always includes `pre-run-failure.json` with the same errors. |

## Rejected at `validate` (not silently ignored)

| Field | Reason |
|-------|--------|
| **`adapter_hooks`** (any non-empty entry) | Commands are not executed; empty object / omitted is OK |
| **`preconditions`**, **`cleanup`** on goals | Not executed |

## Judge / Keys environment (never commit values)

| Variable | Role |
|----------|------|
| `RESTORMEL_KEYS_API_BASE_URL` | Keys API origin; enables `POST …/v1/testing/resolve-model` |
| `RESTORMEL_KEYS_API_TOKEN` | Default bearer for Keys API (name override: `RESTORMEL_KEYS_API_TOKEN_ENV`) |
| `RESTORMEL_TESTING_OPENAI_FALLBACK=1` | Opt-in: use `OPENAI_API_KEY` when Keys is unset or resolution fails |

## `judge_rubric` fields

| Field | Purpose |
|-------|---------|
| `id`, `summary` | Rubric identity / short label for logs |
| `model_ref` | Keys logical ref; else slot from env `keys` |
| `context_selector` | Optional CSS selector — judge sees **only** that element’s text (smaller surface than full page) |

Do **not** point judges at pages with production PII. **Sensitive apps:** treat `context_selector` as **required** practice so provider-bound judge calls do not receive full-page text by default.

### Run record: judge count vs cost hint

- **`judgeInvocationCount`** on `RunRecord` — factual number of judge / rubric model invocations (sum of Keys meta invocation counts).
- **`costEstimate.tokenEstimate`** — MVP **heuristic only** (not billing-grade); do not use for spend accounting.

## GitHub Actions: fork skip and branch protection

The composite action defaults to **`fork_pr_policy: skip`** on fork PRs (no secrets). That step exits **0**, so a **required check can look green when the suite did not run**. If you need an explicit “did not run” outcome for policy, add a second job (e.g. label or status) or adjust branch rules — see `examples/testing-github-actions/README.md`.

### Checks API vs step summary

The MVP writes **step summary** Markdown (`github-summary.md` / action output), not the GitHub **Checks** REST API. A future optional `github/checks` integration could attach richer annotations.

## Further reading

- [MVP spec — test definition](restormel-testing-mvp-spec.md#7-test-definition-model)
- [Agent prompt pack](agent-prompts/README.md)
- [OSS consumption](oss-consumption.md)
