# Phase 5 — Embed the UI

> **Time:** ~25 minutes
> **Prerequisites:** [Phase 4](/keys/docs/walkthrough/phase-4-policies) complete (routes and policies configured, resolve works with route IDs)
> **You'll need:** Your app's frontend codebase, the UI packages installed in Phase 1 (when available on npm)

This phase puts Restormel's embeddable components into your app so end-users can select models and (optionally) manage their own provider credentials. By the end, your app shows a ModelSelector filtered by your policies and a KeyManager for BYOK, both wired to your backend.

> **Keys MVP (2026-06) — canonical UI path:** Use **`@restormel/keys-elements`** (Web Components: `<rk-model-selector>`, `<rk-key-manager>`, `<rk-cost-estimator>`) for all frameworks. `@restormel/keys-svelte` and `@restormel/keys-react` are deprecated (maintenance-only until 2026-12-01) — do not start new integrations on those packages. The in-app walkthrough at [/keys/docs/walkthrough/phase-5-ui](https://restormel.dev/keys/docs/walkthrough/phase-5-ui) is the canonical public version. Verify before installing: `npm view @restormel/keys-elements version`. See [npm packages](../reference/npm-packages.md).

---

## Step 5.1 — Decide what to embed

Not every app needs every component. Use this decision matrix:

| If your app… | Embed | Skip |
|-------------|-------|------|
| Lets users choose which AI model to use | **ModelSelector** | — |
| Lets users bring their own provider API keys (BYOK) | **KeyManager** | — |
| Shows cost estimates before running a request | **CostEstimator** | — |
| Only uses platform keys with no user choice | — | All UI components (server-side resolve is enough) |

Most apps that reached this phase want **ModelSelector**. **KeyManager** is for apps where users supply their own OpenAI/Anthropic/Google keys. **CostEstimator** is a nice-to-have.

---

## Step 5.2 — Embed ModelSelector (Web Components — all frameworks)

`@restormel/keys-elements` is the canonical UI package for all frameworks. Install it:

```bash
pnpm add @restormel/keys-elements
```

**HTML / Astro / Vanilla:**

```html
<script type="module">
  import '@restormel/keys-elements';
  const el = document.querySelector('rk-model-selector');
  // Wire allowed models from your server-side allowed-models endpoint
  fetch('/api/allowed-models').then(r => r.json()).then(({ models }) => {
    el.models = models;
  });
  el.addEventListener('rk-model-selected', (e) => {
    const { modelId, providerId } = e.detail;
    fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId, providerId }),
    });
  });
</script>

<rk-model-selector></rk-model-selector>
```

**React (Next.js) — using Web Components:**

> The `@restormel/keys-react` wrapper is deprecated. Use `@restormel/keys-elements` via a dynamic import so the custom element registers in the browser only:

```tsx
// app/settings/ModelSelectorClient.tsx
'use client';

import { useEffect, useRef } from 'react';

export function ModelSelectorClient() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    import('@restormel/keys-elements');
    fetch('/api/allowed-models').then(r => r.json()).then(({ models }) => {
      if (ref.current) (ref.current as any).models = models;
    });
    ref.current?.addEventListener('rk-model-selected', (e: any) => {
      const { modelId, providerId } = e.detail;
      fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId, providerId }),
      });
    });
  }, []);

  return <rk-model-selector ref={ref} />;
}
```

**OLD deprecated React import (do not use for new integrations):**

```tsx
// ❌ Deprecated — do not use for new integrations
import { ModelSelector, useKeysContext } from '@restormel/keys-react';
import { openaiProvider, anthropicProvider, googleProvider } from '@restormel/keys';

export function ModelSelectorClient() {
  const { keys } = useKeysContext();

  function handleSelect(modelId: string, providerId: string) {
    // Example: persist preference to your backend. Request-scoped selection
    // (pass modelId/providerId per request) is equally valid.
    fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId, providerId }),
    });
  }

  return (
    <ModelSelector
      keys={keys}
      providers={[openaiProvider, anthropicProvider, googleProvider]}
      onSelect={handleSelect}
    />
  );
}
```

> **Tip**
> Use `next/dynamic` with `ssr: false` to lazy-load the model selector so it doesn't increase your initial page bundle.

```tsx
import dynamic from 'next/dynamic';
const ModelSelectorClient = dynamic(() => import('./ModelSelectorClient'), { ssr: false });
```

### You'll see

A model selection UI grouped by provider. Each model shows its availability based on whether a key exists for that provider. Users click a model to select it.

### How to test

1. Start your dev server: `pnpm dev`
2. Navigate to `/settings` (or wherever you embedded the component).
3. Confirm the ModelSelector renders with provider groups and models.
4. Click a model. Confirm the `onSelect` callback fires (e.g. network tab shows your preferences or request-scoped API call).

---

## Step 5.3 — Embed ModelSelector (SvelteKit)

> `@restormel/keys-svelte` is deprecated. Use `@restormel/keys-elements` (Web Components):

```svelte
<!-- src/routes/settings/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  let el: HTMLElement;

  onMount(async () => {
    await import('@restormel/keys-elements');
    const { models } = await fetch('/api/allowed-models').then(r => r.json());
    (el as any).models = models;
    el.addEventListener('rk-model-selected', (e: any) => {
      const { modelId, providerId } = e.detail;
      fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId, providerId }),
      });
    });
  });
</script>

<h1>Model settings</h1>
<rk-model-selector bind:this={el}></rk-model-selector>
```

### You'll see

A model selection UI with policy-filtered models. Users click a model to trigger `rk-model-selected`.

### How to test

Navigate to the settings page, confirm rendering, click a model, verify the callback fires.

---

## Step 5.4 — Wire allowed models from the server

For all framework paths, the model list shown to users should come from your **server-side allowed-models endpoint**, not hardcoded provider lists. This keeps the Gateway Key server-side:

```typescript
// Example: GET /api/allowed-models (server endpoint)
// Calls Restormel policy evaluate with your Gateway Key
export async function GET({ locals }) {
  const res = await fetch(`${RESTORMEL_KEYS_BASE}/keys/v1/policies/evaluate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESTORMEL_GATEWAY_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ projectId: RESTORMEL_PROJECT_ID, workload: 'chat' }),
  });
  const { allowedModels } = await res.json();
  return new Response(JSON.stringify({ models: allowedModels }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

Pass the result to your `<rk-model-selector>`:

```js
fetch('/api/allowed-models').then(r => r.json()).then(({ models }) => {
  document.querySelector('rk-model-selector').models = models;
});
```

> **Pitfall**
> Web Components require setting object props (`models`) via JavaScript properties, not HTML attributes. HTML attributes only work for primitives. See [Framework compatibility](/keys/docs/compatibility) for the full list.

### You'll see

The model selector rendered inside a shadow DOM. Theming applies via `--rk-*` CSS custom properties on the element or a parent.

### How to test

Open your page in a browser. Confirm the custom element renders. Click a model. Confirm the `rk-model-selected` event fires (check via the event listener's console log or network request).

---

## Step 5.5 — Filter the model list by policies

The ModelSelector shows all models from the configured providers by default. If you have policies (Phase 4) that restrict which models are allowed, you should filter the model list so users only see valid choices.

Two approaches:

**A) Server-side filtering (recommended):** Use the **batch** dashboard helpers from `@restormel/keys/dashboard` (server only) instead of looping `evaluate` one model at a time:

- `candidatesFromProviderDefinitions(providers)` — build `(providerType, modelId)` pairs from your picker list.
- `filterModelsByPolicy({ candidates, projectId, auth, ... })` — parallel evaluate with per-model status (`allowed`, `blocked_by_policy`, `restormel_degraded`, `unknown_or_unavailable`).
- `policyAvailabilityMapFromEntries(entries)` — map keyed `providerId:modelId` for the Svelte **ModelSelector** `policyAvailability` prop. Policy-blocked rows are shown unavailable without an extra evaluate; rows marked allowed still run `keys.resolve` for BYOK.
- `filterProviderDefinitionsByAllowedPolicy(providers, entries)` — if you prefer to **hide** non-allowed models entirely, pass the returned provider list to ModelSelector.

See `packages/core/README.md` § Dashboard API client.

**Legacy sequential evaluate (avoid for large lists):** If you cannot use the batch helper yet, call evaluate per model in a server route — same security rules as below.

Then in your client component, fetch `/api/allowed-models` (or equivalent) and pass **`policyAvailability`** and/or a narrowed `providers` list to ModelSelector.

> **Security**
> Never call the policies API from the browser. Keep `RESTORMEL_GATEWAY_KEY` server-side only (e.g. in a route handler). Use a server proxy like `/api/allowed-models` and return only the filtered model IDs to the client.

**B) Client-side filtering with entitlements:** If you use local resolve (Phase 2, Step 2.6), the `keys.entitlements` object can filter models:

```ts
const allModelIds = keys.getAllModelIds();
const allowed = keys.entitlements.getAvailableModels(allModelIds);
```

### You'll see

The ModelSelector shows only models that pass your policies. Blocked models are either hidden or shown as unavailable with a reason.

### How to test

Add a `model_allowlist` policy that excludes one model (e.g. block `gpt-3.5-turbo`). Refresh the settings page. That model should not appear (or should appear greyed out with "Not allowed").

---

## Step 5.6 — Embed KeyManager (optional — for BYOK apps)

If your app lets end-users bring their own API keys, embed the KeyManager component. It provides a settings panel for users to add, validate, list, and remove their provider credentials. **KeyManager sits on top of your own storage and validation endpoints** — you implement and own `POST /api/keys`, `DELETE /api/keys/:id`, and any server-side validation; KeyManager is the UI layer that calls them via `onKeyAdded` and `onKeyRemoved`.

**All frameworks — Web Components (`@restormel/keys-elements`):**

```html
<script type="module">
  import '@restormel/keys-elements';
  const el = document.querySelector('rk-key-manager');
  el.providers = ['openai', 'anthropic'];
  el.addEventListener('rk-key-added', (e) => {
    const { provider, label, apiKey } = e.detail;
    fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, label }),
    });
  });
  el.addEventListener('rk-key-removed', (e) => {
    fetch(`/api/keys/${e.detail.keyId}`, { method: 'DELETE' });
  });
</script>

<rk-key-manager></rk-key-manager>
```

> **Deprecated examples:** `@restormel/keys-react` and `@restormel/keys-svelte` KeyManager wrappers are deprecated. Use `<rk-key-manager>` from `@restormel/keys-elements` for all frameworks.

> **Security**
> The KeyManager validates keys client-side by making a lightweight test call to the provider. Raw key material is never sent to Restormel. Your backend should store only hashed keys and metadata (provider, label, key prefix). Use a secure server-side storage adapter; never log or expose raw keys.

### You'll see

A settings panel with:
- An empty state prompting "Add your first API key."
- A form to select a provider and paste a key.
- Validation feedback (green check or red error).
- A list of stored keys (masked, with provider icon and status).
- Delete buttons for each key.

### How to test

1. Navigate to settings.
2. Add a key (use a test/invalid key for now — validation will fail, which is expected).
3. Confirm the `onKeyAdded` callback fires and your `/api/keys` endpoint receives the request.
4. If you have a valid provider key, add it. Confirm validation passes (green indicator).
5. Delete the key. Confirm `onKeyRemoved` fires and the key disappears from the list.

---

## Step 5.7 — Theme the components

Restormel UI components use `--rk-*` CSS custom properties for theming. Override them to match your app's design:

```css
/* In your app's global CSS or a scoped stylesheet */
rk-key-manager,
rk-model-selector,
rk-cost-estimator,
.rk-key-manager,
.rk-model-selector,
.rk-cost-estimator {
  --rk-bg: #1a1a1e;
  --rk-text: #e8e8ec;
  --rk-accent: #3b82f6;
  --rk-border: #2a2a2e;
  --rk-error: #ef4444;
  --rk-success: #22c55e;
}
```

The components ship with a dark theme (`.rk-dark`) and light theme (`.rk-light`) preset. The dark theme matches the Restormel dashboard aesthetic.

### You'll see

Components render with your app's colour scheme instead of the defaults.

### How to test

Change a token (e.g. `--rk-accent`) to something visually distinct (hot pink). Confirm the accent colour updates on buttons and highlights.

### Integration options and host responsibilities

- **Replace existing picker.** Phase 5 expects the app’s existing model picker to be **replaced** by the packaged ModelSelector (not only “embed alongside”). Use the routing inventory to find the current picker and swap it for the Restormel component.
- **Model choice: request-scoped vs persisted.** Both are valid. **Request-scoped:** pass modelId/providerId per request (e.g. into resolve); no `POST /api/preferences`. **Persisted:** save selection to a preferences endpoint (e.g. `POST /api/preferences`) and load it on next visit. The walkthrough and prompts support either; choose per product needs.
- **ModelSelector host responsibilities.** Pass **`policyAvailability`** (from `policyAvailabilityMapFromEntries`) and use **`onStatusChange`** (`loading` | `ready` | `empty` | `error` | `degraded`), **`retryNonce` / `onRetry`** for reloads, and built-in **Retry** on load failure. You still own **current-selection visibility** and **request-scoped routing** (the component does not persist selection). See [sophia-dogfood-findings.md](../reference/sophia-dogfood-findings.md) §Phase 5 packaged path.
- **Theming.** At minimum set `--rk-bg`, `--rk-text`, and `--rk-accent`. For a full pass, deliberately apply `--rk-*` tokens across **both** ModelSelector and KeyManager (and any Restormel UI) as a separate design task if visual consistency matters.
- **Manual verification.** Phase 5 gate includes keyboard navigation and theming. Prefer an **in-browser manual check** (keyboard: Tab, Enter, Escape; render and theme). If browser/Playwright (or equivalent) is unavailable, document that verification is code/test only and add a manual verification step to the runbook for a human to run later.

### Build-agent prompt: embed-ui-components

**Context docs** (adapt paths for your project): this page (embedding patterns for React, SvelteKit, Web Components); [Framework compatibility](/keys/docs/compatibility) (which package for which framework).

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Replace the app’s existing model picker with the packaged Restormel ModelSelector (and optionally embed KeyManager for BYOK) so the settings/main flow use Restormel’s UI components.
>
> **Steps:**
>
> 1. Read the routing inventory (`docs/restormel-integration/00-routing-inventory.md`) to find the **existing model picker and/or BYOK UI**. **Replace** that UI with the packaged components (do not leave the old picker in place).
> 2. Based on your framework:
>    - **All frameworks:** Use `@restormel/keys-elements` (`<rk-model-selector>`). Import the package dynamically in browser context. Wire `rk-model-selected` event to call your preferences API.
>    - Do NOT use `@restormel/keys-react` or `@restormel/keys-svelte` for new integrations (deprecated).
>    - **Web Components:** Import `@restormel/keys-elements`, set `keys` and `providers` as properties on the `<rk-model-selector>` element.
> 3. Wire `onSelect` (or `rk-model-selected`) to your backend. Either **request-scoped** (pass modelId/providerId per request; no preferences endpoint) or **persisted** (e.g. `POST /api/preferences`); both are valid — choose per product.
> 4. If BYOK is needed: embed `KeyManager` with `onKeyAdded` and `onKeyRemoved` wired to your key API. Use server-side validation (no raw provider calls from browser). See `docs/reference/sophia-integration.md` KeyStorage pattern.
> 5. If allowed models come from your API: use **batch** `filterModelsByPolicy` + **`policyAvailability`** on ModelSelector; keep a thin wrapper only for **selected-state** and routing; see Phase 5 “Integration options” above.
> 6. Add `--rk-*` CSS overrides (at least `--rk-bg`, `--rk-text`, `--rk-accent`). Optionally do a full `--rk-*` pass across ModelSelector and KeyManager for consistent theming.
> 7. Handle all required states: loading, error (with retry), empty. These may live in your wrapper if the list is from your API.
> 8. Verify: components render, selection fires callbacks, theme applies, keyboard navigation (Tab, Enter, Escape). Prefer in-browser manual check; if browser/Playwright is unavailable, document “code/test verified; manual a11y/visual check pending” and add a runbook step for later.
>
> **DO NOT:**
> - Import UI packages in server-side code. All UI components are client-only.
> - Log or expose raw API keys in the browser console, network tab, or error messages.
> - Skip empty/error/loading states — they are required per `docs/ux-contracts.md`.
> - Hardcode model lists. Read from the `keys` instance or fetch allowed models from your backend.
> - Commit real API keys or secrets.

**Gate:** Existing picker replaced by ModelSelector; `onSelect` fires with modelId and providerId. (If BYOK) KeyManager works with server-side validation. Loading, error, empty, retry handled. Theme tokens applied. Keyboard nav works (or documented as manual verification pending if browser tooling unavailable).

---

## Checkpoint

You now have:

- **ModelSelector** embedded in your app, showing models grouped by provider, filtered by your policies.
- (Optional) **KeyManager** embedded for BYOK, with add/validate/list/remove flows wired to your backend.
- Components themed to match your app's design via `--rk-*` CSS custom properties.
- Callbacks wired so user selections are saved to your backend.

The UI components work alongside your resolve integration from Phases 2–4. When a user selects a model, your backend can pass that selection to `resolveProvider({ model: userSelectedModel })` and Restormel evaluates it against routes and policies.

**Next:** [Phase 6 — Go live](/keys/docs/walkthrough/phase-6-golive) — parallel run, cutover, and production verification.
