<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import { githubRepoUrl } from "$lib/testing/site.js";
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
        <strong>Navigation</strong> — for each browser (or performance) goal the runner navigates to the environment <code>base_url</code>,
        then optional per-goal <code>start_path</code> / <code>startPath</code> (relative path under that origin; <code>..</code> is rejected).
        Separate environments with different <code>base_url</code> values are still useful when origins differ.
      </li>
      <li>
        <strong>Suite hooks</strong> — non-empty <code>adapter_hooks</code> (shell commands; <code>teardown</code> runs last), per-goal
        <code>preconditions</code>, and <code>cleanup</code> are <strong>executed</strong> by the runner. Opt out with
        <code>RESTORMEL_TESTING_SKIP_SHELL_HOOKS=1</code>; timeout via <code>RESTORMEL_TESTING_SHELL_HOOK_TIMEOUT_MS</code> (see repo
        <code>docs/testing/config-reference-mvp.md</code>).
      </li>
      <li>
        <strong>Keys</strong> — logical slots such as <code>ref:restormel-keys:llm/primary</code> (illustrative); never paste raw
        provider secrets into this file. You may store encrypted provider keys in the Keys dashboard (<strong>Connections</strong>) and use
        <a href="{base}/docs/guides/keys-dashboard-onboarding">Keys + Testing (dashboard)</a> for project IDs and env—CI still uses a Gateway
        key as <code>RESTORMEL_KEYS_API_TOKEN</code>.
      </li>
    </ul>
    <pre>restormel-testing validate --config restormel-testing.yaml{"\n"}restormel-testing run --suite web-critical --config restormel-testing.yaml{"\n"}restormel-testing run --suites ci-smoke,web-critical --config restormel-testing.yaml</pre>
    <p>
      Canonical MVP field behaviour (executed vs rejected):
      <a href={`${githubRepoUrl}/blob/main/docs/testing/config-reference-mvp.md`} rel="noopener noreferrer"
        ><code>docs/testing/config-reference-mvp.md</code></a
      >. Spec:
      <a href={`${githubRepoUrl}/blob/main/docs/testing/restormel-testing-mvp-spec.md`} rel="noopener noreferrer"
        ><code>docs/testing/restormel-testing-mvp-spec.md</code></a
      >.
    </p>
    <p>
      <a href="{base}/docs/guides/test-definition">Test definition</a> ·
      <a href="{base}/docs/guides/performance-goals">Performance goals</a> ·
      <a href="{base}/docs/guides/keys-ci-checklist">Keys in CI</a> ·
      <a href="{base}/docs/integrations/keys">Keys integration</a>
    </p>
  </div>
</DocArticle>
