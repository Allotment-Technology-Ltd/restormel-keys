# Config reference — MVP runner behaviour

**Canonical machine schema:** YAML or JSON `restormel-testing.*` validated by `@restormel/testing-config`.  
**This doc:** what the **current** open-source runner executes vs rejects.

## Executed today

| Area | Behaviour |
|------|------------|
| **Environments** | `base_url`, per-env `keys`, `auth_mode`, `auth_ref`, optional **`egress_allow_hosts`** / **`egressAllowHosts`** (extra hostnames allowed for **all** browser traffic — same list as the `ac_sequence` **`navigate`** tool **and** Playwright context route blocking for scripts, `fetch`, XHR, WebSockets, etc., in addition to the `base_url` origin) |
| **Suites** | `id`, `environment`, `goals`, optional `description`, **`user_story` / `userStory`** (business narrative), **`acceptance_criteria` / `acceptanceCriteria`** (ordered `{ id, text }[]` for PM/QA traceability), `timeouts` / `retries` / `defaults` merge |
| **`adapter_hooks`** | Map of hook id → shell command string. Run **before** the suite for every key **except** `teardown` (keys sorted lexicographically). **`teardown`** runs **after** the suite (even on failure). Skipped entirely when `RESTORMEL_TESTING_SKIP_SHELL_HOOKS=1`. Timeout per command: `RESTORMEL_TESTING_SHELL_HOOK_TIMEOUT_MS` (default 120000). |
| **Goals (`type: browser`)** | Default **`execution_mode: observe`**: navigate to environment `base_url` with optional per-goal `start_path` / `startPath` (must stay under the origin; `..` rejected). Then evaluate `success_criteria`. **`execution_mode: agent`**: run **`mission_executor`** (shell) with mission env, then navigate and evaluate post-mission criteria (see [agent-missions.md](agent-missions.md)). **`execution_mode: ac_sequence`**: suite must declare **`acceptance_criteria`**; goal includes **`ac_sequence` / `acSequence`** with required **`built_in_agent`** (optional **`model_ref`**, **`max_rounds_per_criterion`**, **`instructions`**). The runner runs a **built-in** multi-turn LLM browser loop **per criterion in order** (same-origin actions), then optional per-AC **`criterion_success`**, **`criterion_rubrics`** (LLM judge JSON must echo the criterion **`ac_id`**), **`post_checks`** (HTTP, **`dom_role_name`**, **`db_shell`**), and optional **`criterion_executor`** shell before each AC. Top-level **`success_criteria`** may be omitted or empty for this mode. If **`acceptance_criterion_ids`** is omitted, it defaults to **all** suite criterion ids in declaration order. Results include **`acSequenceSteps`** on the goal run for reporting. |
| **Goals (`type: performance`)** | Same navigation path as browser goals; performance-specific evaluation uses the Playwright path the runner opens for that goal. |
| **Goals (`type: native`)** | Not supported — run fails with a clear error. |
| **Per-goal `preconditions`** | Shell strings; run **before** the browser attempt (after any prior goals), **before** navigation. Failure → goal outcome `PRECONDITION_FAILED`. Respects the same skip/timeout env vars as `adapter_hooks`. |
| **Per-goal `cleanup`** | Shell strings; run in a `finally` after the goal attempt. Failures are logged as warnings; they do not flip a passed goal to failed. |
| **Success criteria** | `url_matches`, `dom_signals`, `text_present` / `text_absent`, `structured_checks` (`css:…` selectors; Web Vitals-style paths — see below; **Lighthouse-style** paths — see below), **`any_of` / `anyOf`** (OR over nested criteria objects; ≥2 branches), `judge_rubric` (needs Keys HTTP or opt-in OpenAI fallback — see env table). Evaluated **after** navigation to the goal’s entry URL (for **`judge_rubric`**, that snapshot is **post-navigation** unless you use **`execution_mode: agent`** so an external executor performs steps first — see [agent-missions.md](agent-missions.md)). |
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
| **`mission` / `mission_executor` / `mission_constraints` / `after_agent` on observe goals** | Only allowed when **`execution_mode: agent`** (and agent mode only for **`type: browser`**). |
| **`execution_mode: agent` without `mission` + `mission_executor`** | Required strings. |
| **`ac_sequence` block when `execution_mode` is not `ac_sequence`** | Forbidden. |
| **`execution_mode: ac_sequence` without suite `acceptance_criteria`** | Required non-empty suite criteria list. |
| **`execution_mode: ac_sequence` without `ac_sequence` object** | Required goal block with at least **`built_in_agent`**. |
| **`execution_mode: ac_sequence` for non-browser goals** | Only **`type: browser`**. |
| **`acceptance_criterion_ids` without suite `acceptance_criteria`** | Suite must declare criteria first. |
| **Unknown id in `acceptance_criterion_ids`** | Must match a suite **`acceptance_criteria[].id`**. |
| **Duplicate `acceptance_criteria[].id`** | Ids must be unique within the suite. |
| **Empty `acceptance_criteria` array** | Omit the key or include at least one `{ id, text }`. |

