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
      npm (canvas): <a href="https://www.npmjs.com/package/@restormel/graph-core" rel="noopener noreferrer"
        >@restormel/graph-core</a
      >,
      <a href="https://www.npmjs.com/package/@restormel/ui-graph-svelte" rel="noopener noreferrer"
        >@restormel/ui-graph-svelte</a
      >. Reasoning extensions (separate train):
      <a href="https://www.npmjs.com/package/@restormel/graph-reasoning-extensions" rel="noopener noreferrer"
        >@restormel/graph-reasoning-extensions</a
      >,
      <a href="https://www.npmjs.com/package/@restormel/contracts" rel="noopener noreferrer">@restormel/contracts</a> — see
      <a href="{base}/docs/extensions/reasoning">Reasoning extensions &amp; contracts</a>.
    </p>
    <p>
      <strong>Context packs &amp; agent memory</strong> (same <code>platform-v*</code> workflow, not canvas):
      <a href="https://www.npmjs.com/package/@restormel/context-packs" rel="noopener noreferrer">@restormel/context-packs</a>,
      <a href="https://www.npmjs.com/package/@restormel/state" rel="noopener noreferrer">@restormel/state</a> — overview
      <a href="{base}/docs/extensions/state">Restormel State (agent memory)</a>; reasoning page links both to the
      graph-aware LLM story.
    </p>

    <h2>Compatibility matrix</h2>
    <p>
      CI and tarball smoke cover the repo’s pinned stack. Consumer apps on adjacent minors should work but should run their
      own <code>svelte-check</code> and a smoke route after upgrades.
    </p>
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
          <td><code>&gt;=20</code> (graph-core <code>engines</code> field)</td>
        </tr>
        <tr>
          <td>TypeScript</td>
          <td>
            <code>moduleResolution: "NodeNext"</code> or bundler resolution that honours package <code>exports</code>; use
            published <code>.d.ts</code> as source of truth for component props
          </td>
        </tr>
        <tr>
          <td>Svelte</td>
          <td><code>^5.0.0</code> peer on <code>ui-graph-svelte</code> — certify your minor (e.g. 5.20.x) in your app</td>
        </tr>
        <tr>
          <td>Vite</td>
          <td>Vite 5.x and 6.x used in this monorepo; match or exceed demo + dashboard toolchain when upgrading</td>
        </tr>
        <tr>
          <td>SvelteKit</td>
          <td>
            Aligned with <code>apps/restormel-graph-demo</code> and dashboard; <code>ssr.noExternal</code> for
            <strong>both</strong> <code>@restormel/ui-graph-svelte</code> and <code>@restormel/graph-core</code> as documented
          </td>
        </tr>
        <tr>
          <td>graph-reasoning-extensions</td>
          <td>Published on <code>platform-v*</code>; pin alongside <code>@restormel/contracts</code> — independent of
            <code>graph-v*</code></td>
        </tr>
        <tr>
          <td>context-packs, observability, state</td>
          <td>
            Published on <code>platform-v*</code>; <code>@restormel/state</code> depends on context-packs for correlation
            typing — see <a href="{base}/docs/extensions/state">Restormel State</a>
          </td>
        </tr>
      </tbody>
    </table>
    <p>Extend this matrix with specific SvelteKit / Vite patch lines as you certify them in production consumers.</p>

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
