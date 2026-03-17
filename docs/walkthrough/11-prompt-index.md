# Prompt Index

> **Status:** Proposed. Single collection of every build-agent prompt from the walkthrough, numbered for reference, with full context doc links. Use this as the execution companion alongside the walkthrough pages.

Execute prompts in order. Each prompt's **Context docs** list must be read (or provided to your coding agent) before running the prompt. Gates must pass before proceeding to the next prompt.

---

## Prompt inventory

| # | Prompt name | Source page | Phase |
|---|------------|-------------|-------|
| P01 | `inventory-current-routing` | [Phase 0](./02-phase-0-inventory.md) §0.3 | 0 |
| P02 | `add-feature-flag` | [Phase 0](./02-phase-0-inventory.md) §0.5 | 0 |
| P03 | `install-and-configure` | [Phase 1](./03-phase-1-install.md) §1.7 | 1 |
| P04 | `create-resolve-client` | [Phase 2](./04-phase-2-resolve.md) §2.5 | 2 |
| P05 | `create-local-resolve` | [Phase 2](./04-phase-2-resolve.md) §2.6 | 2 |
| P06 | `wire-route-ids` | [Phase 3](./05-phase-3-routes.md) §3.5 | 3 |
| P07 | `add-policies-and-error-handling` | [Phase 4](./06-phase-4-policies.md) §4.6 | 4 |
| P08 | `embed-ui-components` | [Phase 5](./07-phase-5-ui.md) §5.7 | 5 |
| P09 | `create-smoke-test` | [Phase 6](./08-phase-6-golive.md) §6.4 | 6 |
| P10 | `remove-legacy-routing` | [Phase 6](./08-phase-6-golive.md) §6.5 | 6 |
| P11 | `migrate-from-litellm` | [Migration paths](./09-migration-paths.md) Variant B | Migration |
| P12 | `add-ci-verification` | [Verification strategy](./10-verification-strategy.md) §5 | Ongoing |

---

## P01 — `inventory-current-routing`

**Phase:** 0  **Source:** [02-phase-0-inventory.md](./02-phase-0-inventory.md) §0.3

**Context docs:**
- `docs/walkthrough/02-phase-0-inventory.md` — the audit framework
- `docs/reference/sophia-dogfooding-plan.md` — §0 "Remove SOPHIA custom routing" (reference pattern)
- `docs/reference/sophia-integration.md` — §2 "Create keys-adapter" (adapter pattern)
- `docs/02-architecture.md` — §1 "Framework compatibility" and §2 "Package structure"

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Audit the codebase to produce a routing inventory for Restormel Keys integration.
>
> **Steps:**
> 1. Search for all AI provider SDK imports (`openai`, `@anthropic-ai/sdk`, `@google/generative-ai`, or equivalent). List every file that creates a provider client or calls a completion/chat endpoint.
> 2. For each file found, trace backwards: what decides which provider and model to use? List the routing/selection logic files.
> 3. Search for model selection UI (dropdowns, selectors, settings pages). List those components.
> 4. Search for BYOK / key management code. List those files.
> 5. For each item, classify as REMOVE (Restormel replaces it), KEEP (app-specific), or WRAP (insert resolve before existing call).
> 6. Document the current provider call pattern for at least one primary entry point.
> 7. Write results to `docs/restormel-integration/00-routing-inventory.md`.
>
> **DO NOT:** Delete or modify any existing code. Commit real API keys. Guess — trace actual code paths.

**Gate:** Routing inventory document exists with classified files and at least one documented call pattern.

---

## P02 — `add-feature-flag`

**Phase:** 0  **Source:** [02-phase-0-inventory.md](./02-phase-0-inventory.md) §0.5

**Context docs:**
- `docs/walkthrough/02-phase-0-inventory.md` — §0.5 feature flag pattern
- `docs/walkthrough/04-phase-2-resolve.md` — Phase 2 (where the flag gets used)
- `docs/walkthrough/08-phase-6-golive.md` — Phase 6 (where the flag gets flipped)

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Add a feature flag `USE_RESTORMEL_KEYS` to gate the integration.
>
> **Steps:**
> 1. Create a feature flags module exporting `USE_RESTORMEL_KEYS` from `process.env`, defaulting to `false`.
> 2. In each provider resolution function (from inventory), add a conditional: if flag true, call placeholder `restormelResolve()` (throws "not yet implemented"); otherwise call existing logic.
> 3. Add `USE_RESTORMEL_KEYS=false` to `.env.example`.
> 4. Verify app starts with no behaviour change.
>
> **DO NOT:** Set flag to `true`. Modify existing routing logic. Implement `restormelResolve`. Commit secrets.

