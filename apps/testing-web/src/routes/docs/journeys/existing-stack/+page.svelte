<script lang="ts">
  import { base } from "$app/paths";
  import DocArticle from "$lib/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="Journey: Existing stack"
  description="Playwright, CI, and Keys already exist—you are adding the Testing orchestration layer."
  stub={false}
>
  <div class="doc-prose">
    <p>
      Start with <a href="{base}/docs/getting-started/existing-stack">Existing stack</a> and
      <a href="{base}/docs/walkthrough/phase-0-inventory">Phase 0 — Inventory</a>, then align Keys refs in
      <a href="{base}/docs/integrations/keys">Keys integration</a>.
    </p>
  </div>
</DocArticle>
