# SOPHIA dogfood findings — Restormel Keys Phase 5

**Status:** Canonical (findings from first real integration)
**Date:** March 2026
**Source:** SOPHIA app integration through Phase 5A

---

## Current state

Core integration is working in SOPHIA through Phase 5, including the real packaged KeyManager. The remaining issues are no longer "can't integrate at all" blockers; they are mostly product, package, and component-contract gaps that forced app-specific glue.

---

## Latest Sophia handoff (March 2026)

### What is fixed in Sophia (host-side)

- **BYOK add + Anthropic validation now works.**
- **Models now appear in the Sophia UI.**
- **Deploy wiring fix:** `deploy.yml` now passes `RESTORMEL_*` values to Cloud Run.
- **BYOK spinner hardening:** `SettingsTab.svelte` now has timeout + visible retry path.
- **Selector resilience fix:** Sophia fixed a local bug where one failed per-model check could break the whole allowed-model list.

### What remains mostly Restormel-side (cross-consumer)

1. **Svelte package reliability / publish quality**
   - Sophia hit a production crash due to a malformed `@restormel/keys-svelte` publish path.
   - **Update (March 2026):** Repo now has corrected `exports`, a **pack + external SvelteKit smoke** script (`scripts/smoke-keys-svelte-republish.sh`), CI job `keys-svelte-republish-smoke`, and publish workflow steps for `@restormel/keys-svelte`. **npm republish** still requires a maintainer tag push with `NPM_TOKEN`; consumers should verify with `npm view @restormel/keys-svelte version` after release.
2. **Model/catalog alignment for existing providers**
   - Valid key and working policy checks can still feel broken when seeded allowlists/examples and current model IDs drift.
   - **Update (March 2026):** Hybrid governance: `pnpm run check:catalog-drift` enforces that dashboard `model-catalog-seed.json` covers every default model ID for **openai, anthropic, google** (`CATALOG_DRIFT_SYNC_PROVIDER_IDS`). See [catalog-governance.md](catalog-governance.md). Other vendors may still list more IDs in `@restormel/keys` than the seed until coverage expands.
3. **First-class filtered-models contract**
   - Host apps should not need fragile per-model evaluate loops.
   - **Update (March 2026):** `@restormel/keys/dashboard` exports `filterModelsByPolicy`, status types, `groupedModelsForModelSelector`, `policyAvailabilityMapFromEntries`, and `filterProviderDefinitionsByAllowedPolicy` (see `packages/core/README.md`). Hosts can drop sequential evaluate loops in favour of one batch call + these helpers.
4. **Stronger degraded/error contracts in packaged UI**
   - Hosts still wrap loading/degraded/retry/empty/current-selection/auto-routing behavior.
   - **Update (March 2026):** ModelSelector supports optional **`policyAvailability`**, **`retryNonce` / `onRetry`**, **`onStatusChange`** including **`degraded`** when no model is selectable, built-in **Retry** on load failure, and Restormel-oriented error copy. KeyManager exposes **`onStatusChange`** (`empty` | `list` | `entry`) and **`requireRemoveConfirm`** (default **true**). Hosts still own selection persistence and routing; wrapper surface is reduced for policy + availability + remove confirmation.

### Important lesson from Sophia production

- **Valid key != model selectable.** Integrators and users conflate this unless product/docs separate:
  - credential validity
  - model catalog support
  - policy allowlist status
- **Catalog/policy alignment currently matters more than adding more providers.**

---

## Highest-priority improvements

### 1. Publish and support the UI packages as real consumer packages

`@restormel/keys-svelte` still had to be consumed from a local packed tarball for dogfooding. Before external beta, the UI packages need to be installable from npm and covered by release smoke tests.

### 2. Make KeyManager async-persistence aware

~~KeyManager validates locally, calls `onKeyAdded`, and closes immediately. It does not await host persistence or show save/remove failure states.~~ **Resolved:** `onKeyAdded` and `onKeyRemoved` now accept `Promise<KeyAddResult>` / `Promise<KeyRemoveResult>`. The component shows saving/removing states, displays inline errors on `{ ok: false }`, and only closes on success.

