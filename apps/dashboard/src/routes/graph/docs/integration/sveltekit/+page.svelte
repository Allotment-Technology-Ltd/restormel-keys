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

  const npmBadgeGraphCore =
    "https://img.shields.io/npm/v/@restormel/graph-core?label=%40restormel%2Fgraph-core&logo=npm";
  const npmBadgeUi =
    "https://img.shields.io/npm/v/@restormel/ui-graph-svelte?label=%40restormel%2Fui-graph-svelte&logo=npm";
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
      >
      for SOPHIA-depth wiring. <strong>Step-by-step on this site is the primary interface;</strong> CLI or MCP tooling is
      fine only if it is generated or tested against the same content and never treated as the only source of truth.
    </p>

    <div class="doc-version-strip" role="note" aria-label="Docs and npm version alignment">
      <p>
        <strong>Verified against npm:</strong>
        <code>@restormel/graph-core@0.1.1</code> and <code>@restormel/ui-graph-svelte@0.1.1</code> (see badges below).
        When you upgrade, bump <strong>both</strong> packages in lockstep—<code>ui-graph-svelte</code> depends on
        graph-core, and mixed minors across the pair are a common source of drift.
      </p>
      <p class="doc-badge-row">
        <a href="https://www.npmjs.com/package/@restormel/graph-core" rel="noopener noreferrer">
          <img src={npmBadgeGraphCore} alt="npm version @restormel/graph-core" width="156" height="20" loading="lazy" />
        </a>
        <a href="https://www.npmjs.com/package/@restormel/ui-graph-svelte" rel="noopener noreferrer">
          <img src={npmBadgeUi} alt="npm version @restormel/ui-graph-svelte" width="200" height="20" loading="lazy" />
        </a>
      </p>
    </div>

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
      The canvas expects a <strong>:root</strong> token story. Use the table below to decide what you must define vs what
      is optional; diff your <code>design-tokens.css</code> (or equivalent) against the demo reference file.
    </p>
    <table>
      <thead>
        <tr>
          <th scope="col">Layer</th>
          <th scope="col">Required for sensible defaults</th>
          <th scope="col">Optional / extended parity</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Surfaces &amp; text</td>
          <td>
            <code>--color-bg</code>, <code>--color-text</code>, <code>--color-muted</code>, <code>--color-border</code>,
            <code>--color-surface</code>, <code>--color-surface-raised</code>
          </td>
          <td><code>--color-surface-sunken</code>, <code>--color-dim</code> (decorative only)</td>
        </tr>
        <tr>
          <td>Accents &amp; states</td>
          <td><code>--color-sage</code> (+ <code>--color-sage-bg</code>, <code>--color-sage-border</code> where used)</td>
          <td>
            <code>--color-copper</code>, <code>--color-blue</code>, <code>--color-teal</code>, <code>--color-coral</code>,
            <code>--color-purple</code>, <code>--color-amber</code> (+ matching <code>*-bg</code> / <code>*-border</code>)
          </td>
        </tr>
        <tr>
          <td>Type &amp; rhythm</td>
          <td>
            <code>--font-ui</code>, <code>--text-meta</code> or <code>--text-ui</code>, <code>--text-body</code>,
            <code>--leading-body</code>, <code>--space-*</code> used by controls
          </td>
          <td><code>--font-display</code>, <code>--font-body</code>, larger type scale tokens</td>
        </tr>
        <tr>
          <td>Chrome</td>
          <td>
            <code>--radius-sm</code>, <code>--radius-md</code>, <code>--transition-fast</code>,
            <code>--focus-ring-width</code>, <code>--focus-ring-color</code>, <code>--focus-ring-offset</code>
          </td>
          <td>—</td>
        </tr>
        <tr>
          <td>Packaged library CSS</td>
          <td>—</td>
          <td>
            <code>@restormel/ui-graph-svelte/styles.css</code> — component-scoped rules (build artefact
            <code>dist/ui-graph-svelte.css</code> in repo). Does <strong>not</strong> define the palette; import for layout
            / animation parity or when you have no token sheet yet.
          </td>
        </tr>
      </tbody>
    </table>
    <p>
      <strong>Stable references to diff or copy from:</strong>
      <a href="{GITHUB_REPO_URL}/blob/main/apps/restormel-graph-demo/src/lib/graph-demo-tokens.css" rel="noopener noreferrer"
        ><code>apps/restormel-graph-demo/src/lib/graph-demo-tokens.css</code></a
      >
      (full SOPHIA Design&nbsp;B mirror used by the demo) · packaged stylesheet entrypoint in repo tree
      <a href="{GITHUB_REPO_URL}/tree/main/packages/ui-graph-svelte" rel="noopener noreferrer"
        ><code>packages/ui-graph-svelte</code></a
      >
      (<code>exports["./styles.css"]</code> → built CSS).
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
      <li>
        Compare, lineage, projection, evaluation, diff, and summary ship in the published package
        <a href="{base}/docs/extensions/reasoning"><code>@restormel/graph-reasoning-extensions</code></a> (with contracts) —
        not inside the canvas packages. Adapt their outputs into <code>GraphData</code> for <code>GraphCanvas</code>.
      </li>
    </ul>

    <h2>Troubleshooting</h2>
    <ul>
      <li>
        <strong>SSR / “Cannot find module” during dev or build:</strong> ensure <strong>both</strong>
        <code>@restormel/ui-graph-svelte</code> and <code>@restormel/graph-core</code> are in
        <code>ssr.noExternal</code>. Listing only the UI package is a common mistake when graph-core subpaths are pulled in
        transitively.
      </li>
      <li>
        <strong>Vite prebundle errors:</strong> try <code>optimizeDeps.include: ["@restormel/graph-core/layout"]</code> (or
        the subpath mentioned in the error); clear Vite cache if upgrades look “stuck.”
      </li>
      <li>
        <strong><code>svelte-check</code> / callback types:</strong> import <code>GraphCanvasProps</code> /
        <code>NodeDetailProps</code> from <code>@restormel/ui-graph-svelte</code>; trust published <code>.d.ts</code> over
        inferred props.
      </li>
      <li>
        <strong>Duplicate <code>@restormel/graph-core</code>:</strong> a workspace package with the same name as npm will
        shadow installs—rename or remove the local package and use npm (or explicit tarball overrides) as a single source.
      </li>
      <li>
        <strong>Lockfile mismatch:</strong> after bumping one of the pair, run a fresh install so
        <code>ui-graph-svelte</code> resolves the same graph-core version you intend.
      </li>
    </ul>

    <h2>Related docs</h2>
    <p>
      <a href="{base}/docs/extensions/reasoning">Reasoning extensions &amp; contracts</a> ·
      <a href="{base}/docs/reference/contract-v0-scope">Contract v0 scope</a> ·
      <a href="{base}/docs/guides/recipes">Recipes</a> ·
      <a href="{base}/docs/reference/api">API reference</a> ·
      <a href="{base}/docs/guides/migration-from-custom-canvas">Migrate from a custom canvas</a> ·
      <a href="{base}/docs/reference/releases-and-support">Releases &amp; support</a>
    </p>
  </div>
</DocArticle>

<style>
  .doc-version-strip {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    margin: 0 0 var(--space-8);
    padding: var(--space-4);
    background: var(--rm-surface-2);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    border-left: var(--border-4) solid var(--rm-sage);
  }
  .doc-version-strip strong {
    color: var(--rm-text);
  }
  .doc-version-strip p {
    margin: 0 0 var(--space-3);
  }
  .doc-version-strip p:last-child {
    margin-bottom: 0;
  }
  .doc-badge-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: center;
  }
  .doc-badge-row a {
    line-height: 0;
  }
  .doc-badge-row img {
    display: block;
    max-width: 100%;
    height: auto;
  }
</style>
