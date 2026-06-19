---
id: REC-INC-005
title: "Incident — Prod readiness checks fail with 'relation knowledge_readiness_runs does not exist' (runtime-only DDL disabled in prod, no migration)"
class: evidence
owner: "@adam"
approved-by: "@adam"
approved-on: 2026-06-19
status: closed
classification: internal
control-tier: 3
created: 2026-06-19
last-reviewed: 2026-06-19
review-interval: P12M
retention: P6Y
related: [REC-TPL-004, REC-INC-003]
---

# Incident — Prod readiness checks fail (knowledge_readiness_runs missing migration)

> Filed from REC-TPL-004. Append-only once closed. Severity **medium** — readiness-run
> feature fully broken in production; no data loss, no confidentiality/integrity impact.
> Analogous prior incident: **REC-INC-003** (2026-06-18, "Add a graph" 500, same root-cause
> class: runtime-only DDL disabled in prod, fixed by migration 070).

- **Detected:** 2026-06-19 — founder, via runtime error report: every readiness-check API
  call threw **`relation "knowledge_readiness_runs" does not exist`** (Postgres error 42P01)
  in production on **restormel.dev**. **Reported by:** founder → this investigation.
  **Severity:** medium. **Recurring:** yes — reproducible on every attempt.

- **What happened:** All readiness-run API routes that touch the `knowledge_readiness_runs`
  or `knowledge_readiness_run_units` tables fail immediately in prod with a Postgres 42P01
  error because neither table exists in the production database. The tables exist in dev and
  CI (where runtime DDL self-heals the schema), but not in prod.

- **Impact:** The knowledge readiness-runs feature was **fully broken in production** —
  listing, creating, and progressing readiness runs all fail. No data loss; no
  confidentiality/integrity impact — queries were rejected by Postgres before any row was
  written or read. All other dashboard features were unaffected.

- **Response (investigation + remediation):**
  - Traced the error to `ensureIngestionRoutingSchema()` in
    `apps/dashboard/src/lib/server/neon.ts` (~line 2649-2688), which contains `CREATE TABLE
    IF NOT EXISTS knowledge_readiness_runs (...)` and `CREATE TABLE IF NOT EXISTS
    knowledge_readiness_run_units (...)` as runtime DDL statements.
  - Confirmed that `runtimeDdlEnabled()` (neon.ts:56-62) returns `false` in prod
    (`NODE_ENV=production`), so this DDL block is entirely skipped on the prod server.
  - Confirmed no numbered migration (001–071) creates either table — the only DDL for these
    tables is inside `ensureIngestionRoutingSchema()`.
  - **Fix:** authored migration `072_knowledge_readiness_runs.sql` (idempotent, exact
    schema-match to the runtime DDL) and bumped `REQUIRED_MIGRATION` in neon.ts from
    `"070_knowledge_graph_targets_graph_library.sql"` to `"072_knowledge_readiness_runs.sql"`.
    The deploy-time entrypoint applies pending migrations before the server starts
    (fail-closed), so the next deploy automatically brings prod to parity.
  - Pre-PR security gate: **PASS** (check-secrets / hygiene / deps-policy all green; Aikido
    0 findings on changed files; migration contains no secrets or PII; REQUIRED_MIGRATION
    bump is a constant string change only).

- **Root cause:** **Schema drift — the code expected tables that production did not have,
  because the only place those tables are created is RUNTIME DDL that is disabled in prod.**
  - `knowledge_readiness_runs` and `knowledge_readiness_run_units` were added to
    `ensureIngestionRoutingSchema()` as runtime "self-heal" DDL with no corresponding
    numbered migration file.
  - In **production**, `NODE_ENV=production` causes `runtimeDdlEnabled()` to return `false`,
    so the entire DDL block is skipped — the tables are never created.
  - In **dev and CI**, `runtimeDdlEnabled()` returns `true`, so the tables are silently
    self-healed on every server start — the bug is invisible everywhere except production.
  - The `REQUIRED_MIGRATION` high-water mark was at `070`, which post-dated the readiness
    feature but did not cover these tables; the drift gate could not flag what it did not
    know to check.
  - **Same root-cause class as REC-INC-003** (Graph Library `label`/`settings`/`default_domain_pack_id`
    columns, fixed by migration 070) and **REC-INC-001** (catalogue 503, missing migration
    column on a read path). Pattern: code ships runtime-DDL-only schema changes; they are
    invisible in non-prod environments; prod crashes with `42P01` / `42703`.

- **Remediation (in fix PR):**
  1. **Migration `072_knowledge_readiness_runs.sql`** — idempotently creates
     `knowledge_readiness_runs` (with `status` CHECK constraint and two composite indexes)
     and `knowledge_readiness_run_units` (composite PK + `unit_id` index), mirroring the
     runtime DDL exactly. Applied automatically on next deploy (fail-closed).
  2. **`REQUIRED_MIGRATION` bumped `070 → 072`** (`neon.ts:69`) so the schema-drift gate
     fails loudly at deploy/boot if this migration (or 071) is ever missing.
  - **Founder action required (not done by agent — read-only on prod):** confirm the next
    deploy applies migration 072 against the prod dashboard DB (Box B `.167`); verify
    `schema_migrations` reaches `072` post-deploy. No Coolify env change needed.

- **Follow-ups:**
  - **Enforce migration-per-DDL policy** — all DDL in `ensureIngestionRoutingSchema()` must
    have a backing numbered migration. Either add a CI lint that diffs runtime DDL against
    migration history, or ban additive runtime DDL entirely. *(PBI — open from REC-INC-003)*
  - **Prod-mode integration check in merge gate** — run `CONNECT_RUNTIME_DDL=0` against a
    schema built only from numbered migrations in CI to catch this class at PR time.
    *(PBI — open from REC-INC-001 follow-up #13 and REC-INC-003)*
  - **Risk register annotation** — update `governance/risk-register.yaml` to note third
    recurrence of "code outruns prod schema via runtime-only DDL" class (INC-001, INC-003,
    INC-005). *(stage with the PR)*
  - **Closed:** 2026-06-19 (fix implemented + PR opened; pending founder deploy-verify of
    migration 072 on Box B `.167`).
