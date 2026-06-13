# Restormel Suite Architecture Migration — Phased Plan

**Status:** Canonical programme plan (Draft)  
**Owner:** Allotment Technology Ltd  
**PRD:** Restormel Suite Architecture Migration (May 2026)  
**Last reviewed:** 2026-06-01  

**Audience:** Maintainers, product, and agents executing extraction, productisation, and SOPHIA reintegration.

**Platform narrative:** govern (Keys) → verify (Testing, unchanged in this programme) → visualise (Graph) → understand (Knowledge).

---

## 1. Objective

Migrate the Restormel suite from **framework-specific npm packages** to **delivery-model-appropriate interfaces**:

| Product | Current integrator surface | Target integrator surface |
| --- | --- | --- |
| **Keys** | `@restormel/keys` + Svelte / React / Elements npm | **REST API** (edge-deployed) + **Web Components** |
| **Graph** | `@restormel/ui-graph-svelte` (Svelte 5 only) | **Web Components** + **Layout REST API** |
| **Knowledge** ✦ | Embedded in SOPHIA (`src/lib/server/*`, `scripts/ingest.ts`) | **REST API** + **MCP** — Ingest · Retrieve · Verify |

**Dual engineering mandate (this plan):**

1. **Extract** enhanced functionality from SOPHIA into publishable Restormel packages and hosted products (`restormel-keys` primary home).
2. **Reintegrate** SOPHIA as a **reference consumer** of those packages and APIs — without breaking the live showcase app.
3. **Expand the operator experience** from a Keys-centric dashboard into a **Restormel Dashboard** — one signed-in shell for all suite configuration (Keys, Graph, Knowledge, and existing Testing hub).

**Restormel Testing is explicitly out of scope for this programme.** Testing npm, CLI, dashboard hub, and MCP tools **remain as today** until a post-MVP product decision. Do not schedule Testing delivery-model migration work in the phases below.

---

## 2a. Restormel Dashboard (operator shell)

**Decision (product owner, 2026-06-01):** Do **not** ship a separate Knowledge-only dashboard or a second deployable operator app. **Expand** the existing `apps/dashboard` signed-in experience into the **Restormel Dashboard** — the single place Restormel users configure and operate the suite.

| Surface | Direction |
| --- | --- |
| **Branding / IA** | Operator UI presents as **Restormel Dashboard** (suite-wide topbar, product switcher, shared account). Keys remains a **product module**, not the whole shell name. Align with [THEME-L-IA-MATRIX.md](./THEME-L-IA-MATRIX.md). |
| **URL strategy ( pragmatic )** | Keep **`/keys/dashboard`** as the authenticated entry and auth/session base (Neon Auth, existing routes). Add **product hubs** under that shell: `/keys/dashboard/testing` (exists), **`/keys/dashboard/connect`** (new), **`/keys/dashboard/graph`** (new operator views). Marketing stays product-scoped: `/keys`, `/graph`, `/connect`. |
| **Knowledge operator** | Ingest job monitor, per-stage Keys route bindings, retrieve/verify smoke tools, corpus health — all under the Connect hub in Restormel Dashboard. |
| **Graph operator** | Layout preview, graph contract health, fixture validation — under Graph hub (Phase 6); not a separate Graph-only app. |
| **Hosting** | **Same SvelteKit app** on Vercel (`apps/dashboard`); Knowledge REST route handlers live in this app; Zuplo expands for public API edge. |

**Phase placement:** Shell rebrand and nav expansion start in **Phase 0–1** (IA + copy); **Connect hub** ships in **Phase 6**; **Graph operator hub** in **Phase 6** (SOPHIA WC adoption waits until **Phase 8**).

---

## 2. Guiding principles (engineering constraints)