### 3. Give KeyManager a richer key-status model

~~The component currently behaves like a thin credential shell. It does not model status, validation timestamps, errors, or revalidation.~~ **Resolved:** KeyManager now accepts `KeyRecord[]` (extends `KeyConfig` with `id`, `status`, `validatedAt`, `lastError`, `fingerprint`, `metadata`). Supported statuses: `active`, `pending_validation`, `invalid`, `revoked`. Detail view shows all metadata. Revalidate button appears when `onValidate` is provided.

### 4. Add first-class server-side validation support

~~The current package model assumes provider validation can happen from the browser via `validateKey`.~~ **Resolved:** KeyManager now accepts an `onValidate` prop: `(provider, rawCredential) => Promise<ProviderValidationResult>`. When provided, the component calls this instead of `provider.validateKey`, so the host app can route validation through its own server. Documented in `packages/core/README.md` with a full server-side validation example.

### 5. Expand the built-in provider story

~~SOPHIA's BYOK matrix is wider than the built-in package provider set.~~ **Resolved:** First-party providers expanded from 5 to 13: OpenAI, Anthropic, Google (with `vertex`/`gemini` aliases), Mistral, Groq, Together, DeepSeek, Fireworks, Cohere, Perplexity, Azure OpenAI, OpenRouter, Portkey. Custom provider definitions documented as a normal integration path with `defineProvider()` helper. `resolveProviderId(id, providers)` handles alias lookup.

### 6. Expand the icon/branding story for providers

~~The packaged icon set is too sparse for wider BYOK matrices.~~ **Resolved:** Icons for all 13 first-party providers plus aliases. `ProviderDefinition.icon` allows host apps to supply custom SVG icons that override built-ins. `getProviderIcon(id, customIcon?)` in `@restormel/keys-svelte`.

---

## API / component contract changes needed

### KeyManager add flow

~~KeyManager should support a host-driven add flow, not just `onKeyAdded(key, rawCredential)`.~~ **Resolved:** `onKeyAdded` now returns `Promise<KeyAddResult>` where `KeyAddResult = { ok: boolean, error?: string, savedKey?: KeyRecord }`. Component awaits result, shows saving state, displays inline error on failure, closes only on success.

### KeyManager remove flow

~~Same issue as add: remove should be awaitable and failure should stay visible in the component.~~ **Resolved:** `onKeyRemoved` now returns `Promise<KeyRemoveResult>` where `KeyRemoveResult = { ok: boolean, error?: string }`. Component shows removing state and inline error on failure.

### Richer item metadata

~~KeyManager should accept richer item metadata than `KeysInstance.config.keys`.~~ **Resolved:** `KeyRecord` extends `KeyConfig` with `id`, `status` (`active` | `pending_validation` | `invalid` | `revoked`), `validatedAt`, `lastError`, `fingerprint`, `metadata`. Detail view renders all fields. Colour-coded status badges.

### Typed backend helper for evaluate and resolve

SOPHIA had to build its own structured error parsing and policy-aware wrapper. A small official helper would reduce repeated app glue.

**Update:** `@restormel/keys/dashboard` now exports `resolve()`, `evaluatePolicies()`, and typed error guards (`isPolicyBlocked`, `isNoRoute`, `isUsageLimitReached`). This covers the basic case; further improvements may still be needed as more apps integrate.

### Centralize provider normalization

~~`google` -> `vertex` still creates unnecessary app-side mapping.~~ **Resolved:** `googleProvider` now has `aliases: ["vertex", "google-ai", "gemini"]`. `resolveProviderId(id, providers)` looks up by id or alias. UI components use `getProviderDef()` internally which checks aliases. Icons registered for both `google` and `vertex`.

---

## Docs improvements needed

### Phase 5 should be explicit about integration reality

The packaged UI components are host-integrated shells, not complete drop-ins. Real apps still need:

- Persistence
- Validation strategy
- Sometimes a server proxy
- Sometimes native diagnostics around the component

**Update:** Phase 5 walkthrough and Framework compatibility page now include package-availability callouts and headless fallback guidance.

