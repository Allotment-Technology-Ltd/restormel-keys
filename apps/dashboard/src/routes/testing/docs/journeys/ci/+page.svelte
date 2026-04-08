<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="Journey: CI / GitHub Actions"
  description="You need PR gates, stable summaries, and local reproduction of failures."
  stub={false}
>
  <div class="doc-prose">
    <p>
      Read <a href="{base}/docs/guides/ci">CI / GitHub Actions</a>, then implement
      <a href="{base}/docs/walkthrough/phase-5-ci">Walkthrough — Phase 5 — CI</a> and
      <a href="{base}/docs/walkthrough/verification-strategy">Verification strategy</a>.
    </p>
  </div>
</DocArticle>
