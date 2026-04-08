<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
  import WalkthroughAgentPrompts from "$lib/testing/components/docs/WalkthroughAgentPrompts.svelte";
</script>

<DocArticle
  title="Migration paths"
  description="How to move from Playwright-only imperative suites, ad hoc LLM eval notebooks, or mixed legacy E2E—without boiling the ocean."
>
  <div class="phase-page">
    <div class="doc-prose">
      <p>
        Full migration guides ship after more field experience. For now, use
        <a href="{base}/docs/walkthrough/phase-0-inventory">Phase 0 — Inventory</a> and
        <a href="{base}/docs/journeys/from-e2e">Journey: Escaping brittle E2E</a> to pick the first 5–8 goals.
      </p>
      <p>
        <a href="{base}/docs/walkthrough">Walkthrough index</a> ·
        <a href="{base}/docs/walkthrough/verification-strategy">Verification strategy</a>
      </p>
    </div>
    <WalkthroughAgentPrompts>
      <div class="doc-prose">
        <ol>
          <li>Export a list of our top 20 Playwright tests; mark which assert user outcomes vs implementation detail.</li>
          <li>Pick three to retire in favour of one Testing goal each; justify in the PR description.</li>
          <li>Identify any eval notebooks that duplicate those goals; plan to delete or archive after parity.</li>
        </ol>
      </div>
    </WalkthroughAgentPrompts>
  </div>
</DocArticle>
