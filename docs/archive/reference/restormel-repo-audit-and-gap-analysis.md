# Restormel Keys — repo audit and gap analysis

**Purpose:** Compare the current implementation against the target Restormel Keys product model (AI gateway and control plane). Reference: dashboard IA, docs IA, data model, onboarding flow, wireframe outline, onboarding copy.

**Status:** Audit only. No code written. Use this to drive the minimum viable refactor path and file-level change plan.

---

## 1. Current architecture

| Layer | Current state |
|-------|----------------|
| **Repo** | Monorepo (pnpm). `packages/` (core, svelte, elements, react, tokens, cli), `apps/` (dashboard, demo-next, demo-svelte, site), `docs/`, `scripts/`, `zuplo-gateway/`. |
| **Core** | `@restormel/keys` — headless: KeysInstance, providers (OpenAI, Anthropic, Google), router (resolve provider/model from config), cost estimate, entitlements, wallet. No persistence; config passed in. |
| **Dashboard** | SvelteKit app in `apps/dashboard`. Server: Neon Postgres, Better Auth (Neon Auth / GitHub). Routes: `/`, `/projects`, `/projects/[id]`, `/projects/[id]/usage`, `/billing`, `/settings`, `/login`, `/logout`. API: `/api/projects`, `/api/projects/[id]`, `/api/projects/[id]/keys`, `/api/auth/*`, `/api/health`, `/api/billing/*`. |
| **Data** | Neon Postgres. Migrations: `001_initial.sql` (projects, api_keys), `002_better_auth.sql` (user, session, account, verification). **Note:** `neon.ts` references a `users` table (upsertUser) that is not created in 001/002 — schema drift or missing migration. |
| **Auth** | Better Auth with Neon Auth; GitHub sign-in; session in DB. No Management Keys / PATs. |
| **Gateway** | Zuplo: consumer keys (`zpka_...`) at edge; backend key (`rk_...`) injected to dashboard API. Runbooks in `docs/runbooks/zuplo-*`. |
| **Site** | Svelte/SvelteKit app (dashboard + docs at `/keys/docs/*`). |
| **Embeddable** | `@restormel/keys-svelte` (KeyManager, ModelSelector, CostEstimator), `@restormel/keys-elements`, `@restormel/keys-react`. Demos: demo-next, demo-svelte. |

---

## 2. Current auth/key model

| Concept | Current implementation |
|---------|------------------------|
| **Runtime auth into Restormel** | Single key type: stored as `api_keys` (project-scoped). UI/API call it “API key”; format `rk_...`; prefix + hash stored. Used by Zuplo as `KEYS_BACKEND_API_KEY` and by clients. **Not** named Gateway Key. |
| **Management / PAT** | Not present. |
| **Provider credentials** | Not in dashboard or DB. In headless core and demos: provider keys live in **client-side config** (KeyManager stores per-provider keys in host app state/localStorage). No ProviderIntegration, ProviderBinding, or server-side provider credential storage. |
| **Separation** | Gateway Key vs Provider Credential is **not** implemented: dashboard only has project-scoped “API keys” (which are effectively gateway keys). Provider keys are entirely in embeddable/demo layer, not in control plane. |

---

## 3. Project / workspace / environment concepts

| Concept | Current state |
|---------|---------------|
| **Workspace** | Does not exist. No workspace entity, table, or nav. |
| **Project** | Exists. Table `projects(id, name, user_id, created_at)`. Owned by user; 1:many api_keys. No workspace_id. |
| **Environment** | Does not exist. No dev/staging/prod or environment_id on keys or routes. |
| **Hierarchy** | Flat: user → projects → api_keys. Target is workspace → project → environment. |

---

## 4. Provider integrations (current)

| Aspect | Current state |
|--------|----------------|
| **Storage** | No server-side provider credentials. Core `ProviderDefinition` + `validateKey` / `createClient` take an `apiKey` string at call time. |
| **Dashboard** | No “Provider Integrations” section. No connect/test/rotate/bind UI. |
| **Binding** | No ProviderBinding or project/environment binding. Demos pass keys into KeyManager; no binding model. |
| **Catalog** | Providers export static `models` arrays (e.g. OPENAI_MODELS). No governed catalog, no ProviderModelVariant, no central model table. |

---

## 5. Models: dropdown, config blob, or structured object?

| Aspect | Current state |
|--------|----------------|
| **Representation** | **Config blob / dropdown.** Core: `ModelDefinition { id, provider, label }` and provider-specific `models: string[]`. No Model entity with lifecycle, pricing, capabilities. |
| **UI** | ModelSelector (Svelte): lists providers and their `models`, shows availability via `keys.resolve()`. No lifecycle, pricing, or catalog UI. |
| **Pricing / lifecycle** | Provider adapters have `estimateCost(modelId)` (static lookup). No PricingRecord, RateLimitRecord, LifecycleEvent, or “live” structured data. No lifecycle state in UI. |
| **Target** | Model catalog with Model, ProviderModelVariant, pricing, rate limits, lifecycle state, and first-class catalog UI. |

