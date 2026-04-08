<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="Existing stack"
  description="You already have Playwright, CI, and probably Restormel Keys. Testing adds a goal-based orchestration layer—not a replacement migration."
>
  <div class="doc-prose">
    <p>Integration principles:</p>
    <ul>
      <li>Keep Playwright as the <strong>browser substrate</strong>; Testing owns suites, goals, verdicts, and CI contract.</li>
      <li>Map high-value journeys first (5–8 goals) instead of porting an entire legacy suite day one.</li>
      <li>Resolve models through <strong>Keys</strong> so test spend and provider policy match production semantics.</li>
      <li>Reuse existing secrets machinery—Testing configs hold <strong>opaque refs</strong>, not raw keys.</li>
    </ul>
    <p>
      See <a href="{base}/docs/journeys/from-e2e">Escaping brittle E2E</a> and the
      <a href="{base}/docs/walkthrough/phase-0-inventory">inventory</a> phase.
    </p>
  </div>
</DocArticle>
