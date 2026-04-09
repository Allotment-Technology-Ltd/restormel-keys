<script lang="ts">
  import DocArticle from "$lib/graph/components/docs/DocArticle.svelte";
  import { graphBase as base } from "$lib/graph/paths.js";
  import { GITHUB_REPO_URL } from "$lib/site-nav";
</script>

<DocArticle
  title="Performance & scale"
  description="Rough guidance on graph size, computeLayout cost, and patterns for large graphs with @restormel/graph-core and @restormel/ui-graph-svelte."
>
  <div class="doc-prose">
    <p>
      There is no hard node cap in the packages — behaviour depends on device, browser, and how many DOM/SVG elements you
      render. Use this page as <strong>practical guidance</strong>, not a SLA.
    </p>

    <h2>Layout (<code>computeLayout</code>)</h2>
    <p>
      Default orbital layout walks nodes and edges to place sources and claims. Cost grows with
      <strong>node and edge count</strong>; for hundreds of nodes it is usually fine on modern desktops. For thousands of
      nodes, profile in your environment.
    </p>
    <ul>
      <li>
        Layout runs when dimensions change and on explicit <code>reset-layout</code> viewport commands — not on every frame
        during pan/zoom.
      </li>
      <li>
        If layout time dominates, <strong>pre-filter</strong> or <strong>cluster</strong> in your adapter before building
        <code>GraphData</code>.
      </li>
    </ul>

    <h2>Rendering (SVG)</h2>
    <ul>
      <li>
        Every node/edge can become multiple SVG elements and labels. Large graphs increase paint cost and tab-stop count —
        see <a href="{base}/docs/reference/accessibility">Accessibility &amp; input model</a>.
      </li>
      <li>
        <strong>Ghost layer</strong> doubles visual complexity when many ghost nodes/edges exist; toggle
        <code>showGhostLayer</code> off when not needed.
      </li>
      <li>
        There is <strong>no built-in virtualization</strong>. For very large graphs, reduce the working set server-side or
        in the adapter (viewport, importance, or incremental reveal).
      </li>
    </ul>

    <h2>Recommended patterns</h2>
    <ol>
      <li>Cap or paginate what you pass into <code>GraphCanvas</code>; keep “full graph” views for exports or admin tools.</li>
      <li>Use <code>focusNodeIds</code> / <code>dimOutOfScope</code> to emphasize a subset without removing data.</li>
      <li>Debounce expensive adapter work when the user scrubs filters tied to graph rebuilds.</li>
    </ol>

    <p>
      Implementation reference:
      <a href="{GITHUB_REPO_URL}/blob/main/packages/graph-core/src/layout.ts" rel="noopener noreferrer"
        ><code>layout.ts</code></a
      >,
      <a href="{GITHUB_REPO_URL}/tree/main/packages/ui-graph-svelte/src/lib" rel="noopener noreferrer"
        ><code>GraphCanvas.svelte</code></a
      >.
    </p>

    <p>
      <a href="{base}/docs/guides/migration-from-custom-canvas">← Migrate from a custom canvas</a> ·
      <a href="{base}/docs/guides/recipes">Recipes</a>
    </p>
  </div>
</DocArticle>
