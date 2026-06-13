# Phase 5 — Suite migration status (Knowledge Ingest extraction, sub-slice 5a)

**Programme:** [SUITE-ARCHITECTURE-MIGRATION.md](./SUITE-ARCHITECTURE-MIGRATION.md)  
**Branch:** `cursor/phase5-knowledge-ingest-0cf6`  
**Last updated:** 2026-06-01  

---

## Goal

Ingest **planning**, **resume checkpoints**, **LLM USD rates**, and **shared model-call** helpers live in **`@restormel/connect-core`** (restormel-keys monorepo); SOPHIA consumes via **`sophiaIngestPlanningAdapter`** + thin delegates.

This PR is **sub-slice 5a only** — not jobs/repository (5b), stage helpers (5c), or workers (5d). `scripts/ingest.ts` remains in SOPHIA.

---

## Deliverables

| Item | Status |
| --- | --- |
| `packages/connect-core` — planIngestionStage, usage estimates, resume-stage | Done |
| `IngestPlanningDeps` + `IngestModelCallDeps` DI | Done |
| Platform publish workflow (`platform-v*`) includes knowledge-core | Done |
| SOPHIA adapter + thin delegates | Done |
| Package unit tests (plan + resume) | Done |

---

## Deferred (5b–5d)

| Sub-slice | Scope |
| --- | --- |
| **5b** | Neon job schema, `ingestionJobs.ts`, `ingestRunRepository.ts` |
| **5c** | `ingestion/stages/*-helpers.ts` |
| **5d** | Worker entrypoints / pollers |
| **Stay in SOPHIA** | `scripts/ingest.ts`, admin routes, Surreal store, prompts |

---

## Automated gate

```bash
# restormel-keys
pnpm --filter @restormel/connect-core run build
pnpm --filter @restormel/connect-core test
pnpm run test:platform-packages

# sophia
pnpm test
pnpm vitest run src/lib/server/aaif/ingestion-plan.test.ts
pnpm vitest run src/lib/server/ingestion/ingestResumeStage.test.ts
```

---

## Manual gate (pending)

| Review | Pass criteria |
| --- | --- |
| Staging wave-1 ingest | Claim counts + `ingestion_log` match baseline |
| Route bindings | Per-stage Neon bindings + shared fallback unchanged |

Record in PR: `Stage gate: automated ✅ manual ☐`

---

## Next phase

**Phase 6 — Knowledge product launch** — see [PHASE6-SUITE-MIGRATION-STATUS.md](./PHASE6-SUITE-MIGRATION-STATUS.md).

Ingest REST remains **501** until Phase **5b–5d** job persistence lands.
