# @restormel/graph-elements

**Primary UI surface (Phase 2+)** for Restormel Graph Contract v0. Web Component `<rg-graph-canvas>` wraps `@restormel/ui-graph-svelte` for use in plain HTML, Astro, React, or any framework.

Pair with **Layout REST** (`POST /graph/v1/layout`) when you want server-side orbital positions; the canvas also runs `computeLayout` in-process when embedded.

## Installation (npm)

```bash
pnpm add @restormel/graph-core @restormel/ui-graph-svelte @restormel/graph-elements
```

Build graph packages before first use in dev toolchains that read `dist/`:

```bash
pnpm --filter @restormel/graph-core run build
pnpm --filter @restormel/ui-graph-svelte run build
pnpm --filter @restormel/graph-elements run build
```

## CDN (via unpkg)

Pin a semver in production (replace `@latest`):

```html
<script type="module">
  import 'https://unpkg.com/@restormel/graph-elements@latest/dist/index.js';
</script>
<rg-graph-canvas width="800" height="600"></rg-graph-canvas>
<script type="module">
  const el = document.querySelector('rg-graph-canvas');
  el.nodes = [
    { id: 's1', type: 'source', label: 'Source' },
    { id: 'c1', type: 'claim', label: 'Claim' },
  ];
  el.edges = [{ from: 's1', to: 'c1', type: 'contains' }];
  el.addEventListener('rg-node-select', (e) => console.log('selected', e.detail.nodeId));
</script>
```

## Register

```js
import '@restormel/graph-elements';
```

## Properties (set from JavaScript)

| Property | Type | Notes |
| --- | --- | --- |
| `nodes` | `GraphNode[]` | Required for render |
| `edges` | `GraphEdge[]` | |
| `ghostNodes` / `ghostEdges` | arrays | Optional overlay |
| `width` / `height` | number | Attributes `width`, `height` also supported |
| `showGhostLayer` | boolean | Attribute `show-ghost-layer` |
| `selectedNodeId` | string | |

## Events

| Event | Detail |
| --- | --- |
| `rg-node-select` | `{ nodeId: string }` |
| `rg-selected-node-change` | `{ nodeId: string \| null }` |
| `rg-jump-to-references` | `{ nodeId: string }` |

## Advanced properties (Svelte / Graph Kit parity)

Set from JavaScript when you need workspace focus, semantic styles, or viewport commands (same surface as `@restormel/ui-graph-svelte` `GraphCanvas`):

| Property | Type |
| --- | --- |
| `showInlineDetail` | boolean |
| `showStatusChip` | boolean |
| `showViewportControls` | boolean |
| `viewportCommand` | `{ type: 'fit' \| 'reset-layout'; nonce: number } \| null` |
| `nodeSemanticStyles` / `edgeSemanticStyles` | style maps |
| `pinnedNodeIds`, `pathNodeIds`, `pathEdges` | arrays |
| `focusNodeIds`, `focusEdgeIds`, `dimOutOfScope` | focus/dim |

Re-exported helpers: `graphCanvasEdgeKey`, `GraphCanvasNodeSemanticStyle`, `GraphCanvasEdgeSemanticStyle`.

## Layout REST

```bash
curl -sS -X POST "https://restormel.dev/graph/v1/layout" \
  -H "Content-Type: application/json" \
  -d '{"width":800,"height":600,"snapshot":{"nodes":[{"id":"a","type":"source","label":"A"}],"edges":[]}}'
```

Public docs: [restormel.dev/graph/docs/integration/web-components](https://restormel.dev/graph/docs/integration/web-components).

## Svelte apps

New Svelte 5 apps may still use `@restormel/ui-graph-svelte` directly. That package is in **maintenance mode** until Phase 7; prefer Web Components for framework-agnostic embeds.