**Gate:** App starts unchanged. Flag in `.env.example`. Conditional branch in place.

---

## P03 — `install-and-configure`

**Phase:** 1  **Source:** [03-phase-1-install.md](./03-phase-1-install.md) §1.7

**Context docs:**
- `docs/walkthrough/03-phase-1-install.md` — this phase
- `docs/02-architecture.md` — §1 framework compatibility, §2 package structure
- `docs/walkthrough/02-phase-0-inventory.md` — routing inventory (confirms framework)
- `packages/core/src/keys.ts` — `createKeys` function
- `packages/cli/README.md` — CLI commands
- `docs/ux-contracts.md` — canonical Dashboard URLs

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Install Restormel Keys packages, scaffold config, prepare env vars.
>
> **Steps:**
> 1. Read routing inventory to confirm framework.
> 2. Install correct packages (Next.js: core + react + elements; SvelteKit: core + svelte; server-only: core).
> 3. Run `npx @restormel/keys-cli init`.
> 4. Add to `.env.example`: `RESTORMEL_GATEWAY_KEY=`, `RESTORMEL_PROJECT_ID=`, `RESTORMEL_ENVIRONMENT_ID=`, `USE_RESTORMEL_KEYS=false`.
> 5. Run `npx @restormel/keys-cli doctor` — confirm exit 0.
> 6. Commit config, `.env.example`, `package.json`, lockfile.
>
> **DO NOT:** Commit real keys. Add values to `.env.example`. Modify application code. Install wrong packages.

**Gate:** `keys doctor` exits 0. Config committed. `.env.example` lists four vars. No secrets committed.

---

## P04 — `create-resolve-client`

**Phase:** 2  **Source:** [04-phase-2-resolve.md](./04-phase-2-resolve.md) §2.5

**Context docs:**
- `docs/walkthrough/04-phase-2-resolve.md` — resolve client, feature flag wiring, error handling
- `docs/walkthrough/02-phase-0-inventory.md` — identifies legacy resolve function
- `packages/core/src/server/resolve.ts` — resolve middleware (response shape)
- `packages/core/src/router.ts` — `ResolveResult`, `NO_KEY_AVAILABLE`
- `docs/reference/sophia-dogfooding-plan.md` — §1 and build-agent prompt
- `docs/reference/sophia-integration.md` — §5 resolve handler

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Create typed resolve client, wire into feature flag, add error handling with legacy fallback.
>
> **Steps:**
> 1. Read routing inventory to identify legacy resolve function.
> 2. Create `src/lib/server/restormel.ts` with `ResolveRequest`/`ResolveResponse` interfaces and `restormelResolve()`.
> 3. Create/update `src/lib/server/resolve-provider.ts`: flag true → resolve in try/catch with legacy fallback; flag false → legacy.
> 4. Add `RESTORMEL_BASE_URL=https://restormel.dev/keys/dashboard` to `.env.example` (optional override; defaults to this URL).
> 5. Create `scripts/test-resolve.ts`.
> 6. Verify: flag off → unchanged; flag on → Restormel resolve returns `{ data: { providerType, modelId } }`; invalid key → legacy fallback.
>
> **DO NOT:** Default flag to true. Log Gateway Key. Modify legacy logic. Remove code. Commit secrets.

**Gate:** Test script prints valid response. Flag off → unchanged. Flag on → Restormel. Invalid key → fallback. No secrets.

---

## P05 — `create-local-resolve`

**Phase:** 2 (optional)  **Source:** [04-phase-2-resolve.md](./04-phase-2-resolve.md) §2.6

**Context docs:**
- `docs/walkthrough/04-phase-2-resolve.md` — §2.6 local resolve
- `packages/core/src/keys.ts` — `createKeys`, `KeysInstance`
- `packages/core/src/router.ts` — `createRouter`, `ResolveResult`
- `packages/core/src/server/resolve.ts` — `createResolveMiddleware`
- `docs/reference/sophia-integration.md` — §2 keys-adapter
- `docs/02-architecture.md` — §2 package structure

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Create local Keys instance for in-process resolve (no HTTP).
>
> **Steps:**
> 1. Create `src/lib/server/restormel-local.ts`.
> 2. Import `createKeys` and providers from `@restormel/keys`.
> 3. Configure with `routing.defaultProvider`, `routing.rules`, `getPlatformKey` from env vars.
> 4. Export `keys` instance.
> 5. Add local resolve as path option in resolve-provider.
> 6. Verify: `keys.resolve('openai', 'gpt-4o')` returns correct result.
>
> **DO NOT:** Remove HTTP client. Hardcode keys. Import UI in server code. Commit secrets.

**Gate:** `keys.resolve()` valid. Both paths available. Flag defaults off.

---

