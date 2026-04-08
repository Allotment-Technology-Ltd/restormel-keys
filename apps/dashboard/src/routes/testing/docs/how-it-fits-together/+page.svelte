<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import { keysTestingOnboardingUrl } from "$lib/testing/site.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="How it fits together"
  description="Where the CLI, runner, browser adaptor, Keys adaptor, and reporting sit relative to your app, CI, and providers."
>
  <div class="doc-prose">
    <p>At a high level:</p>
    <ul>
      <li><strong>Your app</strong> — the system under test (UI, APIs, agents).</li>
      <li>
        <strong>Testing CLI / CI job</strong> — loads <code>restormel-testing.yaml</code>, <code>validate</code>s against MVP rules,
        starts runs, emits exit codes.
      </li>
      <li><strong>Runner</strong> — coordinates goals, retries, success criteria, verdicts, and artefact writes.</li>
      <li><strong>Browser adaptor</strong> — Playwright (MVP) for real browser execution.</li>
      <li><strong>Keys adaptor</strong> — resolves logical model references to provider execution; aligns with your Keys project.</li>
      <li><strong>Providers / gateways</strong> — unchanged; Keys stays the control layer for resolve policy.</li>
    </ul>
    <p>
      Canonical env and key vocabulary for Keys lives in <strong>Keys docs</strong>—start at
      <a href="{base}/docs/integrations/keys">Keys integration</a> or the full dashboard journey
      <a href={keysTestingOnboardingUrl} rel="noopener noreferrer">Keys + Testing onboarding</a>.
    </p>
  </div>
</DocArticle>
