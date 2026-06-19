---
id: REC-INC-003
title: "Incident — Prod 'Add a graph' returns HTTP 500 (Graph Library schema drift; runtime-only DDL disabled in prod)"
class: evidence
owner: "@adam"
status: closed
classification: internal
control-tier: 3
created: 2026-06-18
last-reviewed: 2026-06-18
review-interval: P12M
retention: P6Y
approved-by: "@adam"
approved-on: 2026-06-18
related: [REC-TPL-004, REC-INC-001]
---

# Incident — Prod "Add a graph" 500 (Graph Library schema drift)

> Filed from REC-TPL-004. Append-only once closed. Severity **medium** — a core onboarding
> action (connect a BYO SurrealDB graph) was 100% broken in production; no data loss, no
> confidentiality/integrity impact (write path rejected before any row was written).

- **Detected:** 2026-06-18 — founder, manually, via the dashboard on **restormel.dev**. The
  "Add a graph" form (Connect → Sources → Graph Library) returned **"Internal Error"** with
  **HTTP 500** (browser console: `Failed to load resource: 500`) on submit. **Reported by:**
  founder → this investigation. **Severity:** medium. **Recurring:** yes — reproducible on every
  attempt.

- **What happened:** The user submitted a BYO SurrealDB graph (`wss://surreal.restormel.dev`,
  ns `main`, db `sophia`, user `root`, a password, domain pack "Surreal — claim / argument",
  "make active" checked). The **same credentials authenticate fine from Surrealist** (desktop →
  Surreal directly), proving SurrealDB and the credentials are healthy. The 500 came from
  **restormel.dev's own server-side handler** (`POST /keys/dashboard/api/connect/graph-library`).

