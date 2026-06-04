# Model catalog ingestion

Reference only. Canonical process: this doc and the scripts it describes.

## Keys MVP (simplified maintenance)

When **`restormel-module-catalog-external-signals`** is off (MVP default):

1. Edit **`apps/dashboard/data/model-catalog-seed.json`** for OpenAI, Anthropic, and Google models.
2. Run **`pnpm run seed:catalog`** from `apps/dashboard` (or let CI apply on push to `main` when seed paths change).
3. Run **`pnpm run check:catalog-drift`** locally before merge (direct providers only).

Deferred: external signals (`catalog-external-signals.ts`), daily [`.github/workflows/model-catalog-weekly.yml`](../../.github/workflows/model-catalog-weekly.yml) (requires repo variable **`RESTORMEL_CATALOG_EXTERNAL_SIGNALS=true`** or manual `workflow_dispatch`).

## Overview

**CI vs `@restormel/keys` defaults:** Which OpenAI/Anthropic/Google model strings from `defaultProviders` must appear in the JSON seed is defined in [catalog-governance.md](catalog-governance.md) (`pnpm run check:catalog-drift`).

The dashboard model catalog is stored in Postgres (`models`, `provider_model_variants`). Data is populated by:

1. **Static seed** — JSON file plus an ingestion script (maintainable, repeatable).
2. **Optional SQL seed** — `005_seed_model_catalog.sql` for minimal bootstrap; can be superseded by the script.

## What is static vs dynamically refreshed

| Source | Type | When | Notes |
|--------|------|------|--------|
| `apps/dashboard/data/model-catalog-seed.json` | Static | On demand via script | Single source of truth for seed. Edit to add/change models, lifecycle, capabilities, pricing refs. |
| `pnpm run seed:catalog` | Script | CI on `main` + PR preview + manual | Reads the JSON above and upserts into Neon. Safe to run multiple times. **Prod:** `.github/workflows/ci.yml` runs it after SQL migrations when `model-catalog-seed.json` or `ingest-model-catalog.mjs` changes (or via workflow_dispatch **Re-run model catalog JSON seed**). **PR previews:** `.github/workflows/neon_workflow.yml` runs it after migrations on the Neon preview branch. |
| Provider APIs (e.g. OpenAI /models) | Dynamic | Future | Not implemented in Phase 00. When added, document here and prefer refresh path over one-off hacks. |

Lifecycle fields (e.g. `sourceLastVerifiedAt`) are only as good as the seed or the future ingestion job; we do not fabricate verification dates.

## How to refresh or reseed

From `apps/dashboard`:

```bash
# DATABASE_URL: see “Env files” below. Run after migrations 004 and 005.
pnpm run seed:catalog
```

**Env files (local vs production):** Ingestion scripts load, in order, repo-root `.env`, then `apps/dashboard/.env`, then **`apps/dashboard/.env.local`** (each layer overrides the previous). Use **`.env`** for the default (e.g. production URI you keep in sync with Vercel production) and **`.env.local`** for local / preview DB while testing (`pnpm dev`, `pnpm run seed:catalog`). `.env.local` is gitignored and is not deployed; **Vercel** uses project environment variables only, so production keeps using the prod `DATABASE_URL` you set there.

Requires `models` and `provider_model_variants` tables (migration `004_control_plane_tables.sql`). Optional SQL seed `005_seed_model_catalog.sql` can be run first for minimal bootstrap; the script upserts over it. **Project model index** (`020` + `021_project_model_bindings_kind.sql`): **`bindingKind` `execution`** rows should match catalog ids; **`registry`** rows store arbitrary `model_id` strings (no FK to `models`). If you remove catalog rows, execution bindings may show nested `model: null` on `GET`.

The script validates the seed file (required fields on models and variants), then upserts into `models` and `provider_model_variants`. Existing rows are updated; new rows are inserted. Variant IDs are derived as `{modelId}-{providerIntegrationType}`.

