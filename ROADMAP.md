# Roadmap

Execution roadmap. Single source for milestones; keep aligned with [STATUS.md](STATUS.md). See [docs/governance/release-readiness.md](docs/governance/release-readiness.md) for gate criteria.

**Positioning:** [docs/product/positioning.md](docs/product/positioning.md) — the **verified-context layer**; Keys is the control plane, routing/BYOK are supporting. **MVP:** Keys + Connect (Testing & Graph flag-off). **Hosting:** Coolify + Forgejo-native CI (cutover 2026-06-13) — [docs/infra/](docs/infra/). Verified-context delivery + claims-integrity rule: [docs/product/verified-context-pivot-roadmap.md](docs/product/verified-context-pivot-roadmap.md).

## Phase 00 — Bootstrap (complete)

- Repo foundation, canonical docs, .cursor/rules, skills, subagents, scripts, .github workflows/templates. No product or business logic.
- **Gate lifted.** Phase 01 may begin.

## Phase 01 — Implementation (current)

### Keys MVP touchpoint matrix

PostHog **`restormel-module-*`** flags gate non-core surfaces (MVP default: **Keys + Connect** only). Registry: [docs/guides/keys-mvp-module-flags.md](docs/guides/keys-mvp-module-flags.md). Operator mode: [docs/guides/keys-mvp-mode.md](docs/guides/keys-mvp-mode.md). Graph decision: [docs/product/GRAPH-MVP-PRODUCT-MEMO.md](docs/product/GRAPH-MVP-PRODUCT-MEMO.md).

| Capability | Marketing | Dashboard UI | REST API | MCP / AAIF | CLI | Docs / sitemap | CI publish |
|------------|-----------|--------------|----------|------------|-----|----------------|------------|
| **Testing** | `suite-modules.ts`, `site-nav.ts`, proof gallery | `nav-config.ts`, `/keys/dashboard/testing`, `copy-for-ci` | `/v1/testing/resolve-model` | `testing.*`, suite invoke | `@restormel/testing-cli` (OSS) | `/testing/docs`, `docs/testing/` | `publish-testing.yml` (gated) |
| **Graph** | Suite nav, `/graph` landing | Docs only | `/graph/v1/*` | `graph.fixture_validate` | — | `/graph/docs` | `publish-graph.yml` (SOPHIA) |
| **Gateway providers** | Integration guides | `integrations/` | `/api/integrations` | AAIF `integrationStack` | — | openrouter, portkey, vercel-ai-gateway guides | — |
| **Guard rails** | — | policies nav, route inspector | resolve policy eval | routing policy tools | — | walkthrough phase 4 | — |
| **Environments** | — | `ProjectContextSwitcher`, route env picker | resolve `environmentId` | `project.environments.list` | env snippets | environment-vocabulary | migration `043` |
| **Connect** | `/connect` marketing | Connect hub, pipeline wizard | `/connect/v1/*` | `connect.*` | — | `/connect/docs` | — |

**Connect (Ingest · Retrieve · Verify) — shipped vs programme plan:** Canonical product brief [docs/product/CONNECT-PRODUCT.md](docs/product/CONNECT-PRODUCT.md). Original programme target was **hosted REST/MCP integrator surfaces** (not npm-only ingestion) per [docs/architecture/SUITE-ARCHITECTURE-MIGRATION.md](docs/architecture/SUITE-ARCHITECTURE-MIGRATION.md) Phase 5–6.

