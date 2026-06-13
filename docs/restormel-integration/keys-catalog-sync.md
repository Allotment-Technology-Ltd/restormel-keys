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

**Default list viability:** **`GET /api/models`** (and the model slice in **`GET /api/catalog`**) omits models with lifecycle **`deprecated`** or **`retired`** (unless you set `lifecycleState`) and omits models whose **`retirement_date`** is in the past. Use **`?includeUnhealthy=1`** for the full operator slice. Legacy **`?source=catalog`** accepts the same flag. **`POST`/`PUT`** with **`bindingKind: execution`** rejects non-viable catalog models and non-**`available`** variants (`model_unavailable`, `variant_unavailable`).

---

## Stable JSON shape for the project index (`GET`)

For the default project index response (no `source=catalog`):

- The binding list is the JSON array at **`data`**.
- Each element is a **project model index entry**: `id`, **`bindingKind`**, **`providerType`**, **`modelId`**, **`enabled`**, timestamps, and nested **`model`** (catalog row or `null` if off-catalog / registry-only / removed catalog row).
- **`meta.source`** is `"project"` when listing bindings.

**`bindingKind` (`execution` vs `registry`):**

- **`execution`** (default on write): `providerType` must be a **canonical** resolve vocabulary value; `modelId` must exist in Keys **`models`** and pass variant checks when variants exist. Use for rows aligned with **`GET /api/models`**.
- **`registry`**: arbitrary provider/model strings (length + sanity checks only) for host merge / pickers when Keys catalog does not yet list the pair. Nested **`model`** is usually **`null`**. Not a promise that resolve/routes execute that pair until catalog and runtime support exist.

**Contract note:** The API does **not** emit `data.bindings` or a top-level `bindings` field. Integrators that conceptually treat the list as “bindings” should read **`response.data`**. Request bodies for **`POST`** / **`PUT`** use **`models`**: `{ providerType, modelId [, enabled] [, bindingKind] }`.

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

Apply Postgres migrations **`020_project_model_bindings.sql`** then **`021_project_model_bindings_kind.sql`** (drops FK from `model_id` to `models`, adds `binding_kind`) when rolling an image that serves the project model index. See [apps/dashboard/README.md](../../apps/dashboard/README.md).

---

## Consumer feedback into this repo

Trusted consumers relay improvement requests via **`[Dogfood]`** issues; policy and relay setup: [docs/archive/github-workflow/github-dogfood-feedback.md](../archive/github-workflow/github-dogfood-feedback.md). SOPHIA-oriented test notes: [docs/archive/reference/restormel-dogfood-sophia-handover.md](../archive/reference/restormel-dogfood-sophia-handover.md).
