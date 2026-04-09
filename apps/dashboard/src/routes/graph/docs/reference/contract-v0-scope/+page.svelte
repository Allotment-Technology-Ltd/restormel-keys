<script lang="ts">
  import DocArticle from "$lib/graph/components/docs/DocArticle.svelte";
  import { graphBase as base } from "$lib/graph/paths.js";
  import { GITHUB_REPO_URL } from "$lib/site-nav";
</script>

<DocArticle
  title="Contract v0 scope"
  description="What @restormel/graph-core guarantees in v0: frozen DTOs in viewModel.ts, contracts-free helpers, and modules deliberately excluded from the canvas contract."
>
  <div class="doc-prose">
    <p>
      The authoritative checklist for “what is v0” lives in the repo file
      <a href="{GITHUB_REPO_URL}/blob/main/packages/graph-core/GRAPH_CORE_V0_SCOPE.md" rel="noopener noreferrer"
        ><code>GRAPH_CORE_V0_SCOPE.md</code></a
      >. This page summarizes it for integrators who should not have to diff <code>viewModel.ts</code> on GitHub to understand
      semver expectations.
    </p>

    <h2>In scope (Contract v0)</h2>
    <ul>
      <li>
        <strong>Frozen DTOs</strong> in <code>@restormel/graph-core/viewModel</code>:
        <code>GraphData</code>, <code>GraphNode</code>, <code>GraphEdge</code>, ghost types, viewport commands, semantic style
        records, and related unions.
      </li>
      <li>
        <strong>No <code>@restormel/contracts</code></strong> inside graph-core MVP — canvas types stay portable across hosts
        that do not ship the reasoning stack.
      </li>
      <li>
        <strong>Co-located helpers</strong> (still contracts-free today): <code>layout</code> (<code>computeLayout</code>),
        <code>trace</code>, <code>workspace</code>.
      </li>
    </ul>

    <h2>Explicitly out of v0</h2>
    <p>
      Compare, lineage, projection, graph diff, evaluation, and summary modules that depend on contracts live in
      <a href="{base}/docs/extensions/reasoning"><code>@restormel/graph-reasoning-extensions</code></a> — not in Contract v0.
      Do not expect those APIs to ship from <code>graph-core</code>.
    </p>

    <h2>Semver expectations (human summary)</h2>
    <ul>
      <li>
        <strong>Patch / minor (canvas):</strong> bugfixes, non-breaking additions to optional fields or helpers, docs — as
        long as published DTOs remain compatible for typical consumers. Follow release notes on npm and
        <a href="{base}/docs/reference/releases-and-support">Releases &amp; support</a>.
      </li>
      <li>
        <strong>Major:</strong> breaking changes to <code>GraphData</code> / node-edge shapes, removed exports, or behaviour
        that forces adapter rewrites. When in doubt, compare <code>viewModel.ts</code> between versions and run your
        <code>svelte-check</code> / integration tests.
      </li>
    </ul>

    <p>
      <a href="{base}/docs/reference/api">← API reference</a> ·
      <a href="{GITHUB_REPO_URL}/blob/main/packages/graph-core/GRAPH_CORE_V0_SCOPE.md" rel="noopener noreferrer"
        >Full scope doc (repo)</a
      >
    </p>
  </div>
</DocArticle>
