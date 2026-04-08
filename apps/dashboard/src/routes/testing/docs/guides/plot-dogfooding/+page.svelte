<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import { githubRepoUrl } from "$lib/testing/site.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="Plot dogfooding"
  description="Plot is the first forcing function: a small web-critical suite (5–8 goals) that proves the MVP in a real AI-enabled product."
>
  <div class="doc-prose">
    <p>Illustrative first goals from the MVP spec:</p>
    <ul>
      <li><code>auth-login-session</code></li>
      <li><code>onboarding-complete</code></li>
      <li><code>dashboard-ready</code></li>
      <li>Core domain journeys, a sandbox payment/subscription flow, a perf smoke goal.</li>
    </ul>
    <p>
      Rules: explicit success criteria, Keys-backed execution where models are involved, same runs locally and in CI. For
      Plotbudget.com and other apps off the registry, add <code>@restormel/testing-cli@^0.1.0</code> as a dev dependency and
      keep the suite in the product repo.
    </p>
    <p>
      Reference material: repo <code>docs/restormel-testing-mvp-spec.md</code> (Plot MVP target journeys). Runnable minimal layout:
      <a href={`${githubRepoUrl}/tree/main/examples/testing-basic-web`} rel="noopener noreferrer"><code>examples/testing-basic-web/</code></a> ·
      <a href="{base}/docs/examples">Examples</a> index.
    </p>
  </div>
</DocArticle>
