---
id: REC-PLAN-019
title: "cadre — OSS cross-agent coordination hub (CNPG-backed MCP hub) — Build Plan"
class: planning
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-23
last-reviewed: 2026-06-23
review-interval: P6M
retention: review-only
related: [REC-PLAN-014, REC-ADR-007, REC-PLAN-011, REC-ADR-005]
---

# cadre — OSS cross-agent coordination hub — Build Plan

**Status: draft — plan only.** This is a durable, resumable build plan. No `cadre` repo
is created and no code is scaffolded by this document. **The build STARTS only after the
`@restormel/aaif → @restormel/dispatch` rename PR merges** (locked sequencing — see
*Dependencies* below). This plan + its tracking issue are the system of record for the
work; any agent can resume from the checklist after a crash or context-limit reset by
following the *Resumability* section.

`cadre` is one shared coordination space across the Restormel/Allotment repos
(restormel-keys, restormel-ops, plotbudget, sophia) **and** an OSS coordination hub for
any MCP agent: a task board (deps + `SELECT … FOR UPDATE SKIP LOCKED` claim), messages
addressed to a repo, advisory file locks (TTL), handoffs, published contracts/decisions,
an auto-surface hook, and per-repo identity.

## Links
- **Readiness report (STEP-4 cadre plan + answered open questions):**
  `scratchpad/a2a-cadre-readiness.md`
  (session scratchpad: `/private/tmp/claude-501/-Users-adamboon-projects-restormel-keys/b0194dba-3ea1-4dcc-bcc4-3efb510f3d10/scratchpad/a2a-cadre-readiness.md`)
- **Program brief:** `restormel-ops/planning/cadre-a2a-program-brief.md`
  (fall back to Forgejo MCP repo `Allotment-Technology-Ltd/restormel-ops` if not local)
- **Prerequisite rename + A2A program:** `planning/a2a-protocol-implementation-plan.md` (REC-PLAN-014)
- **Decision record:** REC-ADR-007 (`docs/decisions/adopt-real-a2a-supersede-door3-hedge.md`, drafted)
- **Tracking issue:** `Allotment-Technology-Ltd/restormel-keys#<ISSUE>` (the resumable worklist;
  this number is filled in by the agent that opens the issue — see Resumability)

---

## Locked decisions (FIXED — do not relitigate without an ADR)

| # | Decision | Detail |
|---|---|---|
| L1 | **Datastore = SELF-HOSTED CNPG on K3s** | A new **`agent_coord` database** in the existing in-cluster CloudNativePG Postgres cluster. **NOT Neon** — this overrides the program brief's "Store = Neon" for sovereignty. The dual-driver db-adapter still ships (so OSS users may point at any Postgres incl. Neon), but Restormel's own deployment targets CNPG. |
| L2 | **Connection string** | Infisical key **`CADRE_DATABASE_URL`**, project **restormel-ops**, env **prod**. Injected at launch; **never written into the plist or committed**. The OSS default is a `DATABASE_URL` env var the operator supplies. |
| L3 | **Migration 001 creates the `agent_coord` schema** | Tables: `agents`; `tasks` (deps, status, claimed via `FOR UPDATE SKIP LOCKED`); `messages` (from/to repo + read cursor); `locks` (file + TTL); `handoffs`; `contracts`. Idempotent `NNN_*.sql` style. |
| L4 | **Repo = new PUBLIC repo `cadre`** | On Forgejo, owner **Allotment-Technology-Ltd**, license **Apache-2.0**, **GitHub mirror only** (push-only mirror; Forgejo canonical). |
| L5 | **Interface = MCP HTTP hub** | `@modelcontextprotocol/sdk` **streamable HTTP**, bound **`127.0.0.1:7878`**. Tools: identity/register, contract.publish, message.send\|broadcast\|inbox, task.create\|claim\|complete\|list, lock.acquire\|release\|status, handoff.create\|list, poll. |
| L6 | **Auto-surface hook** | `agent-coord-poll.sh` on **SessionStart + UserPromptSubmit**. Modelled on `restormel-keys/.claude/hooks/session-start.sh` (bash, `set -u`, stdout→context, always `exit 0`, fail-silent, per-repo cursor, dedupe, cap). |
| L7 | **Clients wired** | restormel-keys, restormel-ops, plotbudget, sophia — each gets a `.mcp.json` http entry + the hook in `.claude/settings.json` + a short CLAUDE.md note. **Additive MERGE, never overwrite.** |
| L8 | **launchd home = restormel-ops** | `uk.allotmentology.cadre.hub.plist` lives in restormel-ops, **localhost-only**, `RunAtLoad` + `KeepAlive` (auto-restart), logs **OUTSIDE any watched outbox tree** (relay loop invariant). |
| L9 | **Sequencing** | Build **STARTS only after the rename PR merges** (frees the `@restormel/dispatch` naming and closes REC-PLAN-014 Phase 0). cadre is otherwise parallel to A2A Phases 1–7. |
| L10 | **Dependency boundary** | cadre depends only on `@modelcontextprotocol/sdk` + `pg` (and optionally `@neondatabase/serverless` for the dual-driver shim) — **never** on internal `@restormel/*`. Reusable bits are **fresh-COPIED**, not imported. |

