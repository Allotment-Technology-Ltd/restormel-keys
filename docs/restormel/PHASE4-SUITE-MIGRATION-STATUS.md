# Phase 4 — Suite migration status (Knowledge Retrieve extraction)

**Programme:** [SUITE-ARCHITECTURE-MIGRATION.md](./SUITE-ARCHITECTURE-MIGRATION.md)  
**Branch:** `cursor/phase4-knowledge-retrieve-0cf6`  
**Last updated:** 2026-06-01  

---

## Goal

Graph-aware retrieval lives in **`@restormel/graphrag-core`** (restormel-keys monorepo); SOPHIA consumes via **`SophiaGraphStore`** + **`sophiaRetrievalAdapter`**. Context packs use **`@restormel/context-packs`** (Phase 2).

---

## Deliverables

| Item | Status |
| --- | --- |
| `packages/graphrag-core` — retrieveContext, hybrid/seed/balance, Surreal fetch helpers | Done |
| `GraphStore` + `EmbeddingPort` + `GraphRagDeps` DI | Done |
| Platform publish workflow (`platform-v*`) includes graphrag-core | Done |
| SOPHIA adapter + thin delegates | Done |
| Replace local `contextPacks.ts` with `@restormel/context-packs` | Done |
| Legacy SOPHIA retrieval body retained as delegate only | Done |

---

## Automated gate

```bash
# restormel-keys
pnpm --filter @restormel/graphrag-core run build
pnpm --filter @restormel/graphrag-core test
pnpm run test:platform-packages

# sophia
pnpm test
pnpm vitest run src/lib/server/hybridCandidateGeneration.test.ts  # optional drift (ported to package)
pnpm kg:audit:benchmark   # manual baseline compare when Surreal available
```

---

## Manual gate (pending)

| Review | Pass criteria |
| --- | --- |
| Stoa/Learn grounding | Quality unchanged on fixed query set |
| Retrieval metadata | UI/trace fields unchanged for analyse flow |
| kg audit benchmark | Baseline artifact within agreed tolerance |

Record in PR: `Stage gate: automated ✅ manual ☐`

---

## Next phase

**Phase 5 — Knowledge Ingest extraction (5a landed)** — see [PHASE5-SUITE-MIGRATION-STATUS.md](./PHASE5-SUITE-MIGRATION-STATUS.md) and [SUITE-ARCHITECTURE-MIGRATION.md § Phase 5](./SUITE-ARCHITECTURE-MIGRATION.md#phase-5--knowledge-ingest-extract--publish--reintegrate-sophia).

Sub-slices **5b–5d** (jobs, stage helpers, workers) remain before Phase 5 manual gate.
