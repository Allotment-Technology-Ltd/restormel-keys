# @restormel/connect-core

Knowledge **Ingest** planning and shared stage helpers extracted from SOPHIA (Phase 5 suite migration, sub-slice **5a**).

## Scope (5a)

- Ingestion stage planning (`planIngestionStage`, usage estimates)
- Resume checkpoint helpers (`ingestResumeStage` semantics)
- LLM token USD rates for ingest cost telemetry
- Shared `callStageModel` / `fixJsonWithModel` with injected `generateText`

## Not in this package yet

- Neon job schema / `ingestionJobs` (5b)
- Stage helper modules under `ingestion/stages/*` (5c)
- Worker entrypoints (5d)
- `scripts/ingest.ts` monolith (stays in SOPHIA as operator CLI)

## Host wiring

Inject `IngestPlanningDeps` (Restormel route resolution, embedding plan, Neon route bindings) and `IngestModelCallDeps` (`generateText` from the AI SDK or equivalent).

See SOPHIA `src/lib/server/knowledge/sophiaIngestPlanningAdapter.ts` for the reference adapter.
