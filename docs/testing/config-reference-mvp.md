# Config reference — MVP runner behaviour

**Canonical machine schema:** YAML or JSON `restormel-testing.*` validated by `@restormel/testing-config`.  
**This doc:** what the **current** open-source runner executes vs rejects.

## Executed today

| Area | Behaviour |
|------|------------|
| **Environments** | `base_url`, per-env `keys`, `auth_mode`, `auth_ref` (see below) |
| **Suites** | `id`, `environment`, `goals`, `timeouts` / `retries` / `defaults` merge |
| **`adapter_hooks`** | Map of hook id → shell command string. Run **before** the suite for every key **except** `teardown` (keys sorted lexicographically). **`teardown`** runs **after** the suite (even on failure). Skipped entirely when `RESTORMEL_TESTING_SKIP_SHELL_HOOKS=1`. Timeout per command: `RESTORMEL_TESTING_SHELL_HOOK_TIMEOUT_MS` (default 120000). |
| **Goals (`type: browser`)** | Navigate to environment `base_url` with optional per-goal `start_path` / `startPath` (must stay under the origin; `..` rejected). Then evaluate `success_criteria`. |
| **Goals (`type: performance`)** | Same navigation path as browser goals; performance-specific evaluation uses the Playwright path the runner opens for that goal. |
| **Goals (`type: native`)** | Not supported — run fails with a clear error. |
| **Per-goal `preconditions`** | Shell strings; run after navigation, before criteria. Failure → goal outcome `PRECONDITION_FAILED`. Respects the same skip/timeout env vars as `adapter_hooks`. |
| **Per-goal `cleanup`** | Shell strings; run in a `finally` after the goal attempt. Failures are logged as warnings; they do not flip a passed goal to failed. |
| **Success criteria** | `url_matches`, `dom_signals`, `text_present` / `text_absent`, `structured_checks` (`css:…` selectors; Web Vitals-style paths — see below; **Lighthouse-style** paths — see below), **`any_of` / `anyOf`** (OR over nested criteria objects; ≥2 branches), `judge_rubric` (needs Keys HTTP or opt-in OpenAI fallback — see env table) |
| **Auth** | `auth_mode: storage_state` + `auth_ref`: filesystem path relative to config file, or `env:VAR` where VAR is a path to Playwright `storageState` JSON |
| **Artefacts** | `run.json`, `traces.json`, `report.json`, Markdown summaries, JUnit, optional screenshots |
| **CLI `--json` + `run`** | Single suite: same as before. **Multiple suites** (`--suite` repeated or `--suites a,b,c`): stdout ends with one JSON object aggregating `verdict`, `suites`, `runs`, and base `artifact_dir`. On **pre-run** failure (bad config, unknown suite, etc., before a `RunRecord` exists): stdout JSON with `ok: false`, `errors`, `artifact_dir`, `partial_artifacts`; the directory always includes `pre-run-failure.json` with the same errors. |

### Web Vitals–style `structured_checks`

Use `path` (and optional `id`) under `structured_checks`. Numeric `expect` is interpreted as a **maximum** threshold:

| `path` | Meaning | Default `expect` if omitted |
|--------|---------|----------------------------|
| `vital:lcp` or `web_vitals:lcp` | Last LCP entry time (ms) | `2500` |
| `vital:fcp` or `web_vitals:fcp` | First paint related timing (ms) | `2500` |
| `vital:cls` or `web_vitals:cls` | Layout shift score | `0.1` |

If no entry is available yet (e.g. LCP), the check may return **indeterminate** (`VITAL_*_MISSING`).

### Lighthouse-style `structured_checks` (full category audits)

Use these when you want **Lighthouse** category scores (performance, accessibility, SEO, etc.), not just the in-page Performance API vitals above.

| `path` | Behaviour |
|--------|------------|
| `lighthouse:performance` or `lh:performance` | Run Lighthouse with **performance** category only. |
| `lighthouse:accessibility` / `lh:accessibility` | **Accessibility** category. |
| `lighthouse:best-practices` / `lh:best-practices` | **Best practices** category. |
| `lighthouse:seo` / `lh:seo` | **SEO** category. |
| `lighthouse:pwa` / `lh:pwa` | **PWA** category (score may be missing on non-PWA sites → **indeterminate**). |
| `lighthouse:full` / `lh:full` / `lighthouse:all` / `lh:all` | **performance**, **accessibility**, **best-practices**, and **seo** (not PWA). |