**Viability in APIs:** By default, `listModels` (and therefore **`GET /keys/dashboard/api/models`** and the model slice inside **`GET /keys/dashboard/api/catalog`**) omits rows with lifecycle **`deprecated`** or **`retired`** (when you are not filtering by `lifecycleState`) and omits rows whose **`retirement_date`** is in the past. Pass **`includeUnhealthy=1`** on those HTTP endpoints to include those rows (operators). The dashboard **Models** browser uses `includeUnhealthy` server-side so operators still see the full table.

## Provider-derived refresh (from `@restormel/keys`)

If you want the catalog to stay aligned with the built-in provider adapters (so DeepSeek and the latest OpenAI/Anthropic model strings show up automatically), use:

```bash
pnpm run seed:catalog:from-keys
```

This derives candidate models/variants from `defaultProviders` in `@restormel/keys` and upserts them into the same tables. Existing richer metadata in `models` is preserved on conflict; this script mainly ensures the rows exist for all built-in provider model strings.

## Daily automation

The repository includes a scheduled GitHub Action to keep the catalog aligned daily:

- Workflow: `.github/workflows/model-catalog-weekly.yml` (runs daily)
- Command: `pnpm --filter dashboard seed:catalog:from-keys`
- Requirements: set a Neon Postgres connection string in repo secrets as `DATABASE_URL` and ensure dashboard migrations (including control-plane tables) are already applied in that DB

## Seed file shape

- `models`: array of model objects.
- Each model must have: `id`, `canonicalName`.
- Each model may have: `family`, `lifecycleState`, `description`, `contextWindow`, `maxOutputTokens`, `supportsTools`, `supportsStructuredOutput`, `supportsMcp`, `modalities`, `capabilities`, `editorialSummary`, `deprecationDate`, `retirementDate`, `replacementModelId`, `sourceLastVerifiedAt`.
- Each model may have `variants`: array of provider variants.
- Each variant must have: `providerIntegrationType`, `providerModelId`. Optional: `availabilityStatus`, `pricingRef`, `rateLimitRef`, `sourceLastVerifiedAt`.

Validation is performed by `scripts/ingest-model-catalog.mjs` before any DB writes. Tests can load the same JSON and assert on shape (see dashboard test suite).

## Troubleshooting: `password authentication failed for user 'neondb_owner'`

The URI is reaching Neon (`ep-…-pooler…` or `ep-…` without pooler), but Postgres rejected the password. The password in the file can look “correct” while the **string the client sends** is still wrong for that **branch and role**.

1. **Use the connection string for the right branch** — In Neon Console, open the **same branch** this endpoint belongs to, then **Connection details → copy** the full URI. **Protected / forked branches** can use **different** role passwords than the parent; do not reuse the parent’s URI on a child branch (or vice versa).
2. **Reset and paste once** — Project → **Roles** → `neondb_owner` → reset password, then copy the **new** connection string from **Connection details** in one step (do not mix host from one place with a password typed elsewhere).
3. **Pooler vs direct** — If auth still fails, switch the dashboard dropdown to the **direct** (non-`pooler`) URI and try again; keep `?sslmode=require` if Neon adds it.
4. **Confirm what Node sees** — From `apps/dashboard`: `MODEL_CATALOG_DEBUG_URL=1 pnpm run seed:catalog` prints host, user, database, and **password length only** (no secret). Compare the host to the branch you expect in the console.

`apps/dashboard/.env` overrides repo-root `.env` for `DATABASE_URL` when both define it.

The **`ep-…`** segment in the hostname (before `-pooler` if present) identifies the **Neon compute / branch** for that URI. It must match the database you intend (e.g. preview vs production). If Vercel links **preview** to one Neon branch and **production** to another, use the connection string from Neon for **that** branch—credentials are not interchangeable across different `ep-…` endpoints.

## Tests and validation

- **Script**: Runs validation before insert; exits with non-zero and messages if the seed is invalid.
- **Vitest**: A test loads the seed JSON and checks that every model has `id` and `canonicalName`, and every variant has `providerIntegrationType` and `providerModelId`. Add more checks as needed (e.g. lifecycle enum, non-empty variants).
