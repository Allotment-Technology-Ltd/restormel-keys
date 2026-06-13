# Restormel / Testing — agentic product requirements (upgrade track)

**Status:** Canonical product + roadmap (in-repo)  
**Audience:** Contributors and adopters  
**Scope:** This document is the **upgrade specification** for **Restormel Testing** (`@restormel/testing-*`, `restormel-testing.yaml`). It is **not** a separate product or repo layout: execution maps to **`testing-runner`** + **`testing-browser-playwright`**, CLI to **`testing-cli`**, CI to **`testing-github-action`**, config to **`testing-config`**.

## Mission

Ship outcome-first, **bounded** autonomous browser checks in CI and locally, with **BYOK** via Restormel Keys (or documented env fallbacks). Deterministic jobs (lint, typecheck, unit, migrations) stay **separate**.

**Non-goals (v1):** Replace compiler-grade checks; fully autonomous prod monitoring; zero-flake promises; mandatory hosted control plane.

## Logical architecture (delivered incrementally)

| Plane | Responsibility | Implementation (this monorepo) |
|-------|------------------|--------------------------------|
| **Configuration** | Versioned declarative config (`schema_version: "1"`), suites, goals, environments, defaults, logical key refs only | `@restormel/testing-config`, `restormel-testing.yaml` |
| **Execution** | Playwright (Chromium), agent loop, structured events, rubric verdicts | `@restormel/testing-runner`, `@restormel/testing-browser-playwright` (`ac-agent-loop`, observe/agent/ac_sequence goals) |
| **Control** | Runs API v1 (roadmap); v0 = runner embedded in GitHub Action / CLI | Inline MVP today; contract in [runs-api-v1.md](runs-api-v1.md) |
| **Policy** | Tool allowlist, same-origin navigation, screenshot policy, prompt versioning | Built-in AC agent system prompt + `artifact_policy`; egress allowlist NFR documented below |
| **Adapters** | `adapter_hooks`, pre/post commands — no adopter-specific code in core | `adapter_hooks` + goal `preconditions` / `cleanup` |

## Functional requirements (mapping)

- **Goals & suites (FR-1–4):** `TestSuite`, `TestGoal`, `success_criteria`, `exclusive_with`, `acceptance_criterion_ids`, environments — see [config-reference-mvp.md](config-reference-mvp.md).
- **Agent loop (FR-5–8):** `execution_mode: ac_sequence` + built-in loop (`maxRoundsPerCriterion`, navigate / click / fill / wait / **scroll_into_view** / **snapshot_a11y** / done); `execution_mode: agent` delegates LLM work to `mission_executor` then evaluates criteria; verdicts `passed` \| `failed` \| `indeterminate` with `reasonCode`, `summary`, `evidenceRefs` in `run.json` / `report.json`.
- **CI (FR-9–11):** Composite Action inputs (`suite`, `suites`, `target_url`, `commit_sha`, `pr_number`, `repository`, fork policy) — [github-action-io-spec.md](github-action-io-spec.md).
- **Reporting (FR-12–14):** Artefact bundle (`junit.xml`, `summary.md`, `github-summary.md`, traces, screenshots); local `testing run --suite …` mirrors CI.
- **Web performance (FR-15–16):** Vitals / Lighthouse paths — [performance goals guide](../../apps/dashboard/src/routes/testing/docs/guides/performance-goals/+page.svelte) (dashboard) and [config-reference-mvp.md](config-reference-mvp.md); retry / indeterminate policies on goals and suites.

## Restormel Keys (BYOK)

- Resolve `ref:restormel-keys:…` at run start via `@restormel/testing-keys-adapter`; **never** embed key material in prompts or committed artefacts.
- Logs: logical ref id / provider metadata — **not** secret values (`KeysModelMeta`).
- Fallback: documented env names (e.g. OpenAI) in [keys-testing-onboarding.md](../keys-testing-onboarding.md).
- **NFR:** Journey suites in CI should use **non-prod** Keys bindings; document blocking prod keys for high-risk flows.

## Reference adopter: Plotbudget (configuration only)

Core must support **without** Plotbudget imports:

| ID | Need |
|----|------|
| PB-1 | Validator hook via `adapter_hooks` / shell (e.g. guard prod Supabase ref) |
| PB-2 | Multiple `storage_state` paths + hooks for fixture users |
| PB-3 | `target_url_overrides` / Action `target_url` + cookie docs (Vercel preview) — [vercel-suite-routing.md](vercel-suite-routing.md), CI guides |
| PB-4 | Polar / PWYL sandbox via adapters + Keys (later) |
| PB-5 | `type: native` reserved; device runner shares goal schema later |

## Phased roadmap