| Area | Shipped in repo | Still open |
|------|-----------------|------------|
| **Ingest REST** | `POST/GET /connect/v1/ingest/jobs*`, dashboard BFF, `@restormel/connect-core` stages, hosted worker → BYO Surreal/Postgres graph | OpenAPI GA; SOPHIA worker cutover to hosted REST; wave-1 staging parity; entity linking (e.g. thinker/authored) |
| **Operator ingest** | Pipeline wizard, domain packs, Graph Designer, source docs/connectors, per-stage Keys routes, graph explorer, validation review, graph re-validation jobs | Ingest GA hardening (validation at scale, provenance, observability); **graph re-embedding** (dimension/model migration — extract from SOPHIA) |
| **Verify REST** | `POST /connect/v1/verify` → `@restormel/reasoning-core` | Operator smoke polish |
| **Retrieve REST** | `POST /connect/v1/retrieve` → structured `graph` + `context_pack` (BYO Surreal); Keys-routed embeddings; MCP `connect.search` / `connect.get_context_for` | Non-degraded retrieve on populated BYO graphs (operator smoke); `connect.verify_claim` / `connect.explore` (v1.1) |
| **Packages** | `@restormel/connect-core`, `@restormel/graphrag-core`, `@restormel/reasoning-core`, `@restormel/context-packs` | Integrator default remains REST/MCP; packages for adapters/self-host |
| **Managed graphs (roadmap)** | — | Optional Restormel-hosted graph index (zero Surreal ops); gated on product/legal sign-off — **not MVP** |

**Next Connect milestones (public roadmap: `/roadmap`):** (1) **Reliable agent grounding** — retrieval that consistently returns the right context from the workspace graph; (2) **Trust you can ship on** — validation, provenance, and review at scale; (3) **Faster first graph** — onboarding for teams without a platform group; (4) **Embed without rebuilding** — stable integrator surfaces. Technical programme: [CONNECT-PRODUCT.md](docs/product/CONNECT-PRODUCT.md).

**Post-MVP re-enable:** flip flags in PostHog or set `RESTORMEL_MODULE_FLAGS` on preview/staging; no code deletion required.

- **Hosted no-code route runtime (partial):** **`POST …/routes/{routeId}/runtime/invoke`** — Phases **1–2** pipeline + Phase **3** **allowlisted** `advanceOn` / **`fallbackOn`** failure advance; OpenAPI **1.5.0**, contract **`2026-06-01`**. **`POST …/runtime/jobs`** + job rows: **linear** completes; **parallel fan-out** gated (**501**). **Not** shipped: full async worker, continuation tokens, streaming — [docs/archive/deferred-products/hosted-runtime/keys-no-code-route-runtime.md](docs/archive/deferred-products/hosted-runtime/keys-no-code-route-runtime.md), [docs/archive/deferred-products/hosted-runtime/keys-hosted-runtime-parallel-jobs.md](docs/archive/deferred-products/hosted-runtime/keys-hosted-runtime-parallel-jobs.md), [docs/archive/deferred-products/hosted-runtime/hosted-runtime-deferred-spikes.md](docs/archive/deferred-products/hosted-runtime/hosted-runtime-deferred-spikes.md).
- **Restormel Testing — business acceptance criteria (shipped `0.1.3`):** suite **`user_story`** + **`acceptance_criteria`** with stable ids; goal **`acceptance_criterion_ids`**; roll-up on **`RunRecord.acceptanceResults`**; **`testing run --ac`**; Markdown/GitHub/JSON reports; mission env **`RESTORMEL_TESTING_ACCEPTANCE_CRITERIA_JSON`**. Full autonomous “one rubric per AC” execution (Plotbudget R-BA-4 style) remains future work on top of **`execution_mode: agent`**.
- **Keys + Testing seamless path (shipped in repo):** hosted provider credentials (AES-256-GCM at rest, masked API/UI), `POST /v1/testing/resolve-model` decrypt path for logical refs, auto-provisioned **Restormel Testing** project + model bindings, dashboard **Restormel Testing** hub and Connections UX, CLI `doctor` hint for `RESTORMEL_PROJECT_ID`. Canonical onboarding: [docs/guides/keys-testing-onboarding.md](docs/guides/keys-testing-onboarding.md). **Onboarding simplification:** canonical Testing env **`RESTORMEL_KEYS_BASE`** + **`RESTORMEL_GATEWAY_KEY`** (with `RESTORMEL_KEYS_API_*` compatibility in the adapter), **Gateway keys** beside **Restormel Testing** in sidebar, overview **Restormel Testing in CI** track + first-run hint.
- **First publish done:** @restormel/keys v0.1.0 on npm; Phase 1 manual steps complete.
- **Phase 2 complete:** @restormel/keys-svelte (KeyManager, ModelSelector, CostEstimator), @restormel/keys-elements, @restormel/keys-react, CLI, Next.js/SvelteKit demos, SOPHIA runbook, a11y, publish.
- **Phase 3 in current architecture:** product surfaces are unified in `apps/dashboard` (Keys landing, docs, dashboard); `apps/site` is archived. Next: iterative UX + docs + control-plane quality improvements in the single-app layout.
- **Experience unification (Phase A–D):** Dashboard logged-out UX and SSO, frontend brand shell and logo integration, journey fixes (pricing checkout, docs handoff, billing copy), docs/Zuplo same-link and documentation strategy, shared tokens package and drift check, UX contracts (nav/copy/state), reintegration seams documented in ARCHITECTURE.md.
- **Platform IA (Theme L — suite-first):** Marketing header **Product · Integrations · Company · Developers**; suite docs hub at `/docs` with progressive disclosure (slim product sidebars + collapsed Reference); dashboard sidebar **Set Up · Monitor · Quality · Connect · Build & embed**; Run vs Embed home CTAs; inventory [docs/architecture/SUITE-IA-REDIRECT-INVENTORY.md](docs/architecture/SUITE-IA-REDIRECT-INVENTORY.md). Canonical Testing hub unchanged — [docs/governance/documentation-strategy.md](docs/governance/documentation-strategy.md).
- **Suite platform:** [platform/](platform/) subtree (tokens, reusable CI composites, Cursor template for new repos). Optional split to **restormel-platform** + npm `tokens-v*` publish — [docs/architecture/platform-modularization.md](docs/architecture/platform-modularization.md). **New module stack:** [docs/architecture/restormel-module-default-stack.md](docs/architecture/restormel-module-default-stack.md) (template checklist + initiation prompt). **Deferred:** Integrations app extraction and dashboard-only repo (same doc).