---

## 6. Routes, policies, lifecycle, analytics, logs

| Capability | Exists? | Where |
|------------|---------|--------|
| **Routes** | Partially in core only. `ResolvedRoute`, `RoutingConfig` in types; `router.ts` resolves provider/model from config. No Route entity, no RouteStep, no dashboard routes section, no fallback chain UI. |
| **Policies** | No. No Policy, PolicyBinding, or policy types (model_allowlist, budget_cap, etc.). |
| **Lifecycle** | No. No LifecycleEvent, lifecycle state on models, or Lifecycle & Migrations UI. |
| **Analytics** | Placeholder only. Dashboard has `/projects/[id]/usage` (placeholder). No UsageAggregate, RequestLog, or analytics views. |
| **Logs & traces** | No. No RequestLog storage or Logs & Traces section. |
| **Billing & forecasting** | Partial. Dashboard has `/billing` and Paddle checkout/webhook; no cost-by-route/model/tenant or forecasting UI. |

---

## 7. Current dashboard/navigation structure

| Nav item | Target (dashboard IA) | Current |
|----------|------------------------|---------|
| Overview | Cross-project summary, health, spend, risk | Yes, minimal: project list + “Create project”. No spend, alerts, lifecycle. |
| Projects | List + detail with Environments, Access, Routes, Policies, Models, Usage, Logs, Settings | List + detail with **API keys** and **Usage (placeholder)** only. No tabs, no environments, no routes/policies/models. |
| Access | Gateway Keys, Management Keys, Service Accounts, OIDC, Audit Log | No. Keys live under project detail as “API keys”. No Management Keys, Audit Log section. |
| Provider Integrations | Connect/test/rotate, bindings, models | Missing. |
| Models | Catalog, filters, lifecycle, detail pages | Missing. |
| Routes | List, detail, definition, fallbacks, exposure, analytics, logs | Missing. |
| Policies | List, detail, bindings | Missing. |
| Analytics | Requests, spend, tokens, comparison, forecast | Missing (usage is placeholder). |
| Logs & Traces | Request-level logs, filters, detail drawer | Missing. |
| Lifecycle & Migrations | Deprecated in use, migration checklist | Missing. |
| Billing & Forecasting | Spend, budgets, calculator | Billing page exists (Paddle); no forecasting or calculator. |
| Documentation | In-product docs hub | Link to `/keys/docs/` in welcome; no in-dashboard docs section. |

**Left nav today:** Overview, Projects, Billing, Settings (+ Log out). No Access, Provider Integrations, Models, Routes, Policies, Analytics, Logs & Traces, Lifecycle, Documentation.

---

## 8. Top architectural mismatches vs target control-plane model

1. **Key taxonomy** — Product uses “API key” everywhere. Target: Gateway Key (Restormel auth) and Provider Credential (upstream) as separate concepts and surfaces.
2. **No workspace/environment** — Flat user → project → keys. Target: Workspace → Project → Environment with keys and bindings scoped to that hierarchy.
3. **No server-side provider integrations** — Provider credentials only in client/config. Target: ProviderIntegration + ProviderBinding, stored and bound per project/environment.
4. **Models as list, not catalog** — Static provider model lists; no Model entity, lifecycle, pricing, or catalog UI. Target: governed Model catalog with structured data and lifecycle.
5. **No first-class routes** — Routing is in-memory config in core only. Target: Route + RouteStep entities, fallback chain, route detail and analytics in dashboard.
6. **No policies** — No Policy/PolicyBinding or governance UI. Target: policies for allow/deny, budgets, lifecycle, exposure.
7. **No analytics or request logs** — No RequestLog, UsageAggregate, or Logs & Traces. Target: request-level logs and aggregated analytics.
8. **Dashboard is settings-style** — Project + keys + billing. Target: control-plane IA (Overview, Access, Provider Integrations, Models, Routes, Policies, Analytics, Logs, Lifecycle, Billing, Docs).
9. **Onboarding** — Welcome explains “create project, generate API key”. Target: onboarding that explains Gateway Key vs Provider Credential, then workspace → project → key → provider → route → first request.
10. **Schema drift** — `neon.ts` uses `users` table; migrations 001/002 do not create it. Must be resolved.

---

## 9. Repo map (key areas)