| Phase | Deliverable |
|-------|-------------|
| **P0** | Schema v1 + JSON Schema draft, Runs API markdown, threat addendum, Action I/O spec |
| **P1** | Blocking web-critical-class suite (deterministic observe-only), BYOK one provider, A1–A4 |
| **P2** | Adopter parity checklist (versioned in-repo); shrink deterministic E2E via multi-criteria observe-only goals — **done:** [checklists/adopter-appendix-b-parity/v1.md](checklists/adopter-appendix-b-parity/v1.md) + `examples/testing-basic-web` / `nextjs-playwright` |
| **P3 (GA OSS)** | Semver Action tags, schema stability policy, quickstart, CONTRIBUTING/SECURITY, A3 dogfood workflow — **done:** [schema-stability-policy.md](schema-stability-policy.md), [github-action-semver.md](github-action-semver.md), [quickstart-ga.md](quickstart-ga.md), [testing-a3-dogfood-workflow.md](testing-a3-dogfood-workflow.md) |
| **P4** | Native / device adapter |

## Acceptance criteria

**P1**

- **A1:** CI blocks on the monorepo **`web-critical`** example (`examples/testing-basic-web`): deterministic **observe-only** goals with coverage equivalent to a longer suite (URL, text, landmarks, structured checks, secondary route) — see [checklists/adopter-appendix-b-parity/v1.md](checklists/adopter-appendix-b-parity/v1.md) § Monorepo reference.
- **A2:** Failed run triage from `report.json` / step summary / JUnit without raw model transcripts.
- **A3:** BYOK E2E with Keys for OpenAI or Anthropic on `judge_rubric` or `ac_sequence`.
- **A4:** Fork PR safe defaults + `require_label` / `sandbox_only` — [github-action-io-spec.md](github-action-io-spec.md).

**P3 (GA)**

- **A5:** Public quickstart + semver Action — [quickstart-ga.md](quickstart-ga.md); Action pins [github-action-semver.md](github-action-semver.md); tag workflow [release-testing-action-version.yml](../../.github/workflows/release-testing-action-version.yml).
- **A6:** Config v1 frozen; minors backwards-compatible — [schema-stability-policy.md](schema-stability-policy.md).
- **A7:** Adopter sign-off on parity checklist.

## Success metrics (surface in run summary)

Time-to-triage, flake trend, goal coverage %, PR wall-time contribution, optional token visibility — align with `RunRecord` / report bundle fields.

## Risks

| Risk | Mitigation |
|------|------------|
| R1 Non-determinism | Rubrics, retries, pinned prompts; deterministic sentinels alongside agent goals |
| R2 Cost | `maxRoundsPerCriterion`, BYOK transparency, invocation counts |
| R3 Autonomous browsing | Same-origin rules, tool allowlist, no secrets in YAML prompts |
| R4 OSS scope | Narrow core, adapters in repo config only |

## Deliverables checklist (builder)

- [x] Monorepo mapping documented (this file) — packages are `testing-*`, not `action/cli/worker` renames.
- [x] JSON Schema draft: `packages/testing-config/schema/restormel-testing-config.v1.schema.json`
- [x] Runs API: [runs-api-v1.md](runs-api-v1.md) + server [testing-runs-server.md](testing-runs-server.md) (`@restormel/testing-runs-server`)
- [x] Action I/O: [github-action-io-spec.md](github-action-io-spec.md)
- [x] Threat model addendum: [testing-autonomous-browsing-threat-addendum.md](testing-autonomous-browsing-threat-addendum.md)
- [x] Egress allowlist: `environments.*.egress_allow_hosts` for `ac_sequence` agent navigation **and** default-deny at Playwright context (subresources, XHR, WS)
- [x] P1 BYOK checklist: [p1-byok-e2e-checklist.md](p1-byok-e2e-checklist.md) (A3)
- [x] Adopter sign-off template: [adopter-parity-signoff-template.md](adopter-parity-signoff-template.md) (A7)
- [x] Appendix B parity checklist **v1.0.0:** [checklists/adopter-appendix-b-parity/v1.md](checklists/adopter-appendix-b-parity/v1.md)
- [x] Schema stability policy: [schema-stability-policy.md](schema-stability-policy.md)
- [x] Composite Action semver tags + workflow: [github-action-semver.md](github-action-semver.md), [`.github/workflows/release-testing-action-version.yml`](../../.github/workflows/release-testing-action-version.yml)
- [x] GA quickstart: [quickstart-ga.md](quickstart-ga.md)
- [x] Root [CONTRIBUTING.md](../../CONTRIBUTING.md) / [SECURITY.md](../../SECURITY.md) (Testing + disclosure scope)
- [x] A3 dogfood: [testing-a3-dogfood-workflow.md](testing-a3-dogfood-workflow.md), [`.github/workflows/testing-a3-byok-dogfood.yml`](../../.github/workflows/testing-a3-byok-dogfood.yml), `examples/testing-a3-dogfood/`
- [x] License policy: [oss-license-policy.md](oss-license-policy.md)
- [x] Examples: `examples/testing-basic-web`, `examples/nextjs-playwright`, `examples/testing-github-actions` (incl. fork-label sample)

**Compatibility:** Preserve `restormel-testing.yaml` concepts (`environments`, `judge_rubric`, web vitals, `ac_sequence`, `execution_mode: agent`). No imports from external adopters in `packages/testing-*`.
