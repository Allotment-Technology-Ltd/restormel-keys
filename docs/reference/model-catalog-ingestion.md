# Model catalog ingestion

Reference only. Canonical process: this doc and the scripts it describes.

## Overview

The dashboard model catalog is stored in Postgres (`models`, `provider_model_variants`). Data is populated by:

1. **Static seed** — JSON file plus an ingestion script (maintainable, repeatable).
2. **Optional SQL seed** — `005_seed_model_catalog.sql` for minimal bootstrap; can be superseded by the script.

## What is static vs dynamically refreshed

| Source | Type | When | Notes |
|--------|------|------|--------|
| `apps/dashboard/data/model-catalog-seed.json` | Static | On demand via script | Single source of truth for seed. Edit to add/change models, lifecycle, capabilities, pricing refs. |
| `pnpm run seed:catalog` | Script | Manual or CI | Reads the JSON above and upserts into Neon. Safe to run multiple times. |
| Provider APIs (e.g. OpenAI /models) | Dynamic | Future | Not implemented in Phase 00. When added, document here and prefer refresh path over one-off hacks. |

Lifecycle fields (e.g. `sourceLastVerifiedAt`) are only as good as the seed or the future ingestion job; we do not fabricate verification dates.

## How to refresh or reseed

From `apps/dashboard`:

```bash
# Ensure DATABASE_URL is set (e.g. in .env). Run after migrations 004 and 005.
pnpm run seed:catalog
```

Requires `models` and `provider_model_variants` tables (migration `004_control_plane_tables.sql`). Optional SQL seed `005_seed_model_catalog.sql` can be run first for minimal bootstrap; the script upserts over it.

The script validates the seed file (required fields on models and variants), then upserts into `models` and `provider_model_variants`. Existing rows are updated; new rows are inserted. Variant IDs are derived as `{modelId}-{providerIntegrationType}`.

## Seed file shape

- `models`: array of model objects.
- Each model must have: `id`, `canonicalName`.
- Each model may have: `family`, `lifecycleState`, `description`, `contextWindow`, `maxOutputTokens`, `supportsTools`, `supportsStructuredOutput`, `supportsMcp`, `modalities`, `capabilities`, `editorialSummary`, `deprecationDate`, `retirementDate`, `replacementModelId`, `sourceLastVerifiedAt`.
- Each model may have `variants`: array of provider variants.
- Each variant must have: `providerIntegrationType`, `providerModelId`. Optional: `availabilityStatus`, `pricingRef`, `rateLimitRef`, `sourceLastVerifiedAt`.

Validation is performed by `scripts/ingest-model-catalog.mjs` before any DB writes. Tests can load the same JSON and assert on shape (see dashboard test suite).

## Tests and validation

- **Script**: Runs validation before insert; exits with non-zero and messages if the seed is invalid.
- **Vitest**: A test loads the seed JSON and checks that every model has `id` and `canonicalName`, and every variant has `providerIntegrationType` and `providerModelId`. Add more checks as needed (e.g. lifecycle enum, non-empty variants).