## P06 — `wire-route-ids`

**Phase:** 3  **Source:** [05-phase-3-routes.md](./05-phase-3-routes.md) §3.5

**Context docs:**
- `docs/walkthrough/05-phase-3-routes.md` — route/step model, wiring pattern
- `docs/walkthrough/04-phase-2-resolve.md` — resolve client and flag
- `docs/reference/sophia-dogfooding-plan.md` — §1 and §2
- `apps/dashboard/src/routes/keys/dashboard/api/projects/[id]/resolve/+server.ts` — resolve endpoint
- `packages/core/src/router.ts` — fallback chain logic

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Update resolve wrapper to accept `routeId`, update all call sites.
>
> **Steps:**
> 1. Update `resolveProvider` to accept `{ routeId?, model? }`.
> 2. Pass `routeId` to `restormelResolve`.
> 3. Read inventory, identify call sites, update each with appropriate `routeId`.
> 4. Create additional dashboard routes if needed.
> 5. Verify: flag on → each call site resolves through intended route.
>
> **DO NOT:** Change legacy path. Reference non-existent routes. Remove error handling. Commit secrets.

**Gate:** Call sites pass `routeId`. Correct routes resolve. Legacy unchanged. Fallback works.

---

## P07 — `add-policies-and-error-handling`

**Phase:** 4  **Source:** [06-phase-4-policies.md](./06-phase-4-policies.md) §4.6

**Context docs:**
- `docs/walkthrough/06-phase-4-policies.md` — policy types, evaluate endpoint
- `docs/walkthrough/04-phase-2-resolve.md` — resolve error handling
- `docs/reference/sophia-dogfooding-plan.md` — §2 policies
- `apps/dashboard/src/routes/keys/dashboard/api/policies/evaluate/+server.ts` — evaluate endpoint
- `packages/core/src/entitlements.ts` — entitlements engine
- `docs/01-product-strategy.md` — §5 product modes

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Distinguish policy errors from network/auth errors in resolve handling.
>
> **Steps:**
> 1. In catch block, parse for budget/cap, `no_key_available`, deprecated/blocked.
> 2. Log each distinctly.
> 3. Optionally add budget alert mechanism.
> 4. Legacy fallback still runs.
> 5. Verify: low budget cap → caught and logged, legacy runs.
>
> **DO NOT:** Change legacy fallback. Remove Phase 2 handling. Expose raw errors. Commit secrets.

**Gate:** Policy errors logged distinctly. Legacy runs on failure. No raw errors to users.

---

## P08 — `embed-ui-components`

**Phase:** 5  **Source:** [07-phase-5-ui.md](./07-phase-5-ui.md) §5.7

**Context docs:**
- `docs/walkthrough/07-phase-5-ui.md` — embedding patterns
- `docs/02-architecture.md` — framework compatibility, package structure
- `packages/react/README.md` — React wrapper API
- `packages/svelte/src/ModelSelector.test.ts` — ModelSelector props
- `packages/elements/README.md` — Web Component API
- `docs/ux-contracts.md` — §3 state conventions
- `docs/reference/sophia-dogfooding-plan.md` — §3 UI embedding
- `docs/reference/sophia-integration.md` — §2 KeyStorage pattern

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Embed ModelSelector (and optionally KeyManager) in settings page.
>
> **Steps:**
> 1. Read inventory for existing UI to replace.
> 2. Embed ModelSelector per framework (React: KeysProvider + client component; SvelteKit: direct; Web Components: element + JS props).
> 3. Wire `onSelect` to save preference.
> 4. (If BYOK) Embed KeyManager with callbacks to key API.
> 5. Add `--rk-*` CSS overrides.
> 6. Handle loading/error/empty states.
> 7. Verify: renders, callbacks fire, theme applies, keyboard nav works.
>
> **DO NOT:** Import UI in server code. Log raw keys. Skip states. Hardcode models. Commit secrets.

**Gate:** ModelSelector renders + callbacks. KeyManager (if used) works. Theme applies. States handled. Keyboard works.

---

## P09 — `create-smoke-test`

**Phase:** 6  **Source:** [08-phase-6-golive.md](./08-phase-6-golive.md) §6.4

**Context docs:**
- `docs/walkthrough/08-phase-6-golive.md` — smoke test, post-cutover
- `docs/walkthrough/04-phase-2-resolve.md` — resolve endpoint
- `docs/walkthrough/06-phase-4-policies.md` — evaluate endpoint
- `docs/runbooks/zuplo-setup.md` — §7 validation pattern
- `packages/cli/README.md` — doctor/validate
- `docs/testing-strategy.md` — verification scope

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Create post-cutover smoke test script.
>
> **Steps:**
> 1. Create `scripts/smoke-test-restormel.sh` (bash, executable).
> 2. Resolve call, evaluate for allowed + blocked, `keys doctor`, `keys validate`. Exit 0/1.
> 3. Read from env vars — no hardcoded secrets.
> 4. Add `"smoke:restormel"` to package.json scripts.
> 5. Verify in staging.
>
> **DO NOT:** Hardcode secrets. Make destructive calls. Skip doctor/validate.

