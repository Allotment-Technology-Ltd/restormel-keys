<script lang="ts">
  import DocArticle from "$lib/graph/components/docs/DocArticle.svelte";
  import { graphBase as base } from "$lib/graph/paths.js";
  import { GITHUB_REPO_URL } from "$lib/site-nav";
</script>

<DocArticle
  title="Releases & support"
  description="Publish trains, compatibility expectations, and what Restormel supports for npm consumers versus fork-or-extend scenarios."
>
  <div class="doc-prose">
    <h2>Release train</h2>
    <p>
      Graph packages publish from this monorepo when maintainers push a git tag matching <code>graph-v*</code>. Workflow:
      <a href="{GITHUB_REPO_URL}/blob/main/.github/workflows/publish-graph.yml" rel="noopener noreferrer"
        ><code>publish-graph.yml</code></a
      >. Changelog entries for the graph stack live in the root
      <a href="{GITHUB_REPO_URL}/blob/main/CHANGELOG.md" rel="noopener noreferrer">CHANGELOG.md</a> under Graph-related
      bullets.
    </p>
    <p>
      npm: <a href="https://www.npmjs.com/package/@restormel/graph-core" rel="noopener noreferrer">@restormel/graph-core</a>,
      <a href="https://www.npmjs.com/package/@restormel/ui-graph-svelte" rel="noopener noreferrer"
        >@restormel/ui-graph-svelte</a
      >.
    </p>

    <h2>Compatibility matrix (initial)</h2>
    <table>
      <thead>
        <tr>
          <th>Layer</th>
          <th>Tested / expected</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Node.js</td>
          <td><code>&gt;=20</code> (graph-core engine field)</td>
        </tr>
        <tr>
          <td>Svelte</td>
          <td><code>^5.0.0</code> peer on ui-graph-svelte</td>
        </tr>
        <tr>
          <td>Vite + SvelteKit</td>
          <td>Aligned with <code>apps/restormel-graph-demo</code> in this repo; use <code>ssr.noExternal</code> as documented</td>
        </tr>
      </tbody>
    </table>
    <p>Expand this matrix as you certify more minor versions in consumer apps.</p>

    <h2>Support boundary</h2>
    <ul>
      <li>
        <strong>Supported for consumers:</strong> documented export paths, Contract v0 DTO stability policy, and canvas
        behaviour consistent with published versions. Integration guidance on
        <a href="{base}/docs/integration/sveltekit">restormel.dev</a> is kept aligned with those releases.
      </li>
      <li>
        <strong>Fork or extend:</strong> deep imports, copied <code>src</code>, vendored forks with divergent DTOs, or
        embedding reasoning contracts inside the graph packages—out of scope for upstream support.
      </li>
    </ul>

    <h2>Docs vs app releases</h2>
    <p>
      The <strong>restormel.dev</strong> narrative (including <code>/graph/docs</code>) deploys with the dashboard app.
      npm packages version on <code>graph-v*</code> tags. Treat integration steps as accurate for the site deployment you
      are viewing; cross-check semver on npm when pinning.
    </p>
  </div>
</DocArticle>
