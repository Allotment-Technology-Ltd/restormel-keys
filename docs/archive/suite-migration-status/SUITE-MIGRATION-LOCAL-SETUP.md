# Suite migration — local setup for manual review

**Branch:** `cursor/suite-migration-integration-0cf6` (Phases 0–10 integrated)  
**Last updated:** 2026-06-01  

Use this checklist when reviewing the suite architecture migration locally. Each phase lists what you must configure vs what works with defaults/tests only.

---

## Integration branch (both repos)

```bash
# restormel-keys
git fetch origin
git checkout cursor/suite-migration-integration-0cf6

# sophia (sibling checkout required for link: deps)
git fetch origin
git checkout cursor/suite-migration-integration-0cf6
```

**Layout:** SOPHIA `package.json` links to `../restormel-keys/packages/{reasoning-core,graphrag-core,knowledge-core,graph-elements}`. Clone both repos as siblings:

```text
parent/
  restormel-keys/
  sophia/
```

Then:

```bash
cd restormel-keys && pnpm install
cd ../sophia && pnpm install
```

---

## Shared prerequisites

| Item | restormel-keys | sophia |
| --- | --- | --- |
| Node | 20.x recommended (22 works; dashboard warns) | per `package.json` |
| Package manager | pnpm 9 | pnpm 11 |
| Automated tests | No secrets required for unit/API tests | No secrets for `pnpm test` |
| Neon Postgres | Required for live dashboard + Knowledge ingest | Required for app + ingest |
| Gateway key | Required for REST smoke against hosted or local dashboard | Required for Keys routing + optional hosted Knowledge |

---

## Phase 0 — Programme foundation

**Configure locally:** Nothing for code review. Docs-only + `@restormel/contracts/connect` schemas.

**Verify:**

```bash
cd restormel-keys
pnpm --filter @restormel/contracts test
node scripts/validate-openapi-suite-draft.mjs
pnpm run review-docs
```

**Manual review:** Approve programme plan in `docs/restormel/SUITE-ARCHITECTURE-MIGRATION.md`.

---

## Phase 1 — Keys REST + Web Components GA

**Configure locally (restormel-keys dashboard):**

| Variable | Required for | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Live `/keys/v1/*` with real auth | Neon; migrations applied |
| Neon Auth vars | Session-based dashboard | See `apps/dashboard/README.md` |
| Gateway key (`rk_…`) | REST smoke | Create in `/keys/dashboard` → Gateway keys |

**Optional:** Zuplo edge — production uses `zuplo-gateway/`; local dev hits dashboard origin directly.

**Verify (no DB):**

```bash
pnpm --filter dashboard exec vitest run src/routes/keys/v1/keys-v1-api.test.ts
node scripts/validate-zuplo-keys-v1.mjs
```

**Manual review:** `curl` resolve/catalog with Gateway key; read `docs/guides/npm-to-rest-keys.md`.

---

## Phase 2 — Graph REST + Web Components

**Configure locally:**

| Variable | Required for | Notes |
| --- | --- | --- |
| None extra | Unit tests | Layout REST uses in-process `@restormel/graph-core` |
| Gateway key | Live `POST /graph/v1/layout` | Same as Phase 1 |

**Verify:**

```bash
pnpm --filter @restormel/graph-elements test
pnpm --filter dashboard exec vitest run src/routes/graph/v1/graph-v1-api.test.ts
node scripts/validate-zuplo-graph-v1.mjs
pnpm run smoke:graph-consumer
```

**Manual review:** Embed `<rg-graph-canvas>` from docs at `/graph/docs/integration/web-components`.

---

## Phase 3 — Knowledge Verify extraction

**Configure locally (sophia):**

| Variable | Required for | Notes |
| --- | --- | --- |
| `RESTORMEL_*` quartet | `/api/v1/verify`, analyse | See sophia `.env.example` |
| Provider keys / BYOK | Real LLM verify | Anthropic, etc. |
| `DATABASE_URL` | Neon-backed features | SOPHIA default |

**In-process (default):** Verify uses `@restormel/reasoning-core` via `sophiaAdapter.ts` — no extra env beyond existing SOPHIA Keys setup.

**Verify:**