| Principle | Implementation rule |
| --- | --- |
| BYOK by default | Knowledge LLM stages resolve via Restormel Keys (`workload: ingestion`, per-stage chains). Same contract as [keys-routing-contract.md](../keys-routing-contract.md). |
| Framework agnostic | New **public** integrator paths: REST, MCP, Web Components. npm UI adapters enter **maintenance mode** only after REST/WC launch (Keys, Graph). |
| Open-source core, managed cloud | Self-hostable APIs + MCP in repo; hosted at `restormel.dev` + Zuplo. |
| Agentic-ready | MCP for Knowledge Retrieve/Verify; REST for Keys resolve and Knowledge Ingest hot path. |
| SOPHIA safety | **No big-bang cutover.** Each extraction slice follows the [SOPHIA reintegration playbook](#7-sophia-reintegration-playbook) (parity tests, adapter layer, optional feature flag). |

**Out of scope (PRD):** Infrastructure gateway replacement; native mobile SDKs; self-hosted enterprise packaging (Year 1); LLM proxy/caching layer; **Testing delivery-model migration**.

---

## 3. Repository roles

| Repo | Role in this programme |
| --- | --- |
| **`restormel-keys`** | Canonical home for Keys/Graph/Knowledge **products**: packages, dashboard routes, OpenAPI, Zuplo, MCP tools, migrations, marketing/docs, publish trains. |
| **`sophia`** | **Extraction source** and **first consumer**. Keeps showcase UX (Stoa, Learn, billing, philosophy corpus). Replaces in-repo logic with npm/workspace packages + HTTP clients slice by slice. |

**Canonical extraction precedent:** [@restormel/context-packs](../../packages/context-packs/) — see [PHASE2-EXTRACTION-STATUS.md](../archive/suite-migration-status/PHASE2-EXTRACTION-STATUS.md) for the extract → publish → SOPHIA adapter → delete duplicate pattern.

---

## 4. Phase overview and dependencies

```text
Phase 0 ──► Phase 1 (Keys REST+WC) ──► Phase 2 (Graph REST+WC)
                │                              │
                └──────────────┬───────────────┘
                               ▼
              Phase 3 (Knowledge: Verify extract+reintegrate)
                               ▼
              Phase 4 (Knowledge: Retrieve extract+reintegrate)
                               ▼
              Phase 5 (Knowledge: Ingest extract+reintegrate)
                               ▼
              Phase 6 (Knowledge REST + MCP product launch)
                               ▼
              Phase 7 (npm maintenance window — Keys/Graph UI npm only)
                               ▼
              Phase 8 (SOPHIA reference-consumer sign-off)
                               ▼
              Phase 9 (Knowledge Ingest job persistence — 5b)
                               ▼
              Phase 10+ (Ingest workers / GA — 5c–5d, proposed)
```

| Phase | Name | Primary repo | SOPHIA touch |
| --- | --- | --- | --- |
| **0** | Programme foundation | keys | Pointer doc only |
| **1** | Keys REST + Web Components GA | keys | None required |
| **2** | Graph Layout REST + Web Components | keys | Optional: demo consumer |
| **3** | Knowledge Verify extraction | keys + sophia | **Reintegrate** `/api/v1/verify`, analyse verify path |
| **4** | Knowledge Retrieve extraction | keys + sophia | **Reintegrate** retrieval, Learn/Stoa grounding |
| **5** | Knowledge Ingest extraction | keys + sophia | **Reintegrate** workers + admin APIs (adapter/proxy) |
| **6** | Knowledge product launch (REST + MCP) | keys | Switch to hosted Knowledge API where applicable |
| **7** | npm maintenance (Keys/Graph UI) | keys | Drop duplicate npm deps when stable |
| **8** | SOPHIA reference-consumer validation | sophia | Full regression + dogfood sign-off |
| **9** | Knowledge Ingest job persistence (5b) | keys | Optional hosted ingest REST client |
| **10+** | Ingest workers + stage helpers (5c–5d) | keys + sophia | Poller / wave-1 staging (proposed) |

---

## 5. Stage gate model

Every phase ends with **two gates**. The next phase must not start until both pass.

### 5.1 Automated gate (CI / scripts)

Run from repo root unless noted. All listed commands must pass on the integration branch.

| Check | `restormel-keys` | `sophia` |
| --- | --- | --- |
| Typecheck | `pnpm --filter dashboard run check` | `pnpm check` |
| Unit tests | `pnpm --filter dashboard run test` | `pnpm test` |
| Platform / extraction packages | `pnpm run test:platform-packages` (when platform packages touched) | Workspace package smoke tests |
| Testing packages (regression only) | `pnpm run check:testing` | — |
| Hygiene | `pnpm run hygiene`, `pnpm run check-secrets` | — |
| OpenAPI / gateway drift | `node scripts/validate-registry.mjs`; Zuplo OAS vs `docs/api/openapi.yaml` review in PR | — |
| Extraction parity | Vitest fixtures ported from SOPHIA (in keys package) | Optional drift test: local vs `@restormel/*` |
| Playwright (when browser tests touched) | `cd packages/testing-browser-playwright && pnpm exec playwright install chromium` once; then `pnpm run test:testing` | `pnpm test:e2e` (subset agreed in phase PR) |

**Phase-specific automated additions** are listed in each phase below.

### 5.2 Manual gate (human review)

| Review area | Reviewer | Pass criteria |
| --- | --- | --- |
| **Architecture** | Maintainer | Boundaries match §3; no Testing scope creep; trust boundaries documented |
| **SOPHIA safety** | Maintainer + operator | No user-facing regression on staging; rollback steps written in PR |
| **Security** | Maintainer | [security-baseline.md](../security-baseline.md); no secrets; BYOK paths unchanged or improved |
| **Docs** | Maintainer | Canonical doc updated; no duplicate operational truth |
| **Product / PRD** | Product owner | Acceptance criteria for the phase met |
| **Publish** | Release owner | Tag train identified; semver impact noted |

Record sign-off in the phase PR description: `Stage gate: automated ✅ manual ✅ (reviewer initials, date)`.

---

## 6. Phase specifications

### Phase 0 — Programme foundation

**Goal:** Contracts, IA, and extraction RFCs before user-facing migration.

**Work (`restormel-keys`):**

| Item | Deliverable |
| --- | --- |
| This plan | `docs/restormel/SUITE-ARCHITECTURE-MIGRATION.md` (canonical) |
| Horizon alignment | Extend [HORIZON-PLATFORM-PROGRAMME.md](./HORIZON-PLATFORM-PROGRAMME.md) Theme **I** → formal **Knowledge** product lane |
| **Restormel Dashboard IA** | Update [THEME-L-IA-MATRIX.md](./THEME-L-IA-MATRIX.md): Knowledge + Graph operator rows; shell copy “Restormel Dashboard” |
| OpenAPI namespaces | Draft paths: `/keys/v1/*`, `/graph/v1/*`, `/connect/v1/*` in `docs/api/openapi.yaml` |
| Knowledge contracts | `@restormel/contracts` schemas: ingest job, retrieve request/response, verify request/response |
| Extraction map | `docs/restormel/CONNECT-EXTRACTION-MAP.md` — module-level sophia → package mapping |
| SOPHIA pointer | Cross-link only (see sophia `docs/sophia/platform-migration.md`) |

**Work (`sophia`):** None (read-only alignment).

**Automated gate:** `pnpm run review-docs` (keys); `pnpm --filter @restormel/contracts test`; `node scripts/validate-openapi-suite-draft.mjs`; `pnpm run docs:verify-present` (sophia).

**Manual gate:** Product owner approves phase ordering and Testing exclusion.

**Status tracking:** [PHASE0-SUITE-MIGRATION-STATUS.md](../archive/suite-migration-status/PHASE0-SUITE-MIGRATION-STATUS.md)

---

### Phase 1 — Keys REST + Web Components GA

**Goal:** External integrators can use Keys **without** `@restormel/keys` npm for hot paths; Web Components documented as primary UI.

**Work (`restormel-keys`):**

| Priority | Deliverable |
| --- | --- |
| P0 | Public OpenAPI paths for resolve, catalog, models, policies/evaluate |
| P0 | Zuplo route expansion (`zuplo-gateway/config/routes.oas.json`) for P0 paths |
| P0 | Migration guide: `docs/guides/npm-to-rest-keys.md` |
| P1 | `@restormel/keys-elements` CDN / script-module install docs |
| P1 | Mark `@restormel/keys`, `keys-svelte`, `keys-react` **maintenance mode** in README (bugfix-only); **not archived** until Phase 7 |
| P1 | **Restormel Dashboard (incremental):** suite-wide signed-in shell copy, product switcher clarifies Keys / Testing / Graph / Knowledge entry points; extend `nav-config.ts` stubs for future Knowledge/Graph hubs |

**SOPHIA:** No change required. SOPHIA continues `RESTORMEL_*` + dashboard API client.

**Automated gate:** New contract tests: curl/HTTP against local dashboard with Gateway key; `pnpm --filter dashboard run build`; Zuplo OAS validation script (add if missing).

**Manual gate:** External integrator smoke (one non-Svelte app calling resolve via gateway); OpenAPI review.

**Status tracking:** [PHASE1-SUITE-MIGRATION-STATUS.md](../archive/suite-migration-status/PHASE1-SUITE-MIGRATION-STATUS.md)

---

### Phase 2 — Graph Layout REST + Web Components

**Goal:** Graph visualisation without `@restormel/ui-graph-svelte` npm.

**Work (`restormel-keys`):**

| Deliverable | Notes |
| --- | --- |
| `@restormel/graph-elements` (new) or `graph-*` custom elements | Port from `packages/ui-graph-svelte` using `@restormel/graph-core` |
| Layout REST | `POST /graph/v1/layout`, graph snapshot read paths — wrap `packages/graph-core` |
| OpenAPI + Zuplo | Graph section in `docs/api/openapi.yaml` |
| Docs | `/graph/docs/integration/web-components` |

**SOPHIA:** **No Graph Web Component adoption in this phase.** SOPHIA continues `@restormel/ui-graph-svelte` until **Phase 8**. Restormel Dashboard may host Graph operator previews using WCs internally.

**Automated gate:** `pnpm run smoke:graph-consumer`; graph package build; dashboard graph doc route checks (`node scripts/check-graph-dashboard-doc-routes.mjs`).

**Manual gate:** WC embed demo; layout API parity vs in-process `graph-core` helpers.

**Status tracking:** [PHASE2-SUITE-MIGRATION-STATUS.md](../archive/suite-migration-status/PHASE2-SUITE-MIGRATION-STATUS.md)

---

### Phase 3 — Knowledge: Verify (extract → publish → reintegrate SOPHIA)

**Goal:** Verification pipeline lives in `@restormel/reasoning-core` (keys repo or published from keys monorepo); SOPHIA calls package **via adapter** with parity tests.

**Extraction source (sophia):**

| Module | Path |
| --- | --- |
| Verification pipeline | `src/lib/server/verification/pipeline.ts` |
| Extraction / eval | `src/lib/server/verification/extraction.ts`, `reasoningEval.ts` |
| Constitution | `src/lib/server/constitution/**` |
| Contracts (already shared) | `@restormel/contracts/verification`, `constitution` |

**Target package (`restormel-keys`):** **`packages/reasoning-core`** in the **restormel-keys monorepo only** — published on the **`platform-v*`** train alongside `@restormel/contracts`. SOPHIA consumes via npm semver; do not maintain parallel implementation in `sophia/packages/reasoning-core` after extraction.

**SOPHIA reintegration steps (mandatory order):**

1. Add dependency on `@restormel/reasoning-core` (workspace or npm).
2. Introduce **thin adapter** in `src/lib/server/verification/sophiaAdapter.ts` mapping SOPHIA env (Keys resolve, domain prompts) to package inputs.
3. Port vitest fixtures from `src/lib/server/routes/verify-v1-route.test.ts` to run against **both** adapter→package and (temporarily) legacy import; assert identical outputs.
4. Switch `src/routes/api/v1/verify/+server.ts` and `src/routes/api/analyse/+server.ts` to adapter.
5. Delete duplicated files only after **one release cycle** with adapter-only path in production staging.

**Automated gate:**

| Repo | Command |
| --- | --- |
| keys | `pnpm --filter @restormel/reasoning-core test` (add package tests) |
| sophia | `pnpm test`; targeted: `pnpm vitest run src/lib/server/routes/verify-v1-route.test.ts` |

**Manual gate:** Compare `/api/v1/verify` JSON/SSE on staging before/after; constitution rule behaviour unchanged.

---

### Phase 4 — Knowledge: Retrieve (extract → publish → reintegrate SOPHIA)

**Goal:** Graph-aware retrieval in `@restormel/graphrag-core`; align with existing `@restormel/context-packs` for pass-specific packing.

**Extraction source (sophia):**

| Module | Path |
| --- | --- |
| Core retrieval | `src/lib/server/retrieval.ts` |
| Hybrid / seeds | `hybridCandidateGeneration.ts`, `seedSetConstructor.ts`, `surrealRetrievalEnhancements.ts` |
| Context assembly | `contextPacks.ts` — **consolidate with** `@restormel/context-packs` (already extracted); delete duplicate per [PHASE2-EXTRACTION-STATUS.md](../archive/suite-migration-status/PHASE2-EXTRACTION-STATUS.md) |
| Consumers to reintegrate | `learn/graphGrounding.ts`, `stoa/grounding.ts`, `kgAudit/benchmarkRetrieval.ts`, `/api/analyse` |

**Design constraint:** Package must accept **injected graph store interface** (Surreal today) — no hard import of sophia `db.ts`. All reads/writes are scoped by **`workspace_id`** (Keys workspace) passed from the caller; see [§10 Resolved decisions](#10-resolved-decisions).

**SOPHIA reintegration steps:**

1. Implement `SophiaGraphStore` adapter implementing package interface (Surreal queries behind interface).
2. Replace `retrieveContext` imports in grounding + analyse with package + adapter.
3. Port retrieval fixtures; run `pnpm kg:audit:benchmark` baseline before/after on fixed query set.
4. Keep philosophy-specific domain filters in SOPHIA adapter, not in core package.

**Automated gate:** Parity vitest suite; sophia `pnpm test`; keys `@restormel/graphrag-core` + `@restormel/context-packs` tests.

**Manual gate:** Stoa/Learn grounding quality review; retrieval metadata shape unchanged for UI.

---

### Phase 5 — Knowledge: Ingest (extract → publish → reintegrate SOPHIA)

**Goal:** Durable ingest orchestration and stage logic in `@restormel/connect-core` (+ stage submodules); SOPHIA workers remain operable via adapter during transition.

**Highest risk phase** — treat as multiple **sub-slices** with their own mini-gates:

| Sub-slice | Extract from sophia | Notes |
| --- | --- | --- |
| **5a** | `ingestion-plan.ts`, `resolve-provider.ts`, stage model-call helpers | Keys routing already Restormel-native |
| **5b** | Neon job schema + `ingestionJobs.ts`, `ingestRunRepository.ts` | Migrations in keys dashboard or shared migration package |
| **5c** | Stage helpers under `src/lib/server/ingestion/stages/*` | Incremental; not monolithic `scripts/ingest.ts` first |
| **5d** | Worker entrypoints | SOPHIA `ingestion-job-poller`, GCP/Railway scripts proxy to Knowledge API or call package in-process |

**Monolith strategy:** `scripts/ingest.ts` stays in sophia as **CLI operator tool** calling `@restormel/connect-core` until Phase 6 REST exists. Do not move 7k LOC in one PR.

**SOPHIA reintegration steps:**

1. Package owns stage orchestration; sophia passes corpus paths and domain config as job parameters.
2. Admin routes (`/api/admin/ingest/*`) become thin HTTP wrappers — later proxy to keys Knowledge REST (Phase 6).
3. Dual-write period: job rows remain in Neon schema compatible with both old and new code paths (schema versioning).

**Automated gate:** Ingest stage unit tests per sub-slice; sophia `pnpm test`; no regression on `ingestResumeStage` contract tests.

**Manual gate:** One full wave-1 ingest on **staging** branch DB; compare claim counts and ingestion_log to baseline.

---

### Phase 6 — Knowledge product launch (REST + MCP + Restormel Dashboard hubs)

**Goal:** Fourth product live — `/connect` marketing + operator docs; public REST; MCP tools on `@restormel/mcp`; **Knowledge and Graph operator hubs** in Restormel Dashboard.

**Restormel Dashboard (operator UI):**

| Hub | Path (signed-in) | Capabilities |
| --- | --- | --- |
| **Knowledge** | `/keys/dashboard/connect` | Ingest jobs, stage/route bindings (BYOK per stage), retrieve/verify smoke, job status |
| **Graph** | `/keys/dashboard/graph` | Layout preview, contract validation, operator health (uses `@restormel/graph-elements` in dashboard) |

**REST (hosted on `restormel.dev`, same `apps/dashboard` app):**

| Sub-product | Method / path | Implementation |
| --- | --- | --- |
| **Verify** | `POST /connect/v1/verify` | Uses `@restormel/reasoning-core` |
| **Retrieve** | `POST /connect/v1/retrieve` | Uses `@restormel/graphrag-core` |
| **Ingest** | `POST /connect/v1/ingest/jobs`, `GET …/status` | Uses `@restormel/connect-core` |

**MCP tools (extend `@restormel/mcp`):**

| Tool | Tier |
| --- | --- |
| `connect.retrieve` | Read |
| `connect.verify` | Read |
| `connect.ingest.start` | Act |
| `connect.ingest.status` | Read |

**SOPHIA:** Feature-flagged switch (`CONNECT_API_BASE`) from in-process packages to hosted REST for verify/retrieve; ingest workers call REST when flag set.

**Automated gate:** Contract tests for REST; MCP tool smoke (`pnpm exec restormel-mcp` help); sophia integration tests with flag on/off.

**Manual gate:** PRD “launch day” checklist; BYOK per-stage chain demo; migration guide for Knowledge consumers; Restormel Dashboard walkthrough (all four product hubs).

---

### Phase 7 — npm maintenance window (Keys + Graph UI npm)

**Goal:** Six-month bugfix-only window for deprecated npm UI adapters; **Testing npm unchanged.**

| Package group | Action |
| --- | --- |
| `@restormel/keys`, `keys-svelte`, `keys-react` | Maintenance → archive after window |
| `@restormel/ui-graph-svelte` | Maintenance → archive after window |
| **Keep publishing** | `keys-elements`, `graph-elements`, `keys-cli`, `mcp`, `aaif`, platform + knowledge packages |

**SOPHIA:** Remove archived npm deps for Keys UI npm; **Graph npm removal waits for Phase 8 WC cutover** (Phase 7 may still allow `@restormel/ui-graph-svelte` in sophia).

**Automated gate:** Consumer smoke without deprecated packages installed.

**Manual gate:** Deprecation comms; npm README banners; archive dates in CHANGELOG.

---

### Phase 8 — SOPHIA reference-consumer sign-off (+ Graph Web Components)

**Goal:** SOPHIA proves the suite narrative end-to-end as **consumer**, not **platform host**. **Graph surfaces adopt `@restormel/graph-elements` (Web Components) here** — not before.

**SOPHIA Graph WC cutover (mandatory in this phase):**

| Surface | Action |
| --- | --- |
| Map / graph explorer UI | Replace `@restormel/ui-graph-svelte` embeds with `@restormel/graph-elements` + Layout REST where needed |
| Dependencies | Remove `@restormel/ui-graph-svelte` from `package.json` after parity |
| Tests | Visual/regression pass on explorer routes; `pnpm test` + agreed E2E smoke |

**Checklist:**

| Area | Pass criteria |
| --- | --- |
| Keys | All LLM routing via `RESTORMEL_*` / Keys REST |
| Knowledge | Verify, Retrieve, Ingest via `@restormel/*` or Knowledge REST |
| Graph | **Web Components + Graph REST** for explorer surfaces (Phase 8) |
| Product-only | Stoa, Learn, billing, philosophy corpus, Paddle remain in sophia |
| Tests | Full `pnpm test` + agreed E2E smoke |
| Ops | Ingest poller + workers documented against Knowledge API |

**Automated gate:** sophia CI green; restormel-keys CI green; cross-repo dogfood script if available (`pnpm smoke:restormel`).

**Manual gate:** Product owner dogfood session; sign-off that sophia is “reference app” not “hidden monorepo”.

---

## 7. SOPHIA reintegration playbook

Every sophia-facing phase **must** follow this sequence. Skipping steps is a stage-gate failure.

```text
1. Extract logic into @restormel/* package (keys repo) with NO imports from sophia
2. Define narrow public API (types in @restormel/contracts where stable)
3. Port tests using anonymised fixtures (JSON on keys side)
4. Publish or wire workspace:* in sophia
5. Add sophia adapter (env, Surreal store, domain filters, Keys client)
6. Dual-run tests: legacy vs package (delete legacy only after staging soak)
7. Update docs + CHANGELOG in both repos
8. Rollback: revert adapter import; feature flag off hosted API
```

**Hard rules:**

- **Never** import sophia paths from keys packages.
- **Never** delete sophia source until adapter is default for ≥1 staging release.
- **Philosophy-specific** prompts, SEP fetchers, Learn/Stoa UX stay in sophia — only domain-agnostic engines move.
- **Neon `sophia_documents`** stays sophia account product state; Knowledge job tables use **keys-managed Neon schema** scoped by **`workspace_id`**, with explicit migration runbook.
- **Surreal graph tenancy:** **Workspace-scoped** — every Knowledge graph read/write includes Keys **`workspace_id`**; managed cloud uses isolated namespace/database per workspace; self-host defaults to a single workspace. See [§10](#10-resolved-decisions).

**High-risk import graph (do not break casually):**

| Consumer | Depends on |
| --- | --- |
| `/api/analyse` | retrieval, verification, engine, Keys evaluate |
| `/api/v1/verify` | verification pipeline |
| Learn / Stoa grounding | `retrieveContext`, `buildContextBlock` |
| Admin ingest | `ingestionJobs`, stage helpers, `scripts/ingest.ts` |
| KG audit | retrieval benchmark |

---

## 8. Module extraction map (summary)

Full detail: `docs/restormel/CONNECT-EXTRACTION-MAP.md` (Phase 0 deliverable).

| Target package | Primary sophia sources | Keys repo home |
| --- | --- | --- |
| `@restormel/reasoning-core` | `verification/**`, constitution, engine verify paths | `packages/reasoning-core` (**restormel-keys monorepo only**) |
| `@restormel/graphrag-core` | `retrieval.ts`, hybrid*, seed* | `packages/graphrag-core` (**restormel-keys**; align sophia stub → npm consumer) |
| `@restormel/connect-core` | `ingestion/stages/*`, `ingestionJobs.ts`, ingest run repo | `packages/connect-core` (**restormel-keys**; `knowledge-v*` train) |
| `@restormel/providers` | `embeddings.ts`, BYOK operator env | platform or knowledge train |
| `@restormel/context-packs` | Already extracted | Wire sophia off local `contextPacks.ts` |

**Stays in sophia only:** Stoa MCP, Learn catalog, billing, practice planner, marketing pages, corpus fetch scripts, domain classifier tuning.

---

## 9. Publish trains (new / updated)

| Train | Packages |
| --- | --- |
| `keys-v*` | Unchanged (elements stay; core/react/svelte enter maintenance in Phase 7) |
| `graph-v*` | `graph-core`, `graph-elements` (new), deprecate `ui-graph-svelte` |
| `platform-v*` | `contracts`, `context-packs`, `reasoning-core`, `graphrag-core`, `providers` |
| **`knowledge-v*`** (new) | `knowledge-core`, Knowledge OpenAPI version tags |

---

## 10. Resolved decisions

Decisions recorded **2026-06-01** (product owner). Phase 3+ work proceeds on this basis.

| # | Topic | Decision | Rationale |
| --- | --- | --- | --- |
| 1 | **Operator UI** | **Restormel Dashboard** — expand `apps/dashboard` signed-in shell to cover Keys, Testing, Graph, and Knowledge configuration. Connect hub at `/keys/dashboard/connect`; Graph hub at `/keys/dashboard/graph`. | Single auth, single operator journey; aligns with Theme L single-app strategy. |
| 2 | **Graph store tenancy** | **Workspace-scoped** graph data keyed by Keys **`workspace_id`** (Gateway key → workspace). Managed cloud: isolated Surreal namespace/DB per workspace. Self-host: single workspace default. | Multi-tenant SaaS safety, BYOK/billing alignment, clear data boundaries for RAG corpora. |
| 3 | **Package home** | **All extraction packages live in `restormel-keys` monorepo only** (`packages/reasoning-core`, `graphrag-core`, `knowledge-core`, `providers`). Publish via **`platform-v*`** / **`knowledge-v*`**; SOPHIA consumes npm — **delete sophia workspace stubs** after each extraction slice. | One canonical product repo ([09-keys-vs-platform-boundary](../../.cursor/rules/09-keys-vs-platform-boundary.mdc)); avoids dual maintenance. |
| 4 | **SOPHIA Graph WC cutover** | **Phase 8 only** — keep `@restormel/ui-graph-svelte` in SOPHIA through Phases 2–7. | Reduces parallel risk during Knowledge extraction; Graph WCs proven in Restormel Dashboard first (Phase 6). |
| 5 | **Knowledge REST hosting** | **Same SvelteKit app** (`apps/dashboard`) + Zuplo edge; no separate Knowledge deployable for MVP. | Matches Restormel Dashboard decision; simpler ops and auth. |

**No open blockers for Phase 3** once Phase 0–2 stage gates pass.

---

## 11. Related documents

| Topic | Document |
| --- | --- |
| Horizon programme | [HORIZON-PLATFORM-PROGRAMME.md](./HORIZON-PLATFORM-PROGRAMME.md) |
| Context packs extraction | [PHASE2-EXTRACTION-STATUS.md](../archive/suite-migration-status/PHASE2-EXTRACTION-STATUS.md) |
| Keys routing / BYOK | [keys-routing-contract.md](../keys-routing-contract.md) |
| SOPHIA consumer routing | [sophia-keys-routing-consumer.md](../guides/sophia-keys-routing-consumer.md) |
| Graph consumer | [restormel-graph-sophia-consumer.md](../archive/deferred-products/restormel-graph-sophia-consumer.md) |
| Package map | [restormel-monorepo-packages.md](../restormel-monorepo-packages.md) |
| **Local review setup** | [SUITE-MIGRATION-LOCAL-SETUP.md](../archive/suite-migration-status/SUITE-MIGRATION-LOCAL-SETUP.md) |
| SOPHIA architecture | [sophia repo `docs/sophia/architecture.md`](https://github.com/Allotment-Technology-Ltd/sophia/blob/main/docs/sophia/architecture.md) |
| SOPHIA migration pointer | [sophia repo `docs/sophia/platform-migration.md`](https://github.com/Allotment-Technology-Ltd/sophia/blob/main/docs/sophia/platform-migration.md) |

---

## 12. Document history

| Date | Change |
| --- | --- |
| 2026-06-01 | Initial phased plan; Testing delivery migration excluded (post-MVP); stage gates defined |
| 2026-06-01 | Phase 0 deliverables: Knowledge contracts, openapi-suite-v1-draft, CONNECT-PRODUCT, PHASE0 status |
