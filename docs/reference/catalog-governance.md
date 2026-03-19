# Catalog governance (hybrid)

**Canonical:** Which provider model strings in `@restormel/keys` must appear in the dashboard model catalog seed, and how CI enforces it.

## Scope

- **Library catalog:** `defaultProviders` in `packages/core/src/providers/defaults.ts` lists many vendors; model IDs are the strings passed to `keys.resolve()` and policy evaluate.
- **Dashboard seed:** `apps/dashboard/data/model-catalog-seed.json` is ingested into Postgres for route steps and API validation (`modelId` must be a known catalog row or variant).

## Major-plus sync (CI)

Not every provider in `defaultProviders` is required to appear in the seed yet. **CI** runs `pnpm run check:catalog-drift`, which enforces seed coverage only for provider IDs in `CATALOG_DRIFT_SYNC_PROVIDER_IDS` (`openai`, `anthropic`, `google`) — see `packages/core/src/providers/catalog-drift-scope.ts`.

For those providers, every model ID in the corresponding `ProviderDefinition.models` array must match either:

- a seed row’s `id`, or  
- a seed variant with matching `providerIntegrationType` and `providerModelId`.

Expand the seed (or narrow library lists) when adding models to those three providers. To widen CI to more vendors, extend `CATALOG_DRIFT_SYNC_PROVIDER_IDS` and add matching seed rows.

## Optional pipeline

Future work: automated import from provider docs or OpenRouter-style listings, with validation before merge — not implemented here; this doc defines the static baseline and drift check.

## Related

- `scripts/check-catalog-drift.ts` — drift implementation.  
- `packages/core/README.md` — dashboard client and filtered-models helpers.