```bash
cd sophia
pnpm vitest run src/lib/server/routes/verify-v1-route.test.ts
cd ../restormel-keys
pnpm --filter @restormel/reasoning-core test
```

---

## Phase 4 — Knowledge Retrieve extraction

**Configure locally (sophia):**

| Variable | Required for | Notes |
| --- | --- | --- |
| `SURREAL_*` | Non-degraded retrieval | Graph store via `SophiaGraphStore` |
| `VOYAGE_API_KEY` or Vertex embed | Embeddings in retrieval | Per existing ingest/retrieval setup |
| `RESTORMEL_*` | Optional route-bound models | Same as Phase 3 |

**Verify:**

```bash
cd restormel-keys && pnpm --filter @restormel/graphrag-core test
cd ../sophia && pnpm test
```

**Manual review:** Stoa/Learn grounding; `pnpm kg:audit` if configured.

---

## Phase 5a — Knowledge Ingest planning (`@restormel/connect-core`)

**Configure locally (sophia ingest):**

| Variable | Required for | Notes |
| --- | --- | --- |
| Full ingest stack | `scripts/ingest.ts` | Existing SOPHIA ingest env (see `.env.example` § Admin ingest) |
| `RESTORMEL_*` + routes | Per-stage LLM | Bootstrap via `scripts/restormel/bootstrap-ingestion-routes.ts` |
| `DATABASE_URL` | Durable ingest / Neon checkpoints | Required for wave jobs |
| `SURREAL_*` | Stage 6 store | Required for full pipeline |

**No new env** for planning/resume delegates — adapter uses existing deps.

**Verify:**

```bash
cd restormel-keys && pnpm --filter @restormel/connect-core test
cd ../sophia
pnpm vitest run src/lib/server/aaif/ingestion-plan.test.ts
pnpm vitest run src/lib/server/ingestion/ingestResumeStage.test.ts
```

---

## Phase 6 — Knowledge product launch (REST + MCP + hubs)

**Configure locally (restormel-keys dashboard):**

| Variable | Required for | Notes |
| --- | --- | --- |
| `DATABASE_URL` | All Knowledge REST + hubs | Apply migration **035** for ingest (Phase 9) |
| Gateway key | `POST /connect/v1/*` | Workspace-scoped body fields |
| Hosted provider credentials | **Verify** (non-degraded) | Connections → encrypted keys; ingestion workload routes |
| Graph index | **Retrieve** (non-degraded) | Hosted retrieve uses **empty graph** until workspace index ships — expect `degraded: true` locally |

**Configure locally (sophia — optional hosted cutover):**

| Variable | Required for | Notes |
| --- | --- | --- |
| `CONNECT_API_BASE` | Hosted verify/retrieve instead of in-process | e.g. `https://restormel.dev` or `http://localhost:5173` |
| `RESTORMEL_GATEWAY_KEY` | Auth to Knowledge REST | Same key as Keys |

**Verify:**

```bash
cd restormel-keys
pnpm --filter dashboard exec vitest run src/routes/connect/v1/connect-v1-api.test.ts
pnpm --filter @restormel/mcp test
node scripts/validate-zuplo-connect-v1.mjs
cd ../sophia
pnpm vitest run src/lib/server/knowledge/knowledgeApiClient.test.ts
```

**Manual review:** `/keys/dashboard/connect`, `/connect` marketing; MCP `knowledge.*` tools.

---

## Phase 7 — npm maintenance window

**Configure locally:** Nothing new. Deprecation banners in package READMEs.

**Verify:**

```bash
cd restormel-keys
bash scripts/smoke-consumer-elements-only.sh
cd ../sophia
pnpm run check:prod-deps-no-ui-graph-svelte
```

**Calendar:** Archive deprecated UI npm packages **2026-12-01** — see `docs/runbooks/npm-maintenance-window.md`.

---

## Phase 8 — SOPHIA Graph WC cutover

**Configure locally (sophia):**

| Variable | Required for | Notes |
| --- | --- | --- |
| None extra | Default | `@restormel/graph-elements` via `link:` |
| `GRAPH_API_BASE` | Optional hosted layout REST | Unset = in-process canvas layout |

**Verify:**

```bash
cd sophia
pnpm run check:prod-deps-no-ui-graph-svelte
pnpm test
# Optional with staging secrets:
pnpm run smoke:restormel
```

