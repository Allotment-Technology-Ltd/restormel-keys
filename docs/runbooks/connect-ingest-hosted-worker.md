# Knowledge Ingest hosted worker

**Status:** Phase 10 (5d stub)  
**Related:** [PHASE10-SUITE-MIGRATION-STATUS.md](../restormel/PHASE10-SUITE-MIGRATION-STATUS.md)

---

## Purpose

Drain **`knowledge_ingest_jobs`** rows created via `POST /connect/v1/ingest/jobs` on Restormel Dashboard Postgres (workspace-scoped).

Default **stub mode** validates sources and marks pipeline stages complete — it does **not** run LLM stages or write to a graph store. Use this to prove dequeue + status progression before wiring a full execution adapter.

---

## Run locally

```bash
# restormel-keys — requires DATABASE_URL (Neon)
pnpm --filter dashboard run connect-ingest-worker
```

Environment:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | required | Neon Postgres |
| `KNOWLEDGE_INGEST_WORKER_MAX_JOBS` | `25` | Max jobs per invocation |
| `CONNECT_INGEST_WORKER_MODE` | auto | **`full`** when a graph store is connected (writes to Surreal BYO or Postgres spine); **`stub`** when none (simulation only). Override: `stub` or `full`. |
| `KNOWLEDGE_INGEST_MAX_CHUNKS` | `8` | Per-job cap on chunks sent to the extraction model (cost guard) in full mode. |
| Keys routes | — | **Preferred:** configure project + per-stage routes on `/keys/dashboard/connect/models` (`workload=ingestion`, stages e.g. `ingestion_extraction`). Worker resolves via `resolveRouteForExecution` + BYOK from Connections. |
| `OPENAI_API_KEY` | — | **Legacy dev fallback** when no project routing is saved on Models & keys. Without routes or this key, full mode falls back to source-record writes. |
| `RESTORMEL_CONNECT_EMBED_MODEL` | `text-embedding-3-small` | Legacy embedding model when not using an `ingestion_embedding` route. |

---

## Smoke flow

1. Create job (Gateway key):

```bash
curl -sS -X POST "https://restormel.dev/connect/v1/ingest/jobs" \
  -H "Authorization: Bearer rk_…" \
  -H "Content-Type: application/json" \
  -d '{"workspace_id":"<uuid>","sources":[{"text":"Smoke excerpt."}]}'
```

2. Run worker (cron, Railway sidecar, or manual script on dashboard host).

3. Poll status:

```bash
curl -sS "https://restormel.dev/connect/v1/ingest/jobs/<jobId>?workspace_id=<uuid>" \
  -H "Authorization: Bearer rk_…"
```

Expect `status: completed` in stub mode.

---

## SOPHIA poller (unchanged)

`scripts/ingestion-job-poller.ts` continues to tick **SOPHIA Neon** `ingestion_jobs` / child `ingest_runs`. Hosted Restormel jobs use a **separate** table until dual-write cutover is explicitly scheduled.

Optional consumer client: SOPHIA `knowledgeApiClient.ts` (`postKnowledgeIngestJobCreate`, `getKnowledgeIngestJobStatus`).

---

## Next steps

- Wire `KNOWLEDGE_INGEST_WORKER_MODE=full` to SOPHIA-class execution adapter (Keys routes + graph store DI).
- Staging wave-1 parity vs legacy SOPHIA jobs.
