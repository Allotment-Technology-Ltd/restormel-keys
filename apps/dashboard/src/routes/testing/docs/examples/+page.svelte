<script lang="ts">
  import { githubRepoUrl } from "$lib/testing/site.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="Examples"
  description="Runnable sample suite, GitHub Actions wiring, and consumption notes live in the open-source repo."
>
  <div class="doc-prose">
    <ul>
      <li>
        <a href={`${githubRepoUrl}/tree/main/examples/testing-basic-web`} rel="noopener noreferrer"><code>examples/testing-basic-web/</code></a> —
        static page, <code>web-critical</code> suite, <code>pnpm run demo</code> after building packages and installing Playwright
        Chromium (see README).
      </li>
      <li>
        <a href={`${githubRepoUrl}/tree/main/examples/testing-github-actions`} rel="noopener noreferrer"><code>examples/testing-github-actions/</code></a>
        — sample workflow using the composite action.
      </li>
      <li>
        <a href={`${githubRepoUrl}/blob/main/docs/testing/oss-consumption.md`} rel="noopener noreferrer"
          ><code>docs/testing/oss-consumption.md</code></a
        >
        — using the CLI and action from another repository.
      </li>
    </ul>
    <p>
      Plot-style reference layouts may land under additional <code>examples/*</code> as they stabilise. Specs and field behaviour:
      <a href={`${githubRepoUrl}/tree/main/docs`} rel="noopener noreferrer">repo <code>docs/</code> →</a>
    </p>
  </div>
</DocArticle>