- **Impact:** The "Add a graph" / Graph Library create+save path was **fully broken in
  production** (every submit 500'd). Connect onboarding (attaching a BYO graph store) could not
  complete. No data loss; no confidentiality/integrity impact — the failure was an INSERT that
  Postgres **rejected**, so no partial/garbage row was written, and the encrypted credential never
  reached storage. Availability of one feature only; the rest of restormel.dev and the dashboard
  were unaffected.

- **Response (investigation + remediation):**
  - Located the handler: "Add a graph" (`ConnectGraphLibrary.svelte`) → `POST
    .../api/connect/graph-library/+server.ts` → `createGraphTarget` →
    `persistGraphTarget` (`$lib/server/connect/graph-target-service.ts`) →
    `upsertConnectGraphTarget` (`$lib/server/neon.ts`).
  - **Sentry:** no usable trace — the Sentry org `allotment-technology-ltd` has only the
    `plotbudget` project; **no `restormel` project and zero error/log events** for this route
    (checked `search_issues` + `search_events`, 24h). So Sentry could not supply the stack frame.
  - **Container logs:** restormel.dev resolves to **`77.42.124.167` (Box B / `.167`)**, the
    post-infra-split host that serves the dashboard. The SSH key on this Mac
    (`~/.ssh/id_hetzner_allotment`) authenticates to **Box A `.150`** but **`.167` returns
    `Permission denied (publickey)`** — so the live dashboard container logs were **not
    accessible** from here (flagged for follow-up). Box A only runs the `web` (allotmentology.tech)
    Next.js app + infra; the SurrealDB server there reports image **`surrealdb/surrealdb:v3.1.4`**.
  - Root-caused by **static analysis from code + the exact symptom string** (see below), which is
    deterministic and conclusive.
  - **Fix implemented** (PR — see Follow-ups): migration `070` to bring the prod schema to parity,
    `REQUIRED_MIGRATION` bumped to `070` so the drift gate catches this class at deploy/boot, and a
    typed-error guard so the handler never returns a bare 500 again. Tests added; high-risk-security
    gate PASS (Aikido 0 findings; hygiene scripts green).

- **Root cause:** **Schema drift — the code expected columns that production did not have, because
  the only place those columns were created is RUNTIME DDL that is disabled in prod.**
  - `upsertConnectGraphTarget` (`apps/dashboard/src/lib/server/neon.ts:7099`) INSERTs into
    `knowledge_graph_targets` referencing columns **`label`**, **`default_domain_pack_id`** and
    **`settings`** (Graph Library), and the feature also requires the one-graph-per-workspace
    `UNIQUE(workspace_id)` constraint to be dropped.
  - Those four schema changes exist **only inside `ensureIngestionRoutingSchema()`**
    (`neon.ts:2760-2767`) as runtime "self-heal" DDL. **There is no numbered migration file**
    (036–069) that adds `label` / `default_domain_pack_id` / `settings` or drops the unique
    constraint — `036` created the base table without them; `038` only added
    `use_dashboard_database`.
  - In **production**, `ensureIngestionRoutingSchema()` **skips all DDL** when
    `CONNECT_RUNTIME_DDL=0` (its default under `NODE_ENV=production`, per `runtimeDdlEnabled()` at
    `neon.ts:56`). So prod's `knowledge_graph_targets` was **missing those columns**.
  - Therefore every "Add a graph" INSERT hit Postgres error **`42703` — `column "settings"
    (/ "label" / "default_domain_pack_id") of relation "knowledge_graph_targets" does not exist`**.
    That throw was **uncaught** in the `+server.ts` POST handler, so SvelteKit's
    `handleError` (`hooks.server.ts:337`) returned `{ message: "Internal Error" }` with **HTTP
    500** — the exact observed symptom. SurrealDB/credentials were never the problem (the INSERT is
    the dashboard's own Neon write), which is why Surrealist worked.
  - **Why it was never caught pre-prod:** in dev and CI, `CONNECT_RUNTIME_DDL` defaults **ON**, so
    `ensureIngestionRoutingSchema()` silently creates the columns and drops the constraint — the
    bug is invisible everywhere except production.
  - **Same class as REC-INC-001** (2026-06-16 catalogue 503): *code shipped ahead of the prod
    schema*. INC-001 was a single missing migration column on a read path; this is the same failure
    on a write path, made worse because the missing DDL was never expressed as a migration file at
    all (only as prod-disabled runtime DDL), so the deploy migration runner could not have applied
    it and the `REQUIRED_MIGRATION` high-water mark (`065`) did not flag it.

- **Remediation (in the fix PR):**
  1. **Migration `070_knowledge_graph_targets_graph_library.sql`** — idempotently adds `label`,
     `default_domain_pack_id` (FK → `knowledge_domain_packs(id) ON DELETE SET NULL`) and `settings`
     (`JSONB NOT NULL DEFAULT '{}'`), drops the stale `knowledge_graph_targets_workspace_unique`
     constraint, and creates the workspace index — mirroring the runtime DDL exactly. The
     deploy-time entrypoint (`docker-entrypoint.sh`) applies it before the server starts (the
     INC-001 follow-up #18 fix), and it is fail-closed.
  2. **`REQUIRED_MIGRATION` bumped `065 → 070`** (`neon.ts`) so the schema-drift gate fails loudly
     at deploy/boot if this migration is ever missing again.
  3. **Typed-error guard** in `persistGraphTarget` — a DB throw is now mapped to a clear,
     typed JSON result (`503 server_misconfigured` for schema drift with an actionable message;
     `503 storage_unavailable` otherwise) instead of a bare 500. The failure is logged
     server-side with **workspace id + a sanitised DB error only — never the password/credential**;
     the encrypted credential stays ciphertext and is never echoed (the masked `secret_set` shape is
     unchanged). Regression test added (`graph-target-persist.test.ts`).
  - **Founder action required (NOT done by the agent — read-only on prod):** confirm the deploy of
    the fix actually runs migration `070` against the **prod dashboard DB on Box B `.167`**. Because
    deploys apply pending migrations on container start, a normal deploy of this branch should apply
    `070` automatically; verify `schema_migrations` reaches `070` post-deploy. No Coolify env change
    is needed (the fix is migration + code, not config).

- **Follow-ups:**
  - **Restore log/diagnostic access to Box B `.167`** (the host serving restormel.dev) from the
    operator Mac — the current `id_hetzner_allotment` key is rejected by `.167`, so prod dashboard
    container logs were not reachable during this incident. *(track as a PBI)*
  - **Decide the policy on runtime-only DDL.** `ensureIngestionRoutingSchema()` contains DDL that has
    no backing migration file; that is the structural root cause. Either (a) ban runtime-only DDL and
    require a migration for every column the code depends on, or (b) bake an audit that diffs
    `ensureIngestionRoutingSchema()` against the migrations and fails CI on drift. *(track as a PBI)*
  - **Run the full dashboard `vite build` + a prod-mode (`CONNECT_RUNTIME_DDL=0`) integration check
    in the merge gate** so a prod-only schema gap is caught at PR time — this is the still-open
    INC-001 follow-up (#13) and would have caught this. *(track as a PBI)*
  - **No `restormel` Sentry project exists** — error visibility for restormel.dev relies on PostHog
    capture + container logs only. Consider a dedicated Sentry project or confirm PostHog server
    exception capture is wired for the dashboard. *(track as a PBI)*
  - **Risk register:** add/annotate the "code outruns prod schema" risk (recurrence of INC-001 class)
    in `governance/risk-register.yaml`. *(stage with the PR)*
  - **Closed:** 2026-06-18 (fix implemented + PR opened; pending founder deploy-verify of migration 070 on `.167`).
