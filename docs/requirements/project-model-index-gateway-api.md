# Requirements: Project model index — API mutations (Gateway Key)

**Status:** Draft (not implemented). **Audience:** Building agents / implementers.  
**Canonical:** This file owns this feature spec. **Related:** [docs/guides/resolve-to-execution-contract.md](../guides/resolve-to-execution-contract.md) (canonical `providerType`), [docs/api/openapi.yaml](../api/openapi.yaml) (`GET /api/projects/{projectId}/models` today), [apps/dashboard/src/routes/keys/docs/cloud-api/+page.svelte](../../apps/dashboard/src/routes/keys/docs/cloud-api/+page.svelte) (Cloud API doc).

## Problem

Integrators (e.g. Sophia) call `GET /keys/dashboard/api/projects/{projectId}/models` to drive model pickers. That surface is effectively **read-only** in public docs. There is no documented, **`rk_` Gateway Key–authenticated** way to add or remove models from the project’s selectable index. Operators are pushed to the dashboard (or unclear control-plane paths), which blocks automation, CI, and “configure from Sophia admin/API.”

Sophia merges that response with a static catalog and only supplements non-Voyage embeddings when Google / Vertex already appear in the project model set — so the **missing capability is upstream**, not a Sophia bug.

## Goals

1. **Machine configuration:** Create / update / remove project model bindings via HTTP + JSON, same operational style as routes/steps.
2. **Single story for Sophia:** Prefer **Dashboard API + Gateway Key (`rk_`)** for these mutations so Sophia does not need a second secret unless unavoidable.
3. **Contract clarity:** Every new path appears in **published OpenAPI** and **Cloud API** docs with auth, errors, and examples.

## Functional requirements

| ID | Requirement |
|----|-------------|
| **FR-1** | Add one or more models to the project index: at minimum `{ providerType, modelId }` per row (names aligned with existing resolve/route fields: `openai`, `anthropic`, `google`, `voyage`, etc.). Support **batch** in one request if that fits existing patterns. |
| **FR-2** | Remove or disable a binding — choose one model: **hard delete** vs **soft `enabled: false`**; **document semantics** in OpenAPI and Cloud API. |
| **FR-3** | **Idempotency:** Re-adding the same `providerType` + `modelId` must not error (or return a stable 200 / 409 with clear code — **document which**). |
| **FR-4** | **Authorization:** Gateway Key may only mutate the project bound to the key; **reject cross-project `projectId` tampering** (mirror policies/evaluate rules). |
| **FR-5** | **Read-after-write:** After a successful mutation, `GET …/projects/{projectId}/models` must include the change (same consistency guarantees as the rest of the dashboard API; if eventually consistent, **document lag**). |
| **FR-6** | **Errors:** Reuse existing dashboard JSON error shape (`error`, `detail`, optional `errors[]`) and HTTP codes (400 validation, 401, 403, 404 unknown model/provider if validated against canonical catalog). |
| **FR-7** | **Provider normalization:** Document **canonical `providerType` values and aliases** (e.g. `vertex` vs `google`) so integrators’ merge logic matches resolve. Sophia already normalizes some Vertex spellings in `ingestionModelCatalogMerge.ts`; **Keys must document the source of truth** (see resolve contract guide + OpenAPI enums). |

## Non-goals (explicit)

Storing third-party API secrets remains on existing **BYOK / integration** flows. This feature is the **project model index** used for selectors and merge, unless you intentionally unify “enable provider + register models” in one API — if so, **document that**.

## Documentation / OpenAPI (part of the deliverable)

- Add paths under `/keys/dashboard/api` to **OpenAPI** (`docs/api/openapi.yaml`); keep in sync with any `/keys/docs/...` published bundle if applicable.
- **Cloud API doc:** Table row for mutations on project models; state clearly **Dashboard API + `rk_`** vs **Zuplo + `zpka_`** if any operation stays on Zuplo.
- **curl** examples: add, remove, list.

## Acceptance criteria

- From a backend with only **`RESTORMEL_GATEWAY_KEY`** + **`RESTORMEL_PROJECT_ID`**, an integrator can add **`google` + `text-embedding-005`** (or **`vertex` + same id**, per canonical choice documented) and see it on **`GET …/models`** without using the browser dashboard.
- OpenAPI lists the new methods and schemas.
- **Tests (automated or manual notes):** forbidden cross-project mutation; validation errors for unknown provider/model if enforced.

## Optional stretch (IaC-friendly)

| ID | Requirement |
|----|-------------|
| **FR-8** | `PUT` or `PATCH` to **replace** the full project model allowlist from a JSON array for declarative sync. |

## Documentation status (gap closed for “what exists today”)

The following now state clearly that **`GET …/projects/{projectId}/models` is read-only**, uses the **Dashboard API + Gateway Key (`rk_`)**, is **not** on Zuplo consumer-key paths, and that **writes are UI-only** until this spec is implemented:

- [docs/api/openapi.yaml](../api/openapi.yaml) — `info` inventory + `listProjectModels` description + `gatewayKey` scheme text
- In-app **Cloud API** (`apps/dashboard/.../cloud-api/+page.svelte`) — matrix table, routing metadata row, list curl
- [docs/guides/resolve-to-execution-contract.md](../guides/resolve-to-execution-contract.md) — canonical `providerType` alignment for merge
- [docs/walkthrough/01-writing-style-guide.md](../walkthrough/01-writing-style-guide.md) — glossary + auth cheat-sheet (`zpka_` vs `rk_`)
- [docs/reference/implemented-behaviour.md](../reference/implemented-behaviour.md) — live vs not live
- [docs/documentation-strategy.md](../documentation-strategy.md) — strategy bullet

**Remaining gap (this spec):** machine **mutations** (`POST`/`DELETE`/replace) for the project model index — implementation + OpenAPI methods + curl examples for writes.

## Implementation checklist (for the building agent)

- [ ] DB / control-plane: schema for project–model bindings (if not already present); migrations.
- [ ] `+server.ts` handlers + shared validation (catalog / canonical provider).
- [ ] Gateway Key auth + project scope (FR-4).
- [ ] OpenAPI + Cloud API page + walkthrough cross-links if user-facing.
- [ ] Vitest (or integration tests) for idempotency, 403 cross-project, validation errors.
