# Phase 10 — Suite migration status (Knowledge Ingest workers + stage helpers)

**Programme:** [SUITE-ARCHITECTURE-MIGRATION.md](./SUITE-ARCHITECTURE-MIGRATION.md)  
**Branch:** `cursor/phase10-connect-ingest-worker-0cf6`  
**Last updated:** 2026-06-01  

---

## Goal

Complete deferred **5c–5d** as post-programme **Phase 10**:

- **5c:** Extract portable relation-stage helpers to `@restormel/connect-core`
- **5d:** Hosted worker dequeues `knowledge_ingest_jobs` and advances stage rows (stub mode until full LLM/graph adapter)

---

## Deliverables

| Item | Status |
| --- | --- |
| `knowledge-core` `stages/relations-helpers.ts` + tests | Done |
| `knowledge-core` `ingest/worker-stub.ts` + tests | Done |
| Neon `claimNextPendingConnectIngestJob` / `updateConnectIngestJobById` | Done |
| `connect-ingest-worker.ts` + dashboard script | Done |
| SOPHIA relations-helpers → knowledge-core delegates | Done |
| Runbook `docs/runbooks/connect-ingest-hosted-worker.md` | Done |

---

## Worker modes

| `KNOWLEDGE_INGEST_WORKER_MODE` | Behavior |
| --- | --- |
| unset / not `full` | **Stub:** validate sources, mark all stages `completed` |
| `full` | Reserved — fails with `full_worker_not_configured` until SOPHIA adapter lands |

Run: `pnpm --filter dashboard run connect-ingest-worker`

---

## Still deferred (Knowledge Ingest GA)

| Item | Notes |
| --- | --- |
| Full LLM stage execution on hosted worker | Requires Keys routing + graph store adapter |
| SOPHIA poller dual-write cutover | SOPHIA Neon jobs vs hosted jobs |
| Staging wave-1 parity | Manual gate |

---

## Automated gate

```bash
pnpm --filter @restormel/connect-core test
pnpm --filter dashboard run test -- src/lib/server/connect-ingest-worker.test.ts src/routes/connect/v1/connect-v1-api.test.ts
pnpm test   # sophia
```

---

## Manual gate (pending)

| Review | Pass criteria |
| --- | --- |
| Staging dequeue | Create job via REST → run worker → status `completed` |
| SOPHIA ingest | Local poller unchanged; no regression on wave jobs |

Record in PR: `Stage gate: automated ✅ manual ☐`