```
restormel-keys/
├── apps/
│   ├── dashboard/          # SvelteKit; Neon + Better Auth; projects + api_keys
│   │   ├── migrations/     # 001_initial (projects, api_keys), 002_better_auth
│   │   ├── src/lib/server/ # neon.ts, db.ts, auth.ts, billing/paddle.ts
│   │   ├── src/routes/     # +layout, +page, projects, projects/[id], billing, settings, login, logout
│   │   └── src/routes/api/ # projects, projects/[id], projects/[id]/keys, auth/*, health, billing/*
│   ├── demo-next/          # Next.js demo; KeyManager, settings, API keys
│   ├── demo-svelte/        # SvelteKit demo; KeyManager, settings
│   └── dashboard/          # SvelteKit; dashboard + /keys/docs/*
├── packages/
│   ├── core/               # @restormel/keys — keys, router, providers, cost, entitlements, wallet
│   │   ├── src/            # types.ts, keys.ts, router.ts, providers/*, server/*, storage/*
│   │   └── (no Workspace/Project/Environment/Route/Policy/RequestLog types)
│   ├── svelte/             # KeyManager, ModelSelector, CostEstimator
│   ├── react/              # KeyManager
│   ├── elements/           # rk-key-manager
│   ├── cli/                # init, add, list, validate, doctor, estimate
│   └── tokens/            # design tokens (rm/rk)
├── zuplo-gateway/          # Zuplo config; consumer keys → backend key → dashboard API
└── docs/
    ├── reference/          # dashboard IA+data+onboarding, wireframe, implementation plan
    ├── runbooks/           # zuplo-*, firestore-to-neon, etc.
    └── prompts/           # restormel-cursor-implementation-prompt-pack.md
```

---

## 10. Gap analysis (summary)

| Target capability | Gap |
|-------------------|-----|
| Workspace | New entity, table, nav, and default workspace for existing users. |
| Environment | New entity and project→environments; keys/bindings/routes scoped to environment. |
| Gateway Key naming & placement | Rename “API key” → “Gateway Key”; optional workspace/project/environment scope; move to Access section. |
| Management Key | New entity and UI (Access). |
| Provider Integration | New entities (ProviderIntegration, ProviderBinding), storage, connect/test/rotate/bind UI. |
| Model catalog | New entities (Model, ProviderModelVariant, PricingRecord, RateLimitRecord, LifecycleEvent); catalog UI and filters. |
| Routes | New entities (Route, RouteStep); dashboard Routes section; fallback chain and route analytics. |
| Policies | New entities (Policy, PolicyBinding); policy types; Policies section. |
| RequestLog / UsageAggregate | New tables and ingestion; Analytics and Logs & Traces UI. |
| Lifecycle & Migrations | Lifecycle state on models; Lifecycle section and migration workflows. |
| Billing & Forecasting | Extend billing with cost-by-route/model/tenant and calculator (Paddle already present). |
| Dashboard IA | Expand nav to match target; add tabs to project detail; add Access, Provider Integrations, Models, Routes, Policies, Analytics, Logs, Lifecycle, Documentation. |
| Onboarding | Replace “project + API key” with key-model explanation, workspace → project → Gateway Key → provider → route → first request. |
| Docs IA | Align docs structure and nouns with reference; Gateway Key vs Provider Credential, concepts, provider setup, model catalog, routing, analytics, interfaces. |
| Schema | Add/fix `users` if required by neon.ts; add all new tables for workspace, environment, gateway_keys, management_keys, provider_integrations, provider_bindings, models, provider_model_variants, pricing, rate_limits, lifecycle_events, routes, route_steps, policies, policy_bindings, request_logs, usage_aggregates, audit_events, customer_tenants, exposure_rules. |

---

## 11. Recommended implementation order (grounded in codebase)

Order is chosen to minimise breakage and to build on what exists.

1. **Schema and key taxonomy (foundation)**  
   - Fix schema: add `users` table if needed (or remove `upsertUser` usage) so DB and code match.  
   - Rename in code and UI: “API key” → “Gateway Key” where it means Restormel auth (dashboard, API, runbooks, docs). Keep `api_keys` table name for a later migration if desired, or rename to `gateway_keys` in a new migration.  
   - Add migration for: workspace, environment (and project.workspace_id, project default env), then gateway_keys with optional workspace/project/environment scope (or keep current table and add columns).  
   - **Files:** migrations (new), `apps/dashboard/src/lib/server/neon.ts`, dashboard project/key pages and copy, runbooks/docs that say “API key” for gateway.

2. **Workspace + default workspace for existing users**  
   - Add workspace table and workspace_id to projects; create default workspace per user; update listProjects/createProject/getProject and dashboard.  
   - **Files:** migration, neon.ts, API and project list/detail.