## Suite architecture migration (programme)

Phased plan to move Keys, Graph, and Knowledge to REST / Web Components / MCP integrator surfaces, extract platform logic from SOPHIA, and reintegrate SOPHIA as reference consumer. **Restormel Testing delivery-model changes are post-MVP and excluded.**

- **Plan (canonical):** [docs/architecture/SUITE-ARCHITECTURE-MIGRATION.md](docs/architecture/SUITE-ARCHITECTURE-MIGRATION.md)
- **Extraction map:** [docs/product/CONNECT-EXTRACTION-MAP.md](docs/product/CONNECT-EXTRACTION-MAP.md)

## Integrations — Developer Enablement

- **Marketing:** `/integrations` landing page (hero, integration cards, setup steps).
- **Dashboard:** `/keys/dashboard/dev-tools` overview + CLI, MCP, AAIF sub-pages. Existing provider integrations relabelled to "Provider Access".
- **Packages:** `@restormel/aaif` (types, validation, runtime helper `executeAAIFRequest`; optional **`RestormelSuiteToolName`** re-export when `@restormel/mcp` is installed), `@restormel/mcp` (tool schemas + stdio server `restormel-mcp`, `createRestormelMcpServer()`; **0.2.0+** adds Horizon **suite read** tools + HTTP **`POST /api/suite/invoke`** mirror; **0.1.10+** environments + Gateway key read/write, `testing.hub_snapshot`, `testing.journey` billing focus; **0.1.9+** `projects.list`, `project_models.list`, `testing.journey`, `testing.ci_env_template`, `testing.resolve_probe`). Package availability is truth-sourced from [docs/reference/npm-packages.md](docs/reference/npm-packages.md) using `npm view` checks.
- **CLI:** `keys models list` and `keys routing explain` commands added.
- **Onboarding:** Usage path selector ("In my app / terminal / agent") on dashboard overview.
- **Docs:** `/keys/docs/integrations/` with CLI quickstart, MCP setup, AAIF overview.
- **Shipped (repo):** `testing release-pack` CLI + schema `restormel-release-pack/1`; workspace **webhooks** MVP (`policy.published`, signed POST, migration **029**); in-app docs for **BYO-GPU** paths, **Release pack**, **webhooks/audit**, **hosted MCP (BYO execution)** posture; GTM note [docs/product/gtm-plg-enterprise-sequencing.md](docs/product/gtm-plg-enterprise-sequencing.md).
- **Next:** AAIF routing integration, additional webhook event types / streaming; MCP HTTP transport if demand emerges.
- Full spec: [docs/integrations/INTEGRATIONS-FULL-SPEC.md](docs/integrations/INTEGRATIONS-FULL-SPEC.md).
- **Operator API parity shipped:** provider trust health, route coverage/readiness APIs, route recommendation endpoint, policy lifecycle parity endpoints, and provenance fields for route/policy updates.

