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
      <li>
        <strong>@restormel/graph-reasoning-extensions</strong> (optional) — compare, lineage, projection, evaluation, diff,
        summary over <code>@restormel/contracts</code> snapshots. Depends on contracts + graph-core types; semver train
        <code>platform-v*</code>, independent of <code>graph-v*</code>. See
        <a href="{base}/docs/extensions/reasoning">Reasoning extensions &amp; contracts</a>.
      </li>
      <li>
        <strong>@restormel/context-packs</strong> + <strong>@restormel/state</strong> (optional, same
        <code>platform-v*</code> train) — pass-specific LLM text from a retrieval-shaped payload; append-only
        <strong>agent memory</strong> projections and correlation with those packs and traces. Not canvas packages; see
        <a href="{base}/docs/extensions/reasoning">Reasoning extensions</a> (context packs) and
        <a href="{base}/docs/extensions/state">Restormel State</a>.
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
      <a href="{base}/docs/integration/sveltekit">SvelteKit integration</a> ·
      <a href="{base}/docs/extensions/reasoning">Reasoning extensions</a> ·
      <a href="{base}/docs/extensions/state">Restormel State</a>
    </p>
  </div>
</DocArticle>
