<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import { githubRepoUrl, keysDocsUrl, keysTestingOnboardingUrl } from "$lib/testing/site.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";

  const keysEnvYamlSnippet = `RESTORMEL_KEYS_BASE: \${{ secrets.RESTORMEL_KEYS_BASE }}
RESTORMEL_GATEWAY_KEY: \${{ secrets.RESTORMEL_GATEWAY_KEY }}
RESTORMEL_PROJECT_ID: \${{ secrets.RESTORMEL_PROJECT_ID }}`;
</script>

<DocArticle
  title="Keys in CI (checklist)"
  description="When you need Restormel Keys in GitHub Actions—and when you do not. Deterministic browser goals (URL + DOM) do not require Keys or RESTORMEL_KEYS_* env."
>
  <div class="doc-prose">
    <p>
      <strong>Plotbudget-style MVP:</strong> Suites that only use URL checks, <code>data-testid</code> / DOM signals, and
      <code>structured_checks</code> with supported selectors need <strong>no</strong> Keys HTTP client in CI. You do not need
      <code>RESTORMEL_KEYS_*</code> in the workflow or app for those goals. For <code>judge_rubric</code> and Keys-backed resolve, you can
      store encrypted provider keys in the Keys dashboard (<strong>Connections</strong>) and copy <code>RESTORMEL_PROJECT_ID</code> from
      <strong>Restormel Testing</strong>—see
      <a href={keysTestingOnboardingUrl} rel="noopener noreferrer">Keys + Testing onboarding</a>.
    </p>

    <h2 class="doc-prose__h2">You do <em>not</em> need Keys env when</h2>
    <ul>
      <li>Every goal is <code>type: browser</code> with success criteria that do not include <code>judge_rubric</code>.</li>
      <li>CI only runs <code>testing validate</code> / <code>testing run</code> (or the composite Action) with those suites.</li>
    </ul>

    <h2 class="doc-prose__h2">You <em>do</em> need Keys env when</h2>
    <ul>
      <li>Any goal uses <code>judge_rubric</code> and you want model execution through Keys (recommended long term).</li>
      <li>You rely on logical model refs in YAML that resolve via the Keys HTTP API (see config reference).</li>
    </ul>
    <p>
      Typical GitHub Actions <code>env</code> (never log values; use secrets). <code>RESTORMEL_GATEWAY_KEY</code> is a Gateway key (<code>rk_…</code>), not a provider secret. Name your repository secrets however you like; map them to these
      <strong>runtime</strong> names. Compatibility: <code>RESTORMEL_KEYS_API_BASE_URL</code> / <code>RESTORMEL_KEYS_API_TOKEN</code> work the same if your workflow already uses them.
    </p>
    <pre>{keysEnvYamlSnippet}</pre>
    <p>
      Optional escape hatch (team policy only): <code>RESTORMEL_TESTING_OPENAI_FALLBACK=1</code> and <code>OPENAI_API_KEY</code>. Prefer Keys
      for alignment with production.
    </p>

    <h2 class="doc-prose__h2">Forbidden patterns</h2>
    <ul>
      <li>Do not put raw provider API keys or gateway tokens inside <code>restormel-testing.yaml</code>.</li>
      <li>Do not print <code>RESTORMEL_KEYS_*</code> or token values in CI logs or step summaries.</li>
      <li>On fork PR workflows, assume secrets are absent unless you have explicitly opted into a safe public-URL path; see
        <a href="{base}/docs/guides/ci-security">Fork PRs and workflow triggers</a>.
      </li>
    </ul>

    <h2 class="doc-prose__h2">Canonical references</h2>
    <ul>
      <li>
        <a href={keysDocsUrl} rel="noopener noreferrer">Restormel Keys documentation</a> — environment vocabulary, resolve flow, dashboard.
      </li>
      <li>
        <a href={keysTestingOnboardingUrl} rel="noopener noreferrer">Keys + Testing onboarding</a> — Connections, Testing hub, CLI env.
      </li>
      <li>
        <a href="{base}/docs/integrations/keys">Keys integration</a> — Testing-specific env names and fallbacks.
      </li>
      <li>
        <a href={`${githubRepoUrl}/blob/main/docs/testing/config-reference-mvp.md`} rel="noopener noreferrer"
          ><code>docs/testing/config-reference-mvp.md</code></a
        >
        — field-level truth for MVP.
      </li>
      <li>
        Consumer feedback and gap list:
        <a href={`${githubRepoUrl}/blob/main/docs/testing/plotbudget-testing-adoption-feedback.md`} rel="noopener noreferrer"
          ><code>docs/testing/plotbudget-testing-adoption-feedback.md</code></a
        >.
      </li>
    </ul>

    <p>
      <strong>CLI <code>doctor</code>:</strong> run <code>testing doctor</code> to check Node, Playwright, Keys env hints, and (when URL + token are set) a single resolve probe (HTTP status only). It also flags a missing <code>RESTORMEL_PROJECT_ID</code> when <code>RESTORMEL_KEYS_BASE</code> (or <code>RESTORMEL_KEYS_API_BASE_URL</code>) is set.
    </p>
  </div>
</DocArticle>

<style>
  :global(.doc-article .doc-prose__h2) {
    font-family: var(--rm-font-display);
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: var(--space-8) 0 var(--space-3);
    letter-spacing: var(--tracking-tight);
  }
</style>
