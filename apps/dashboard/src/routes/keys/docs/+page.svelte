<script lang="ts">
  /** Docs overview — ported from Starlight index.md */
</script>

<svelte:head>
  <title>Restormel Keys docs</title>
  <meta name="description" content="Documentation for Restormel Keys — drop-in BYOK and provider routing for AI apps." />
</svelte:head>

<div class="doc-content">
  <h1>Restormel Keys docs</h1>
  <p class="doc-tagline">Drop-in BYOK and provider routing for AI apps. Get started in minutes.</p>

  <p>Restormel Keys adds multi-provider routing and production-grade key management to your app. This doc set covers install, framework choice, and API.</p>

  <h2>Start with Next.js</h2>
  <p>Using <strong>Next.js App Router</strong>? Install the core plus React and Web Components, then add KeyManager and your key storage. Full path: <a href="/keys/docs/compatibility">Framework compatibility</a>.</p>
  <pre class="code-block"><code>pnpm add @restormel/keys @restormel/keys-react @restormel/keys-elements</code></pre>

  <h2>Pick your framework</h2>
  <p>One core; different wrappers. Use the headless API for resolution and cost on the server; add UI (KeyManager, ModelSelector, CostEstimator) where it fits.</p>
  <table class="doc-table">
    <thead>
      <tr><th>Framework</th><th>Package path</th><th>Status</th></tr>
    </thead>
    <tbody>
      <tr><td>Next.js / React</td><td><code>@restormel/keys</code> + <code>@restormel/keys-react</code> + <code>@restormel/keys-elements</code></td><td>✅ Supported</td></tr>
      <tr><td>SvelteKit</td><td><code>@restormel/keys</code> + <code>@restormel/keys-svelte</code></td><td>✅ Supported</td></tr>
      <tr><td>Web Components / Astro / vanilla</td><td><code>@restormel/keys</code> + <code>@restormel/keys-elements</code></td><td>✅ Supported</td></tr>
      <tr><td>Vue / Nuxt</td><td>Headless or elements for now</td><td>🔵 Planned</td></tr>
    </tbody>
  </table>
  <p><a href="/keys/docs/compatibility">Framework compatibility</a> has install commands, when-to-use guidance, and the full Next.js walkthrough.</p>

  <h2>Quick links</h2>
  <ul>
    <li><a href="/keys/docs/cloud-api">Cloud API</a> — API reference, gateway URL, and Developer Portal</li>
    <li><a href="/keys">Keys landing</a> — what Keys is, modes, comparison, pricing</li>
    <li><a href="/keys/pricing">Pricing</a> — tiers and FAQ</li>
    <li><a href="/keys/dashboard">Dashboard</a> — create projects and API keys</li>
    <li><a href="/keys/dashboard/login">Sign in</a> — authenticate with GitHub</li>
  </ul>
</div>

<style>
  .doc-content {
    max-width: var(--rm-container-narrow);
  }
  .doc-tagline {
    font-size: var(--text-lg);
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
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
  .doc-content ul {
    margin: 0 0 var(--space-6);
    padding-left: var(--space-5);
  }
  .doc-content li {
    margin-bottom: var(--space-2);
  }
  .code-block {
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    overflow-x: auto;
    margin: 0 0 var(--space-4);
  }
  .doc-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 var(--space-4);
    font-size: var(--text-sm);
  }
  .doc-table th, .doc-table td {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rm-border);
    text-align: left;
  }
  .doc-table th {
    background: var(--rm-surface-raised);
    color: var(--rm-text);
    font-weight: var(--font-medium);
  }
  .doc-table td {
    color: var(--rm-muted);
  }
  .doc-table code {
    font-family: var(--rm-font-ui);
    font-size: 0.9em;
  }
</style>