## Dogfood-driven priorities (from SOPHIA Phase 5)

Findings from the first real integration. See [docs/archive/reference/sophia-dogfood-findings.md](docs/archive/reference/sophia-dogfood-findings.md) for full context and workarounds.

- **Project model index — Gateway Key API (shipped):** `POST`/`PUT`/`PATCH`/`DELETE` on `/keys/dashboard/api/projects/{projectId}/models` (+ binding id) with **`rk_`**; OpenAPI 1.3.2 + Cloud API curls; **`bindingKind`** execution vs registry. **Spec / FR traceability:** [docs/requirements/project-model-index-gateway-api.md](docs/requirements/project-model-index-gateway-api.md).

**Restormel-first strategy:** Production issues on Sophia should be treated in two layers: (1) Restormel does more heavy lifting (stronger contract, typings, component behavior, model filtering, diagnostics); (2) then simplify the host app and reassess what is truly app-specific. See [docs/archive/reference/restormel-first-assessment.md](docs/archive/reference/restormel-first-assessment.md).

1. **Publish UI packages to npm.** `@restormel/keys-svelte`, `@restormel/keys-react`, `@restormel/keys-elements` — installable from npm with release smoke tests. Currently 404.
2. **KeyManager async persistence.** `onKeyAdded`/`onKeyRemoved` should accept promises; show loading/error states; close only on host success.
3. **Richer key-status model.** `pending_validation`, `invalid`, `revoked`, `validated_at`, `last_error`, manual revalidate — so host apps can drop their own diagnostics UI.
4. **Server-side validation pattern.** First-class docs and optional helper for host-owned validation (no raw provider calls from browser).
5. **Provider definitions and icons.** More first-party providers for common OpenAI-compatible APIs; document custom provider definitions as a normal integration path; expand icon set.
6. **KeyManager contract.** Host-driven add/remove flows (async result), richer item metadata prop.
7. **Provider normalization.** Consistent `google` handling across UI, docs, and API helpers.
8. **ModelSelector host control (Phase 5 packaged path).** Sophia uses wrapped ModelSelector in main flow; wrapper needed for current-selection visibility, request-scoped routing, host-owned loading/error/empty states, retry/disabled around allowed-models fetch. Make ModelSelector more host-controllable (selection visibility, loading/error/empty/retry/disabled) so hosts need thinner wrappers or none.

### Restormel-first integration (recommended order, from assessment)

Do these before over-rotating on host-app fixes:

- **Stronger Svelte typings** — usable `.d.ts` for KeyManager and ModelSelector (not generic SvelteComponent).
- **Richer packaged component APIs** — built-in loading/error/degraded/empty states so hosts need fewer wrappers.
- **Model-filtering contract** — more complete contract so apps do not have to build custom allowed-models proxy for the common case.
- **Diagnostics** — when Restormel is misconfigured or unavailable, failure should present as "Restormel backend/config issue" not "component broken"; clearer in component behavior and package/debug surface.
- **Semantic docs clarity** — keep route model categories and resolve-to-execution contract explicit to avoid host-side inference errors.
- **Archetype entry routing** — route new users by intent (new project, existing stack, BYOK SaaS, agent/IDE, platform ops) before deep walkthrough phases.

---

*Update when milestones change. Use roadmap-status-sync skill to keep ROADMAP and STATUS aligned.*
