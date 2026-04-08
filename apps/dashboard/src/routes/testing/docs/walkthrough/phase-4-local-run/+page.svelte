<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
  import WalkthroughAgentPrompts from "$lib/testing/components/docs/WalkthroughAgentPrompts.svelte";
</script>

<DocArticle
  title="Phase 4 — Run your first suite locally"
  description="Execute the suite containing your first goal; confirm verdict output (passed / failed / indeterminate), reason codes, and where artefacts land on disk."
>
  <div class="phase-page">
    <div class="doc-prose">
      <pre>restormel-testing run --suite &lt;your-suite-id&gt; --config restormel-testing.yaml{"\n"}# optional: --goal id1,id2  --json  --artifact-dir ./out/run-1{"\n"}restormel-testing report .restormel-testing/runs/run-…</pre>
      <p>
        Default artefact root: <code>.restormel-testing/runs/run-&lt;timestamp&gt;/</code> with <code>report.json</code>,
        <code>summary.md</code>, traces, and JUnit. A failed goal includes a <code>reproduction</code> command in
        <code>report.json</code> includes factual <code>judgeInvocationCount</code> when rubrics ran; <code>costEstimate</code> is a
        non-billing heuristic only.
      </p>
      <p>
        <a href="{base}/docs/guides/config">Configuration</a> ·
        <a href="{base}/docs/walkthrough/phase-3-first-goal">← Phase 3</a> ·
        <a href="{base}/docs/walkthrough/phase-5-ci">Phase 5 — CI →</a>
      </p>
    </div>
    <WalkthroughAgentPrompts>
      <div class="doc-prose">
        <ol>
          <li>Run the suite locally; paste the summary block into the PR or team notes.</li>
          <li>Force a failure (e.g. break success criteria); confirm artefact paths and reproduction command.</li>
          <li>Compare wall-clock time and flake rate over three consecutive runs; adjust retries only if justified.</li>
        </ol>
      </div>
    </WalkthroughAgentPrompts>
  </div>
</DocArticle>
