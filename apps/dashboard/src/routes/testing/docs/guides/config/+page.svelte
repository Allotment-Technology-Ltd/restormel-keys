<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="Configuration"
  description="Repo-native `restormel-testing.yaml`: suites, goals, environments, timeouts, retries, and opaque Keys references."
>
  <div class="doc-prose">
    <p>Core concepts (MVP schema):</p>
    <ul>
      <li><strong>Suite</strong> — named collection of goals, environment, timeouts, retries, optional tags.</li>
      <li><strong>Goal</strong> — outcome under test; <code>browser</code> (MVP) or <code>performance</code>; success criteria.</li>
      <li>
        <strong>Environment</strong> — <code>base_url</code>, optional per-env Keys slots, and <code>auth_mode: storage_state</code> with
        <code>auth_ref</code> (path relative to the config file, or <code>env:VAR</code> for a path to Playwright storage state JSON).
      </li>
      <li>
        <strong>Keys</strong> — logical slots such as <code>ref:restormel-keys:llm/primary</code> (illustrative); never paste raw
        provider secrets into this file.
      </li>
      <li>
        <strong>MVP limits</strong> — <code>validate</code> rejects non-empty <code>adapter_hooks</code> and any <code>preconditions</code> /
        <code>cleanup</code> on goals (those fields are not executed). Omit them or keep hooks as an empty object.
      </li>
    </ul>
    <pre>restormel-testing validate --config restormel-testing.yaml{"\n"}restormel-testing run --suite web-critical --config restormel-testing.yaml</pre>
    <p>
      Canonical MVP field behaviour (executed vs rejected): repo <code>docs/config-reference-mvp.md</code>. Spec:
      <code>docs/restormel-testing-mvp-spec.md</code>.
    </p>
    <p><a href="{base}/docs/guides/test-definition">Test definition</a> · <a href="{base}/docs/integrations/keys">Keys integration</a></p>
  </div>
</DocArticle>
