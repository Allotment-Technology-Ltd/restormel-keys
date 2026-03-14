# @restormel/keys-elements

Web Component wrappers for Restormel Keys. Use `<rk-key-manager>`, `<rk-model-selector>`, and `<rk-cost-estimator>` in plain HTML, Astro, or any framework.

## Installation

```bash
pnpm add @restormel/keys @restormel/keys-svelte @restormel/keys-elements
```

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
