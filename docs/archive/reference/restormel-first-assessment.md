# Restormel-first assessment — Sophia production and integration burden

**Status:** Canonical (strategy for where to fix issues: Restormel vs host app)  
**Date:** March 2026  
**Context:** Production symptoms on Sophia; who should own the fix.

---

## Summary

Treat production issues in two layers: (1) **make Restormel Keys do more of the heavy lifting**, with a clearer and more complete integration contract; (2) **then revisit what is genuinely left as Sophia-specific glue**. Right now too much operational burden sits with the host app. Sophia can be fixed locally, but a meaningful part of what looks like "our bug" is downstream of Restormel not yet owning enough of the integration surface.

**Short version:** The immediate production warning in Sophia is likely caused by deploy not passing `RESTORMEL_*` envs into Cloud Run, and the stuck BYOK panel still needs local debugging. The broader lesson is that **Restormel should take on more integration burden before over-rotating on local fixes**. The Svelte package still behaves like a low-level shell, typings are too weak, and host apps still need wrappers for common UI/runtime behavior. Best path: **strengthen Restormel first** (model filtering, diagnostics, component behavior), **then revisit Sophia** and remove whatever local glue is no longer necessary.

---

## 1. Issues to fix in Sophia — after Restormel does more

These are likely real app-side issues but should be **reassessed after** Restormel improves the integration contract.

| Issue | Notes |
|-------|--------|
| **deploy.yml** | Not wiring `RESTORMEL_*` env/config into Cloud Run. Likely why live model selector shows red degraded warning. Sophia deployment/config issue. |
| **allowed-models/+server.ts** | Evaluates policy eligibility one model at a time, sequentially. Local implementation choice, inefficient. Exists because Sophia hosts its own filtering proxy instead of consuming a higher-level Restormel contract. |
| **SettingsTab.svelte** | No timeout/degraded-state escape hatch for `refreshByokProviders()`. If backend stalls, UI stays on "Loading provider status..." indefinitely. Harden locally. |
| **BYOK settings panel** | Mounts multiple data dependencies at once (BYOK, billing, private sources). Increases perceived fragility; split/lazy-load locally. |
| **Client fetch path** | Does not separate auth failure, hung request, and server failure clearly. Local polish. |

**Key point:** These local issues occur in a setup where the host app still does more orchestration than it ideally should.

---

## 2. Issues in Restormel Keys to fix first (affect many consumers)

Restormel should absorb more of this so host apps need fewer wrappers, workarounds, and custom backend logic.

| Priority | Issue |
|----------|--------|
| **Typings** | Svelte package does not provide strong usable component typings. Published `.d.ts` for KeyManager and ModelSelector are effectively generic `SvelteComponent` exports. Integration more error-prone for typed Svelte consumers. |
| **Component behavior** | **Partially improved (March 2026):** ModelSelector merges server `policyAvailability` with per-model `resolve`, surfaces **`degraded`** when nothing is selectable, and exposes Retry for load failures. KeyManager surfaces view status and optional remove confirmation. Hosts still wrap: current selection persistence, request-scoped routing, and app-specific banners — but less glue for policy/credential availability and remove confirmation. |
| **Model filtering** | **Improved (March 2026):** `@restormel/keys/dashboard` provides `filterModelsByPolicy` plus ModelSelector-oriented helpers (`groupedModelsForModelSelector`, `policyAvailabilityMapFromEntries`, `filterProviderDefinitionsByAllowedPolicy`). Hosts should prefer one batch policy pass + passing `policyAvailability` into ModelSelector over hand-rolled per-model evaluate loops. BYOK and persistence remain host-owned. |
| **Debug surface** | Package is compiled-only, not very introspectable when something goes wrong. Downstream debugging significantly harder. |
| **Runtime contract** | Still too implicit. Docs improved; package/API surface still leaves apps inferring behavior rather than consuming a strongly expressed integration model. |
| **Failure attribution** | When Restormel is misconfigured or unavailable, failure often presents in-host as "component broken" rather than "Restormel backend/config issue." Separation needs to be clearer in component behavior and diagnostics. |

