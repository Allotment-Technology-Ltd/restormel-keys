# @restormel/testing-runs-server

## 0.1.8

### Patch Changes

- **0.1.8** publish train: version align with **`@restormel/testing-github-action`** `action.yml` YAML parse fix.

## 0.1.7

### Patch Changes

- **0.1.7** publish train: tarball matches **`main`** after PR **#79** merge (CI: Next `^14.2.25`, basic-web `/about` + `serve -l 4173 .`).


## 0.1.6

### Patch Changes

- **Ops hardening:** Structured stderr logs (`RESTORMEL_RUNS_LOG_LEVEL`), **`X-Request-Id`** on JSON responses, optional **`RESTORMEL_RUNS_RATE_LIMIT_RPM`** (+ **`RESTORMEL_RUNS_TRUST_PROXY`**), **`GET /health`** **`version`**, Unix socket **`RESTORMEL_RUNS_SOCKET_PATH`** / **`--socket=`**, graceful shutdown, **`runs_api.run_finished`** / **`runs_api.http_request`** events. Deployment: **`docs/testing/testing-runs-server-deployment.md`**.
- **Neon Postgres** persistence when **`RESTORMEL_RUNS_DATABASE_URL`** or **`DATABASE_URL`** is set — table **`restormel_testing_run_jobs`** (dashboard migration **`027`**). In-memory store when unset.
- **`GET /v1/runs`** list with `limit` / `offset`; **`GET /health`** returns `store` + `db` probe.
- HTTP **Runs API** (`POST` / `GET /v1/runs`, `GET /health`) with workspace-scoped config load; artefact bundle under `.restormel-testing/runs-api/<id>/` (local only; not committed).
