<script lang="ts">
  import { base } from "$app/paths";
  import DocArticle from "$lib/components/docs/DocArticle.svelte";
  import WalkthroughAgentPrompts from "$lib/components/docs/WalkthroughAgentPrompts.svelte";
</script>

<DocArticle
  title="Phase 3 — Define your first goal"
  description="Author one business-meaningful goal with explicit success criteria and evidence you would trust in a PR review—before you optimise for CI scale."
>
  <div class="phase-page">
    <div class="doc-prose">
      <p>Anchor on:</p>
      <ul>
        <li>Clear user outcome in the goal description (what “green” means for the product).</li>
        <li>Machine-checkable signals first; rubric/judge steps only where unavoidable.</li>
        <li>Timeouts and retries realistic for CI, not only your laptop.</li>
      </ul>
      <p>
        <a href="{base}/docs/guides/test-definition">Test definition</a> ·
        <a href="{base}/docs/walkthrough/phase-2-keys">← Phase 2</a> ·
        <a href="{base}/docs/walkthrough/phase-4-local-run">Phase 4 — Local run →</a>
      </p>
    </div>
    <WalkthroughAgentPrompts>
      <div class="doc-prose">
        <ol>
          <li>Draft one goal for our highest-risk AI journey; write success criteria as bullet assertions.</li>
          <li>Identify minimal browser or API steps the runner must perform to observe those signals.</li>
          <li>Peer-review: would a teammate trust this goal in a failed PR without re-running the whole suite blind?</li>
        </ol>
      </div>
    </WalkthroughAgentPrompts>
  </div>
</DocArticle>
