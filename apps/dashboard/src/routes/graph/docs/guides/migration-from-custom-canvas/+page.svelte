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
        <strong>Compare / lineage / projection / evaluation?</strong> Prefer the published
        <a href="{base}/docs/extensions/reasoning"><code>@restormel/graph-reasoning-extensions</code></a> package (plus
        <code>@restormel/contracts</code>) and map results <em>into</em> <code>GraphData</code> — do not fork Contract v0
        DTOs. Add internal packages only for org-specific logic on top.
      </li>
      <li>
        <strong>Monorepo pattern:</strong> npm canvas + contracts-backed extensions + <strong>one adapter</strong> that
        converts snapshots into <code>GraphData</code>. See
        <a href="{base}/docs/reference/performance">Performance &amp; scale</a> if you need to cap graph size.
      </li>
      <li>
        <strong>Already deleted legacy graph code?</strong> Focus on adapter correctness and CSS parity; run the
        verification commands from the integration page.
      </li>
    </ul>

    <h2>Performance</h2>
    <p>
      Large graphs: pre-filter or cluster in your adapter before calling <code>computeLayout</code> / <code>GraphCanvas</code>.
      Details: <a href="{base}/docs/reference/performance">Performance &amp; scale</a>.
    </p>

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
