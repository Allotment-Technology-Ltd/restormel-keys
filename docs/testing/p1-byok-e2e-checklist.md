# P1 checklist — BYOK E2E (A3)

**Goal:** Prove **one** LLM provider path end-to-end via **Restormel Keys** (or documented env fallback) for `judge_rubric` and/or `execution_mode: ac_sequence`, without putting key material in the repo.

## Preconditions

- [ ] Dashboard **Connections** has an encrypted provider credential for **OpenAI** or **Anthropic** (non-prod project).
- [ ] **Restormel Testing** project exists; `RESTORMEL_PROJECT_ID` is known.
- [ ] A config slot resolves, e.g. `llm_primary: ref:restormel-keys:llm/primary` under `environments.<id>.keys` or top-level `keys`.

## Keys HTTP resolve

- [ ] `RESTORMEL_KEYS_BASE` (or compatibility `RESTORMEL_KEYS_API_BASE_URL`) points at your deployment origin.
- [ ] `RESTORMEL_GATEWAY_KEY` is a valid Gateway key for that project.
- [ ] `testing doctor` reports Keys reachability and does **not** suggest missing project id when using hosted resolve.

## Minimal proof run (local)

- [ ] `testing validate --config restormel-testing.yaml` passes.
- [ ] A goal that invokes the model (`judge_rubric` or `ac_sequence`) **passes** or **fails with a rubric/agent reason** (not `MODEL_RESOLVE_FAILED`).
- [ ] `run.json` / `report.json` lists **`keysModelMeta`** with **logical ref** and **`resolutionSource: keys`** (not only `env_fallback`).

## CI (optional same PR)

- [ ] Repository **secrets** hold `RESTORMEL_KEYS_BASE`, `RESTORMEL_GATEWAY_KEY`, `RESTORMEL_PROJECT_ID` (names per [keys-testing-onboarding.md](../keys-testing-onboarding.md)).
- [ ] Workflow does **not** echo secrets in logs; fork PR policy matches your risk (`skip` / `require_label` / `sandbox_only`).

**Monorepo automated proof (maintainers):** GitHub **Environment** + [testing-a3-dogfood-workflow.md](testing-a3-dogfood-workflow.md) (`workflow_dispatch` or opt-in `RESTORMEL_TESTING_A3_MAIN`).

## Prod key blocking (journey suites)

- [ ] Documented rule: CI journey suites use **non-prod** Keys bindings; prod credentials are not referenced from `ref:restormel-keys:…` slots used in automated suites.

## Fallback path (documented only)

- [ ] If Keys is unavailable, `RESTORMEL_TESTING_OPENAI_FALLBACK=1` and provider env vars are **only** in CI secrets — never in YAML.

When all items are checked, **A3** is satisfied for that provider and environment.