3. **Environment**  
   - Add environment table (project_id, name, type); default dev/prod per project; seed for existing projects.  
   - **Files:** migration, neon.ts, project detail (environments tab or section).

4. **Access section and Gateway Key placement**  
   - Add “Access” to nav. Move Gateway Keys to Access (workspace-level list) with optional project/environment filter; keep project detail “Access” tab as filtered view.  
   - **Files:** layout nav, new Access route(s), project detail tabs or sections.

5. **Provider Integration (backend + minimal UI)**  
   - Add provider_integrations + provider_bindings tables and CRUD; secure credential storage (hash or vault); connect/test endpoint; minimal “Provider Integrations” page (list, connect, bind to project/env).  
   - **Files:** migrations, neon (or new service), API routes, Provider Integrations nav and page.

6. **Model catalog (data + one view)**  
   - Add models, provider_model_variants, pricing_records, rate_limit_records, lifecycle_events (or minimal subset); seed from provider definitions; one “Models” list page with filters.  
   - **Files:** migrations, seed script, core or dashboard types, Models nav and page.

7. **Routes (backend + list/detail)**  
   - Add routes, route_steps tables; CRUD API; dashboard Routes section (list + detail with definition, fallbacks, constraints).  
   - **Files:** migrations, API, Routes nav and pages.

8. **Policies (backend + list/detail)**  
   - Add policies, policy_bindings; policy types; Policies section.  
   - **Files:** migrations, API, Policies nav and pages.

9. **RequestLog + UsageAggregate + ingestion**  
   - Tables and write path from gateway or dashboard backend; then Analytics overview and Logs & Traces list/detail.  
   - **Files:** migrations, ingestion (Zuplo or dashboard), Analytics and Logs nav and pages.

10. **Lifecycle & Migrations, Billing & Forecasting, Documentation**  
    - Lifecycle section (deprecated in use, migration checklist).  
    - Billing: cost breakdown, forecast, calculator.  
    - In-dashboard Documentation hub linking to docs site.  
    - **Files:** new pages and nav items.

11. **Onboarding**  
    - Replace welcome and first-run flow with key-model explanation, workspace → project → Gateway Key → provider → route → first request (per onboarding copy).  
    - **Files:** dashboard welcome, first-run and onboarding components.

12. **Docs IA and copy**  
    - Align docs structure and wording with reference (Gateway Key vs Provider Credential, concepts, provider setup, model catalog, routing, interfaces).  
    - **Files:** docs content and navigation.

---

## 12. File-level change plan (high level)

| Area | Files to add | Files to change |
|------|----------------|------------------|
| **Migrations** | New migration(s) for workspace, environment, gateway_keys (or rename api_keys), provider_integrations, provider_bindings, models, variants, pricing, rate_limits, lifecycle_events, routes, route_steps, policies, policy_bindings, request_logs, usage_aggregates, audit_events, customer_tenants, exposure_rules; fix users if needed | 001/002 only if adding users table |
| **Dashboard server** | New API routes for workspaces, environments, provider integrations, bindings, models, routes, policies, logs, usage | `neon.ts`, `db.ts`, project/projects API, keys API |
| **Dashboard UI** | Access, Provider Integrations, Models, Routes, Policies, Analytics, Logs & Traces, Lifecycle, Billing (extended), Documentation; project detail tabs | `+layout.svelte` (nav), `+page.svelte` (overview), projects/[id], new route folders |
| **Dashboard copy** | All “API key” → “Gateway Key” where appropriate; empty states and onboarding | Layout welcome, project detail, keys section, runbooks |
| **Core package** | Optional: shared types for Workspace, Project, Environment, GatewayKey, Route, Policy, etc. | `types.ts`, possibly new domain modules |
| **CLI** | Commands for gateway keys, provider credentials, routes (if API exists) | `commands/*` |
| **Docs** | New structure and pages per docs IA; Gateway Key vs Provider Credential; concepts | `docs/` and site content |
| **Runbooks** | Terminology: backend “API key” → “Gateway Key” or “backend Gateway Key” | zuplo-setup, zuplo-launch-cli, etc. |

---

## 13. What to do next

1. **Confirm schema** — Resolve `users` table vs migrations (add migration or remove upsertUser usage).  
2. **Implement key taxonomy refactor** — Rename API key → Gateway Key in dashboard, API, and runbooks; plan gateway_keys table rename if desired.  
3. **Implement workspace + environment** — Migrations and data layer; then dashboard nav and project detail.  
4. **Proceed in order** — Follow the implementation order above for Provider Integrations, Model catalog, Routes, Policies, Logs/Analytics, Lifecycle, Billing, Onboarding, Docs.

Use the “minimum viable refactor path” prompt (Prompt 2) next to get a phased plan with risks and the first concrete task.
