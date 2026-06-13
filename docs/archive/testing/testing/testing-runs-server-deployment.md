# Runs API server — production deployment

Canonical behaviour and env vars for [`@restormel/testing-runs-server`](testing-runs-server.md). This page is the **single** place for TLS, sidecar layout, and rate-limit guidance; the package README defers here.

## Recommended shape: reverse proxy + sidecar + Unix socket

1. **Process:** Run `restormel-testing-runs-server` in a **sidecar** or dedicated task on the same host / pod as the workload that needs Playwright (or mount the same workspace volume).
2. **Listen:** Set **`RESTORMEL_RUNS_SOCKET_PATH`** (or **`--socket=`**) to an absolute path (e.g. `/var/run/restormel/runs.sock`). The server removes a stale socket file before `listen`. **Do not** expose this socket to untrusted tenants on a shared node without filesystem permissions.
3. **TLS:** Terminate TLS **only** at the reverse proxy (nginx, Envoy, Caddy, cloud load balancer). The Node server speaks **plain HTTP** over TCP or a Unix socket; the proxy forwards **`Authorization`**, **`X-Request-Id`**, and (if you enable trust) **`X-Forwarded-For`**.
4. **Persistence:** Use **Neon / Postgres** with migration **`027_restormel_testing_run_jobs.sql`** and **`RESTORMEL_RUNS_DATABASE_URL`** (see [testing-runs-server.md](testing-runs-server.md)).

Example nginx fragment (illustrative — tune paths and `proxy_pass` for your layout):

```nginx
upstream runs_api {
  server unix:/var/run/restormel/runs.sock;
}

server {
  listen 443 ssl;
  # ssl_certificate / ssl_certificate_key …

  location / {
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Request-Id $request_id;
    proxy_pass http://runs_api;
  }
}
```

## Observability

- **Structured logs:** One JSON object per line on **stderr** (`event`, `level`, `ts`, `service`, `version`, plus fields). Filter with your log stack; keep stdout for optional human banners only.
- **`RESTORMEL_RUNS_LOG_LEVEL`:** `debug` | `info` (default) | `warn` | `error`.
- **HTTP access:** Event **`runs_api.http_request`** includes `request_id`, `method`, `path`, `status`, `duration_ms`, and a **`client_key`** derived from the remote address (or from **`X-Forwarded-For`** when trust is enabled).
- **Runs:** Event **`runs_api.run_finished`** includes `run_id`, `outcome`, optional `verdict`, `wall_ms`.
- **Correlation:** Every response includes **`X-Request-Id`**. Send a UUID in **`X-Request-Id`** on the request to propagate your trace id; otherwise the server generates one.

## Rate limiting

- **`RESTORMEL_RUNS_RATE_LIMIT_RPM`:** Max HTTP requests per minute per client key; **`0`** or unset = off. The limiter is **in-process** and **not** distributed across replicas — for multiple instances, prefer limits at the proxy or use a shared store later.
- **`RESTORMEL_RUNS_TRUST_PROXY=1`:** Use the first hop of **`X-Forwarded-For`** as the client key. **Only** enable behind a proxy you control that **overwrites** or sanitises that header; otherwise clients can spoof IPs and bypass limits.

## Security checklist

- Set **`RESTORMEL_RUNS_API_TOKEN`** in production and require **`Authorization: Bearer …`**.
- Bind TCP only to **`127.0.0.1`** when not using a Unix socket; never expose the raw Node listener to the public internet without TLS in front.
- Treat **`RESTORMEL_RUNS_DATABASE_URL`** like any database secret (secret manager, not the image).

## Environment reference (hardening)

| Variable | Role |
|----------|------|
| `RESTORMEL_RUNS_SOCKET_PATH` | Unix socket listen path (TCP `host`/`port` ignored for bind) |
| `RESTORMEL_RUNS_LOG_LEVEL` | Log verbosity |
| `RESTORMEL_RUNS_RATE_LIMIT_RPM` | Per-minute HTTP cap per client key; `0` = off |
| `RESTORMEL_RUNS_TRUST_PROXY` | `1` = trust first `X-Forwarded-For` hop for rate-limit key |

See [testing-runs-server.md](testing-runs-server.md) for workspace, database, auth, and concurrency variables.
