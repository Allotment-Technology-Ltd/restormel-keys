# Restormel / Testing — MVP hardening implementation plan

**Status:** Phases 0–6 implemented in-repo (see [follow-up review](restormel-testing-hardening-follow-up-review.md)).  
**Date:** 2026-04-07  
**Source:** Gap analysis from MVP spec, technical architecture, product brief vs current `packages/*` implementation.

## Objectives

1. Make **Plot dogfooding** credible: Keys-backed judge runs, consumable packages, honest config.
2. Shrink **support burden**: docs match behaviour; no silent no-ops in YAML.
3. Keep scope **minimal**: prefer delete, defer, or validate-and-fail over new surface area.

## Principles

- **Honest YAML:** If the runner does not execute `preconditions`, `cleanup`, or `adapter_hooks`, either implement a minimal path or reject/warn at `validate` time.
- **Keys first, fallback explicit:** No silent OpenAI env fallback in CI without opt-in flags/env documented in one place.
- **One canonical doc** for “what works in MVP” — update MVP spec where it contradicts the composite Action (e.g. polling).

---

## Phase 0 — Documentation truth (0.5–1 day)

**Goal:** Stop lying to users and agents before more code lands.

| # | Task | Acceptance criteria |
|---|------|---------------------|
| 0.1 | MVP spec **Journey 2 (GitHub Actions):** remove or mark *future* any “poll until terminal” / hosted orchestration language; describe **inline composite** + step summary + fork skip. | `docs/restormel-testing-mvp-spec.md` updated; no contradictory promise. |
| 0.2 | Architecture / product docs: **one paragraph** stating MVP execution = **navigate to `base_url` + evaluate `success_criteria`** (optional judge); **agentic multi-step loop deferred**. | Brief + architecture aligned. |
| 0.3 | Root **README**: replace “scaffold” for packages that are real; **primary quickstart** = `examples/testing-basic-web`; link Playwright install once. | `README.md` |
| 0.4 | **Config reference** (canonical location TBD — e.g. extend `apps/web` docs or `docs/`): list **supported vs ignored** fields for this runner version. | Single source; agent-prompt pack links to it. |

**Deliverable:** Doc PR mergeable without behaviour change.

---

## Phase 1 — Keys + CLI wiring (blocker for Plot) (2–4 days)

**Goal:** `judge_rubric` and any Keys-backed path work from **CLI** and **GitHub Action**.

| # | Task | Acceptance criteria |
|---|------|---------------------|
| 1.1 | **Env contract:** document and implement reading of e.g. `RESTORMEL_KEYS_API_BASE_URL`, `RESTORMEL_KEYS_API_TOKEN` (or names you standardise), optional **opt-in** `RESTORMEL_TESTING_OPENAI_FALLBACK=1` + `OPENAI_API_KEY` for judge-only escape hatch. | Table in security-sensitive doc + `.env.example` placeholders only. |
| 1.2 | **CLI `run` + `validate`:** thread `keysAdapterOptions` from env into `runLocalSuite` / `runSuiteFromConfig` (mirror test stubs in `run-suite.test.ts`). | Judge goals resolve model when Keys HTTP + secret binding env are set. |
| 1.3 | **GitHub Action:** same wiring via env inputs or documented `env:` block on the workflow step; **never** log tokens or provider keys. | `packages/testing-github-action/src/run-ci.ts` + `action.yml` if new inputs needed. |
| 1.4 | **Failure modes:** clear stderr when judge requested but model resolution fails (already partially via warnings — ensure exit code and summary reflect **indeterminate** / **failed** appropriately). | Manual smoke: goal with `judge_rubric` + stub transport in test; integration doc for real Keys. |

**Deliverable:** End-to-end: config with `judge_rubric` + Keys resolution in local + GHA (with test double or staging Keys URL).

---

## Phase 2 — CLI completeness vs MVP spec (1–2 days)

**Goal:** Close the highest-value spec gaps without building a TUI.

| # | Task | Acceptance criteria |
|---|------|---------------------|
| 2.1 | **`testing run --goal <id>`** (repeatable or comma-separated): plumb to existing `goalIds` on runner. | `packages/cli` parse-args, dispatch, help text. |
| 2.2 | **`testing doctor` (minimal):** Node version, config path exists, Playwright chromium check (spawn or `playwright --version` + browser path hint), optional Keys env presence **without printing values**. | Exit non-zero if hard prerequisites missing. |
| 2.3 | **Machine-readable output (pick one):** `--json` on `run`/`validate` **or** document “parse `run.json` only” and drop spec JSON stdout — **decide in Phase 0 doc sync**. | Spec and implementation match. |

