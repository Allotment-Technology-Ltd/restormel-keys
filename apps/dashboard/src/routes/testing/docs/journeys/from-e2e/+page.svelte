<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="Journey: Escaping brittle E2E"
  description="Selector-heavy suites miss AI regressions; you want goals tied to user outcomes."
  stub={false}
>
  <div class="doc-prose">
    <p>
      Pair <a href="{base}/docs/guides/test-definition">Test definition</a> with
      <a href="{base}/docs/walkthrough/phase-0-inventory">inventory</a> and
      <a href="{base}/docs/walkthrough/phase-3-first-goal">Phase 3 — First goal</a>. Keep Playwright as execution, not the
      contract you optimise for.
    </p>
  </div>
</DocArticle>
