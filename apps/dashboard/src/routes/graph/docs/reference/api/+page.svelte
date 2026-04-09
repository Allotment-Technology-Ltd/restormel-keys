<script lang="ts">
  import DocArticle from "$lib/graph/components/docs/DocArticle.svelte";
  import { graphBase as base } from "$lib/graph/paths.js";
  import { GITHUB_REPO_URL } from "$lib/site-nav";
</script>

<DocArticle
  title="API reference"
  description="High-signal summary of published exports. The source of truth for exact callback signatures is the published .d.ts on npm—especially GraphRendererProps / GraphCanvasProps."
>
  <div class="doc-prose">
    <p>
      This page is a <strong>typed overview</strong>. For edge cases and exhaustive props, read the generated
      declarations in your install of <code>@restormel/graph-core</code> and <code>@restormel/ui-graph-svelte</code>, or
      browse
      <a href="{GITHUB_REPO_URL}/tree/main/packages/graph-core" rel="noopener noreferrer">graph-core</a>
      and
      <a href="{GITHUB_REPO_URL}/tree/main/packages/ui-graph-svelte" rel="noopener noreferrer">ui-graph-svelte</a>
      on GitHub.
    </p>

    <h2>Core types (<code>@restormel/graph-core/viewModel</code>)</h2>
    <ul>
      <li><code>GraphData</code> — <code>nodes</code>, <code>edges</code>, <code>ghostNodes</code>, <code>ghostEdges</code></li>
      <li><code>GraphNode</code>, <code>GraphEdge</code> — vertices and directed typed edges</li>
      <li><code>GraphGhostNode</code>, <code>GraphGhostEdge</code> — optional rejected / overlay layer</li>
      <li><code>GraphViewportCommand</code>, <code>GraphViewportCommandType</code> — <code>fit</code> / <code>reset-layout</code></li>
      <li><code>GraphNodeSemanticStyle</code>, <code>GraphEdgeSemanticStyle</code> — semantic styling maps</li>
      <li>
        <code>GraphRendererProps</code> — full canvas prop contract (nodes, edges, ghosts, viewport, selection callbacks,
        path/focus/dim modes, dimensions, fullscreen toggle, semantic style records, …)
      </li>
    </ul>

    <h2>UI exports (<code>@restormel/ui-graph-svelte</code>)</h2>
    <ul>
      <li><code>GraphCanvas</code> — Svelte component; props align with <code>GraphRendererProps</code> (see published typings for any <code>Omit</code> / extras).</li>
      <li><code>GraphCanvasProps</code> — alias of <code>GraphRendererProps</code> for ergonomic imports.</li>
      <li>
        <code>NodeDetail</code> — inline detail panel; <code>NodeDetailProps</code> includes <code>node</code>,
        <code>edges</code>, <code>nodes</code>, <code>position</code>, <code>onClose</code>, optional
        <code>onJumpToReferences</code>.
      </li>
      <li><code>graphCanvasEdgeKey</code> — stable edge key helper (<code>from:type:to</code>)</li>
    </ul>

    <h2>Why .d.ts matters</h2>
    <p>
      Ambiguous or inferred callback types in consuming apps can cause <code>svelte-check</code> friction. The UI package
      publishes explicit component typings (including callback shapes). If docs and <code>.d.ts</code> disagree, trust
      <strong>published types</strong> and file an issue.
    </p>

    <p><a href="{base}/docs/integration/sveltekit">← SvelteKit integration</a></p>
  </div>
</DocArticle>