---

## Architecture (one paragraph)

A single localhost MCP **hub** process (launchd-managed in restormel-ops, bound
`127.0.0.1:7878`) speaks streamable HTTP to every wired repo's Claude Code session via a
committed `.mcp.json` http entry. The hub persists all coordination state in the
**`agent_coord`** database on the in-cluster CNPG Postgres. Each repo identifies as its
repo name. A per-repo **auto-surface hook** polls the hub's `poll` tool on SessionStart and
UserPromptSubmit and injects "what changed for me" into the agent's context (fail-silent if
the hub is down). Task claiming is concurrency-safe via `SELECT … FOR UPDATE SKIP LOCKED`;
file locks are advisory with a TTL.

---

## Fresh-COPY sources (exact files — COPY, do not import)

All four confirmed present in restormel-keys at plan time. Copy as **fresh files with an
origin header** (`// origin: restormel-keys <path> @ <commit> — fresh copy, de-coupled`),
strip every `@restormel/*` / `$lib` coupling, and re-target cadre's schema.

| Source (restormel-keys) | Lines | What to copy | Notes |
|---|---|---|---|
| `apps/dashboard/src/lib/server/db-adapter.ts` | ~344 | Dual-driver shim: `getDb(url)`, `shouldUseNeonHttp`, `sslConfigFromUrl`, `getPool`, `makePgClient`, `buildParameterizedQuery` (injection-safe tagged template), `DbClient`/`TxnClient` interfaces | Deps: `@neondatabase/serverless` + `pg` only — **no** `@restormel/*`. Directly reusable. → `src/server/db-adapter.ts` |
| `apps/dashboard/src/lib/server/migration-runner.ts` | ~223 | Pure logic, no I/O/env/exit: `runMigrations(sql, listFn, readFn)`, `splitSqlStatements` (dollar-quote-aware), `ensureTrackingTable`, `loadApplied`, `sortMigrationFiles`, `numericPrefix`; `schema_migrations` + `ON CONFLICT DO NOTHING` per-file txn | Zero deps. Reusable as-is. → `src/server/migration-runner.ts` |
| `apps/dashboard/scripts/apply-migrations.mts` | ~69 | CLI: env → `getDb` → `runMigrations` over `../migrations/*.sql`, fail-closed `exit(1)` | Only path rewrites: migrations dir + relative import paths; drop `./load-dashboard-env.mjs` (use plain `process.env.DATABASE_URL`). → `scripts/apply-migrations.mts` |
| `apps/dashboard/src/lib/server/neon.ts` → `claimNextQueuedHostedRuntimeJob` (~L5618) | ~37 | SKIP-LOCKED claim CTE shape: `WITH c AS (SELECT id … FOR UPDATE SKIP LOCKED) UPDATE … RETURNING` | Copy the **shape only**; re-target cadre's `tasks`, drop hosted-runtime columns. → `src/server/claim.ts` |

---

## Migration 001 — `agent_coord` schema (shape)

`migrations/001_agent_coord.sql`, idempotent. Targets the `agent_coord` database on CNPG
(L1). Tables and key constraints:

