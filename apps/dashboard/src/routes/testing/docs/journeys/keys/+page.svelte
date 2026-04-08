<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import { keysDocsUrl, keysTestingOnboardingUrl } from "$lib/testing/site.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="Journey: BYOK through Keys"
  description="You want test runs to respect the same resolve and policy story as production."
  stub={false}
>
  <div class="doc-prose">
    <p>
      Read <a href="{base}/docs/integrations/keys">Keys integration</a> for Testing-specific process env (<code>RESTORMEL_KEYS_*</code>,
      fallback), then <a href="{base}/docs/walkthrough/phase-2-keys">Walkthrough — Phase 2 — Wire Keys</a>. For dashboard setup (Connections,
      Restormel Testing hub, <code>RESTORMEL_PROJECT_ID</code>): <a href={keysTestingOnboardingUrl} rel="noopener noreferrer">Keys + Testing onboarding</a>.
      Keys dashboard and resolve API detail: <a href={keysDocsUrl} rel="noopener noreferrer">Keys docs</a>.
    </p>
  </div>
</DocArticle>