### Keep the headless fallback as a first-class path

This is important and now mostly correct. Keep showing:

- Server-side allowed-models proxy
- App-owned picker
- App-owned key custody UI

That path works today.

### Clarify route model semantics and resolve boundary

Sophia validation highlighted two semantics that must be explicit in docs and operator UX:

- **Shared generic routes vs dedicated stage-aware routes** accept different runtime context shapes.
- **Resolve success != host execution success**; host runtime credential/capability checks still apply after resolve.

Canonical guides:

- [Choosing a route model](../guides/choosing-route-model.md)
- [From resolve to execution](../guides/resolve-to-execution-contract.md)

### Add a real packaged KeyManager integration example

~~Not just a demo that stores directly through a toy endpoint.~~ **Resolved:** `packages/core/README.md` §8 now shows a full Next.js/React example with `onValidate` (server-side validation), `onKeyAdded` (async persistence with error handling), and `onKeyRemoved` (async removal). Documents `KeyRecord` metadata and all supported statuses.

### Be explicit about the two different fallback meanings

This was a recurring source of ambiguity:

- **Restormel route-step fallback:** Steps within a route (provider A -> provider B)
- **App-side fallback:** App falls back to legacy routing when Restormel is unavailable

### Document that host apps may need custom provider definitions

~~That is not an edge case. It is normal for real products with broader provider coverage or stricter custody rules.~~ **Resolved:** `packages/core/README.md` §7 documents `defineProvider()`, custom icon via `ProviderDefinition.icon`, `resolveProviderId()` for alias lookup, and passing custom providers alongside built-ins.

---

## Dashboard / product ergonomics

### Policy testing

A built-in evaluate/test surface would reduce API-only debugging.

**Update:** Policy detail page now has a "Test policy" form (project, environment, model, provider) that calls evaluate via session and displays allowed/blocked + violations.

### Policy binding visibility

Users need to see more clearly what is bound where and why a route was blocked.

**Update:** Policy detail page now resolves binding `targetId` to human-readable labels (workspace name, project name, environment + project, route + project) and supports add/remove bindings from the UI.

### Route-step fallback

Current semantics are now better documented, but future product work could make fallback more health/key-aware.

---

## Exact workarounds used in SOPHIA

1. Installed `@restormel/keys-svelte` from a local tarball instead of npm.
2. Built app-owned provider definitions to cover SOPHIA's full BYOK provider set.
3. Added a server-side raw-validation endpoint so KeyManager would not validate credentials directly against providers from the browser.
4. Kept SOPHIA's native BYOK diagnostics UI because KeyManager does not show validation timestamps, last errors, or revalidate controls.
5. Kept app-side provider normalization and structured resolve error handling.

---

## Priority order for next work

1. **Fix and republish `@restormel/keys-svelte` safely** (export correctness + external SvelteKit smoke test in dev/prod).
2. **Expand and align model catalog for supported providers** (catalog, seeded allowlists, route examples, docs, and UI IDs stay current and consistent).
3. **Add a first-class filtered-models/server-helper path** (remove fragile host-side per-model evaluate loops).
4. **Improve component degraded/error contracts and docs** (built-in/loading/degraded/retry/empty expectations and host obligations).
5. Then reassess how much wrapper logic host apps like Sophia still need.

---

## Follow-up after Sophia refactor (March 2026)

After SOPHIA refactored to the new KeyManager contract (onValidate, async onKeyAdded/onKeyRemoved, KeyRecords, first-party providers, alias-aware resolution), the following were raised and addressed in Restormel:

### Addressed in Restormel

