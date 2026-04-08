<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import { keysDocsUrl } from "$lib/testing/site.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="Restormel Keys"
  description="Testing uses Keys for logical model resolution and BYOK-aligned execution. Canonical environment names and API details live in Keys docs—this page is the integration seam."
>
  <div class="doc-prose">
    <p>MVP integration points:</p>
    <ul>
      <li>Resolve a primary (and optionally vision) model through Keys for <code>judge_rubric</code> steps.</li>
      <li>Store <strong>opaque references</strong> in Testing config; keep raw provider secrets in env or your secrets manager.</li>
      <li>Do not bypass Keys by default; avoid building a second credential-management system.</li>
    </ul>
    <p>
      <strong>Process env read by the Testing CLI</strong> (values are never printed; see repo <code>.env.example</code> and
      <code>docs/config-reference-mvp.md</code>):
    </p>
    <ul>
      <li><code>RESTORMEL_KEYS_API_BASE_URL</code> — Keys API origin.</li>
      <li><code>RESTORMEL_KEYS_API_TOKEN</code> — bearer token (or set <code>RESTORMEL_KEYS_API_TOKEN_ENV</code> to another var name).</li>
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
    <p>Local context: <a href="{base}/docs/how-it-fits-together">How it fits together</a> · <a href="{base}/docs/guides/config">Configuration</a></p>
  </div>
</DocArticle>
