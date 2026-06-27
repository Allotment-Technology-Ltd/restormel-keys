---
id: REC-INC-001
title: "Incident — Model catalogue endpoint 503 (prod DB behind code; missing migration 068)"
class: evidence
owner: founder
status: closed
classification: internal
control-tier: 3
created: 2026-06-16
last-reviewed: 2026-06-16
review-interval: P12M
retention: P6Y
approved-by: founder
approved-on: 2026-06-16
related: [REC-TPL-004]
---

# Incident — Model catalogue endpoint 503 (missing prod DB migration)

> Filed from REC-TPL-004. Append-only once closed. Severity **low** — single public endpoint
> degraded ~10 min; main site unaffected; no data loss, no confidentiality/integrity impact.

- **Detected:** 2026-06-16 ~17:10 UTC — Uptime monitor alert via Telegram (Restormel Monitor):
  `[Restormel prod (catalog)] [down] Request failed with status code 503`. **Reported by:** automated
  monitor → founder. **Severity:** low.

- **What happened:** The first production deploy in ~43 h (auto-deploy had been paused 2026-06-13 during
  the database-strategy migration) shipped current `main`, which includes the DB-backed model catalogue
  (`#55`). That code reads `models.home_jurisdiction`, a column added by migration **068**. **Prod's
  `restormel_ops` DB was at migration 067** — the column did not exist — so `GET /keys/v1/catalog`
  degraded to **503** (`degraded: true`, `db_error_cold_start`, `column "home_jurisdiction" does not
  exist`). The deploy itself succeeded and the dashboard container stayed **healthy**: the catalogue
  failure was correctly isolated from the container healthcheck (a design control from the 2026-06-12
  cascade lesson held — no container eviction).

- **Impact:** Public model-catalogue endpoint (`/keys/v1/catalog`) and the Models page degraded for
  ~10 min. `restormel.dev` and the dashboard (`/keys/dashboard/*`) stayed up (HTTP 200) throughout.
  **No data loss; no confidentiality or integrity impact** (read path only; the missing column is a
  schema gap, not data corruption). Availability only, single feature.

- **Response (timeline, 2026-06-16 UTC):**
  - 17:03 — deploy `okuc59j5zufs9go0nnqbha6t` (commit `0fc89c74`) finished; new container live.
  - ~17:10 — monitor alert; investigation began.
  - Diagnosed from the catalogue degraded payload + container logs: `home_jurisdiction` missing;
    confirmed prod DB at `067`, code needs `068`.
  - ~17:18 — applied migration **068** to prod `restormel_ops` (idempotent `ADD COLUMN IF NOT EXISTS`),
    founder-authorised; recorded in `schema_migrations`. Catalogue recovered to **200** (`degraded`
    cleared; 13 providers, 236 rows, 254 models) — no redeploy/restart needed.
  - Also applied migration **069** (`upstream_mcp_targets`, flag-gated) to bring prod to parity with the
    code. Prod DB now at `069`.

- **Root cause:** **Production deploys do not auto-apply pending DB migrations.** The CI "Apply dashboard
  migrations" step targets only the Forgejo CI database, not prod. So shipped code can outrun the prod
  schema. Masked until now because paused auto-deploy left prod on code that predated the catalogue.
  Contributing: the merge gate does not run the full dashboard build (a separate deploy-safety gap), so
  schema/build assumptions weren't validated at PR time.

- **Follow-ups:**
  - **Auto-apply migrations on deploy** so code can never again outrun the prod schema — Coolify
    pre-deploy command / container-entrypoint `pnpm migrate` (apply-migrations.mts) / deploy job.
    *(tracked: task #18)*
  - **Run the full dashboard `vite build` in the merge gate.** *(tracked: task #13)*
  - Consider a post-deploy smoke check of `/keys/v1/catalog` in the deploy pipeline.

- **Closed:** 2026-06-16.
