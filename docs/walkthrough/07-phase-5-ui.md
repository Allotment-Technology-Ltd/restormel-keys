# Phase 5 — Embed the UI

> **Time:** ~25 minutes
> **Prerequisites:** [Phase 4](/keys/docs/walkthrough/phase-4-policies) complete (routes and policies configured, resolve works with route IDs)
> **You'll need:** Your app's frontend codebase, the UI packages installed in Phase 1

This phase puts Restormel's embeddable components into your app so end-users can select models and (optionally) manage their own provider credentials. By the end, your app shows a ModelSelector filtered by your policies and a KeyManager for BYOK, both wired to your backend.

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

## Step 5.2 — Embed ModelSelector (Next.js / React)

**`app/settings/page.tsx`** (server component):

```tsx
// app/settings/page.tsx
import { KeysProvider } from '@restormel/keys-react';
import { openaiProvider, anthropicProvider, googleProvider } from '@restormel/keys';
import { ModelSelectorClient } from './ModelSelectorClient';

export default function SettingsPage() {
  const config = { keys: [], routing: { defaultProvider: 'openai' } };
  const options = { providers: [openaiProvider, anthropicProvider, googleProvider] };

  return (
    <KeysProvider config={config} options={options}>
      <h1>Model settings</h1>
      <ModelSelectorClient />
    </KeysProvider>
  );
}
```

**`app/settings/ModelSelectorClient.tsx`** (client component):

```tsx
// app/settings/ModelSelectorClient.tsx
'use client';

import { ModelSelector, useKeysContext } from '@restormel/keys-react';
import { openaiProvider, anthropicProvider, googleProvider } from '@restormel/keys';

export function ModelSelectorClient() {
  const { keys } = useKeysContext();

  function handleSelect(modelId: string, providerId: string) {
    // Save the user's model preference to your backend
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
4. Click a model. Confirm the `onSelect` callback fires (check your network tab for the `POST /api/preferences` call).

---

## Step 5.3 — Embed ModelSelector (SvelteKit)

```svelte
<!-- src/routes/settings/+page.svelte -->
<script lang="ts">
  import { ModelSelector } from '@restormel/keys-svelte';
  import { createKeys, openaiProvider, anthropicProvider, googleProvider } from '@restormel/keys';

  const keys = createKeys(
    { keys: [], routing: { defaultProvider: 'openai' } },
    { providers: [openaiProvider, anthropicProvider, googleProvider] }
  );

  const providers = [openaiProvider, anthropicProvider, googleProvider];

  function handleSelect(modelId: string, providerId: string) {
    fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId, providerId }),
    });
  }
</script>

<h1>Model settings</h1>
<ModelSelector {keys} {providers} onSelect={handleSelect} />
```

### You'll see

The same model selection UI as the React version, rendered natively in Svelte.

### How to test

Same as Step 5.2: navigate to the settings page, confirm rendering, click a model, verify the callback.

---

## Step 5.4 — Embed ModelSelector (Web Components / vanilla)

For frameworks not covered by the React or Svelte wrappers, use the Web Components directly:

```html
<!-- In your HTML or template -->
<script type="module">
  import '@restormel/keys-elements';
  import { createKeys, openaiProvider, anthropicProvider, googleProvider } from '@restormel/keys';

  const keys = createKeys(
    { keys: [], routing: { defaultProvider: 'openai' } },
    { providers: [openaiProvider, anthropicProvider, googleProvider] }
  );

  const el = document.querySelector('rk-model-selector');
  el.keys = keys;
  el.providers = [openaiProvider, anthropicProvider, googleProvider];

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

> **Pitfall**
> Web Components require setting object props (`keys`, `providers`) via JavaScript properties, not HTML attributes. HTML attributes only work for primitives like `user-id`. See [Framework compatibility](/keys/docs/compatibility) for the full list.

### You'll see

The model selector rendered inside a shadow DOM. Theming applies via `--rk-*` CSS custom properties on the element or a parent.

### How to test

Open your page in a browser. Confirm the custom element renders. Click a model. Confirm the `rk-model-selected` event fires (check via the event listener's console log or network request).

---

## Step 5.5 — Filter the model list by policies

The ModelSelector shows all models from the configured providers by default. If you have policies (Phase 4) that restrict which models are allowed, you should filter the model list so users only see valid choices.

Two approaches:

**A) Server-side filtering (recommended):** Fetch the allowed models from Restormel's evaluate or catalog API, then pass them to the component.

