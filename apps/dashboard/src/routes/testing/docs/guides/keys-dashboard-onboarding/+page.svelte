<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import { keysTestingOnboardingUrl } from "$lib/testing/site.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="Keys dashboard: Testing setup"
  description="Use Restormel Keys Connections and the Restormel Testing hub so judge and resolve work from the CLI without a parallel secret system."
>
  <div class="doc-prose">
    <p>
      End-to-end setup (hosted encrypted provider keys, Gateway keys, project IDs, <code>testing doctor</code>) is documented in
      <strong>Keys docs</strong>:
      <a href={keysTestingOnboardingUrl} rel="noopener noreferrer">Keys + Restormel Testing onboarding</a>.
    </p>
    <p>Quick pointers on the same deployment:</p>
    <ul>
      <li><a href={keysTestingOnboardingUrl} rel="noopener noreferrer">Guide (canonical)</a> — full checklist.</li>
      <li><a href="https://restormel.dev/keys/dashboard/integrations" rel="noopener noreferrer">Connections</a> — add providers.</li>
      <li><a href="https://restormel.dev/keys/dashboard/testing" rel="noopener noreferrer">Restormel Testing</a> — copy <code>RESTORMEL_PROJECT_ID</code> and environment IDs.</li>
      <li><a href="https://restormel.dev/keys/dashboard/access" rel="noopener noreferrer">Gateway keys</a> — <code>rk_…</code> for <code>RESTORMEL_KEYS_API_TOKEN</code>.</li>
    </ul>
    <p>
      Testing-specific env and resolve behaviour: <a href="{base}/docs/integrations/keys">Keys integration</a> ·
      <a href="{base}/docs/guides/keys-ci-checklist">Keys in CI</a>.
    </p>
  </div>
</DocArticle>
