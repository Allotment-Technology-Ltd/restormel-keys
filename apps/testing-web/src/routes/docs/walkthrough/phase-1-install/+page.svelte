<script lang="ts">
  import { base } from "$app/paths";
  import DocArticle from "$lib/components/docs/DocArticle.svelte";
  import WalkthroughAgentPrompts from "$lib/components/docs/WalkthroughAgentPrompts.svelte";
</script>

<DocArticle
  title="Phase 1 — Install and configure"
  description="Install the Testing CLI (when published), scaffold `restormel-testing.yaml`, run doctor-style checks, and align Node/pnpm with the Restormel module stack."
>
  <div class="phase-page">
    <div class="doc-prose">
      <p>Expected commands (see CLI <code>--help</code> and repo <code>README</code>):</p>
      <pre>restormel-testing init{"\n"}restormel-testing doctor --config restormel-testing.yaml{"\n"}restormel-testing validate --config restormel-testing.yaml</pre>
      <p>From this monorepo after <code>pnpm run build:testing-packages</code>, use <code>pnpm exec testing …</code> (or <code>restormel-testing</code> when published).</p>
      <p>
        <a href="{base}/docs/guides/config">Configuration</a> ·
        <a href="{base}/docs/walkthrough/phase-0-inventory">← Phase 0</a> ·
        <a href="{base}/docs/walkthrough/phase-2-keys">Phase 2 — Wire Keys →</a>
      </p>
    </div>
    <WalkthroughAgentPrompts>
      <div class="doc-prose">
        <ol>
          <li>Add the Testing CLI to this repo per current install instructions; run <code>doctor</code> and capture output.</li>
          <li>Create <code>restormel-testing.yaml</code> via <code>init</code> (starter includes one example suite and goal) or hand-edit; run <code>validate</code>.</li>
          <li>Ensure Node 20 and pnpm match <code>engines</code>; document any CI image changes needed.</li>
        </ol>
      </div>
    </WalkthroughAgentPrompts>
  </div>
</DocArticle>
