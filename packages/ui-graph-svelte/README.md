# `@restormel/ui-graph-svelte`

Svelte 5 implementation of the Restormel Graph canvas (`GraphCanvas`, optional `NodeDetail`), aligned with **Contract v0** in `@restormel/graph-core` (`viewModel.ts`). Ported from the SOPHIA app for modular reuse.

**SOPHIA / SvelteKit consumers:** follow **[docs/restormel-graph-sophia-consumer.md](../../docs/restormel-graph-sophia-consumer.md)** (npm versions, `pnpm.overrides` + tarballs, peers, Vite `ssr.noExternal`, CSS tokens).

## Dependencies

- `peerDependencies`: `svelte@^5`
- `dependencies`: `@restormel/graph-core` (layout, trace, DTO types)

There is **no** `@restormel/contracts` dependency.

## Install (workspace / monorepo)

```bash
pnpm add @restormel/ui-graph-svelte @restormel/graph-core
```

Build `@restormel/graph-core` before consuming subpath imports in dev toolchains that read `dist/` (`pnpm --filter @restormel/graph-core run build`).

## CSS variables

The canvas uses SOPHIA design tokens as CSS variables (for example `--color-bg`, `--color-sage`, `--color-text`, `--radius-md`, `--font-ui`, `--text-meta`). Host apps should load a compatible token sheet. The demo app mirrors SOPHIA’s `design-tokens.css` under `apps/restormel-graph-demo/src/lib/graph-demo-tokens.css`.

## Usage

Pass **nodes**, **edges**, and optional **ghost** layers and semantic style maps. Shape matches `GraphRendererProps` in `@restormel/graph-core/viewModel`.

```svelte
<script lang="ts">
  import { GraphCanvas } from "@restormel/ui-graph-svelte";
  import type { GraphData } from "@restormel/graph-core/viewModel";

  const data: GraphData = {
    nodes: [
      { id: "s1", type: "source", label: "Source" },
      { id: "c1", type: "claim", label: "Claim", phase: "analysis" },
    ],
    edges: [{ from: "s1", to: "c1", type: "contains" }],
    ghostNodes: [],
    ghostEdges: [],
  };
</script>

<GraphCanvas
  nodes={data.nodes}
  edges={data.edges}
  ghostNodes={data.ghostNodes}
  ghostEdges={data.ghostEdges}
  showGhostLayer={false}
  showInlineDetail={true}
  showStatusChip={true}
  showViewportControls={true}
  nodeSemanticStyles={{}}
  edgeSemanticStyles={{}}
/>
```

Edge semantic styles are keyed with `graphCanvasEdgeKey(edge)` exported from this package (`from:type:to`).

Optional props: `selectedNodeId`, `onSelectedNodeChange`, `onNodeSelect`, `viewportCommand`, `pinnedNodeIds`, `pathNodeIds`, `pathEdges`, `focusNodeIds`, `focusEdgeIds`, `dimOutOfScope`, `isFullscreen`, `onToggleFullscreen`, `onJumpToReferences`.

## Demo

`apps/restormel-graph-demo` — route `/dev/graph-portability`.

```bash
pnpm --filter restormel-graph-demo run dev
```

Then open `/dev/graph-portability`.

## Build

```bash
pnpm --filter @restormel/graph-core run build
pnpm --filter @restormel/ui-graph-svelte run build
```

Optional extracted stylesheet (same rules as Vite library build): `dist/ui-graph-svelte.css` (component styles are also bundled into the JS output for typical consumers).
