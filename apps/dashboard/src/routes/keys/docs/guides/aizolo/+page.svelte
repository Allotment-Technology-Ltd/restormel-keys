<script lang="ts">
  /** Doc-only example; no live credentials. */
  const curlExample = `curl -X POST https://chat.aizolo.com/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <your AiZolo API key>" \\
  -d '{
    "model": "openai",
    "messages": [
      { "role": "user", "content": "Hello." }
    ]
  }'`;
</script>

<svelte:head>
  <title>AiZolo quick start — Restormel Keys</title>
  <meta
    name="description"
    content="Connect AiZolo to Restormel Keys: encrypted API keys, catalog models, routes, hosted runtime, and MCP provider validation."
  />
</svelte:head>

<div class="doc-content">
  <h1>AiZolo quick start</h1>
  <p class="doc-intro">
    <a href="https://aizolo.com/" rel="noopener noreferrer">AiZolo</a> exposes an
    <strong>OpenAI Chat Completions–compatible</strong> HTTP API. Restormel Keys treats AiZolo as a first-class provider
    (<code class="inline-code">aizolo</code>): you can store your AiZolo API key in Connections, pick catalog models on
    routes, and execute via resolve and hosted runtime the same way as other OpenAI-compatible providers.
  </p>

  <div class="callout callout-note">
    <strong>Credentials</strong> — Never commit API keys. In examples below, replace placeholders with your own secret;
    Restormel stores hosted keys encrypted at rest when <code class="inline-code">RESTORMEL_CREDENTIALS_ENCRYPTION_KEY</code>
    is configured.
  </div>

  <h2>1. Get an AiZolo API key</h2>
  <p>
    In the AiZolo product, open <strong>Settings → API Access</strong>, create a key, and copy it for the next step.
    Keys are commonly shown with an <code class="inline-code">aizolo_</code> prefix; send the full token AiZolo gives you
    in the <code class="inline-code">Authorization</code> header.
  </p>

  <h2>2. Connect AiZolo in the Restormel dashboard</h2>
  <ol>
    <li>
      Go to <strong>Connect a Provider</strong> and choose <strong>AiZolo</strong>, or set provider type to
      <code class="inline-code">aizolo</code> under <strong>Other</strong>.
    </li>
    <li>
      Add a display name and paste the key into <strong>Hosted API key</strong> (recommended) so it is encrypted in
      Postgres, or use a <strong>credential reference</strong> if your deployment stores secrets elsewhere.
    </li>
    <li>
      Bind the integration to your project so resolve and runtime can find a key for
      <code class="inline-code">providerType: "aizolo"</code>.
    </li>
  </ol>
  <p>
    Related: <a href="/keys/docs/guides/keys-testing-onboarding">Keys + Restormel Testing onboarding</a> for project and
    environment IDs.
  </p>

  <h2>3. Pick models from the catalog</h2>
  <p>
    Route steps use Restormel catalog ids such as <code class="inline-code">aizolo-openai-gpt-4o</code> (dashes replace
    slashes in the AiZolo <code class="inline-code">model</code> value <code class="inline-code">openai/gpt-4o</code>).
    The hosted runtime maps the catalog row back to the exact vendor string for the API. Provider roots like
    <code class="inline-code">openai</code> or <code class="inline-code">gemini</code> appear as
    <code class="inline-code">aizolo-openai</code> and <code class="inline-code">aizolo-gemini</code>.
  </p>
  <p>
    Machine-readable list: <code class="inline-code">GET /keys/dashboard/api/catalog</code> — see
    <a href="/keys/docs/guides/canonical-catalog">Canonical model &amp; provider catalog</a>.
  </p>
  <p>
    <strong>Self-host / local dev:</strong> after pulling changes, apply the catalog seed so Postgres has AiZolo rows:
    from <code class="inline-code">apps/dashboard</code>, <code class="inline-code">pnpm run seed:catalog</code> with
    <code class="inline-code">DATABASE_URL</code> set. Maintainers can refresh JSON from
    <code class="inline-code">@restormel/keys</code> with <code class="inline-code">pnpm run sync:aizolo-seed</code>
    (run <code class="inline-code">pnpm -w --filter @restormel/keys run build</code> first).
  </p>

  <h2>4. Call AiZolo directly (reference)</h2>
  <p>Base URL for chat completions (same shape as OpenAI):</p>
  <pre class="doc-pre" role="region" aria-label="Example base URL"><code>https://chat.aizolo.com/api/v1/chat/completions</code></pre>
  <p>Minimal non-streaming request:</p>
  <pre class="doc-pre" role="region" aria-label="Example curl"><code>{curlExample}</code></pre>
  <p>
    AiZolo supports streaming (<code class="inline-code">stream: true</code>), vision backends where advertised, and
    rate limits that may return HTTP <code class="inline-code">429</code> with a
    <code class="inline-code">Retry-After</code> header. On hosted runtime, a 429 is classified as
    <code class="inline-code">rate_limit</code> for fallback policies.
  </p>

  <h2>5. MCP and local validation</h2>
  <p>
    The Restormel MCP server’s <code class="inline-code">providers.validate</code> tool can check an AiZolo key using
    environment variables in the MCP process (see <a href="/keys/docs/integrations/mcp">MCP</a>):
  </p>
  <ul>
    <li><code class="inline-code">AIZOLO_API_KEY</code></li>
    <li><code class="inline-code">RESTORMEL_MCP_AIZOLO_KEY</code> (override)</li>
  </ul>
  <p>
    Canonical naming for URLs and tokens across tools is in
    <a href="/keys/docs/guides/environment-vocabulary">Environment vocabulary</a>.
  </p>

  <h2>Related</h2>
  <ul>
    <li><a href="/keys/docs/guides/integration-catalog">Integration catalog</a></li>
    <li><a href="/keys/docs/guides/provider-access-modes">Provider access modes</a></li>
    <li><a href="/keys/docs/cloud-api">Cloud API</a> (resolve, policies, routes)</li>
    <li><a href="/keys/docs/guides/openrouter">OpenRouter</a> — similar “aggregator” pattern</li>
  </ul>
</div>

<style>
  .doc-content {
    max-width: var(--rm-container-narrow);
  }
  .doc-intro {
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
    line-height: var(--leading-relaxed);
  }
  .doc-content h1 {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    margin: 0 0 var(--space-4);
  }
  .doc-content h2 {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    margin: var(--space-8) 0 var(--space-3);
  }
  .doc-content p,
  .doc-content li {
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-3);
  }
  .doc-content ul,
  .doc-content ol {
    margin: 0 0 var(--space-4);
    padding-left: var(--space-5);
  }
  .doc-content li {
    margin-bottom: var(--space-2);
  }
  .inline-code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.9em;
    background: var(--rm-surface-2);
    padding: 0.1em 0.35em;
    border-radius: var(--radius-sm);
  }
  .doc-pre {
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    background: var(--rm-surface-2);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    overflow-x: auto;
    font-size: var(--text-sm);
  }
  .doc-pre code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .callout {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    margin: 0 0 var(--space-4);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
  }
  .callout-note {
    border: 1px solid var(--rm-border);
    background: var(--rm-surface-2);
    color: var(--rm-muted);
  }
  .callout strong {
    color: var(--rm-text);
  }
  .doc-content a {
    color: var(--rm-sage);
    font-weight: 500;
    text-decoration: none;
  }
  .doc-content a:hover {
    text-decoration: underline;
  }
</style>
