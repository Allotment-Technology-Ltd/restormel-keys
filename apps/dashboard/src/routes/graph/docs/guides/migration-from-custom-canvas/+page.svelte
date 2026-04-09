<script lang="ts">
  import DocArticle from "$lib/graph/components/docs/DocArticle.svelte";
  import { graphBase as base } from "$lib/graph/paths.js";
  import { GITHUB_REPO_URL } from "$lib/site-nav";
</script>

<DocArticle
  title="Migrate from a custom canvas"
  description="Checklist for replacing in-app graph components with @restormel/ui-graph-svelte and @restormel/graph-core—imports, Vite, CSS, deduplication, and verification."
>
  <div class="doc-prose">
    <p>
      This guide assumes you are <strong>replacing</strong> local graph code, not greenfield. Follow the canonical
      <a href="{base}/docs/integration/sveltekit">SvelteKit integration</a> page first, then use the checklist below.
    </p>

    <h2>Checklist</h2>
    <ol>
      <li>Add npm dependencies and <code>ssr.noExternal</code> entries (see integration guide).</li>
      <li>Swap imports: local canvas / detail / semantic style helpers → <code>@restormel/ui-graph-svelte</code>.</li>
      <li>Swap types and layout/trace/workspace → <code>@restormel/graph-core</code> subpaths or barrel.</li>
      <li>Ensure global CSS satisfies the variable contract; add <code>styles.css</code> from the UI package if needed.</li>
      <li>Remove duplicate components and stale <code>viewModel</code> copies from the repo—single source of truth is npm.</li>
      <li>Run <code>pnpm run check</code>, targeted tests, and a manual smoke route if you have one.</li>
    </ol>

    <h2>Decision hints</h2>
    <ul>
      <li>
        <strong>Still need compare / lineage / projection in-app?</strong> Keep those modules; they should map
        <em>into</em> <code>GraphData</code> rather than forking Contract v0 DTOs.
      </li>
      <li>
        <strong>Monorepo pattern:</strong> colocate reasoning-specific code in a <strong>dedicated workspace package</strong>
        (for example an internal <code>@your-org/graph-reasoning-extensions</code>—similar in spirit to how larger apps split
        “canvas from npm” vs “compare/lineage/projection”) that depends on <code>@restormel/graph-core</code> and your
        contracts layer, then adapt into <code>GraphData</code> at the edge. Keeps the replace-custom-canvas story
        copy-paste clear: npm canvas + one local extensions package, not a second forked <code>viewModel</code>.
      </li>
      <li>
        <strong>Already deleted legacy graph code?</strong> Focus on adapter correctness and CSS parity; run the
        verification commands from the integration page.
      </li>
    </ul>

    <h2>Risk callouts</h2>
    <ul>
      <li>
        <strong>Duplicate package names:</strong> a monorepo workspace package named <code>@restormel/graph-core</code> vs
        npm can confuse resolution—prefer a single source (npm or explicit tarball overrides).
      </li>
      <li><strong>Lockfile pins:</strong> ensure <code>ui-graph-svelte</code> and <code>graph-core</code> resolve the same version.</li>
      <li><strong>Registry lag:</strong> immediately after <code>graph-v*</code> publishes, <code>npm view</code> can be stale briefly.</li>
    </ul>

    <p>
      Maintainer detail:
      <a href="{GITHUB_REPO_URL}/blob/main/docs/restormel-graph-sophia-consumer.md" rel="noopener noreferrer"
        >restormel-graph-sophia-consumer.md</a
      >.
    </p>
  </div>
</DocArticle>
