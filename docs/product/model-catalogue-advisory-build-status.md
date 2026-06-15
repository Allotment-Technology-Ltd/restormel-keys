# Model catalogue advisory — build status (overnight implementation)

**Status:** Phase 0 implemented · all changes ADDITIVE · single integration PR for review
**Branch:** `feat/model-catalogue-advisory` → `main` (Forgejo)
**Plan:** [model-catalogue-advisory-plan.md](./model-catalogue-advisory-plan.md)
**Built:** 2026-06-14 (overnight, multi-agent)

> **One-paragraph summary:** The derived advisory **engine** is built and tested end-to-end against
> the real 143-model catalogue — suitability verdicts (with the embedding two-way hard guard),
> aggregator/inference-host family resolution, cost ($/1M + $/run, never $0), provider-neutral
> ranking, and jurisdiction/region filtering — plus the data facets, the Surreal dimension fix, an
> additive read-only API, a neo-brutalist advisory UI, and the §3.9 discovery scaffold. **Everything
> is additive**: no existing picker, endpoint, or behaviour was changed, so the risk surface is low.
> The one thing reviewers must sequence is migration `068` (below).

## What landed (all green)

| Lane | What | Verify |
|---|---|---|
| Keystone | `CatalogueRepository` interface + in-memory & seed-backed impls; derived suitability (embedding hard-guard both ways); cost; aggregator/inference-host `underlyingFamily` | 48 unit tests |
| Graph | Surreal HNSW `DIMENSION` parameterized (was hardcoded 768 → derives, default 1024) | graphrag typecheck + 93 tests |
| Data | `homeJurisdiction` (per model) + `processingRegion` (per variant) on all 143 models via re-runnable enrich script; migration `068`; sync columns; capability hygiene test | seed-hygiene test |
| Ranking | Provider-neutral ranking + region/jurisdiction filtering (allow/exclude, unknown handling, hidden counts) | neutrality test |
| Advisory | `SeedCatalogueRepository` + `computeStageAdvisory` + serializer; integration tests on the REAL catalogue | integration tests |
| API | `GET /keys/dashboard/api/connect/ingest/stage-suitability` (read-only, additive) | svelte-check |
| UX | Neo-brutalist `ModelAdvisoryPanel` + route `/keys/dashboard/connect/model-advisory` (additive) | svelte-check 0 errors |
| §3.9 | Discovery scaffold: `CatalogueSource` interface + OpenRouter reference adapter + refresh orchestration | fixture tests |

**Verification:** 48 catalogue unit tests + graphrag-core suite green; full dashboard `svelte-check` = 0 errors. No existing files changed except the seed JSON + `model-catalog-sync.ts` (additive columns) + `underlying-family` hardening.

## ⚠️ Deploy ordering — apply migration 068
`apps/dashboard/migrations/068_catalog_region_facets.sql` adds `models.home_jurisdiction` and
`provider_model_variants.processing_region`. `model-catalog-sync.ts` now writes those columns, so
**apply 068 with this deploy.** (Catalog sync is fire-and-forget/caught, so a missing column is
logged, not fatal — but the facets won't populate until 068 runs.)

## Deferred (explicit follow-ups — NOT done tonight)
- **Neon / replacement-Postgres `CatalogueRepository` impl.** The advisory path reads the bundled
  seed today (offline). The DB-backed repo (for discovered/registered models) is Phase 1 — it rides
  the DB migration and swaps in with zero consumer changes (the interface is the seam).
- **Swapping the LIVE pickers** (`model-recommendations` / `connect-models`) from the curated
  `INGEST_STAGE_MODEL_GUIDANCE` steering to the derived engine. Deferred deliberately — it changes
  live behaviour and wants visual QA + the DB repo. The new advisory panel is a parallel, additive
  surface to validate the engine first.
- **Free-text auto-register persisted** (currently an in-memory overlay; persistence = DB repo).
- **The other 11 §3.9 provider adapters** + the scheduled refresh job + applying discovery to the DB.
- **Aizolo processing region** — left `null` (unverified; the filter treats it as unknown).

## Reviewer notes
- See the engine in action at **`/keys/dashboard/connect/model-advisory`** (stage selector + region presets).
- Cost shows verbatim labels incl. "cost unknown" — never "$0".
- Provider equality is enforced in `ranking.ts` (no provider term in the comparator) and asserted by a neutrality test.
