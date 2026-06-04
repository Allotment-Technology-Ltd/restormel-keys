<script lang="ts">
  import DocArticle from "$lib/graph/components/docs/DocArticle.svelte";
  import { graphBase as base } from "$lib/graph/paths.js";
  import { GITHUB_REPO_URL } from "$lib/site-nav";

  const pnpmAdd = "pnpm add @restormel/graph-core @restormel/graph-elements";

  const layoutCurl = `curl -sS -X POST "https://restormel.dev/graph/v1/layout" \\
  -H "Content-Type: application/json" \\
  -d '{
    "width": 800,
    "height": 600,
    "snapshot": {
      "nodes": [
        { "id": "s1", "type": "source", "label": "Source" },
        { "id": "c1", "type": "claim", "label": "Claim" }
      ],
      "edges": [{ "from": "s1", "to": "c1", "type": "contains" }]
    }
  }'`;

  const wcExample = [
    '<script type="module">',
    "  import '@restormel/graph-elements';",
    "  const el = document.querySelector('rg-graph-canvas');",
    "  el.nodes = [",
    "    { id: 's1', type: 'source', label: 'Source' },",
    "    { id: 'c1', type: 'claim', label: 'Claim' },",
    "  ];",
    "  el.edges = [{ from: 's1', to: 'c1', type: 'contains' }];",
    "  el.addEventListener('rg-node-select', (e) => console.log(e.detail.nodeId));",
    "</scr" + "ipt>",
    '<rg-graph-canvas width="800" height="600"></rg-graph-canvas>',
  ].join("\n");
</script>

<DocArticle
  title="Integrate Restormel Graph with Web Components"
  description="Phase 2 canonical path: @restormel/graph-elements (rg-graph-canvas), optional Layout REST at POST /graph/v1/layout, and Contract v0 GraphData from @restormel/graph-core."
>
  <div class="doc-prose">
    <p>
      Use this guide when your host app is <strong>not Svelte 5</strong> — React, Vue, plain HTML, Astro static pages, or
      embedded docs. For SvelteKit-first wiring, see
      <a href="{base}/docs/integration/sveltekit">SvelteKit integration</a>.
    </p>

    <h2>Install</h2>
    <pre><code>{pnpmAdd}</code></pre>
    <p>
      Package README:
      <a href="{GITHUB_REPO_URL}/blob/main/packages/graph-elements/README.md" rel="noopener noreferrer"
        ><code>packages/graph-elements/README.md</code></a
      >.
    </p>

    <h2>Register the canvas</h2>
    <p>Import once so <code>&lt;rg-graph-canvas&gt;</code> is defined:</p>
    <pre><code>import "@restormel/graph-elements";</code></pre>

    <h2>Plain HTML example</h2>
    <pre><code>{wcExample}</code></pre>
    <p>
      Set <strong>object props</strong> (<code>nodes</code>, <code>edges</code>) on the element from JavaScript — same
      pattern as <code>@restormel/keys-elements</code>. React hosts should use a ref and assign after mount.
    </p>

    <h2>Layout REST (optional)</h2>
    <p>
      The canvas runs <code>computeLayout</code> internally. For server-side or precomputed positions, call
      <strong>POST /graph/v1/layout</strong> with Contract v0 <code>GraphData</code> inline:
    </p>
    <pre><code>{layoutCurl}</code></pre>
    <p>
      Response includes <code>layout.positions</code> keyed by node id. Hosted snapshot reads
      (<code>GET /graph/v1/snapshots/&#123;id&#125;</code>) return <code>404</code> until Phase 6 operator persistence.
    </p>

    <h2>CSS tokens</h2>
    <p>
      <code>rg-graph-canvas</code> ships a minimal token sheet inside shadow DOM. Override host tokens on the element or
      a parent if your app already defines SOPHIA-compatible <code>--color-*</code> variables.
    </p>

    <h2>Events</h2>
    <ul>
      <li><code>rg-node-select</code> — detail <code>&#123; nodeId &#125;</code></li>
      <li><code>rg-selected-node-change</code> — detail <code>&#123; nodeId &#125;</code></li>
    </ul>

    <h2>Maintenance mode</h2>
    <p>
      <code>@restormel/ui-graph-svelte</code> remains available for existing Svelte consumers (bugfix-only until Phase 7).
      SOPHIA adopts Web Components in Phase 8.
    </p>
  </div>
</DocArticle>