Numeric **`expect`** is a **minimum pass threshold** for each selected category’s score: use an integer **0–100** (percent) or a fraction **0–1**. Omitted **`expect`** defaults to **50** (50%). **Every** selected category must meet the threshold.

**Important:** Lighthouse runs in a **separate** headless Chrome (same binary family as Playwright’s Chromium). It loads the **same URL** as the Playwright page after navigation but does **not** inherit cookies, `storageState`, or other session state. For **logged-in** journeys, prefer **`vital:*`** checks in the existing browser session, keep strict gates on **Lighthouse CI** with your auth story, or test a **public** URL.

| Variable | Role |
|----------|------|
| `RESTORMEL_TESTING_SKIP_LIGHTHOUSE=1` | Skip Lighthouse structured checks (they return **indeterminate**). |
| `RESTORMEL_TESTING_LIGHTHOUSE_TIMEOUT_MS` | Max time for one Lighthouse run in ms (default **180000**). |

## Rejected at `validate` (not silently ignored)

| Field | Reason |
|-------|--------|
| _(none for hooks)_ | Non-empty `adapter_hooks`, `preconditions`, and `cleanup` are **allowed** and executed. |
| Malformed `any_of` | e.g. fewer than two branches, or mixed with other keys at the same object level (schema rules in `@restormel/testing-config`). |
| Unsafe `start_path` | Paths containing `..` |

## Judge / Keys environment (never commit values)

| Variable | Role |
|----------|------|
| `RESTORMEL_KEYS_API_BASE_URL` | Keys API origin; enables `POST …/v1/testing/resolve-model` |
| `RESTORMEL_KEYS_API_TOKEN` | Default bearer for Keys API (name override: `RESTORMEL_KEYS_API_TOKEN_ENV`). Use a **Gateway key** (`rk_…`), not a raw provider secret. |
| `RESTORMEL_PROJECT_ID` | Restormel **project** UUID for resolve and bindings. Copy from the Keys dashboard **Restormel Testing** page (`/keys/dashboard/testing`) or your project settings. |
| `RESTORMEL_TESTING_OPENAI_FALLBACK=1` | Opt-in: use `OPENAI_API_KEY` when Keys is unset or resolution fails |
| *(resolve response)* `secretEnvVar: RESTORMEL_HOSTED_INLINE` + `inlineApiKey` | When the Keys deployment stores an encrypted provider key for the binding, the adapter may receive a short-lived inline key for the runner. Still keep `RESTORMEL_KEYS_API_TOKEN` as the Gateway key. See [keys-testing-onboarding.md](../keys-testing-onboarding.md). |

### Shell hooks (adapter / precondition / cleanup)

| Variable | Role |
|----------|------|
| `RESTORMEL_TESTING_SKIP_SHELL_HOOKS=1` | Skip all shell hooks (suite hooks, preconditions, cleanup). |
| `RESTORMEL_TESTING_SHELL_HOOK_TIMEOUT_MS` | Per-command timeout in milliseconds (default `120000`). |

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

**Multi-suite:** set input `suites` to a comma-separated list (e.g. `ci-smoke,web-critical`), or set a single `suite`. When `suites` is non-empty, `suite` is ignored. Artefacts are written under per-suite subfolders of the run directory so one step does not overwrite another.

Environment variables set by the action: `RESTORMEL_TESTING_SUITE`, `RESTORMEL_TESTING_SUITES`.

### Checks API vs step summary

The MVP writes **step summary** Markdown (`github-summary.md` / action output), not the GitHub **Checks** REST API. A future optional `github/checks` integration could attach richer annotations.

## Further reading

- [MVP spec — test definition](restormel-testing-mvp-spec.md#7-test-definition-model)
- [Agent prompt pack](agent-prompts/README.md)
- [OSS consumption](oss-consumption.md)