- **`agents`** — `repo` UNIQUE (identity = repo name), display name, first/last-seen.
- **`tasks`** — id, title, body, `status` CHECK (`queued|claimed|done|…`), `deps` (array
  of task ids), `claimed_by`/`claimed_at`, `created_at`. Claimed via the SKIP-LOCKED CTE
  (`src/server/claim.ts`). Index `tasks(status, created_at)`.
- **`messages`** — id, `from_repo`, `to_repo` (nullable = broadcast), body, `created_at`;
  plus **`message_reads`** (per-repo read cursor for `inbox-since`). Index `messages(to_repo, id)`.
- **`locks`** — id, `file_path`, `holder_repo`, `acquired_at`, `expires_at` (TTL). **Partial
  unique index** on `file_path WHERE expires_at > now()` (one active lock per path).
- **`handoffs`** — id, from/to repo, payload/context, `created_at`.
- **`contracts`** — id, name, `version`, body/decision text, published_by, `created_at` (versioned).

---

## ORDERED resumable to-do list

> Each item is a **discrete, independently resumable task**. Tick the box in BOTH this file
> and the tracking issue when complete (the issue body mirrors this list). An item is "done"
> only when its **verification** holds. See *Resumability* for how to determine the current
> state. **Do not start C1 until the GATE passes.**

### GATE (must pass before any build step)
- [ ] **G0 — Rename PR merged.** Confirm the `@restormel/aaif → @restormel/dispatch` rename
  PR (REC-PLAN-014 Phase 0) is **merged to `main`** on Forgejo. *Verify:* `@restormel/dispatch`
  exists in restormel-keys main (`git grep -l "@restormel/dispatch" packages/dispatch/package.json`)
  and `packages/aaif` is gone. **If not merged, STOP — the entire build is blocked (label `blocked`).**

### Phase A — repo + scaffold
- [ ] **A1 — Create the `cadre` repo.** New **public** Forgejo repo `Allotment-Technology-Ltd/cadre`,
  **Apache-2.0**, init with README + LICENSE + `.gitignore`. Configure the **GitHub push-only mirror**.
  *Verify:* repo resolves on `git.allotmentology.tech`; LICENSE = Apache-2.0; mirror configured.
- [ ] **A2 — Lay down the project skeleton.** Directory layout:
  `src/server/{db-adapter,migration-runner,claim,store}.ts`, `src/hub/{index.ts,tools/}`,
  `src/identity.ts`, `scripts/apply-migrations.mts`, `migrations/`,
  `client/{.mcp.json.example,agent-coord-poll.sh}`, `deploy/uk.allotmentology.cadre.hub.plist`,
  `package.json` (deps: `@modelcontextprotocol/sdk`, `pg`, optional `@neondatabase/serverless`;
  **no `@restormel/*`**), `tsconfig.json`. *Verify:* `pnpm install` resolves; no `@restormel/*` in deps.

### Phase B — fresh-copy the reusable bits (see Fresh-COPY sources table)
- [ ] **B1 — Copy db-adapter shim** → `src/server/db-adapter.ts` (origin header; strip `$lib`/`@restormel/*`).
  *Verify:* type-checks standalone; only `pg`/`@neondatabase/serverless` imported.
- [ ] **B2 — Copy migration-runner** → `src/server/migration-runner.ts` (origin header; zero deps).
  *Verify:* type-checks standalone.
- [ ] **B3 — Copy apply-migrations CLI** → `scripts/apply-migrations.mts` (rewrite migrations dir +
  imports; drop `load-dashboard-env`; read `process.env.DATABASE_URL`). *Verify:* `--help`/dry path runs.
- [ ] **B4 — Copy SKIP-LOCKED claim shape** → `src/server/claim.ts` (re-target cadre `tasks`,
  drop hosted-runtime columns). *Verify:* SQL references only `agent_coord.tasks` columns.

### Phase C — schema + store
- [ ] **C1 — Author `migrations/001_agent_coord.sql`** per the *Migration 001* shape above
  (agents, tasks[deps,status,SKIP-LOCKED], messages[+message_reads cursor], locks[file+TTL,
  partial-unique], handoffs, contracts; indexes). Idempotent. *Verify:* parses; re-runnable.
