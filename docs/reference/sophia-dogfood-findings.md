# SOPHIA dogfood findings — Restormel Keys Phase 5

**Status:** Canonical (findings from first real integration)
**Date:** March 2026
**Source:** SOPHIA app integration through Phase 5A

---

## Current state

Core integration is working in SOPHIA through Phase 5, including the real packaged KeyManager. The remaining issues are no longer "can't integrate at all" blockers; they are mostly product, package, and component-contract gaps that forced app-specific glue.

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

1. Make the UI packages cleanly consumable from npm.
2. Improve KeyManager to await host persistence and display real async error states.
3. Add richer key-status support and revalidation UX.
4. Add first-class server-side validation integration guidance and helpers.
5. Expand provider definitions/icons for real-world BYOK coverage.

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

**Related docs:**

- [sophia-dogfooding-plan.md](sophia-dogfooding-plan.md) — original dogfooding plan
- [sophia-integration.md](sophia-integration.md) — integration runbook
- [npm-packages.md](npm-packages.md) — package availability and install paths
