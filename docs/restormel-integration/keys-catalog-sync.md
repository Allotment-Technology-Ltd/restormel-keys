# Project model index and global catalog (integrator reference)

**Audience:** Host apps and consumer repos that call the **Dashboard API** with a **Gateway Key** (`rk_…`) to merge Restormel’s project model allowlist with local pickers or ingestion UX.

**Canonical API:** [docs/api/openapi.yaml](../api/openapi.yaml) (`GET/POST/PUT /api/projects/{projectId}/models`, `PATCH/DELETE …/models/{bindingId}`). **Behaviour spec:** [docs/requirements/project-model-index-gateway-api.md](../requirements/project-model-index-gateway-api.md). **Resolve / provider vocabulary:** [docs/guides/resolve-to-execution-contract.md](../guides/resolve-to-execution-contract.md).

**Base URL (production):** `https://restormel.dev/keys/dashboard` — HTTP paths below are appended (e.g. `/api/projects/{projectId}/models`).

---

## Per-project index vs global catalog

| Use case | Method | Path | Auth |
|----------|--------|------|------|
| **Project allowlist** (bindings + nested catalog row per model) | `GET` | `/api/projects/{projectId}/models` (no `source`, or `source=project`) | Gateway Key (project-scoped) |
| **Full tenant catalog** (all catalog models, not project-specific) | `GET` | `/api/models` | Unauthenticated on dashboard host (see OpenAPI) |

Do **not** rely on `GET /api/projects/{projectId}/models?source=catalog` for new code: it returns the global list for **legacy** callers only. Prefer **`GET /api/models`** for the global catalog so project paths stay semantically “index only.”

---

## Stable JSON shape for the project index (`GET`)

For the default project index response (no `source=catalog`):

- The binding list is the JSON array at **`data`**.
- Each element is a **project model index entry**: `id`, canonical **`providerType`**, **`modelId`**, **`enabled`**, timestamps, and nested **`model`** (catalog row or `null` if the catalog row was removed).
- **`meta.source`** is `"project"` when listing bindings.

**Contract note:** The API does **not** emit `data.bindings` or a top-level `bindings` field. Integrators that conceptually treat the list as “bindings” should read **`response.data`**. Request bodies for **`POST`** / **`PUT`** still use the key **`models`** (array of `{ providerType, modelId [, enabled] }`).

Entries with **`enabled: false`** remain in **`data`**; picker UIs may exclude them so soft-disabled models do not appear in merge layers.

---

## Validation errors (`POST` / `PUT`)

When one or more rows fail catalog or provider checks, the API responds with **HTTP 400** and:

- **`error`:** `project_models_validation_failed`
- **`detail`:** short human summary
- **`errors`:** array of `{ index, field, code, message }` — **automated callers should branch on `error` and parse `errors[]` per row.**

Schema: OpenAPI component **`ProjectModelsValidationError`**. The same shape is documented in the public integrator guide ([resolve-to-execution-contract.md](../guides/resolve-to-execution-contract.md) — subsection *Project model index: response shape and validation errors*).

---

## Operators (Keys deploy)

Apply Postgres migration **`020_project_model_bindings.sql`** to the dashboard database when rolling an image that serves the project model index. See [apps/dashboard/README.md](../../apps/dashboard/README.md).

---

## Consumer feedback into this repo

Trusted consumers relay improvement requests via **`[Dogfood]`** issues; policy and relay setup: [docs/github-dogfood-feedback.md](../github-dogfood-feedback.md). SOPHIA-oriented test notes: [docs/reference/restormel-dogfood-sophia-handover.md](../reference/restormel-dogfood-sophia-handover.md).
