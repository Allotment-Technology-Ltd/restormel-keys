<script lang="ts">
  import DocArticle from "$lib/graph/components/docs/DocArticle.svelte";
  import { graphBase as base } from "$lib/graph/paths.js";
</script>

<DocArticle
  title="Recipes"
  description="Short patterns beyond the minimal GraphCanvas example: ghost layer, focus/dim, path highlighting, semantic styles, and fullscreen."
>
  <div class="doc-prose">
    <p>
      These recipes assume you already followed
      <a href="{base}/docs/integration/sveltekit">SvelteKit integration</a>. Prop names match
      <a href="{base}/docs/reference/api">API reference</a> / published <code>GraphRendererProps</code>.
    </p>

    <h2>Ghost layer (rejected / overlay)</h2>
    <p>
      Pass <code>ghostNodes</code> and <code>ghostEdges</code> alongside the main graph. Toggle visibility with
      <code>showGhostLayer</code> so users can show or hide rejected traversals without rebuilding data.
    </p>

    <h2>Focus and dim</h2>
    <p>
      Set <code>focusNodeIds</code> and optionally <code>focusEdgeIds</code> to define the “in scope” set. With
      <code>dimOutOfScope={true}</code>, nodes and edges outside that set render de-emphasized. Combine with your own
      filter UI to drive the id arrays.
    </p>

    <h2>Path highlighting</h2>
    <p>
      Use <code>pathNodeIds</code> and <code>pathEdges</code> (or <code>pinnedNodeIds</code> for persistent emphasis) to
      highlight a reasoning path or search result. Edge entries should match the keys you would pass to
      <code>graphCanvasEdgeKey</code> for styling consistency.
    </p>

    <h2>Semantic style maps</h2>
    <p>
      Supply <code>nodeSemanticStyles</code> and <code>edgeSemanticStyles</code> keyed by node id and edge key to encode
      status, phase, or evaluation results without mutating core <code>GraphNode</code> labels. Keeps adapters stable when
      theming changes.
    </p>

    <h2>Fullscreen</h2>
    <p>
      Wire <code>isFullscreen</code> and <code>onToggleFullscreen</code> to your app’s fullscreen state (browser Fullscreen API
      or layout wrapper). The canvas toolbar shows an entry when <code>onToggleFullscreen</code> is provided.
    </p>

    <h2>Reasoning → canvas</h2>
    <p>
      When results come from <a href="{base}/docs/extensions/reasoning">@restormel/graph-reasoning-extensions</a>, map diff or
      evaluation output into the props above at your adapter boundary — the canvas stays unaware of contracts types.
    </p>

    <p>
      <a href="{base}/docs">← Docs home</a> · <a href="{base}/docs/reference/performance">Performance notes</a>
    </p>
  </div>
</DocArticle>
