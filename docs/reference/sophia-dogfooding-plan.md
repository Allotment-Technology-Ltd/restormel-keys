# SOPHIA dogfooding plan: Restormel Keys as primary test

**Status:** Reference (plan). Work is performed **in the SOPHIA repo** and in Restormel dashboard/API configuration. This doc defines the scope and mapping so dogfooding doubles as the best test of Restormel Keys.

**Goal:** SOPHIA uses Restormel Keys for (1) the **ingestion pipeline** with fallback routes and policies, and (2) **embedded UI** so end-users can select which models to use for philosophy queries.

**Feedback to Restormel Keys (standard for trusted repos):** SOPHIA is treated as a **trusted** consumer. The **de facto** way to relay improvement requirements into the **restormel-keys** GitHub repo is **not** manual copy-paste: use the label **`restormel-feedback`** in SOPHIA with the GitHub Actions relay described in [restormel-dogfood-relay-consumer-pack.md](restormel-dogfood-relay-consumer-pack.md) (copy that file into the SOPHIA repo and complete setup once). Canonical policy: [github-dogfood-feedback.md](../github-dogfood-feedback.md).

---

## Scope

| Area | What SOPHIA needs | What Restormel Keys provides |
|------|-------------------|------------------------------|
| **Ingestion pipeline** | All ingestion AI calls go through Restormel Keys: resolution, provider/model choice, fallback when a provider fails or is rate-limited. | Dashboard: **Workspace → Project → Environment → Route → Steps**. Routes have **route mode** (e.g. fallback chain), **steps** (provider + model + fallback behaviour). **Resolve API** returns route + provider + model for a request. **Policies** (model allowlist/denylist, budget cap, deprecated-model block) apply at project/environment/route. |
| **Fallback routes and policies** | Configurable fallback order (e.g. OpenAI → Anthropic → Google) and policy guards (allowed models, budget, deprecated blocking). | **Routes**: `routeMode` (e.g. `fallback_chain`), steps with `providerPreference`, `modelId`, `fallbackOn`. **Policies**: created per workspace/project/environment; types include `model_allowlist`, `model_denylist`, `deprecated_model_block`, `budget_cap`, `token_cap`. **Evaluate API** for testing policy outcome for a context. |
| **End-user model selection** | Philosophy query UI lets users pick which model(s) to use. Selection must be consistent with routes and policies (e.g. only show allowed models). | **Embeddable UI**: `KeyManager`, **ModelSelector**, `CostEstimator` from `@restormel/keys-svelte` or `@restormel/keys-react`. Host app points them at Restormel Keys API (or a SOPHIA proxy that calls Restormel). Model list can be driven by dashboard **model catalog** and **policies** so only valid choices are shown. |

---

## Step 0: Remove SOPHIA custom routing and model selection (first step)

Before wiring Restormel Keys into ingestion and UI, SOPHIA’s **custom** routing and model-selection layer must be removed or retired so there is a single source of truth (Restormel).

**Remove or replace in SOPHIA:**

| What | Action |
|------|--------|
| Custom provider/model selection logic | Delete or retire internal modules that choose provider/model (custom router, fallback chains, provider health checks, bespoke model allowlists). Replace with a single “call Restormel resolve” step before each AI request. |
| Custom model picker UI | Remove UI that presents model choice using SOPHIA-specific logic/data. Replace with Restormel’s embeddable **ModelSelector** (see §3). |
| Custom BYOK settings panel | If it duplicates KeyManager/ModelSelector, remove or replace with Restormel’s **KeyManager** (or defer BYOK to a later step). |

**Keep in SOPHIA (do not delete):**

- Billing, wallet, top-ups, founder logic.
- Auth/session model (reuse for API auth).
- Ingestion pipeline **orchestration** (jobs/workers); only the “how we choose model/provider” is replaced.

**Outcome:** One source of truth for routing and fallback (Restormel routes/steps). No custom “choose provider/model” logic in the ingestion path. Model selection in the product UI is done via Restormel ModelSelector (or a thin wrapper).