```ts
// app/api/allowed-models/route.ts (Next.js) or equivalent
export async function GET() {
  const allModels = ['gpt-4o', 'gpt-4o-mini', 'claude-sonnet-4-20250514', 'gemini-2.5-pro'];

  const allowed = [];
  for (const model of allModels) {
    const res = await fetch(
      `https://restormel.dev/keys/dashboard/api/policies/evaluate`,
      {
        method: 'POST',
        headers: {
          // Use a Management Key for policies (Gateway Keys do not have access to workspace-scoped policy APIs)
          'Authorization': `Bearer ${process.env.RESTORMEL_MANAGEMENT_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: process.env.RESTORMEL_PROJECT_ID,
          environmentId: 'production',
          modelId: model,
          providerType: 'openai', // evaluate per providerType if needed
        }),
      }
    );
    const result = await res.json();
    if (result.data?.allowed) allowed.push(model);
  }

  return Response.json({ models: allowed });
}
```

Then in your client component, fetch `/api/allowed-models` and only configure the providers/models that are allowed.

> **Security**
> Never call the policies API from the browser. Keep `RESTORMEL_MANAGEMENT_KEY` server-side only (e.g. in a route handler). Use a server proxy like `/api/allowed-models` and return only the filtered model IDs to the client.

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

If your app lets end-users bring their own API keys, embed the KeyManager component. This provides a settings panel for users to add, validate, list, and remove their provider credentials.

**Next.js / React:**

```tsx
// app/settings/KeyManagerClient.tsx
'use client';

import { KeyManager, useKeysContext } from '@restormel/keys-react';
import { openaiProvider, anthropicProvider } from '@restormel/keys';

export function KeyManagerClient({ userId }: { userId: string }) {
  const { keys } = useKeysContext();

  return (
    <KeyManager
      keys={keys}
      userId={userId}
      providers={[openaiProvider, anthropicProvider]}
      onKeyAdded={(key, apiKey) => {
        // Persist to your backend
        fetch('/api/keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: key.provider, label: key.label }),
        });
      }}
      onKeyRemoved={(keyId) => {
        fetch(`/api/keys/${keyId}`, { method: 'DELETE' });
      }}
    />
  );
}
```

**SvelteKit:**

```svelte
<script lang="ts">
  import { KeyManager } from '@restormel/keys-svelte';
  // ... keys instance and providers setup as in Step 5.3

  function handleKeyAdded(key, apiKey) {
    fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: key.provider, label: key.label }),
    });
  }

  function handleKeyRemoved(keyId) {
    fetch(`/api/keys/${keyId}`, { method: 'DELETE' });
  }
</script>

<KeyManager
  {keys}
  userId={$page.data.userId}
  providers={[openaiProvider, anthropicProvider]}
  onKeyAdded={handleKeyAdded}
  onKeyRemoved={handleKeyRemoved}
/>
```

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

### Build-agent prompt: embed-ui-components

**Context docs** (adapt paths for your project): this page (embedding patterns for React, SvelteKit, Web Components); [Framework compatibility](/keys/docs/compatibility) (which package for which framework).

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Embed Restormel Keys UI components (ModelSelector and optionally KeyManager) into your app's settings page.
>
> **Steps:**
>
> 1. Read the routing inventory (`docs/restormel-integration/00-routing-inventory.md`) to identify the existing model picker and/or BYOK settings UI to replace.
> 2. Based on your framework:
>    - **Next.js/React:** Create a client component wrapping `ModelSelector` from `@restormel/keys-react` inside a `KeysProvider`. Use `next/dynamic` with `ssr: false` for the client component. See `packages/react/README.md` for the exact pattern.
>    - **SvelteKit:** Import `ModelSelector` from `@restormel/keys-svelte` directly. Create the `keys` instance with `createKeys`.
>    - **Web Components:** Import `@restormel/keys-elements`, set `keys` and `providers` as properties on the `<rk-model-selector>` element.
> 3. Wire the `onSelect` callback (or `rk-model-selected` event) to save the user's model preference to your backend (e.g. `POST /api/preferences`).
> 4. If BYOK is needed: embed `KeyManager` with `onKeyAdded` and `onKeyRemoved` callbacks wired to your key storage API (e.g. `POST /api/keys`, `DELETE /api/keys/:id`). Follow the KeyStorage adapter pattern from `docs/reference/sophia-integration.md`.
> 5. Add `--rk-*` CSS overrides to match your app's theme. At minimum set `--rk-bg`, `--rk-text`, and `--rk-accent`.
> 6. Handle all required states: loading (show skeleton), error (show message + retry), empty (show "Add your first key" or "No models available").
> 7. Verify: components render, selection fires callbacks, theme applies, keyboard navigation works (Tab, Enter, Escape).
>
> **DO NOT:**
> - Import UI packages in server-side code. All UI components are client-only.
> - Log or expose raw API keys in the browser console, network tab, or error messages.
> - Skip empty/error/loading states — they are required per `docs/ux-contracts.md`.
> - Hardcode model lists. Read from the `keys` instance or fetch allowed models from your backend.
> - Commit real API keys or secrets.

**Gate:** ModelSelector renders and fires `onSelect` with modelId and providerId. (If BYOK) KeyManager renders, add/remove key callbacks work. Components respect `--rk-*` theme tokens. Loading, error, and empty states are handled. Keyboard navigation works (Tab through controls, Enter to select, Escape to close).

---

## Checkpoint

You now have:

- **ModelSelector** embedded in your app, showing models grouped by provider, filtered by your policies.
- (Optional) **KeyManager** embedded for BYOK, with add/validate/list/remove flows wired to your backend.
- Components themed to match your app's design via `--rk-*` CSS custom properties.
- Callbacks wired so user selections are saved to your backend.

The UI components work alongside your resolve integration from Phases 2–4. When a user selects a model, your backend can pass that selection to `resolveProvider({ model: userSelectedModel })` and Restormel evaluates it against routes and policies.

**Next:** [Phase 6 — Go live](/keys/docs/walkthrough/phase-6-golive) — parallel run, cutover, and production verification.
