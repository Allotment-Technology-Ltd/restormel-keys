# Restormel / Testing — MVP Specification

**Status:** Internal MVP spec  
**Date:** 2026-04-07

## 1. MVP objective

Ship a **small but real** open-source product that proves Restormel / Testing can replace a meaningful slice of brittle scripted browser-journey testing for Plot, while establishing the core architectural seam between:
- Restormel / Testing
- Restormel / Keys
- browser automation
- CI/CD execution

The MVP is successful if a developer can:
1. define a small number of goal-based tests in repo config
2. run them locally
3. run them in GitHub Actions
4. resolve model execution through Restormel / Keys
5. get an interpretable verdict and useful failure artefacts

---

## 2. MVP constraints

The MVP must be:
- open-source first
- built on Restormel / Keys
- cheap to run via BYOK
- usable in local development and CI/CD
- dogfooded on Plot first
- intentionally small
- built by integrating mature infrastructure where possible

---

## 3. MVP goals

### G1 — Goal-based browser testing for critical AI-enabled journeys
Support a small suite of browser-backed tests expressed as **goals + success criteria**, not brittle imperative scripts.

### G2 — Keys-backed execution
Use Restormel / Keys for model/provider resolution and BYOK execution.

### G3 — Local + GitHub Actions execution
Developers must be able to run:
- local CLI execution
- GitHub Actions execution on PRs / branches

### G4 — Useful verdict model
Every run should end with one of:
- `passed`
- `failed`
- `indeterminate`

With structured reasons and evidence.

### G5 — Plot dogfooding utility
The MVP must be valuable enough to run on Plot’s `web-critical` journeys.

### G6 — Narrow architecture with clean seams
Do not build a large hosted platform first. Keep the seams clean enough for later expansion.

---

## 4. Non-goals

The MVP should **not** include:
- native/mobile support
- a rich hosted dashboard requirement
- broad visual regression support
- full autonomous test generation
- enterprise collaboration / governance features
- full parity with all Plot tests
- broad vendor integrations just for marketing coverage
- full observability platform behaviour
- production synthetic monitoring

---

## 5. Core user journeys

## Journey 1 — Local run
A developer edits code in Plot and runs:

```bash
restormel-testing run --suite web-critical
```

The tool:
- loads config
- resolves environment (and optional Playwright `storage_state` for `auth_mode: storage_state`)
- resolves model/provider via Restormel / Keys when `judge_rubric` or Keys env is configured
- runs browser-backed goals (navigate to `base_url`, evaluate `success_criteria`)
- prints a structured result summary (or `--json` machine output)
- stores local artefacts

**Note:** `preconditions`, `cleanup`, and `adapter_hooks` are **rejected at validate** in the current MVP runner — they are not silently ignored.

Implementation plan: [restormel-testing-mvp-hardening-plan.md](restormel-testing-mvp-hardening-plan.md).

## Journey 2 — PR check in GitHub Actions
A PR triggers a Restormel / Testing job.

The composite Action (MVP):
- loads suite config from the repo
- runs the **same inline runner** as the local CLI (no hosted orchestration, **no polling**)
- writes artefacts under `.restormel-testing/runs/`
- appends a **GitHub step summary** (not a separate Checks API integration)
- fails the step when the suite verdict is `failed` or `indeterminate`
- defaults to **skipping** browser runs on **fork** PRs when `fork_pr_policy: skip` (exit **0** when skipped — branch protection should account for “skipped” vs “ran”)

Set `RESTORMEL_KEYS_API_BASE_URL` / token env in workflow **env** when using `judge_rubric`. See `docs/config-reference-mvp.md`.

## Journey 3 — Reproduce a failed CI run locally
A failed PR links to a run summary containing:
- failing goal ID
- high-level failure reason
- key artefacts
- local reproduction command

The developer can rerun the failing goal or suite locally.

---

## 6. Plot MVP target journeys

Start with 5–8 goals only.

Recommended first Plot goals:
1. `auth-login-session`
2. `onboarding-complete`
3. `dashboard-ready`
4. one core domain journey
5. one second core domain journey
6. one payment/subscription sandbox flow
7. one perf smoke goal

Rules:
- every goal must be business meaningful
- every goal must have explicit success criteria
- avoid broad exploratory coverage in MVP

---

## 7. Test definition model

Use a repo-native config file, initially YAML:

`restormel-testing.yaml`

### Minimum schema concepts

#### Suite
A named collection of goals.

Fields:
- `id`
- `environment`
- `goals[]`
- `timeouts`
- `retries`
- optional `tags`

#### Goal
Represents the outcome being tested.

Fields:
- `id`
- `description`
- `type` (`browser`, `performance`, later `native`)
- `success_criteria`
- optional `preconditions`
- optional `cleanup`
- optional `exclusive_with`
- optional `tags`

#### Success criteria
Machine-checkable or rubric-backed checks.

Allowed MVP shapes:
- URL match
- DOM signal presence
- text match / absence
- lightweight structured extraction + assertion
- explicit rubric/judge check for narrow cases

#### Environment
Named target environment:
- local
- preview
- staging

