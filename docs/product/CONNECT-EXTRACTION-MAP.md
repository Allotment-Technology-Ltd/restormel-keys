# Knowledge extraction map — SOPHIA → Restormel

**Status:** Reference (companion to [SUITE-ARCHITECTURE-MIGRATION.md](../architecture/SUITE-ARCHITECTURE-MIGRATION.md))  
**Owner:** Allotment Technology Ltd  
**Last reviewed:** 2026-06-01  

Maps SOPHIA implementation paths to target Restormel packages. Use this when opening extraction PRs. **Do not extract without following the [SOPHIA reintegration playbook](../architecture/SUITE-ARCHITECTURE-MIGRATION.md#7-sophia-reintegration-playbook).**

---

## Verify → `@restormel/reasoning-core`

| SOPHIA path | Extract? | Notes |
| --- | --- | --- |
| `src/lib/server/verification/pipeline.ts` | Yes | Orchestration entry |
| `src/lib/server/verification/extraction.ts` | Yes | Claim extraction |
| `src/lib/server/verification/reasoningEval.ts` | Yes | Evaluation pass |
| `src/lib/server/constitution/**` | Yes | Deterministic + LLM rules |
| `src/lib/server/engine.ts` (verify paths only) | Partial | Keep analyse orchestration in sophia; extract verify-specific helpers |
| `src/routes/api/v1/verify/+server.ts` | No | HTTP stays; becomes adapter |
| `src/routes/api/verify/+server.ts` | No | SSE product route; adapter |

**SOPHIA tests to port first:** `src/lib/server/routes/verify-v1-route.test.ts`

---

## Retrieve → `@restormel/graphrag-core` + `@restormel/context-packs`

| SOPHIA path | Extract? | Notes |
| --- | --- | --- |
| `src/lib/server/retrieval.ts` | Yes | Core retrieve API |
| `src/lib/server/hybridCandidateGeneration.ts` | Yes | |
| `src/lib/server/seedSetConstructor.ts` | Yes | |
| `src/lib/server/surrealRetrievalEnhancements.ts` | Yes | Inject store interface |
| `src/lib/server/contextPacks.ts` | **Replace** | Use `@restormel/context-packs` per [PHASE2-EXTRACTION-STATUS.md](../archive/suite-migration-status/PHASE2-EXTRACTION-STATUS.md) |
| `src/lib/server/domainClassifier.ts` | No | Showcase domains |
| `src/lib/server/learn/graphGrounding.ts` | No | Adapter consumer |
| `src/lib/server/stoa/grounding.ts` | No | Adapter consumer |
| `src/lib/server/kgAudit/benchmarkRetrieval.ts` | No | Ops; calls package |

**Package README (planned moves):** `sophia/packages/graphrag-core/README.md`

---

## Ingest → `@restormel/connect-core`

| SOPHIA path | Extract? | Notes |
| --- | --- | --- |
| `src/lib/server/aaif/ingestion-plan.ts` | Yes | Keys stage resolve |
| `src/lib/server/resolve-provider.ts` | Partial | Generic resolve in platform; ingestion workload in knowledge-core |
| `src/lib/server/ingestion/stages/*` | Yes (incremental) | One stage per PR where possible |
| `src/lib/server/ingestionJobs.ts` | Yes | Job orchestration |
| `src/lib/server/db/ingestRunRepository.ts` | Yes | With Neon schema ownership decision |
| `src/lib/server/db/schema.ts` (ingest tables) | Partial | Migrate definitions to keys or shared migration |
| `scripts/ingest.ts` | No (initially) | Operator CLI; call package APIs |
| `scripts/ingestion-job-poller.ts` | Partial | Becomes worker client to Knowledge REST |
| `src/routes/api/admin/ingest/**` | No | Thin HTTP; proxy later |

**Stage order in monolith:** extracting → relating → grouping → embedding → validating → remediating → storing (`src/lib/server/ingestion/ingestResumeStage.ts`)

---

## Providers / embeddings → `@restormel/providers`

| SOPHIA path | Extract? | Notes |
| --- | --- | --- |
| `src/lib/server/embeddings.ts` | Yes | Voyage/Vertex; not Keys-routed |
| `src/lib/server/vertex.ts` | Partial | |
| `src/lib/server/byok/**` | Partial | Account BYOK stays sophia; operator ingest env builder may move |

---

## Restormel integration (already shared)

| SOPHIA path | Target |
| --- | --- |
| `src/lib/server/restormel.ts` | Stays sophia client; keys implements server |
| `src/lib/server/restormelIngestionRoutes.ts` | Keys dashboard + Knowledge operator UI |
| `scripts/restormel/bootstrap-ingestion-routes.ts` | Keys-side tooling |

---

## Explicitly SOPHIA-only (do not extract)

| Area | Paths |
| --- | --- |
| Stoa | `src/lib/server/stoa/**`, `src/routes/mcp/stoa/**` |
| Learn | `src/lib/server/learn/**`, `src/routes/learn/**` |
| Billing | `src/lib/server/billing/**`, Paddle scripts |
| Practice | `src/lib/server/practice/**` |
| Marketing / UX | `src/routes/home`, `src/lib/components/marketing/**` |
| Corpus ops | `data/sources/**`, wave JSON, SEP-specific fetch heuristics in `scripts/fetch-source.ts` |
| Account DB | `sophia_documents` paths in `sophiaDocumentsDb.ts` |

---

## Reintegration verification commands (sophia)

After each extraction slice:

```bash
pnpm check
pnpm test
# Phase 3+
pnpm vitest run src/lib/server/routes/verify-v1-route.test.ts
# Phase 4+
pnpm kg:audit:benchmark   # when retrieval touched; compare baseline artifact
# Phase 5+
# staging ingest: one source, compare Surreal claim counts + Neon job events
```