- **KeyRecord.updatedAt** — Added as a first-class field (ISO 8601) so hosts don't need to store it in `metadata.updatedAt`.
- **Revalidate callback** — Added **`onRevalidate(keyId, provider)`** so revalidation is explicit instead of overloading `onValidate` with `rawCredential === ""`. KeyManager still falls back to `onValidate(provider, "")` when `onRevalidate` is not provided (backwards compat).
- **Provider canonicalization for storage** — Added **`canonicalizeProviderId(id, providers)`** so hosts can persist a single canonical id (e.g. `google`) when the UI or upstream may use an alias (e.g. `vertex`).
- **xAI and Voyage as first-party** — Added **xai** (Grok) and **voyage** (Voyage AI) provider definitions and icons. SOPHIA can drop custom definitions for these and use built-ins.
- **Validate-then-persist** — Documented in `packages/core/README.md` §8: host save endpoint can skip second validation when client already used `onValidate`, or validate again and return `{ ok: false }` (and optionally delete the just-saved key) to keep UI consistent.

### Remaining / host-side

- **Canonical id vs stored id** — If a host (e.g. SOPHIA) historically stored `vertex` as the provider id, it may still need one alias-aware translation from Restormel's canonical `google` to the stored `vertex` when loading keys into the UI. Using `canonicalizeProviderId` when *saving* keeps new records consistent; existing data may need a one-time migration or a thin mapping layer when hydrating KeyRecords.
- **Duplicate validation on persist** — If the host's save endpoint validates again on persist, the add flow can do two validation passes. Restormel documents the options (skip second validation, or validate and roll back on failure); eliminating duplication is a host responsibility (e.g. accept a `preValidated: true` flag from the client).

---

## Second refactor (defaultProviders, onRevalidate, updatedAt, canonicalize)

Sophia completed a second refactor to use Restormel’s latest contract and providers.

### What Sophia did

- **Provider list** — Derives KeyManager provider list from Restormel’s **`defaultProviders`**; no custom provider list.
- **onRevalidate** — SettingsTab.svelte uses the new **`onRevalidate`** prop instead of the empty-string `onValidate` sentinel.
- **KeyRecord.updatedAt** — Maps **`updatedAt`** at the top level when building KeyRecords; no longer uses `metadata.updatedAt`.
- **xAI / Voyage** — Removed custom `defineProvider` definitions; uses first-party **xaiProvider** and **voyageProvider** from Restormel.
- **Canonicalization** — Helper layer uses Restormel’s **`canonicalizeProviderId`** and builds UI records from the richer **KeyRecord** shape in key-manager.ts.
- **Packages** — Refreshed local Restormel package tarballs in Sophia’s package.json.

### Remaining issues / gaps

- **Vertex vs google in storage** — Sophia still stores Google Gemini BYOK under historical **vertex** ids in backend routes/stores. The UI canonicalizes to **google** for display, but the save/revalidate/remove path still translates back to **vertex** for persistence. A clearer storage-canonicalization story for hosts migrating from alias ids would help.
- **Double validation on save** — The save endpoint still performs a second provider validation after client-side `onValidate`. Sophia kept the defensive delete-on-failed-second-validation behaviour because the backend contract has not been relaxed. Making the “validate-then-persist without double validation” path explicit in server examples would let consumer apps remove redundant second validation safely.
- **onRevalidate keyId unused** — KeyManager passes **keyId** and **provider** to `onRevalidate`, but Sophia’s revalidate endpoint is still provider-centric (not key-id-centric), so **keyId** is currently unused by the host callback. If `onRevalidate` is meant to be key-specific, documenting or encouraging server endpoints that accept **keyId** (look up stored credential by keyId, then validate) would align host backends.
- **validate-raw still required** — Sophia’s custody model keeps provider validation server-side; **validate-raw** (or equivalent) is still needed rather than calling providers directly from the browser.

### Suggestions for Restormel (addressed in docs)

- **Storage canonicalization for migration** — Add a clearer story for hosts migrating from alias ids (e.g. vertex) to canonical ids (e.g. google): when to persist canonical id, when to keep a thin translation layer for legacy storage, and optional one-time migration. *Addressed in README §7 and §8 (see below).*
- **Validate-then-persist without double validation** — Make the path explicit in server examples (e.g. save endpoint accepts `preValidated: true` and skips second validation). *Addressed in README §8.*
- **onRevalidate key-id-centric** — Document or encourage revalidate endpoints that accept **keyId** and look up the stored credential by keyId before validating. *Addressed in README §8.*

---