## Judge / Keys environment (never commit values)

**Canonical names** (prefer these in new `.env` and docs): [restormel-environment-vocabulary.md](../guides/restormel-environment-vocabulary.md) § Testing runner. The adapter still accepts **compatibility aliases** `RESTORMEL_KEYS_API_BASE_URL` and `RESTORMEL_KEYS_API_TOKEN` (same values as `RESTORMEL_KEYS_BASE` and `RESTORMEL_GATEWAY_KEY`).

| Variable | Role |
|----------|------|
| `RESTORMEL_KEYS_BASE` | Site origin; enables `POST …/v1/testing/resolve-model` on the same host |
| `RESTORMEL_GATEWAY_KEY` | Bearer for that request. Use a **Gateway key** (`rk_…`), not a raw provider secret. (`RESTORMEL_SERVER_TOKEN` is the same secret when you already use it elsewhere.) |
| `RESTORMEL_KEYS_API_TOKEN_ENV` | Optional: env **name** that holds the bearer (default treats `RESTORMEL_KEYS_API_TOKEN` then `RESTORMEL_GATEWAY_KEY`; see vocabulary for full precedence). |
| `RESTORMEL_PROJECT_ID` | Restormel **project** UUID for resolve and bindings. Copy from the Keys dashboard **Restormel Testing** page (`/keys/dashboard/testing`) or your project settings. |
| `RESTORMEL_TESTING_OPENAI_FALLBACK=1` | Opt-in: use `OPENAI_API_KEY` when Keys is unset or resolution fails |
| *(resolve response)* `secretEnvVar: RESTORMEL_HOSTED_INLINE` + `inlineApiKey` | When the Keys deployment stores an encrypted provider key for the binding, the adapter may receive a short-lived inline key for the runner. Still keep `RESTORMEL_GATEWAY_KEY` (or alias `RESTORMEL_KEYS_API_TOKEN`) for Gateway auth. See [keys-testing-onboarding.md](../keys-testing-onboarding.md). |

### Shell hooks (adapter / precondition / cleanup)

| Variable | Role |
|----------|------|
| `RESTORMEL_TESTING_SKIP_SHELL_HOOKS=1` | Skip all shell hooks (suite hooks, preconditions, cleanup). |
| `RESTORMEL_TESTING_SHELL_HOOK_TIMEOUT_MS` | Per-command timeout in milliseconds (default `120000`). Also caps **`mission_executor`** unless `mission_constraints.max_duration_ms` raises the ceiling (max of both). |
| `RESTORMEL_TESTING_SKIP_MISSION_EXECUTOR=1` | Skip **`mission_executor`** only for **`execution_mode: agent`** goals (post-mission browser still runs). |
| `RESTORMEL_TESTING_AC_ID`, `RESTORMEL_TESTING_AC_TEXT`, `RESTORMEL_TESTING_AC_INDEX` | During **`ac_sequence`** per-criterion work: set for **`criterion_executor`** and **`post_checks.db_shell`**, with existing run vars (`RESTORMEL_TESTING_BASE_URL`, `RESTORMEL_TESTING_GOAL_ID`, `RESTORMEL_TESTING_RUN_ID`, optional **`RESTORMEL_TESTING_ARTIFACT_DIR`**). |

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

- [Agent missions (`execution_mode: agent`)](agent-missions.md)
- [MVP spec — test definition](restormel-testing-mvp-spec.md#7-test-definition-model)
- [Agent prompt pack](agent-prompts/README.md)
- [OSS consumption](oss-consumption.md)