---

## 3. Recommended order of work

1. **Improve Restormel’s integration contract first**
   - Stronger Svelte typings
   - Clearer and richer packaged component APIs
   - Better built-in handling for loading / error / degraded states
   - More complete model-filtering contract so apps do not need so much proxy logic
   - Clearer diagnostics when Restormel config/env/backend is missing or degraded

2. **Then simplify Sophia around that improved contract**
   - Wire the missing `RESTORMEL_*` deploy envs
   - Remove or reduce local wrapper logic where Restormel now covers it
   - Keep only app-specific pieces that are genuinely product-specific

3. **Then reassess what is truly Sophia-only**
   - Separate: real Sophia deployment/config bugs and real Sophia UX hardening
   - From: integration workarounds that only existed because Restormel was incomplete

---

## 4. Sophia post-fix report (what was fixed, and where the burden was)

After the production issues were addressed, the Sophia agent reported:

**Mostly Sophia-side (fixed in the app):**
- **Deploy:** Restormel config existed in the app, but `deploy.yml` was not sending `RESTORMEL_*` into Cloud Run. Fixed in Sophia.
- **BYOK spinner:** `SettingsTab.svelte` needed timeouts and a visible retry path. Fixed in Sophia.
- **“One failed model check breaks the whole selector”:** Bug in Sophia’s `allowed-models/+server.ts`. Fixed in Sophia.

**Why these were easy to hit (Restormel gaps):**
- Restormel currently makes host apps do per-model evaluate orchestration themselves, which pushed Sophia into a brittle local proxy.
- The packaged UI does not own degraded/loading/error handling strongly enough, so host apps build that behavior around it.
- “Restormel misconfigured/unavailable” can look too much like “consumer app UI broken.”

**Restormel-side improvements to extract:**
1. **First-class filtered-models / server-helper path** — so consumer apps do not have to implement fragile per-model evaluation loops themselves.
2. **Stronger component-level degraded/error contracts** — so hosts need fewer wrappers.

---

## 5. Restormel response (implemented)

The two product asks above are addressed in Restormel as follows.

**Filtered-models contract:**  
`@restormel/keys` (dashboard client) now exposes **`filterAllowedModels(options)`**. It takes `projectId`, `environmentId`, `auth`, and `candidates: { providerType, modelId }[]`, calls `evaluatePolicies` in parallel for each candidate, and returns the allowed subset. Apps can replace a custom allowed-models proxy with one call. See `packages/core/src/dashboard/client.ts` and `packages/core/src/dashboard/index.ts`.

**Component degraded/error contracts:**  
`@restormel/keys-svelte` **ModelSelector** now has:
- Built-in **loading** (“Loading availability…”), **error** (with a clear “Restormel backend unavailable. Check RESTORMEL_* configuration.” message), and **empty** (“No models configured.”) states.
- **`onStatusChange(status, message?)`** so the host can show a degraded banner or retry.
- **`errorMessage`** and **emptyMessage** overrides.
- **`RESTORMEL_BACKEND_ERROR_MESSAGE`** exported for consistent copy in host UI.

**Typings:**  
`packages/svelte/src/types.ts` exports **`KeyManagerProps`**, **`ModelSelectorProps`**, **`CostEstimatorProps`**, **`ModelSelectorStatus`** so typed Svelte consumers get explicit props instead of generic `SvelteComponent`.

Sophia can now adopt `filterAllowedModels` for allowed-models and rely on ModelSelector’s built-in error/empty handling and `onStatusChange` instead of custom wrappers where appropriate.

---

## 6. References

- [sophia-dogfood-findings.md](sophia-dogfood-findings.md) — Phase 5 findings and resolved vs open items
- [ROADMAP.md](../../ROADMAP.md) — Dogfood-driven priorities and integrations spec
- [INTEGRATIONS-FULL-SPEC.md](../integrations/INTEGRATIONS-FULL-SPEC.md) — Integrations layer spec