## Phase 5 packaged path (ModelSelector in main flow)

Phase 5 is implemented on the real packaged path in Sophia. **For Sophia’s dogfood goal it is complete enough functionally;** relative to the broader Phase 5 wording and docs, a few things are under-specified or not yet delivered.

### What is delivered in Sophia

- **Packaged ModelSelector** is embedded in the real app flow (via wrapper **RestormelModelSelector.svelte**, provider/key shaping in **model-selector.ts**, app-page swap in **src/routes/app/+page.svelte**).
- **Packaged KeyManager** is embedded in settings (**SettingsTab.svelte**).
- **`/api/allowed-models`** filters models server-side; Gateway Key is kept off the client.
- **Loading, error, retry, and empty states** are implemented around the selector and allowed-models fetch.
- **Custom model overrides** are disabled while policy filtering is active.
- **Server-side validation** is used for BYOK; raw credentials do not go browser-to-provider.

### What is still not delivered (relative to broader Phase 5 wording)

- **No persisted `POST /api/preferences`-style model preference endpoint** — Sophia keeps model choice **request-scoped** instead (selection per request, not stored user preference).
- **No successful in-browser manual verification pass** for keyboard/render/theming — Playwright’s local Chrome session is failing in this environment; Phase 5 is code/test verified only.
- **Theming** is applied through the wrapper/tokens added around the packaged selector, but there was **no full deliberate `--rk-*` pass** across both packaged components as a separate design task.

### What docs/prompts still under-specify

- The **prompts do not explicitly ask** the agent to **replace** the app’s existing picker with the packaged ModelSelector (they say “embed” and “identify UI to replace” but don’t require the swap).
- They **do not cover** the case where model choice is **request-scoped** instead of persisted preferences (walkthrough mentions both in passing; prompts don’t call it out).
- They **do not mention** that ModelSelector **may need a host wrapper** for auto mode, selected-state display, and host-owned loading/error/empty when allowed-models come from the host’s API.
- They **do not require** a **theming pass** beyond “apply tokens” (no explicit “deliberate `--rk-*` across both components” as a design task).
- They **do not force** an explicit **manual accessibility/browser verification step** with a fallback when browser tooling (e.g. Playwright) is unavailable.

### Main component finding: ModelSelector not fully host-controlled

The packaged ModelSelector is **usable** but not fully host-controlled. Sophia had to wrap it to preserve:

- **Current-selection visibility** — Host needs to show and persist the currently selected model in the request/app context.
- **Request-scoped auto routing** — Selection drives resolve/routing for the current request; the host owns that wiring.
- **Host-owned loading / error / empty states** — Loading while allowed-models are fetched, error and retry when the fetch fails, empty state when no models are allowed.
- **Retry and disabled behavior** — Around the `/api/allowed-models` fetch.

**Suggestion for Restormel:** Make ModelSelector more host-controllable so wrappers can be thinner or unnecessary: expose or support **current selection** (controlled or visible to host), **loading/error/empty** slots or callbacks, and **retry/disabled** behavior when the allowed-models source is loading or has failed. Document the pattern when the host fetches allowed models from its own API and passes them in.

### Verification (Sophia)

- **Tests:** `model-selector.test.ts`, `key-manager.test.ts`, `allowed-models.test.ts`, `resolve-provider.test.ts`, `validate-raw.test.ts` — passed.
- **pnpm check** — passed.
- **Browser visual smoke** — not completed (Playwright Chrome persistent-session launch failing). Phase 5 is code/test verified only.

### Conclusion

- **For Sophia’s dogfood goal:** yes — enough to complete Phase 5 pragmatically.
- **For “everything the documentation alludes to”:** no — there are still under-specified areas; completing the phase cleanly required interpreting the walkthrough, compatibility/docs updates, and component behavior rather than the two prompts alone.

---

**Related docs:**

- [sophia-dogfooding-plan.md](sophia-dogfooding-plan.md) — original dogfooding plan
- [sophia-integration.md](sophia-integration.md) — integration runbook
- [npm-packages.md](npm-packages.md) — package availability and install paths
