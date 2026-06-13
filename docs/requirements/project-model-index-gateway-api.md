# Requirements: Project model index — API mutations (Gateway Key)

**Status:** **Implemented** (dashboard `+server` handlers, migrations `020`–`021`, OpenAPI 1.3.2, Cloud API). **Audience:** Integrators + implementers.  
**Canonical:** This file records the original FRs and semantics. **Related:** [docs/guides/resolve-to-execution-contract.md](../guides/resolve-to-execution-contract.md), [docs/guides/integration/keys-catalog-sync.md](../guides/integration/keys-catalog-sync.md), [docs/api/openapi.yaml](../api/openapi.yaml), [apps/dashboard/src/routes/keys/docs/cloud-api/+page.svelte](../../apps/dashboard/src/routes/keys/docs/cloud-api/+page.svelte).

## Problem (historical)

Integrators called `GET /keys/dashboard/api/projects/{projectId}/models` for pickers but had no Gateway Key path to mutate the index without the browser.

## Shipped behaviour (summary)

| Area | Detail |
|------|--------|
| **Storage** | `project_model_bindings` (`020_project_model_bindings.sql`); runtime self-heal in `neon.ts` if migration not yet applied. |
| **GET** | Default: project bindings in JSON **`data`** (array); no `data.bindings` key. Nested `model` catalog row per binding. `?source=catalog` = legacy global list (deprecated — prefer `GET /api/models`). |
| **POST** | `{ "models": [{ "providerType", "modelId" [, "bindingKind"?] }] }` — batch upsert, **idempotent** (re-add sets `enabled: true`). |
| **PUT** | `{ "models": [{ "providerType", "modelId", "enabled"?, "bindingKind"? }] }` — **replace** full allowlist (empty clears). |
| **PATCH** | `.../models/{bindingId}` + `{ "enabled": boolean }` — soft disable / re-enable. |
| **DELETE** | `.../models/{bindingId}` — hard remove. |
| **Auth** | Gateway Key (project-scoped) + session/management patterns matching other project APIs. Cross-project key → **403**. |
| **Validation** | **`bindingKind` `execution`** (default): canonical `providerType`; `getModel` + variant check when variants exist. **`registry`**: length/sanity only (`project-model-index-validation.ts`). Errors: `project_models_validation_failed` + `errors[]`. |
| **FR-3** | Idempotent add: **200**, upsert without error. |

## Functional requirements (traceability)

| ID | Status |
|----|--------|
| FR-1 | Done — batch `POST`. |
| FR-2 | Done — `DELETE` hard, `PATCH` soft `enabled`. |
| FR-3 | Done — upsert re-enables. |
| FR-4 | Done — `403` cross-project Gateway Key. |
| FR-5 | Done — synchronous Postgres; `GET` reflects writes immediately. |
| FR-6 | Done — JSON shape + 400/401/403/404. |
| FR-7 | Done — resolve guide + OpenAPI (`ProjectModelBindingKind`, relaxed `providerType` on index entry). |
| FR-8 | Done — `PUT` replace. |

## Non-goals (unchanged)

BYOK / integration secrets stay on existing flows; this index is for selector/merge metadata only.

## Documentation / OpenAPI

Delivered: OpenAPI paths + schemas (`ProjectModelIndexEntry`, batch/replace requests, validation error), Cloud API matrix + curl blocks.

## Acceptance criteria

Met: integrator with `RESTORMEL_GATEWAY_KEY` + `RESTORMEL_PROJECT_ID` can `POST` `vertex` + `text-embedding-005` and see rows on `GET`; OpenAPI + tests cover cross-project and validation failures.

## Implementation checklist

- [x] DB migration + neon CRUD
- [x] `+server.ts` + validation
- [x] Gateway Key scope
- [x] OpenAPI + Cloud API + Vitest
