# Plotbudget — Restormel Testing adoption feedback

**Status:** Reference (consumer feedback). Not a commitment schedule; product prioritisation lives in roadmap / specs.  
**Date:** 2026-04-08  
**Context:** Plotbudget-class dogfooding used **deterministic MVP goals** (URL + `data-testid` / DOM checks). **Restormel Keys was not wired into a live CI path** for that work—no `RESTORMEL_KEYS_*` in workflows or app code yet. Keys appears in docs and in the product model for future `judge_rubric` goals.

**Update (same day, in-repo):** The runner and tooling now cover most of the structural gaps called out below — executable hooks / preconditions / cleanup, per-goal `start_path`, `any_of` success criteria, Web Vitals–style `structured_checks` paths, multi-suite CLI and Action (`suites` input), meta-package `@restormel/testing-bundle`, and a Keys HTTP probe in `testing doctor`. Canonical behaviour: [config-reference-mvp.md](config-reference-mvp.md); ship note: [CHANGELOG.md](../../CHANGELOG.md) (2026-04-08). The numbered sections below remain as **original feedback** for traceability.

**Update (Keys + Testing hosted path):** Teams that want `judge_rubric` without manual env archaeology can add **encrypted** provider keys under dashboard **Connections**, use **Restormel Testing** (`/keys/dashboard/testing`) for `RESTORMEL_PROJECT_ID` and snippets, and run `testing doctor` (it reminds you if `RESTORMEL_PROJECT_ID` is missing when Keys URL is set). Walkthrough: [keys-testing-onboarding.md](../keys-testing-onboarding.md).

## What would have made adoption smoother

### Executable `adapter_hooks` or a first-class “guard” goal type

*(Superseded in-repo — hooks now run; see Update above.)* MVP validation previously rejected non-empty `adapter_hooks` and did not run `preconditions` / `cleanup`, so guards had to be a **separate CI step**. Executable shell hooks in YAML are now supported with documented skip/timeout env vars.

### Per-goal navigation (path / relative URL)

*(Addressed: `start_path` / `startPath` on goals.)* Previously the runner navigated only to `base_url`; extra paths required multiple environments or suites.

### OR / composite success criteria

*(Addressed: `any_of` / `anyOf` on `success_criteria`.)* Previously, multiple `dom_signals` behaved as **AND** only.

### Performance goals vs real Web Vitals

*(Addressed: `vital:lcp` / `fcp` / `cls` and `web_vitals:*` in the Playwright session; `lighthouse:*` / `lh:*` category audits in a separate Chrome; `performance` goals share the navigation path.)* Heavy customised Lighthouse CI or RUM may still be complementary; see [config-reference-mvp.md](config-reference-mvp.md).

### Multi-suite runs without artefact / summary footguns

*(Addressed: `--suites` / repeated `--suite`, and Action `suites` input with per-suite subfolders.)* You can still set distinct **`RESTORMEL_TESTING_ARTIFACT_DIR`** values if you prefer separate action steps.

### Docs and packaging

*(Partially addressed: `@restormel/testing-bundle`, [oss-consumption.md](oss-consumption.md), dashboard guides.)* Ongoing docs work continues separately from this feedback capture.

### Keys + Testing story for CI

For **judge** goals, teams must understand Keys HTTP env, optional OpenAI fallback, and logical refs in YAML. A single **CI checklist** (required env vars, forbidden patterns, fork PR behaviour) reduces mistakes. *(Doctor now performs an optional Keys resolve POST and prints HTTP status only when URL + token are set.)*

## Functionality to move beyond MVP (Plotbudget-class)

| Gap | Why it matters |
|-----|----------------|
| Run **performance** (and eventually **native**) for real | Retire or shrink Playwright perf/native duplication only when verdicts are **passed/failed**, not indeterminate. |
| **Preconditions / hooks** actually run | Prod Supabase guard, payment sandbox checks, preview URL probes—without shell scripts beside every job. |
| Richer **browser** journeys | Multi-step flows (click, fill, wait) or documented hybrid with Playwright projects as “steps”—today mostly load URL + assert. |
| **Judge + Keys in CI by default** | Rubrics need stable resolution, cost/latency expectations, and policy when Keys is down (fail vs skip vs retry). |
| **Parity tooling** | Map spec appendix rows to suite ids; optional coverage-style reporting in CI output for QA sign-off. |

## Bottom line

For **MVP parity** with deterministic Plotbudget-style adoption, the largest product gaps called out here are **hooks/preconditions**, **per-goal URLs**, and **OR criteria**—they push workarounds into YAML and CI instead of expressing intent once. For **post-MVP**, real performance and native execution, executable guards, and deeper browser orchestration (or an explicit hybrid model with Playwright) are needed before shrinking the scripted matrix on Restormel alone.

## In-repo doc surfaces

- **Plot engineers — what shipped (April 2026):** [release-notes-plot-engineers-2026-04.md](release-notes-plot-engineers-2026-04.md) (before/after, doc map, links to live `/testing/docs`).
- Dashboard: [Keys in CI (checklist)](https://restormel.dev/testing/docs/guides/keys-ci-checklist), [Configuration](https://restormel.dev/testing/docs/guides/config), [Test definition](https://restormel.dev/testing/docs/guides/test-definition), [Performance goals](https://restormel.dev/testing/docs/guides/performance-goals).
- This file: single place to cite Plotbudget feedback without duplicating full narrative in multiple canonical docs.