A full **build-agent prompt** for the SOPHIA repo is in [§ Build-agent prompt (SOPHIA repo)](#build-agent-prompt-sophia-repo) below; use it in the SOPHIA project to perform Step 0 and the replacement work.

---

## 1. Ingestion pipeline on Restormel Keys

- **Current (SOPHIA):** Ingestion likely uses platform keys and/or ad-hoc routing. Goal is to call **Restormel Resolve** for decisions (route/provider/model + policy outcomes) so product controls are centralized, while execution stays in your existing provider access layer (gateway or direct) and observability stays in your existing tooling.
- **Restormel side:**
  - Create (or reuse) a **workspace** and **project** for SOPHIA ingestion.
  - Define **environments** (e.g. production, staging).
  - Create **routes** with **steps** that define provider order and optional model pinning; set **route mode** to fallback chain so failed steps trigger the next step.
  - Attach **policies** as needed (model allowlist, budget cap, deprecated-model block).
  - **Resolve API:** `POST /keys/dashboard/api/projects/[id]/resolve` with `environmentId` (and optional `routeId`) returns `routeId`, `providerType`, `modelId`, etc. SOPHIA ingestion calls this before each AI request and uses the returned provider/model to call your provider access layer (OpenRouter/Portkey/Vercel AI Gateway or direct providers).
- **SOPHIA side (in SOPHIA repo):**
  - Add a **resolve** step to the ingestion path: call Restormel resolve API with project + environment (and optionally route), then use the returned provider/model and credential (platform or BYOK) for the upstream request.
  - Use a **Gateway Key** for authenticating to Restormel; store it in SOPHIA env or secret manager.
  - On resolve failure or 503, implement local fallback (e.g. retry, skip step) as needed.

**Reference:** Dashboard route resolver: `apps/dashboard/src/lib/server/route-resolver.ts`. Resolve endpoint: `apps/dashboard/src/routes/keys/dashboard/api/projects/[id]/resolve/+server.ts`. Zuplo/API gateway runbooks: `docs/runbooks/zuplo-setup.md`, `docs/runbooks/zuplo-launch-cli.md`.

---

## 2. Fallback routes and policies

- **Routes:** In Restormel dashboard, configure routes with multiple **steps**. Each step has provider preference and optional model; `routeMode` “fallback chain” means if a step fails (e.g. rate limit, timeout), the next step is used. Steps and route mode are editable in the UI (Routes → route → Fallback / steps).
- **Policies:** Create policies at workspace/project/environment level. Policy types include `model_allowlist`, `model_denylist`, `provider_allowlist`, `provider_denylist`, `deprecated_model_block`, `budget_cap`, `token_cap`. Policy evaluation is used when resolving or when checking if a user choice is allowed.
- **SOPHIA:** No code change to “what” fallback means; Restormel owns the chain. SOPHIA just calls resolve and uses the result. For **end-user** model choice (see below), SOPHIA may need to call an API that returns “allowed models for this context” (derived from catalog + policies) so the embedded ModelSelector only shows valid options.

**Reference:** Policies: `apps/dashboard/src/routes/keys/dashboard/api/policies/`, evaluate: `.../api/policies/evaluate/+server.ts`. Route steps and route mode: `apps/dashboard/src/routes/keys/dashboard/projects/[id]/routes/[routeId]/+page.svelte`, `.../api/projects/[id]/routes/[routeId]/+server.ts`.

---

## 3. UI embedding for end-user model selection

- **Goal:** In SOPHIA, end-users (philosophy query users) can choose which model to use. That choice should be constrained by Restormel routes/policies and reflect the same model catalog and lifecycle (e.g. deprecation warnings).
- **Restormel side:**
  - **Model catalog** and **policies** define which models are available and allowed. Expose a small API or use existing “list models” + “evaluate policy” so a host app can request “allowed models for this project/environment (and optionally route).”
  - **Embeddable components:** `KeyManager` (provider credentials), **ModelSelector** (pick model; can be filtered by allowed list). From `@restormel/keys-svelte` or `@restormel/keys-react`; or Web Components from `@restormel/keys-elements`. Host app provides API base URL (Restormel dashboard API or SOPHIA proxy), `userId`, and optional theme.
- **SOPHIA side:**
  - Embed **ModelSelector** (and optionally KeyManager) in the philosophy query UI (e.g. settings or query form).
  - Point the components at an API that backs Restormel (dashboard API with auth, or a SOPHIA route that proxies to Restormel and adds session/auth). Optionally, SOPHIA fetches “allowed models” once and passes them into ModelSelector so only valid options are shown.
  - On “run philosophy query,” send the selected model (and any route/environment context) so the server can call Restormel resolve (or use the same route) and then run the query with the resolved provider/model.

**Reference:** Embedding: `packages/svelte` (KeyManager, ModelSelector, CostEstimator), `packages/react` (KeysProvider, KeyManager, ModelSelector, hooks), `packages/elements` (Web Components). Docs: `apps/dashboard/src/routes/keys/docs/compatibility/+page.svelte`, `docs/02-architecture.md`, `docs/01-product-strategy.md` (Mode 2 / Mode 3). BYOK/adapter runbook: `docs/reference/sophia-integration.md`.

---

## 4. Relationship to existing SOPHIA integration runbook

- **sophia-integration.md** covers replacing SOPHIA’s **inline BYOK** with `@restormel/keys`: key storage, Keys middleware, resolve middleware, and refactoring BYOK routes. That remains the basis for **end-user provider credentials** (KeyManager) and server-side resolution when using user keys.
- **This dogfooding plan** adds:
  - **Ingestion pipeline** using Restormel for all ingestion AI calls (platform keys + fallback routes and policies).
  - **Explicit use of routes and policies** in the dashboard, with resolve API as the single place for “which provider/model for this request.”
  - **ModelSelector embedding** so end-users choose models for philosophy queries within Restormel’s catalog and policy constraints.

Implement in this order (or in parallel with clear handoffs): **(0) Remove SOPHIA custom routing/model selection** (see Step 0 and build-agent prompt); (1) ingestion pipeline + resolve API + fallback routes in dashboard; (2) policies as needed; (3) BYOK/adapter per sophia-integration.md if not already done; (4) embedded ModelSelector (and optional KeyManager) in SOPHIA, backed by Restormel API or SOPHIA proxy.

---

## 5. Success criteria (dogfooding as test)

- **Ingestion:** All SOPHIA ingestion AI requests go through Restormel resolve; fallback behaviour is configured in dashboard routes and observed in practice (e.g. step failure → next step).
- **Policies:** At least one policy type (e.g. model allowlist or deprecated_model_block) is configured and affects resolution or allowed model list in SOPHIA.
- **UI:** End-users can select the model for philosophy queries via the embedded ModelSelector; selection is consistent with Restormel routes/policies and catalog.

### Operational checks (bring the wedge CLIs into dogfooding)

Use these checks during the SOPHIA rollout so dogfooding validates the standalone CLIs and the wrapper surface:

- **Doctor** (local setup + inventory + lifecycle warnings):

```bash
npx @restormel/doctor
npx @restormel/doctor --repo
```

If SOPHIA wants CI-stable inventory results, write a manifest:

```bash
npx @restormel/doctor --repo --manifest-out restormel.doctor.manifest.json
```

- **Validate** (credential health gate):

```bash
npx @restormel/validate
```

In CI, treat exit code `3` as “transient-only” (retry once + alert if persistent).

This gives Restormel Keys a single, real-world test: SOPHIA as the first consumer of the full stack (control plane, resolve, fallback, policies, embeddable UI).

---

## Build-agent prompt (SOPHIA repo)

Use the following prompt in the **SOPHIA** project (build agent / Cursor) to perform Step 0 and the replacement work. It is self-contained with Restormel context.

<!-- BEGIN BUILD-AGENT PROMPT - copy from here -->

You are working in the SOPHIA repo. Goal: dogfood Restormel Keys end-to-end by **removing SOPHIA's custom AI routing/model selection/BYOK UI** and replacing it with Restormel Keys control-plane (routes/policies/resolve) + embeddable UI (ModelSelector, optionally KeyManager).

### Context (Restormel Keys)

- Restormel dashboard is live at `https://restormel.dev/keys/dashboard`.
- Restormel supports:
  - **Routes** with **steps** (provider preference + optional model) and route-mode `fallback_chain`.
  - **Policies** (model allowlist/denylist, provider allowlist/denylist, deprecated_model_block, budget_cap, token_cap, etc.).
  - A **resolve endpoint** that returns the chosen provider/model for a request:
    - `POST https://restormel.dev/keys/dashboard/api/projects/[id]/resolve` with body `{ environmentId?, routeId? }`. Auth: Bearer with Restormel Gateway Key.
- Embeddable UI packages:
  - `@restormel/keys-react` (React): `KeysProvider`, `ModelSelector`, `KeyManager`, `CostEstimator`.
  - `@restormel/keys-elements` (Web Components).
- Integration runbook in restormel-keys repo: `docs/reference/sophia-integration.md` (KeyStorage adapter + middleware; **no secrets committed**).
- Dogfooding plan: `docs/reference/sophia-dogfooding-plan.md` in restormel-keys.

### What to remove/replace in SOPHIA (first step)

- **Remove:** Internal modules that select models/providers directly (custom router, fallback chains, provider health checks, bespoke model allowlists). Any UI that presents model choice using SOPHIA-specific logic. Any custom BYOK settings panel that duplicates KeyManager/ModelSelector.
- **Keep:** Billing/wallet/top-ups/founder logic. Auth/session model. Ingestion pipeline orchestration (jobs/workers); replace only *how* model/provider is chosen.

### Replacement architecture in SOPHIA

**A) Ingestion pipeline (platform-side)**  
- Add a server module (e.g. `src/lib/server/restormel-keys.ts`) that calls Restormel resolve before each ingestion AI call and uses the returned provider/model. Use env: `RESTORMEL_GATEWAY_KEY`, `RESTORMEL_PROJECT_ID`, `RESTORMEL_ENVIRONMENT_ID`, optional `RESTORMEL_ROUTE_ID`. Do not commit secrets; document placeholders only.

