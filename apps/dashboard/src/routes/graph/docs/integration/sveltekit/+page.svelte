<script lang="ts">
  import DocArticle from "$lib/graph/components/docs/DocArticle.svelte";
  import { graphBase as base } from "$lib/graph/paths.js";
  import { GITHUB_REPO_URL } from "$lib/site-nav";

  const packageJsonDeps = `{
  "dependencies": {
    "@restormel/graph-core": "^0.1.1",
    "@restormel/ui-graph-svelte": "^0.1.1"
  }
}`;

  const pnpmAdd = "pnpm add @restormel/graph-core @restormel/ui-graph-svelte";

  const verifyCommands = `npm view @restormel/graph-core version
npm view @restormel/ui-graph-svelte version`;

  const viteConfig = `import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  ssr: {
    noExternal: ["@restormel/ui-graph-svelte", "@restormel/graph-core"],
  },
});`;

  const closeScript = "</scr" + "ipt>";
  const minimalExample = [
    '<script lang="ts">',
    '  import { GraphCanvas } from "@restormel/ui-graph-svelte";',
    '  import type { GraphData } from "@restormel/graph-core/viewModel";',
    "",
    "  const graphData: GraphData = {",
    '    nodes: [',
    '      { id: "a", type: "source", label: "Source A" },',
    '      { id: "b", type: "claim", label: "Claim B" },',
    "    ],",
    '    edges: [{ from: "a", to: "b", type: "supports" }],',
    "    ghostNodes: [],",
    "    ghostEdges: [],",
    "  };",
    closeScript,
    "",
    "<GraphCanvas",
    "  nodes={graphData.nodes}",
    "  edges={graphData.edges}",
    "  ghostNodes={graphData.ghostNodes}",
    "  ghostEdges={graphData.ghostEdges}",
    "/>",
  ].join("\n");

  const optionalCssImport = `/* Optional: component-level rules from the package */
import "@restormel/ui-graph-svelte/styles.css";`;
</script>

<DocArticle
  title="Integrate Restormel Graph in a SvelteKit app"
  description="Canonical consumer guide: install exact packages, use only supported export paths, wire Vite SSR, satisfy the CSS variable contract, verify with check/build, and plan upgrades against viewModel drift."