**Defer:** Rich `doctor`, multiple output formats, `report --run <id>` alias beyond current `report <path>`.

---

## Phase 3 — Config honesty: hooks and session (2–5 days, split as needed)

**Goal:** Plot-ready **fixtures** without a generic automation framework.

| # | Task | Acceptance criteria |
|---|------|---------------------|
| 3.1 | **Preconditions / cleanup / adapter_hooks:** choose **A** implement minimal executor (shell commands from `adapter_hooks` map, keyed by hook id) **B** `validate` **error** if non-empty hooks/preconditions/cleanup **C** warn-only. Recommendation: **B or minimal A** — avoid silent no-op. | YAML + tests in `packages/config` / `packages/runner`. |
| 3.2 | **Auth/session for Plot:** smallest credible story — e.g. `storageStatePath` env or config key + Playwright `storageState` in browser session factory **or** document “manual cookie injection” for MVP. | One worked example in docs; no full IAM. |

**Defer:** Full `auth_mode` matrix, Keys session exchange, multi-tenant fixtures.

---

## Phase 4 — Security hardening (parallel with Phase 1–2) (1–2 days)

| # | Task | Acceptance criteria |
|---|------|---------------------|
| 4.1 | **Judge payload:** reduce sensitivity — prefer selector-scoped text for judge context where possible; cap size; document **no prod PII** in rubric goals. | `packages/runner` `evaluate-criteria.ts` + docs. |
| 4.2 | **Logging:** redact/truncate judge HTTP errors and any future auth headers in traces. | Spot-check `traces.json` for leaks. |
| 4.3 | **Fork skip:** document **green skip** implications for branch protection; optional follow-up issue for a dedicated “skipped” check job. | `examples/testing-github-actions/README.md` + action README. |

---

## Phase 5 — CI and OSS consumption (1–3 days)

| # | Task | Acceptance criteria |
|---|------|---------------------|
| 5.1 | **This repo’s CI:** one job that runs **`testing run`** against **basic-web** (serve + run) **or** explicitly document exclusion + rely on unit tests — pick one and make it intentional. | `.github/workflows/ci.yml` |
| 5.2 | **Sample workflow:** uncomment or add **upload-artifact** for `.restormel-testing/runs/` in example workflow. | `examples/testing-github-actions/sample-workflow.yml` |
| 5.3 | **Consumption story for Plot:** Changesets/npm **or** pinned git + `pnpm` build from tag — document **one** recommended path; version `@restormel/testing-cli` (and siblings) when publishing. | README + optional `docs/` release note |

---

## Phase 6 — Product metrics / reports (optional, defer)

| # | Task | Acceptance criteria |
|---|------|---------------------|
| 6.1 | Populate `RunRecord.costEstimate` or remove from contract until used. | `packages/core` + `packages/report` |
| 6.2 | Structured `reproduction` block in `report.json` if still desired by architecture doc. | Align schema + writer |

---

## Dependency graph (simplified)

```text
Phase 0 (docs truth)
    ↓
Phase 1 (Keys + CLI + Action) — blocker for Plot + judge
    ↓
Phase 2 (CLI flags + doctor)     Phase 4 (security) — can overlap
    ↓
Phase 3 (hooks / session)
    ↓
Phase 5 (CI + publish + examples)
    ↓
Phase 6 (cost / reproduction) — defer
```

---

## Out of scope (explicit defer)

- Hosted control plane, polling orchestration, run history UI.
- Full agentic multi-step runner from config.
- Native/mobile, broad visual regression.
- Replacing Playwright with multiple vendors.

---

## “Done” definition for Plot dogfooding

- [ ] `web-critical` (or equivalent) runs **locally** and in **GHA** against preview/staging URL.
- [ ] At least one goal uses **Keys-resolved** model for **judge_rubric** (or team explicitly drops judge for first slice).
- [ ] Preconditions/session story documented and **works** for login **or** goals are public-only for v1.
- [ ] No **ignored** YAML fields without warning/error.
- [ ] Published or versioned packages consumed by Plot without fragile git shims.

---

## Ship recommendation (plan-level)

Execute **Phase 0 + Phase 1** before declaring “MVP hardened.” **Phase 3** minimum is required for **authenticated** Plot journeys. **Phase 5.3** is required before calling it **OSS-ready** outside the monorepo.

See also: gap analysis in chat / future pointer from `docs/restormel-testing-mvp-spec.md` to this plan once execution starts.