- [ ] **C2 — Build `src/server/store.ts`** — typed data-access for each table, used by the hub
  tools (insert/select helpers; claim delegates to `claim.ts`; inbox uses `message_reads`).
  *Verify:* compiles against the schema; no raw string interpolation (use parameterised queries).

### Phase D — MCP hub
- [ ] **D1 — Hub server `src/hub/index.ts`** — `@modelcontextprotocol/sdk` streamable HTTP,
  bind **`127.0.0.1:7878`** only, `/mcp` endpoint. Wire identity from the caller's repo name.
  *Verify:* `curl http://127.0.0.1:7878/mcp` (or MCP handshake) responds; bound to loopback only.
- [ ] **D2 — Tools `src/hub/tools/`** — implement: `identity.register`, `contract.publish`,
  `message.send|broadcast|inbox`, `task.create|claim|complete|list`, `lock.acquire|release|status`,
  `handoff.create|list`, and the composite **`poll`** ("what changed for me" since cursor).
  *Verify:* each tool round-trips against a local `agent_coord` DB; `task.claim` is SKIP-LOCKED;
  `poll` advances the per-repo cursor.

### Phase E — auto-surface hook
- [ ] **E1 — `client/agent-coord-poll.sh`** — modelled on `session-start.sh`: `set -u`, always
  `exit 0`, diagnostics→stderr, context→stdout, `BASH_SOURCE` repo-root resolve. Curl the local
  hub `poll` (identity = repo name), per-repo cursor file **`.cadre-cursor`** (gitignored), dedupe
  + cap output, **degrade silently if the hub is down**. *Verify:* runs with hub up (emits context)
  and hub down (silent, `exit 0`).

### Phase F — per-repo client wiring (ADDITIVE MERGE — never overwrite)
- [ ] **F1 — restormel-keys** — merge `.mcp.json` (add `"cadre": {"type":"http","url":"http://localhost:7878/mcp"}`
  alongside the existing `midjourney` http entry); append `agent-coord-poll.sh` to the existing
  SessionStart array in `.claude/settings.json` **and** add a UserPromptSubmit entry (keep
  `session-start.sh`); short CLAUDE.md "cadre" note; `.gitignore` add `.cadre-cursor`. *Verify:*
  existing entries intact; valid JSON; hook listed twice (SessionStart + UserPromptSubmit).
- [ ] **F2 — restormel-ops** — same additive wiring. *Verify:* as F1.
- [ ] **F3 — plotbudget** — same additive wiring. *Verify:* as F1.
- [ ] **F4 — sophia** — same additive wiring. *Verify:* as F1.

### Phase G — launchd + DB connect + verify
- [ ] **G1 — launchd plist** — `deploy/.../uk.allotmentology.cadre.hub.plist` (home = restormel-ops),
  hub bound `127.0.0.1:7878`, `RunAtLoad` + `KeepAlive`, **logs OUTSIDE any watched outbox tree**.
  Connection string injected from Infisical key **`CADRE_DATABASE_URL`** (restormel-ops/prod) at
  launch — **never in the plist**. *Verify:* plist contains no secret; log path is outside any relay outbox.
- [ ] **G2 — Apply migration 001 to CNPG.** Create the `agent_coord` database in the in-cluster
  CNPG Postgres; resolve `CADRE_DATABASE_URL` from Infisical (restormel-ops/prod); run
  `scripts/apply-migrations.mts`. *Verify:* `schema_migrations` lists `001_agent_coord.sql`; all
  six tables exist. (CNPG access pattern: see memory `k3s-db-access-pattern` — port-forward the
  pod, single-command lifetime.)
- [ ] **G3 — Load + smoke-test the hub.** `launchctl load` the plist; confirm the hub is up on
  `127.0.0.1:7878` and KeepAlive restarts it. From a wired repo, exercise `poll`, `task.create` →
  `task.claim` (two concurrent claimers — exactly one wins via SKIP-LOCKED), `message.send` →
  `inbox`, `lock.acquire` → `status` → `release`. *Verify:* round-trips succeed; concurrent claim
  is exclusive; hook surfaces context on a fresh session.