**B) End-user model selection**  
- Replace SOPHIA's model picker with Restormel's **ModelSelector** (`@restormel/keys-react` if React/Next). Only show models allowed for the context (from Restormel catalog/policies or a SOPHIA proxy). On "run philosophy query," pass selected model (and route/environment context) so server calls Restormel resolve and runs the request.

**C) BYOK (optional in step 1)**  
- If SOPHIA has end-user BYOK: follow `docs/reference/sophia-integration.md` for KeyStorage and key CRUD with `@restormel/keys`; do not change API contracts; do not log raw keys. If not needed for first milestone, skip KeyManager and only embed ModelSelector + server-side resolve.

### Concrete tasks

1. **Inventory** SOPHIA: list files/modules for (a) provider routing/fallback, (b) model selection, (c) BYOK UI. Decide: delete, deprecate behind flag, or replace in-place.
2. **Implement** a minimal typed client that calls Restormel resolve (with validation; no keys in errors).
3. **Replace** ingestion selection: before each AI call, call resolve with env+route; use returned provider/model; remove custom fallback logic.
4. **Replace** UI: swap model dropdown/selector with `ModelSelector`; preserve loading/error/empty and accessibility.
5. **Tests:** Update tests for new selection source; add integration test that mocks Restormel resolve and asserts correct provider/model.
6. **Secrets:** Document env placeholders only; no real values committed.

### Acceptance criteria

- **One** source of truth for routing and fallback: Restormel routes/steps.
- No custom "choose provider/model" logic in the ingestion path.
- Product UI uses Restormel ModelSelector (or thin wrapper) for end-user model selection.
- No unintentional API contract breaks (especially BYOK if present).
- No raw keys in logs, errors, tests, or docs.

If the browser needs model/list data, expose a SOPHIA proxy that uses SOPHIA auth and never exposes gateway keys client-side.

<!-- END BUILD-AGENT PROMPT -->