>
  <div class="doc-prose">
    <p>
      This page is the <strong>single public integration doc</strong> for Restormel Graph. Prefer it over ad hoc prompts:
      it is versioned with the restormel.dev site and mirrors the maintainer note
      <a href="{GITHUB_REPO_URL}/blob/main/docs/restormel-graph-sophia-consumer.md" rel="noopener noreferrer"
        ><code>docs/restormel-graph-sophia-consumer.md</code></a
      >. CLI or MCP helpers are optional; they must not contradict this guide.
    </p>

    <h2>What to install</h2>
    <p>
      Minimum published versions (bump as your semver range allows; verify on npm after a fresh publish—registry lag can
      briefly hide tarballs):
    </p>
    <table>
      <thead>
        <tr>
          <th>Package</th>
          <th>Role</th>
          <th>Peer / notes</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>@restormel/graph-core</code></td>
          <td>DTOs + layout / trace / workspace</td>
          <td>Node <code>&gt;=20</code>; no Svelte peer</td>
        </tr>
        <tr>
          <td><code>@restormel/ui-graph-svelte</code></td>
          <td>Svelte UI + semantic styles + packaged CSS export</td>
          <td>Peer: <code>svelte ^5.0.0</code>; <code>@sveltejs/kit</code> is a consumer framework, not a peer</td>
        </tr>
      </tbody>
    </table>
    <pre><code>{pnpmAdd}</code></pre>
    <p>Or add to <code>package.json</code>:</p>
    <pre><code>{packageJsonDeps}</code></pre>

    <h2>What each package owns</h2>
    <ul>
      <li>
        <strong>graph-core</strong> — Contract v0 types in <code>viewModel</code>; orbital <code>layout</code>; trace
        labels; workspace filters. No components, no contracts package.
      </li>
      <li>
        <strong>ui-graph-svelte</strong> — <code>GraphCanvas</code>, <code>NodeDetail</code>,
        <code>graphCanvasEdgeKey</code>, optional <code>styles.css</code>.
      </li>
    </ul>

    <h2>Stable import map</h2>
    <p>Use only paths declared in each package’s <code>exports</code>. Do not deep-import <code>src/</code>.</p>
    <table>
      <thead>
        <tr>
          <th>Import path</th>
          <th>Purpose</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>@restormel/graph-core/viewModel</code></td>
          <td><code>GraphData</code>, <code>GraphNode</code>, <code>GraphEdge</code>, ghosts, <code>GraphRendererProps</code>, semantic style types</td>
        </tr>
        <tr>
          <td><code>@restormel/graph-core/layout</code></td>
          <td><code>computeLayout</code> (orbital positions)</td>
        </tr>
        <tr>
          <td><code>@restormel/graph-core/trace</code></td>
          <td>Trace tags / labels</td>
        </tr>
        <tr>
          <td><code>@restormel/graph-core/workspace</code></td>
          <td>Filter / scope helpers</td>
        </tr>
        <tr>
          <td><code>@restormel/graph-core</code></td>
          <td>Barrel of MVP exports</td>
        </tr>
        <tr>
          <td><code>@restormel/ui-graph-svelte</code></td>
          <td><code>GraphCanvas</code>, <code>NodeDetail</code>, <code>graphCanvasEdgeKey</code>; types <code>GraphCanvasProps</code>, <code>NodeDetailProps</code></td>
        </tr>
        <tr>
          <td><code>@restormel/ui-graph-svelte/styles.css</code></td>
          <td>Packaged component CSS (see CSS contract)</td>
        </tr>
      </tbody>
    </table>

    <h2>Framework wiring (Vite / SvelteKit)</h2>
    <p>
      Prebundling and SSR can break Svelte libraries unless both packages are treated as external for SSR bundling. Mirror
      <code>apps/restormel-graph-demo/vite.config.ts</code> in this repo:
    </p>
    <pre><code>{viteConfig}</code></pre>
    <p>
      If dev prebundle errors mention graph-core only, try <code>optimizeDeps.include</code> for
      <code>@restormel/graph-core/layout</code> (rare).
    </p>

    <h2>CSS contract</h2>
    <p>
      The canvas reads <strong>CSS variables</strong> for colours, radius, type, spacing, motion, and focus rings (e.g.
      <code>--color-bg</code>, <code>--color-text</code>, <code>--color-muted</code>, <code>--color-border</code>,
      <code>--color-sage</code>, <code>--radius-sm</code>, <code>--font-ui</code>, <code>--space-*</code>,
      <code>--transition-fast</code>, <code>--focus-ring-width</code>, …). If your app already defines a compatible
      <code>:root</code> token sheet, you may not need extra palette imports from Restormel.
    </p>
    <p>
      <strong><code>styles.css</code> from the UI package</strong> ships component-level rules; it does not replace your
      palette. Import it when you want packaged rules in one place or when debugging style drift.
    </p>
    <pre><code>{optionalCssImport}</code></pre>

    <h2>Integration seam</h2>
    <p>
      <strong>Hosts produce <code>GraphData</code>; adapters live in the app.</strong> Domain-specific mappers (e.g. from an
      internal graph kit) should return types compatible with <code>@restormel/graph-core/viewModel</code>.
    </p>

    <h2>Minimal runnable example (analogue to a five-line quickstart)</h2>
    <pre><code>{minimalExample}</code></pre>
    <p>
      A full SvelteKit demo with mock data lives under
      <a href="{GITHUB_REPO_URL}/tree/main/apps/restormel-graph-demo" rel="noopener noreferrer"
        ><code>apps/restormel-graph-demo</code></a
      >
      (<code>/dev/graph-portability</code>).
    </p>

    <h2>Verification</h2>
    <p>After install:</p>
    <pre><code>{verifyCommands}</code></pre>
    <p>Then in your app:</p>
    <pre><code>pnpm run check
pnpm run build</code></pre>
    <p>
      Upstream CI runs <code>scripts/smoke-graph-packages-consumer.sh</code> (tarball install + check + build on a copy of
      the demo outside the workspace graph).
    </p>

    <h2>Upgrade / drift</h2>
    <ul>
      <li>
        <strong>Authoritative DTOs:</strong> <code>packages/graph-core/src/viewModel.ts</code> in restormel-keys (banner:
        RESTORMEL GRAPH CONTRACT v0).
      </li>
      <li>
        <strong>Diff</strong> that file across versions before bumping; if fields change, semver should reflect breaks and
        your adapter must update first.
      </li>
      <li>Track package history via npm and GitHub releases tagged <code>graph-v*</code>.</li>
    </ul>

    <h2>Not in MVP (explicit)</h2>
    <ul>
      <li>No <code>@restormel/contracts</code> inside graph-core or ui-graph-svelte.</li>
      <li>Reasoning-heavy modules (compare, lineage, projection, …) stay app-side or in separate extensions.</li>
    </ul>

    <h2>Related docs</h2>
    <p>
      <a href="{base}/docs/reference/api">API reference</a> ·
      <a href="{base}/docs/guides/migration-from-custom-canvas">Migrate from a custom canvas</a> ·
      <a href="{base}/docs/reference/releases-and-support">Releases &amp; support</a>
    </p>
  </div>
</DocArticle>