- [ ] **G4 — Records hygiene.** Stage `governance/asset-inventory.yaml` (new `cadre` service +
  `agent_coord` DB) and, if a new external dependency is introduced, `governance/suppliers.yaml`;
  flip this plan's `status` if appropriate; run `node scripts/records/register.mjs`. *Verify:*
  register regenerated; frontmatter validates.

---

## Resumability — how any agent determines current state and the next undone step

A resuming agent (after a crash / context reset) should, in order:

1. **Read this plan** (`planning/cadre-build-plan.md`) and the **tracking issue**
   `Allotment-Technology-Ltd/restormel-keys#<ISSUE>` — the issue checklist is the live worklist;
   ticked boxes there are authoritative for "what's done".
2. **Re-check the GATE (G0).** If the rename PR is not yet merged
   (`git grep -l "@restormel/dispatch" packages/dispatch/package.json` in restormel-keys main
   returns nothing, or `packages/aaif` still exists), **STOP** — nothing else may proceed. Leave
   the `blocked` label on; do not create the cadre repo.
3. **Determine the furthest-completed step empirically**, not by trust:
   - **A1 done?** Does `Allotment-Technology-Ltd/cadre` exist on Forgejo? (`search_repos` / `get_repo`).
     If not → start at A1.
   - **A2/B*/C*/D*/E* done?** Clone/open `cadre`; check for the files each step produces
     (`src/server/db-adapter.ts`, `migration-runner.ts`, `claim.ts`, `migrations/001_agent_coord.sql`,
     `src/hub/index.ts`, `src/hub/tools/`, `client/agent-coord-poll.sh`). The **last file present**
     marks the boundary; resume at the first missing one.
   - **F1–F4 done?** In each client repo, grep `.mcp.json` for `"cadre"` and `.claude/settings.json`
     for `agent-coord-poll.sh`. Missing → that repo's wiring is the next step.
   - **G1 done?** `uk.allotmentology.cadre.hub.plist` present in restormel-ops `deploy/`.
   - **G2 done?** Query `agent_coord` for `schema_migrations` containing `001_agent_coord.sql`.
   - **G3 done?** Is the hub answering on `127.0.0.1:7878`? Does a wired repo's `poll` round-trip?
   - **G4 done?** `git grep cadre governance/asset-inventory.yaml`.
4. **Resume at the first step whose verification fails.** Each step is idempotent in intent
   (the migration runner skips applied files; client wiring is additive-merge; repo create is a
   no-op if it exists) — re-running a partially-done step is safe.
5. **Always tick the box in BOTH this file and the issue** on completion, and push so the next
   agent inherits accurate state.

### Working-context invariants for any resuming agent
- **Worktree discipline:** the restormel-keys main checkout **auto-resets to `origin/main`** —
  do any restormel-keys edits (e.g. F1, G4) in a `git worktree`, never the live main checkout.
- **Forgejo is primary CI/CD:** push/PR/merge via `origin` = `git.allotmentology.tech`; GitHub is a mirror.
- **High-risk-security review:** the hub touches MCP transport + a DB credential + localhost
  network surface — run the `restormel-high-risk-security` review before opening any cadre PR that
  exposes the hub or its DB access. The hub must stay bound to `127.0.0.1` only.
- **Loop invariant (launchd/relay):** the launchd log path must be **outside** any watched outbox
  tree (a log inside an outbox creates a ~10s relay loop).
- **Secrets:** `CADRE_DATABASE_URL` is resolved from Infisical (restormel-ops/prod) at launch and
  must never be committed or written into the plist.

---

## Dependencies / blockers
- **Rename PR merged (REC-PLAN-014 Phase 0)** — HARD prerequisite (G0). Frees `@restormel/dispatch`
  and the `A2A` name; cadre build is blocked until it lands.
- **REC-ADR-007** (adopt/build real A2A; supersede Door-3 hedge) — companion decision; founder
  sign-off sequenced with the rename. Not a per-step blocker for cadre but part of the same gate.
- **CNPG access** — reaching the in-cluster Postgres from the Mac (G2) follows the
  `k3s-db-access-pattern` (port-forward the pod, single-command lifetime, `sslmode=disable` for tooling).
- **Infisical key `CADRE_DATABASE_URL`** present in restormel-ops/prod before G1/G2.