**Manual review:** Map / graph explorer visual parity (`GraphCanvasHost.svelte`).

---

## Phase 9 — Knowledge Ingest job persistence (5b)

**Configure locally (restormel-keys):**

| Variable | Required for | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Ingest REST + job rows | Run migration `035_knowledge_ingest_jobs.sql` |
| Gateway key | `POST/GET /connect/v1/ingest/jobs` | Valid `workspace_id` matching key's project |

**Configure locally (sophia):**

| Variable | Required for | Notes |
| --- | --- | --- |
| `CONNECT_API_BASE` | Client helpers only | Optional; poller still uses SOPHIA Neon jobs |

**Verify:**

```bash
cd restormel-keys
pnpm --filter dashboard exec vitest run src/routes/connect/v1/connect-v1-api.test.ts
```

**Manual review:** Create job via REST → list in `/keys/dashboard/connect`.

---

## Phase 10 — Ingest worker stub (5c–5d)

**Configure locally (restormel-keys):**

| Variable | Required for | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Worker dequeue | Same Neon as dashboard |
| `KNOWLEDGE_INGEST_WORKER_MAX_JOBS` | Optional | Default `25` |
| `KNOWLEDGE_INGEST_WORKER_MODE` | Optional | Unset = **stub** (marks stages complete); `full` → error until adapter lands |

**Run worker:**

```bash
cd restormel-keys
pnpm --filter dashboard run connect-ingest-worker
```

**Configure locally (sophia):** No change — relations helpers delegate to `@restormel/connect-core`; local poller unchanged.

**Verify:**

```bash
cd restormel-keys
pnpm --filter @restormel/connect-core test
pnpm --filter dashboard exec vitest run src/lib/server/connect-ingest-worker.test.ts
cd ../sophia && pnpm test
```

**Manual review:** Create job → run worker → `GET …/ingest/jobs/{id}` status `completed` (stub).

---

## Still not local-configurable (post-integration engineering)

These require future work or external services — **not** blockers for merging the integration branch:

| Item | Why |
| --- | --- |
| `KNOWLEDGE_INGEST_WORKER_MODE=full` | Full LLM + graph execution adapter not wired |
| Hosted retrieve with real corpus | Workspace graph index not on dashboard Postgres yet |
| SOPHIA poller → hosted job cutover | Dual-write / migration runbook pending |
| npm publish `platform-v*` / `knowledge-v*` | SOPHIA `link:` works locally; production needs tags |
| Zuplo production deploy | Config validated by scripts; edge deploy is ops |

---

## Full automated gate (integration branch)

```bash
# restormel-keys
cd restormel-keys
pnpm install
pnpm --filter @restormel/contracts test
pnpm --filter @restormel/reasoning-core test
pnpm --filter @restormel/graphrag-core test
pnpm --filter @restormel/connect-core test
pnpm --filter @restormel/graph-elements test
pnpm --filter dashboard exec vitest run \
  src/routes/keys/v1/keys-v1-api.test.ts \
  src/routes/graph/v1/graph-v1-api.test.ts \
  src/routes/connect/v1/connect-v1-api.test.ts \
  src/lib/server/connect-ingest-worker.test.ts
node scripts/validate-openapi-suite-draft.mjs
node scripts/validate-zuplo-keys-v1.mjs
node scripts/validate-zuplo-graph-v1.mjs
node scripts/validate-zuplo-connect-v1.mjs
bash scripts/check-repo-hygiene.sh
bash scripts/check-secrets.sh

# sophia
cd ../sophia
pnpm install
pnpm test
pnpm run check:prod-deps-no-ui-graph-svelte
```

---

## Related

- Programme plan: [SUITE-ARCHITECTURE-MIGRATION.md](./SUITE-ARCHITECTURE-MIGRATION.md)
- Per-phase status: `PHASE0-SUITE-MIGRATION-STATUS.md` … `PHASE10-SUITE-MIGRATION-STATUS.md`
- Ingest worker runbook: [docs/runbooks/connect-ingest-hosted-worker.md](../runbooks/connect-ingest-hosted-worker.md)
- SOPHIA pointer: [sophia/docs/sophia/platform-migration.md](https://github.com/Allotment-Technology-Ltd/sophia/blob/main/docs/sophia/platform-migration.md)
