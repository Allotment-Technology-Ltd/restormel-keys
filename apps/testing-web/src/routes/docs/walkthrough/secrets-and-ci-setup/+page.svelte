<script lang="ts">
  import { base } from "$app/paths";
  import DocArticle from "$lib/components/docs/DocArticle.svelte";
  import WalkthroughAgentPrompts from "$lib/components/docs/WalkthroughAgentPrompts.svelte";
</script>

<DocArticle
  title="Secrets and CI setup"
  description="Where GitHub Actions (or other runners) store Keys-related material, how rotation works, and when to use staging vs production-adjacent Keys projects for tests."
>
  <div class="phase-page">
    <div class="doc-prose">
      <p>
        Parallels the Keys <strong>Staging and CI setup</strong> topic: name secrets consistently, document where each
        value comes from, and separate nightly from per-PR jobs if cost or flake demands it. Keys dashboard naming lives in
        <a href="https://restormel.dev/keys/docs" rel="noopener noreferrer">Keys docs</a>; for what the Testing runner reads from
        the job environment (e.g. <code>RESTORMEL_KEYS_API_TOKEN</code>), see
        <a href="{base}/docs/integrations/keys">Keys integration</a>.
      </p>
      <p>
        <a href="{base}/docs/walkthrough/verification-strategy">← Verification strategy</a> ·
        <a href="{base}/docs/guides/ci">CI guide</a>
      </p>
    </div>
    <WalkthroughAgentPrompts>
      <div class="doc-prose">
        <ol>
          <li>Inventory all GitHub Actions secrets used for Keys; map each to Keys dashboard concepts.</li>
          <li>Document rotation: who owns it, how often, and which jobs break if a secret expires.</li>
          <li>Propose staging vs prod Keys project usage for PR checks vs nightly full suites.</li>
        </ol>
      </div>
    </WalkthroughAgentPrompts>
  </div>
</DocArticle>
