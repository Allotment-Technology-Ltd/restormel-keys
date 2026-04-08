<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import { githubRepoUrl, keysTestingOnboardingUrl } from "$lib/testing/site.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
  import WalkthroughAgentPrompts from "$lib/testing/components/docs/WalkthroughAgentPrompts.svelte";
</script>

<DocArticle
  title="Phase 2 — Wire Keys and confirm resolution"
  description="Add logical Keys references to your Testing configuration and prove one model resolution path works for test execution—BYOK-aligned, no second key vault."
>
  <div class="phase-page">
    <div class="doc-prose">
      <p>Principles:</p>
      <ul>
        <li>Use opaque refs in YAML—never commit raw provider keys.</li>
        <li>
          Set Testing’s Keys env vars for judges (<code>RESTORMEL_KEYS_API_BASE_URL</code>, Gateway token
          <code>RESTORMEL_KEYS_API_TOKEN</code> / <code>RESTORMEL_KEYS_API_TOKEN_ENV</code>, usually <code>RESTORMEL_PROJECT_ID</code>) or the
          documented OpenAI fallback; full table in
          <a href={`${githubRepoUrl}/blob/main/docs/testing/config-reference-mvp.md`} rel="noopener noreferrer"
            ><code>docs/testing/config-reference-mvp.md</code></a
          >. Dashboard setup: <a href={keysTestingOnboardingUrl} rel="noopener noreferrer">Keys + Testing onboarding</a>.
        </li>
        <li>Confirm resolve behaviour matches how your app uses Keys in a non-production environment first.</li>
      </ul>
      <p>
        <a href="{base}/docs/integrations/keys">Keys integration</a> ·
        <a href="{base}/docs/walkthrough/phase-1-install">← Phase 1</a> ·
        <a href="{base}/docs/walkthrough/phase-3-first-goal">Phase 3 — First goal →</a>
      </p>
    </div>
    <WalkthroughAgentPrompts>
      <div class="doc-prose">
        <ol>
          <li>Map our app’s Keys project and gateway usage; list env vars required for resolve in CI.</li>
          <li>Add logical model refs to <code>restormel-testing.yaml</code>; run a dry resolution or smallest possible test call.</li>
          <li>Verify failures when Keys is misconfigured are explicit (no silent fallback to wrong models in CI).</li>
        </ol>
      </div>
    </WalkthroughAgentPrompts>
  </div>
</DocArticle>
