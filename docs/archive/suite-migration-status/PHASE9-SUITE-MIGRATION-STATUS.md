# Phase 9 — Suite migration status (Knowledge Ingest job persistence)

**Programme:** [SUITE-ARCHITECTURE-MIGRATION.md](./SUITE-ARCHITECTURE-MIGRATION.md)  
**Branch:** `cursor/phase9-knowledge-ingest-0cf6`  
**Last updated:** 2026-06-01  

---

## Goal

Land **Phase 5b** as post-programme **Phase 9**: workspace-scoped **Knowledge Ingest job persistence** in Restormel Dashboard Postgres, enabling `POST/GET /connect/v1/ingest/jobs` and job status reads. **Stage execution (5c–5d)** remains in SOPHIA until a follow-up slice.

---

## Scope (this slice = 5b)

| Item | Status |
| --- | --- |
| Migration `035_knowledge_ingest_jobs.sql` | Done |
| Neon CRUD (`insert`, `list`, `get`) | Done |
| `@restormel/connect-core` `buildInitialConnectIngestJob` | Done |
| Ingest REST handlers (201 create, 200 list/status) | Done |
| Knowledge v1 API tests updated | Done |

---

## Deferred (5c–5d → Phase 10 candidate)

| Sub-slice | Scope |
| --- | --- |
| **5c** | Stage helpers extraction |
| **5d** | Workers / pollers dequeue hosted jobs |
| **GA manual gate** | Staging wave-1 ingest baseline vs SOPHIA Neon jobs |

---

## Automated gate

```bash
pnpm --filter @restormel/connect-core run build
pnpm --filter @restormel/connect-core test
pnpm --filter dashboard run test -- src/routes/connect/v1/connect-v1-api.test.ts
```

---

## Manual gate (pending)

| Review | Pass criteria |
| --- | --- |
| Staging job create | REST creates row; dashboard Connect hub lists job |
| Worker cutover plan | Document SOPHIA poller → hosted API dequeue |

Record in PR: `Stage gate: automated ✅ manual ☐`

---

## Next slice

**Phase 10 — Ingest workers + stage helpers (5c–5d)** — see [PHASE10-SUITE-MIGRATION-STATUS.md](./PHASE10-SUITE-MIGRATION-STATUS.md).
