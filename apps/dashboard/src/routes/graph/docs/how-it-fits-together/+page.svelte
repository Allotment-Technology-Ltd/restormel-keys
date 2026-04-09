<script lang="ts">
  import { graphBase as base } from "$lib/graph/paths.js";
  import DocArticle from "$lib/graph/components/docs/DocArticle.svelte";

  const typeSnippet = `import type { GraphData } from "@restormel/graph-core/viewModel";

function toGraphData(snapshot: YourDomainSnapshot): GraphData {
  return {
    nodes: [/* … */],
    edges: [/* … */],
    ghostNodes: [],
    ghostEdges: [],
  };
}`;
</script>

<DocArticle
  title="How it fits together"
  description="A single integration seam: hosts produce GraphData; @restormel/graph-core defines the contract; @restormel/ui-graph-svelte renders it."
>
  <div class="doc-prose">
    <h2>Package boundaries</h2>
    <ul>
      <li>
        <strong>@restormel/graph-core</strong> — Contract v0 <strong>DTOs</strong> (<code>GraphData</code>,
        <code>GraphNode</code>, <code>GraphEdge</code>, ghost types, viewport commands), plus <strong>layout</strong>,
        <strong>trace</strong>, and <strong>workspace</strong> helpers. No Svelte, no UI, no
        <code>@restormel/contracts</code>.
      </li>
      <li>
        <strong>@restormel/ui-graph-svelte</strong> — <strong>Svelte&nbsp;5</strong> UI: <code>GraphCanvas</code>,
        optional <code>NodeDetail</code>, semantic style helpers, and packaged component CSS. Depends on published
        graph-core.
      </li>
    </ul>
    <h2>Integration seam (one sentence)</h2>
    <p>
      <strong>Hosts produce <code>GraphData</code>; adapters live in the app</strong>—map your snapshot into the DTOs
      exported from <code>@restormel/graph-core/viewModel</code>, then pass node and edge arrays into
      <code>GraphCanvas</code>.
    </p>
    <h2>Minimal type sketch</h2>
    <pre><code>{typeSnippet}</code></pre>
    <p>
      Back: <a href="{base}/docs/overview">Overview</a> · Forward:
      <a href="{base}/docs/integration/sveltekit">SvelteKit integration</a>
    </p>
  </div>
</DocArticle>
