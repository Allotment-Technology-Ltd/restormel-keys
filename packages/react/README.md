# @restormel/keys-react

React components and hooks for Restormel Keys. Wraps the Web Components so you get a native React API with typed props and callbacks—no need to think about custom elements.

## Installation

```bash
pnpm add @restormel/keys @restormel/keys-elements @restormel/keys-react
```

Peer: **React 18+**.

## Quick start (generic React app)

```tsx
import { KeysProvider, KeyManager, useKeysContext } from "@restormel/keys-react";
import { openaiProvider } from "@restormel/keys";

function App() {
  return (
    <KeysProvider
      config={{ keys: [], routing: { defaultProvider: "openai" } }}
      options={{ providers: [openaiProvider] }}
    >
      <Settings />
    </KeysProvider>
  );
}

function Settings() {
  const { keys } = useKeysContext();
  return (
    <KeyManager
      keys={keys}
      userId="user-1"
      onKeyAdded={(key, apiKey) => console.log("Added", key, apiKey)}
      onKeyRemoved={(keyId) => console.log("Removed", keyId)}
    />
  );
}
```

## Next.js App Router (settings page)

Use a client component that reads `keys` from context and passes it to `KeyManager`. The page can be a server component that wraps with `KeysProvider`.

**`app/settings/page.tsx`** (server component):

```tsx
import { KeysProvider } from "@restormel/keys-react";
import { openaiProvider } from "@restormel/keys";
import { KeyManagerWithContext } from "./KeyManagerWithContext";

export default function SettingsPage() {
  const config = { keys: [], routing: { defaultProvider: "openai" } };
  const options = { providers: [openaiProvider] };

  return (
    <KeysProvider config={config} options={options}>
      <KeyManagerWithContext userId="user-1" />
    </KeysProvider>
  );
}
```

**`app/settings/KeyManagerWithContext.tsx`** (client component):

```tsx
"use client";
import { KeyManager, useKeysContext } from "@restormel/keys-react";

export function KeyManagerWithContext({ userId }: { userId: string }) {
  const { keys } = useKeysContext();
  return (
    <KeyManager
      keys={keys}
      userId={userId}
      onKeyAdded={(k, apiKey) => { /* persist */ }}
      onKeyRemoved={(id) => { /* remove */ }}
    />
  );
}
```

For code splitting, use `dynamic(..., { ssr: false })` when importing the client wrapper so the key manager only loads on the client.

## Dynamic import (code splitting)

To load the key UI only when needed (e.g. settings route):

```tsx
import { lazy, Suspense } from "react";

const KeyManager = lazy(() =>
  import("@restormel/keys-react").then((m) => ({ default: m.KeyManager }))
);

function Settings() {
  const { keys } = useKeysContext();
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <KeyManager keys={keys} userId="user-1" />
    </Suspense>
  );
}
```

## Hooks

- **useKeys(config, options)** — creates a Keys instance. Returns `{ keys, loading, error }`.
- **useKeysContext()** — use inside `KeysProvider` to get `{ keys, loading, error }`.
- **useModels(keys, providers)** — returns `{ modelIds, groups }` (models grouped by provider).
- **useCost(keys, modelId)** — returns `{ cost }` (estimate for the model), recalculates when `keys` or `modelId` change.

## Components

- **KeyManager** — props: `keys`, `userId`, `providers?`, `onKeyAdded?`, `onKeyRemoved?`
- **ModelSelector** — props: `keys`, `providers`, `onSelect?`
- **CostEstimator** — props: `cost`, `budget?`, `estimatedCost?`, `onCostUpdated?`

All components are client components (`"use client"`) and wrap the corresponding Web Component from `@restormel/keys-elements`.
