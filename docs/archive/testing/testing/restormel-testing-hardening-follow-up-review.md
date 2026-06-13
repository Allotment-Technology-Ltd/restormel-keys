# Hardening follow-up review (post Phase 0–6)

**Date:** 2026-04-07  
**Scope:** After implementing [restormel-testing-mvp-hardening-plan.md](restormel-testing-mvp-hardening-plan.md) phases 0–6 in-repo.

## What improved

- **Docs truth:** MVP spec matches **inline** composite Action; architecture/brief state single-URL + criteria execution honestly.
- **Keys wiring:** `keysAdapterOptionsFromProcessEnv()` used by **CLI** and **GitHub Action**; documented env table + `.env.example`.
- **CLI:** `--goal`, `doctor`, `--json` on `validate` / `run`; help updated.
- **Config honesty (superseded):** hooks were later **implemented** in the runner; see [config-reference-mvp.md](config-reference-mvp.md). This bullet reflected the pre-implementation MVP.
- **Session:** `auth_mode: storage_state` + `auth_ref` resolves Playwright `storageState` path.
- **Judge hardening:** smaller default sample (`main` → `body`), optional `context_selector`, redacted error snippets.
- **Reports:** `report.json` includes optional `reproduction`; `RunRecord.costEstimate` heuristic when judge invocations > 0.
- **CI:** `basic-web-integration` job; sample workflow uploads artefacts.
- **OSS:** `docs/testing/oss-consumption.md` describes git pin vs future npm.

## Remaining gaps — addressed (2026-04-07 follow-up)

| Topic | Resolution |
|-------|----------------|
| **`--json` on failed `run`** | `pre-run-failure.json` written under the artefact dir; stdout JSON includes `artifact_dir` and `partial_artifacts`. Documented in `config-reference-mvp.md` and CLI `help run`. |
| **Cost estimate** | `RunRecord.judgeInvocationCount` added (factual). `costEstimate.tokenEstimate` kept with explicit “not billing-grade” docs and Markdown heading **Rough token scale (heuristic only)**. |
| **Published packages** | [Changesets](https://github.com/changesets/changesets) scaffold (`.changeset/`) + [npm publish checklist](npm-publish-checklist.md). CI release workflow still optional. |
| **Checks API** | Documented as step-summary MVP only; Checks API noted as future optional work (`config-reference-mvp.md`). |
| **Fork skip + branch protection** | Documented under config reference + existing `examples/testing-github-actions/README.md`. |
| **Judge network** | `config-reference-mvp.md`: sensitive apps should treat `context_selector` as required practice. |

## Drift watch

- Avoid adding **hosted polling** without updating the spec again.
- Avoid **silent YAML** fields — extend `validate` when adding schema surface.

**Ship posture:** OK for **deterministic** OSS quickstart + CI; **Plot** with **login** can use `storage_state`; **judge** goals need **Keys or explicit fallback** in env.
