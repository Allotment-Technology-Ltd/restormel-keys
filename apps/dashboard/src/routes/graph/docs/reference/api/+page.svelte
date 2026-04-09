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

    <h2>GraphCanvas — high-traffic props</h2>
    <p>
      One-screen cheat sheet for first integration; exhaustive shapes and optional props live in
      <code>GraphRendererProps</code> / published <code>index.d.ts</code>.
    </p>
    <table>
      <thead>
        <tr>
          <th scope="col">Prop</th>
          <th scope="col">Role</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>nodes</code>, <code>edges</code></td>
          <td>Required graph data (arrays; shape from <code>viewModel</code>).</td>
        </tr>
        <tr>
          <td><code>ghostNodes</code>, <code>ghostEdges</code>, <code>showGhostLayer</code></td>
          <td>Optional rejected / overlay layer and visibility toggle.</td>
        </tr>
        <tr>
          <td><code>selectedNodeId</code>, <code>onSelectedNodeChange</code>, <code>onNodeSelect</code></td>
          <td>Controlled selection and selection change callbacks.</td>
        </tr>
        <tr>
          <td><code>viewportCommand</code></td>
          <td>Imperative <code>fit</code> / <code>reset-layout</code> via <code>GraphViewportCommand</code> + nonce.</td>
        </tr>
        <tr>
          <td><code>nodeSemanticStyles</code>, <code>edgeSemanticStyles</code></td>
          <td>Maps keyed by node id and by edge key (<code>graphCanvasEdgeKey</code>).</td>
        </tr>
        <tr>
          <td><code>showInlineDetail</code>, <code>showStatusChip</code>, <code>showViewportControls</code></td>
          <td>UI chrome toggles.</td>
        </tr>
        <tr>
          <td><code>width</code>, <code>height</code>, <code>isFullscreen</code>, <code>onToggleFullscreen</code></td>
          <td>Layout and fullscreen affordances.</td>
        </tr>
        <tr>
          <td><code>pinnedNodeIds</code>, <code>pathNodeIds</code>, <code>pathEdges</code></td>
          <td>Highlight / path overlays.</td>
        </tr>
        <tr>
          <td><code>focusNodeIds</code>, <code>focusEdgeIds</code>, <code>dimOutOfScope</code></td>
          <td>Focus mode and dimming outside focus set.</td>
        </tr>
        <tr>
          <td><code>onJumpToReferences</code></td>
          <td>Callback when the user jumps references from detail UI; signature is explicit in published <code>.d.ts</code>.</td>
        </tr>
      </tbody>
    </table>

    <h2>Why .d.ts matters</h2>
    <p>
      Ambiguous or inferred callback types in consuming apps can cause <code>svelte-check</code> friction. The UI package
      publishes explicit component typings (including callback shapes). If docs and <code>.d.ts</code> disagree, trust
      <strong>published types</strong> and file an issue.
    </p>

    <p><a href="{base}/docs/integration/sveltekit">← SvelteKit integration</a></p>
  </div>
</DocArticle>
