<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import { githubRepoUrl, keysDocsUrl, keysTestingOnboardingUrl } from "$lib/testing/site.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="Restormel Keys"
  description="Testing uses Keys for logical model resolution and BYOK-aligned execution when you run judge-backed goals. Deterministic browser goals (URL + DOM) do not call Keys."
>
  <div class="doc-prose">
    <p>
      <strong>CI reality check:</strong> Many first suites are fully deterministic (e.g. URL + <code>data-testid</code>). Those runs need
      <strong>no</strong> <code>RESTORMEL_KEYS_*</code> in GitHub Actions. Add Keys when you introduce <code>judge_rubric</code> or other
      resolution that hits the Keys HTTP API. See <a href="{base}/docs/guides/keys-ci-checklist">Keys in CI (checklist)</a>.
    </p>
    <p>
      <strong>Hosted credentials (optional):</strong> In the Keys dashboard you can store encrypted provider keys under <strong>Connections</strong> and use
      <strong>Restormel Testing</strong> (<code>/keys/dashboard/testing</code>) for <code>RESTORMEL_PROJECT_ID</code> and environment IDs. End-to-end guide:
      <a href={keysTestingOnboardingUrl} rel="noopener noreferrer">Keys + Testing onboarding</a> (repo:
      <a href={`${githubRepoUrl}/blob/main/docs/keys-testing-onboarding.md`} rel="noopener noreferrer"
        ><code>docs/keys-testing-onboarding.md</code></a
      >).
    </p>
    <p>MVP integration points:</p>
    <ul>
      <li>Resolve a primary (and optionally vision) model through Keys for <code>judge_rubric</code> steps.</li>
      <li>Store <strong>opaque references</strong> (<code>ref:restormel-keys:…</code>) in Testing config; keep raw provider secrets out of YAML — in CI use secrets, or use hosted encrypted keys in Keys plus Gateway auth for resolve.</li>
      <li>Do not bypass Keys by default; avoid building a second credential-management system.</li>
    </ul>
    <p>
      <strong>Process env read by the Testing CLI</strong> (values are never printed; see repo <code>.env.example</code> and
      <a href={`${githubRepoUrl}/blob/main/docs/testing/config-reference-mvp.md`} rel="noopener noreferrer"
        ><code>docs/testing/config-reference-mvp.md</code></a
      >):
    </p>
    <ul>
      <li><code>RESTORMEL_KEYS_BASE</code> — site origin for Keys HTTP resolve (alias: <code>RESTORMEL_KEYS_API_BASE_URL</code>).</li>
      <li><code>RESTORMEL_GATEWAY_KEY</code> — Gateway key bearer (alias: <code>RESTORMEL_KEYS_API_TOKEN</code>; or <code>RESTORMEL_KEYS_API_TOKEN_ENV</code> for a custom var name).</li>
      <li><code>RESTORMEL_PROJECT_ID</code> — project UUID (Restormel Testing hub in the Keys dashboard).</li>
      <li>
        <code>RESTORMEL_TESTING_OPENAI_FALLBACK=1</code> — opt-in use of <code>OPENAI_API_KEY</code> when Keys is unset or resolution
        fails.
      </li>
    </ul>
    <p>
      <strong>Canonical docs:</strong>
      <a href={keysDocsUrl} rel="noopener noreferrer">Restormel Keys documentation</a> (environment vocabulary, resolve flow,
      dashboard workflows).
    </p>
    <p>
      Local context: <a href="{base}/docs/how-it-fits-together">How it fits together</a> ·
      <a href="{base}/docs/guides/config">Configuration</a> ·
      <a href="{base}/docs/guides/keys-dashboard-onboarding">Keys + Testing (from Testing docs)</a>
    </p>
  </div>
</DocArticle>