Fields:
- `base_url`
- auth/session mode
- cookie/origin rules
- optional fixture commands

#### Keys references
Opaque references only, never raw secrets.

Example:
```yaml
keys:
  llm_primary: ref:restormel-keys:llm/primary
  llm_vision: ref:restormel-keys:llm/vision
```

---

## 8. CLI requirements

### Core commands

```bash
restormel-testing init
restormel-testing run --suite web-critical
restormel-testing run --suite web-critical --goal onboarding-complete
testing report .restormel-testing/runs/<run-dir>
testing doctor --config restormel-testing.yaml
```

### MVP CLI needs
- initialise a basic config
- run a suite or subset via `--goal` (comma-separated)
- `validate` / `run` support `--json` for machine-readable stdout (full detail remains in artefact `run.json` / `report.json`)
- store run artefacts locally
- `doctor` for Node / config readability / Playwright / Keys env **names** (no secret values)

### Do not build yet
- large interactive TUI
- complex orchestration CLI subcommands
- broad cloud lifecycle commands

---

## 9. System components

### 9.1 CLI
Loads config, validates input, triggers execution, prints summaries.

### 9.2 Runner / worker
Executes browser-backed goals, bounded agent loop, assertions, retries, and artefact generation.

### 9.3 Browser execution adaptor
Default: Playwright.

### 9.4 Keys integration adaptor
Resolves logical model references through Restormel / Keys.

### 9.5 Report / artefact writer
Writes structured results and optional PR annotation payloads.

### 9.6 GitHub Action
Thin wrapper around the runner contract.

---

## 10. Package / module boundaries

Recommend this initial repo shape:

```text
restormel-testing/
├── packages/
│   ├── core/            # contracts, schemas, run model, verdict model
│   ├── runner/          # execution engine, retries, orchestration
│   ├── browser-playwright/
│   ├── keys-adapter/
│   ├── cli/
│   └── github-action/
├── docs/
├── examples/
│   ├── plot-reference/
│   └── public-demo/
├── scripts/
└── .github/workflows/
```

### Boundary rule
- `core` defines contracts, not vendor logic
- `runner` coordinates execution, not provider resolution internals
- `browser-playwright` handles browser specifics
- `keys-adapter` owns Restormel / Keys integration seam
- `github-action` stays thin

---

## 11. Run artifacts and report model

Every run should produce:

### Run summary
- run ID
- suite ID
- environment
- start/end timestamps
- overall verdict
- duration
- cost estimate if available

### Goal results
For each goal:
- goal ID
- verdict
- reason code
- short summary
- retry count
- evidence links

### Evidence artifacts
- screenshots where enabled
- action timeline
- assertion results
- optional sanitized model reasoning summary
- optional HAR-lite / console / network snippets

### CI outputs
- GitHub Checks summary
- optional JUnit-compatible output

---

## 12. Keys integration points

Restormel / Testing should use Keys for:
- logical model reference resolution
- provider/model selection
- BYOK handling
- optional policy-aware execution later

### MVP Keys usage
- resolve one primary model
- optionally resolve one vision model
- log key IDs / refs, never raw secrets
- support fallback to CI env secrets only when Keys is unavailable

### Do not do in MVP
- bypass Keys by default
- build a second credential-management system
- depend on private app-level Keys internals

---

## 13. External tools to integrate with first

## First integrations
1. **Playwright** — browser execution substrate
2. **GitHub Actions** — CI entry point
3. **Restormel / Keys** — model/provider execution
4. **JUnit / GitHub Checks outputs** — downstream compatibility
5. **OpenTelemetry export hooks** — optional, lightweight seam only

## Later integrations
- Phoenix / LangSmith / Braintrust / Weave
- Promptfoo / DeepEval / Ragas scorer adapters
- Browserbase / Stagehand
- Maestro / Appium for native

---

## 14. Phase 1 vs Phase 2

## Phase 1 — shippable MVP
- YAML config
- CLI
- Playwright-backed runner
- GitHub Action
- Keys integration for one or two providers
- small verdict and artefact model
- Plot `web-critical` suite
- safe CI defaults

## Phase 2 — first expansion
- richer assertion types
- better diffing across runs/providers/prompts
- optional observability exports
- native runner interface
- AI-assisted authoring helpers
- more reusable fixture adapters

---

## 15. Success criteria

The MVP is successful if:

1. Plot can run 5–8 meaningful `web-critical` goals through Restormel / Testing.
2. A developer can run the same suite locally and in GitHub Actions.
3. Keys-backed execution works with at least one provider end to end.
4. Failed runs produce enough evidence for an engineer to triage the issue in under 30 minutes.
5. The product remains small enough that a solo founder can ship and iterate it.

---

## 16. Recommended implementation sequence

1. Define `core` schemas and verdict model.
2. Implement YAML parsing and validation.
3. Build the Playwright execution adaptor.
4. Add Keys resolution seam.
5. Add CLI local run.
6. Add GitHub Action wrapper.
7. Add Plot reference suite.
8. Tighten artefacts and flake handling.

This is the smallest honest path to something real.
