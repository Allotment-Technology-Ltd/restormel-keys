# @restormel/keys-elements

**Primary UI surface (Phase 1+)** for Restormel Keys. Web Component wrappers — use `<rk-key-manager>`, `<rk-model-selector>`, and `<rk-cost-estimator>` in plain HTML, Astro, or any framework. Pair with **Keys REST** (`/keys/v1/*`) for server-side resolve; see [npm-to-rest-keys.md](../../docs/guides/npm-to-rest-keys.md).

## Installation (npm)

```bash
pnpm add @restormel/keys @restormel/keys-svelte @restormel/keys-elements
```

## CDN (via unpkg)

Load the built ESM bundle from npm without a bundler. Pin a **semver tag** in production (replace `@latest` with a published version from `npm view @restormel/keys-elements version`).

```html
<script type="module">
  import 'https://unpkg.com/@restormel/keys-elements@latest/dist/index.js';
</script>
<rk-key-manager user-id="user-1"></rk-key-manager>
```

For **Keys REST** resolve from the browser, call your backend or `POST /keys/v1/projects/{projectId}/resolve` with a Gateway key — never embed `rk_…` in public pages. Host-side proxy recommended.

**Module import map (optional):**

```html
<script type="importmap">
{
  "imports": {
    "@restormel/keys-elements": "https://unpkg.com/@restormel/keys-elements@latest/dist/index.js",
    "@restormel/keys": "https://unpkg.com/@restormel/keys@latest/dist/index.js"
  }
}
</script>
<script type="module">
  import '@restormel/keys-elements';
</script>
```

Published files live under `dist/` after `pnpm --filter @restormel/keys-elements run build`. Self-host the same artifacts from your CDN by copying `dist/` from the npm tarball.

## Register elements

Import once so custom elements are defined:

```js
import '@restormel/keys-elements';
```

Or import the package entry (same side-effect):

```js
import '@restormel/keys-elements';
```

## Plain HTML

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module" src="./node_modules/@restormel/keys-elements/dist/index.js"></script>
</head>
<body>
  <rk-key-manager user-id="user-1"></rk-key-manager>
  <script type="module">
    import { createKeys } from '@restormel/keys';
    import { openaiProvider } from '@restormel/keys';
    const keys = createKeys(
      { keys: [], routing: { defaultProvider: 'openai' } },
      { providers: [openaiProvider] }
    );
    document.querySelector('rk-key-manager').keys = keys;
  </script>
</body>
</html>
```

## Astro

```astro
---
import '@restormel/keys-elements';
import { createKeys } from '@restormel/keys';
import { openaiProvider } from '@restormel/keys';
const keys = createKeys(
  { keys: [], routing: { defaultProvider: 'openai' } },
  { providers: [openaiProvider] }
);
---
<rk-key-manager user-id="user-1" client:load />
<script>
  document.querySelector('rk-key-manager').keys = keys;
</script>
```

## Generic script import (ESM)

```html
<script type="module">
  import '@restormel/keys-elements';
  import { createKeys } from '@restormel/keys';
  import { openaiProvider } from '@restormel/keys';

  const keys = createKeys(
    { keys: [], routing: { defaultProvider: 'openai' } },
    { providers: [openaiProvider] }
  );
  const el = document.querySelector('rk-key-manager');
  el.keys = keys;
  el.userId = 'user-1';

  el.addEventListener('rk-key-added', (e) => {
    console.log('Key added', e.detail.key, e.detail.apiKey);
  });
  el.addEventListener('rk-key-removed', (e) => {
    console.log('Key removed', e.detail.keyId);
  });
</script>
<rk-key-manager user-id="user-1"></rk-key-manager>
```

## Theming

Set `--rk-*` CSS custom properties on the host (or a parent) to override the default theme. Elements use Shadow DOM and ship default theme CSS; host variables apply via `:host`.

```css
rk-key-manager,
rk-model-selector,
rk-cost-estimator {
  --rk-bg: #0f0f12;
  --rk-text: #f0f0f0;
}
```

## Custom events

| Element              | Event            | Detail                                      |
|----------------------|------------------|---------------------------------------------|
| `<rk-key-manager>`   | `rk-key-added`   | `{ key, apiKey? }`                          |
| `<rk-key-manager>`   | `rk-key-removed` | `{ keyId }`                                 |
| `<rk-model-selector>`| `rk-model-selected` | `{ modelId, providerId }`                |
| `<rk-cost-estimator>`| `rk-cost-updated`  | `{ cost, budget, estimatedCost }`        |

## React / Next.js compatibility

Web Components work in React, but you must set **object props (e.g. `keys`, `providers`, `cost`) via the element’s properties**, not via React props, because React does not pass object props to custom elements. Use a ref and assign in `useEffect`:

```tsx
const ref = useRef<RKKeyManagerElement>(null);
useEffect(() => {
  if (ref.current) ref.current.keys = keysInstance;
}, [keysInstance]);
return <rk-key-manager ref={ref} user-id={userId} />;
```

**Friction points:**

- React does not forward non-primitive props to custom elements; you must assign `element.keys = ...` (and similar) after mount.
- Attribute names stay kebab-case (`user-id`, `estimated-cost`); React’s `userId` will not set `user-id` unless you use a string or a custom wrapper.
- The **@restormel/keys-react** wrapper exists to provide a React-friendly API (context, hooks, typed props) and avoids these issues by wrapping the Web Components or Svelte components for React.

For Next.js, use the React wrapper or load the elements script only on the client so the custom element constructor is defined before hydration.