**Gate:** `pnpm run smoke:restormel` exits 0 in staging. No hardcoded secrets.

---

## P10 — `remove-legacy-routing`

**Phase:** 6 (post-burn-in)  **Source:** [08-phase-6-golive.md](./08-phase-6-golive.md) §6.5

**Context docs:**
- `docs/walkthrough/08-phase-6-golive.md` — §6.5 removal scope
- `docs/walkthrough/02-phase-0-inventory.md` — REMOVE items
- `docs/walkthrough/04-phase-2-resolve.md` — flag and legacy fallback
- `docs/reference/sophia-dogfooding-plan.md` — §0 removal pattern
- `docs/reference/sophia-integration.md` — what to keep

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Remove legacy routing after Restormel handles all traffic.
>
> **Steps:**
> 1. Delete every REMOVE item from inventory.
> 2. Remove flag, remove `legacyResolve`, always use `restormelResolve` (keep try/catch with safe default).
> 3. Remove flag module if single-purpose.
> 4. Remove flag vars from `.env.example`.
> 5. Remove replaced UI components.
> 6. Remove unused env vars.
> 7. Run tests. Run smoke test.
>
> **DO NOT:** Remove KEEP items. Remove error handling. Remove env vars used elsewhere. Remove smoke test.

**Gate:** REMOVE items deleted. Flag gone. Always Restormel. Tests pass. Smoke passes.

---

## P11 — `migrate-from-litellm`

**Phase:** Migration  **Source:** [09-migration-paths.md](./09-migration-paths.md) Variant B

**Context docs:**
- `docs/walkthrough/09-migration-paths.md` — Variant B
- `docs/walkthrough/02-phase-0-inventory.md` — inventory framework
- `docs/walkthrough/05-phase-3-routes.md` — route/step model
- `docs/walkthrough/06-phase-4-policies.md` — policy types
- `docs/02-architecture.md` — package structure
- `docs/01-product-strategy.md` — §8 competitive positioning

**Prompt:**

> You are working in [your app repo] which uses LiteLLM.
>
> **Goal:** Inventory LiteLLM and produce migration plan.
>
> **Steps:**
> 1. Locate LiteLLM config.
> 2. Extract: models, fallback, allowed/blocked, budget, key env var names.
> 3. Locate all proxy calls.
> 4. Map to Restormel: models → steps, fallback → fallback_chain, allowed → allowlist policy, budget → budget_cap.
> 5. Decide: remove LiteLLM or keep as normalisation layer.
> 6. Write to `docs/restormel-integration/01-litellm-migration.md`.
>
> **DO NOT:** Remove LiteLLM yet. Copy real keys. Assume unconfigured features.

**Gate:** Migration plan maps features. Includes keep/remove decision.

---

## P12 — `add-ci-verification`

**Phase:** Ongoing  **Source:** [10-verification-strategy.md](./10-verification-strategy.md) §5

**Context docs:**
- `docs/walkthrough/10-verification-strategy.md` — CLI checks, smoke tests, CI
- `docs/walkthrough/08-phase-6-golive.md` — smoke test script
- `packages/cli/README.md` — doctor/validate
- `docs/testing-strategy.md` — testing strategy
- `.github/workflows/ci.yml` — CI workflow

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Add Restormel verification to CI.
>
> **Steps:**
> 1. Add CI step: `keys doctor` (fail on non-zero).
> 2. Add CI step: `keys validate` (needs `RESTORMEL_GATEWAY_KEY` secret).
> 3. Add GitHub Actions secret (staging key).
> 4. Optionally add post-deploy smoke test.
> 5. Verify: push PR, both pass.
>
> **DO NOT:** Use production key. Commit secrets. Block on unavailable endpoint.

**Gate:** CI runs doctor + validate. Both pass. Key is Actions secret.

---

## Execution order

**Fresh integration (no prior gateway):**

```
P01 → P02 → P03 → P04 → P06 → P07 → P08 → P09 → [cutover] → P10 → P12
```

P05 (local resolve) is optional, alongside or instead of P04.

**LiteLLM migration:**

```
P11 → P01 → P02 → P03 → P04 → P06 → P07 → P08 → P09 → [cutover] → P10 → P12
```

---

*See [Master index](./00-index.md) for the full walkthrough file listing and reading order.*
