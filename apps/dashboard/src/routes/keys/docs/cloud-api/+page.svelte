<script lang="ts">
  /** Cloud API doc — ported from Starlight cloud-api.md */
</script>

<svelte:head>
  <title>Cloud API — Restormel Keys</title>
  <meta name="description" content="Call the Restormel Keys API via the Zuplo gateway — reference docs and Try it." />
</svelte:head>

<div class="doc-content">
  <h1>Cloud API</h1>
  <p>The <strong>Cloud API</strong> lets you manage projects and keys over HTTP. It is exposed through a Zuplo gateway with rate limiting, quotas, and consumer-key auth.</p>

  <h2>Where to use it</h2>
  <ul>
    <li><strong>API reference and Try it:</strong> <a href="https://restormel-keys-gateway-main-bc13eba.zuplo.site" target="_blank" rel="noopener noreferrer">Restormel Keys Developer Portal</a> — full endpoint list, request/response schemas, and interactive “Try it” with a consumer key.</li>
    <li><strong>Gateway base URL (for API calls):</strong> <code>https://restormel-keys-gateway-main-bc13eba.zuplo.app</code> — call <code>/api/health</code>, <code>/api/projects</code>, <code>/api/projects/{id}</code>, <code>/api/projects/{id}/keys</code>. The gateway root (<code>/</code>) is not a page; use these paths.</li>
    <li><strong>Dashboard:</strong> <a href="/keys/dashboard">Dashboard</a> — <a href="/keys/dashboard/login">Sign in</a>, create projects, and create the <strong>backend</strong> API key that the gateway uses when forwarding to the Keys backend.</li>
  </ul>

  <h2>How it fits together</h2>
  <ol>
    <li>You use the <strong>dashboard</strong> to create projects and API keys.</li>
    <li>You (or your services) call the <strong>gateway</strong> with a <strong>consumer key</strong> (<code>zpka_...</code>) from Zuplo's API Key Service.</li>
    <li>The <strong>Developer Portal</strong> (link above) documents the API and lets you try requests.</li>
  </ol>
  <p>See the portal's <a href="https://restormel-keys-gateway-main-bc13eba.zuplo.site/how-it-fits-together" target="_blank" rel="noopener noreferrer">How it all fits together</a> page for the full picture.</p>

  <h2>Quick links</h2>
  <ul>
    <li><a href="https://restormel-keys-gateway-main-bc13eba.zuplo.site" target="_blank" rel="noopener noreferrer">Developer Portal (API reference + Try it)</a></li>
    <li><a href="https://restormel-keys-gateway-main-bc13eba.zuplo.site/introduction" target="_blank" rel="noopener noreferrer">Introduction & authentication</a></li>
    <li><a href="/keys/dashboard">Dashboard</a> — create projects and API keys</li>
  </ul>

  <h2>See also</h2>
  <ul>
    <li><a href="/keys/dashboard">Dashboard</a> — create projects and API keys</li>
    <li><a href="/keys/dashboard/login">Sign in</a> — authenticate with GitHub</li>
    <li><a href="/keys/docs">Docs</a> — framework compatibility and guides</li>
    <li><a href="/keys/pricing">Pricing</a> — tiers and plans</li>
  </ul>
</div>

<style>
  .doc-content {
    max-width: var(--rm-container-narrow);
  }
  .doc-content h1 {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    color: var(--rm-text);
    margin: 0 0 var(--space-4);
  }
  .doc-content h2 {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    color: var(--rm-text);
    margin: var(--space-8) 0 var(--space-3);
  }
  .doc-content p {
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-4);
  }
  .doc-content ul, .doc-content ol {
    margin: 0 0 var(--space-6);
    padding-left: var(--space-5);
  }
  .doc-content li {
    margin-bottom: var(--space-2);
  }
</style>
