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
- `GET /keys/dashboard/api/catalog` — canonical downstream contract for providers + models (`2026-03-20.catalog.v1`).

## Downstream contract (canonical)

Downstream products should not hardcode provider presets. Use Restormel as source of truth:

1. Fetch `GET /keys/dashboard/api/catalog` server-side.
2. Render provider + model selectors from `providers[]` and `data[]`.
3. Use provider `validation.mode` metadata for validation shape selection (native vs openai_compatible).
4. Keep a local fallback only as resilience; mark fallback/degraded state in UI and telemetry.

For existing host apps, the one-step path is `fetchCanonicalCatalogWithFallback()` from `@restormel/keys/dashboard`.

### Viability guarantees

Canonical catalog responses are viability-filtered by default:

- models with `lifecycleState` of `deprecated` or `retired` are excluded
- variants are included only when `availabilityStatus` is `available`
- models with zero remaining variants are excluded

Diagnostic override: `GET /keys/dashboard/api/catalog?includeUnhealthy=1` returns unhealthy rows for operator debugging.

Downstream apps should still apply defense-in-depth filtering before UI render (for stale caches or fallback data). Use `filterCanonicalCatalogForViability()` from `@restormel/keys/dashboard` where possible.
