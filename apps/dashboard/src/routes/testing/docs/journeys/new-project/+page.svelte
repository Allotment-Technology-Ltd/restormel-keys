<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="Journey: Starting a new project"
  description="You want a working local run and a clear path to CI with minimal surface area."
  stub={false}
>
  <div class="doc-prose">
    <p>
      Go straight to <a href="{base}/docs/getting-started/new-project">New project</a> and the
      <a href="{base}/docs/walkthrough">walkthrough</a> starting at
      <a href="{base}/docs/walkthrough/phase-1-install">Phase 1 — Install</a>.
    </p>
  </div>
</DocArticle>
