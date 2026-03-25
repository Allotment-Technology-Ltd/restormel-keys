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
- `GET /keys/dashboard/api/catalog` — canonical downstream contract for providers + models (`2026-03-25.catalog.v5`). **By default**, responses include only `(providerId, providerModelId)` pairs present in `@restormel/keys` `defaultProviders` (stale DB rows are dropped). Operators: `skipDefaultAllowlist=1` returns unfiltered rows (still subject to `includeUnhealthy` when unset). Responses include `compatibility` (`minCliVersion`, `minCoreDashboardVersion`), `externalSignals` (credential-free runtime signals: OpenAI/Anthropic status snapshots, OpenRouter public endpoint health metadata, **`externalSignals.freshness` staleness SLO**), and optional per-variant `crowdObservations` (aggregated reports from authenticated `POST /keys/dashboard/api/catalog/observations`).

## Downstream contract (canonical)

**Public integration guide (shareable):** [Canonical model & provider catalog](https://restormel.dev/keys/docs/guides/canonical-catalog) — step-by-step for third parties (curl, paging, npm, CLI).

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

### OpenAI-compatible base URLs

When `validation.mode === "openai_compatible"` and `validation.requiresBaseUrl === false`, the catalog includes `validation.defaultApiBaseUrl` — the canonical public OpenAI-compatible API base for that provider (so hosts need not hardcode vendor maps). When `requiresBaseUrl === true` (e.g. Azure), the field is omitted and the user supplies the base URL.

### Align catalog ids with resolve `providerType`

- Catalog variants and `providerTypes` on models use **integration / cost** ids (e.g. **`google`** for Vertex/Gemini), matching `@restormel/keys` `defaultProviders` and policy evaluation.
- **`POST .../resolve`** and **`POST .../routes/{routeId}/simulate`** success payloads emit **`vertex`** as the canonical JSON `providerType` for that same provider. When mapping resolve output to catalog rows, treat `vertex` ↔ `google` as the same logical provider at the integration layer.
