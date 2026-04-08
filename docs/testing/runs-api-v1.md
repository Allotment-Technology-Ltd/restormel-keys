# Runs API v1 — contract (roadmap)

**Status:** Contract + **optional embedded server**  
**Implementation:** The npm package **`@restormel/testing-runs-server`** exposes `POST /v1/runs`, `GET /v1/runs` (list), and `GET /v1/runs/:id` against a **configured workspace root** (runs the same `@restormel/testing-runner` as the CLI). Optional **Neon Postgres** persistence via **`RESTORMEL_RUNS_DATABASE_URL`** (or **`DATABASE_URL`**) — migration **`027_restormel_testing_run_jobs.sql`**. Default bind **`127.0.0.1`**; set **`RESTORMEL_RUNS_API_TOKEN`** for Bearer auth. Responses include **`X-Request-Id`**; structured logs and production TLS / sidecar / Unix socket guidance: [testing-runs-server.md](testing-runs-server.md), [testing-runs-server-deployment.md](testing-runs-server-deployment.md). The composite GitHub Action and `testing run` remain the primary CI path; the server is for sidecar / local orchestration.

## Purpose

- Start a run from CI or a remote orchestrator without cloning the repo on the control plane.
- Poll run status until a **terminal** state.
- Align statuses with `RunRecord.verdict` and CI outputs.

## Base URL

`https://{host}/v1` (TLS required in production).

## Authentication

Out of scope for this document; use mutual TLS, OIDC, or signed tokens at the deployment boundary. **Never** accept raw provider API keys in query parameters.

---

## `POST /v1/runs`

Creates a run (accepted → queued → running).

### Request body (JSON)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `suite_id` | string | yes | Suite id from config |
| `environment_id` | string | no | Overrides suite default |
| `target_url` | string (URL) | no | Overrides environment `base_url` (e.g. preview) |
| `commit_sha` | string | no | Git SHA for attribution |
| `repository` | string | no | `org/name` |
| `pr_number` | string | no | For reporting only |
| `config_ref` | string | no | Git ref, tarball URL, or opaque id — product-specific |
| `goal_ids` | string[] | no | Subset of goals |

### Response `201 Created`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "created_at": "2026-04-08T12:00:00.000Z"
}
```

### Errors

| Status | Meaning |
|--------|---------|
| `400` | Validation (unknown suite, bad URL) |
| `401` / `403` | Auth |
| `429` | Rate limit |

---

## `GET /v1/runs`

List recent runs (newest first). **Pagination:** query `limit` (1–100, default **50**), `offset` (default **0**).

### Response `200 OK`

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "passed",
      "suite_id": "web-critical",
      "created_at": "2026-04-08T12:00:00.000Z",
      "workspace_root": "/abs/path/to/repo"
    }
  ],
  "limit": 50,
  "offset": 0,
  "next_offset": null
}
```

`next_offset` is the next `offset` to pass, or **`null`** when there are no more rows.

When no database URL is configured, the server uses an **in-memory** store (same shape, lost on restart).

---

## `GET /v1/runs/:id`

### Response `200 OK` (non-terminal)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "running",
  "suite_id": "web-critical",
  "started_at": "2026-04-08T12:00:01.000Z",
  "goal_completed": 2,
  "goal_total": 6
}
```

### Response `200 OK` (terminal)

`status` is one of:

| Status | Maps to CLI / Action |
|--------|----------------------|
| `passed` | `verdict: passed` |
| `failed` | `verdict: failed` |
| `indeterminate` | `verdict: indeterminate` |
| `error` | Runner could not complete (misconfig, crash) |
| `skipped` | Policy skip (e.g. fork) — optional for HTTP layer |

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "failed",
  "suite_id": "web-critical",
  "started_at": "2026-04-08T12:00:01.000Z",
  "ended_at": "2026-04-08T12:03:00.000Z",
  "verdict": "failed",
  "artifact_manifest_url": "https://…/runs/550e8400/…",
  "summary": "One-line human summary for triage"
}
```

### Errors

| Status | Meaning |
|--------|---------|
| `404` | Unknown run id |

---

## Idempotency

Implementations **may** support `Idempotency-Key` on `POST /v1/runs` to dedupe retries; not required for v1.

## Relation to artefacts

When embedded, the worker already writes `run.json`, `report.json`, `traces.json`, `junit.xml`. A hosted API should treat those as the **source of truth** for post-mortem and expose URLs or signed download links — not duplicate sensitive fields.
