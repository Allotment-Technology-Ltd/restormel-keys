<script lang="ts">
  /** Framework compatibility */
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";
</script>

<svelte:head>
  <title>Framework compatibility — Restormel Keys</title>
  <meta name="description" content="Which package to use for Next.js, React, SvelteKit, Web Components, or headless core." />
</svelte:head>

<div class="doc-content">
  <h1>Framework compatibility</h1>
  <p>Restormel Keys is built to fit the stacks you already use. This page helps you choose the right package and get started quickly.</p>

  <div class="callout callout-note">
    <strong>UI packages may not be on npm yet</strong> — <code>@restormel/keys-svelte</code>, <code>@restormel/keys-react</code>, and <code>@restormel/keys-elements</code> can return <strong>404</strong> from npm until they are published. Verify with <code>npm view @restormel/keys-svelte version</code> (and the same for <code>keys-react</code>, <code>keys-elements</code>). If you get 404, use the headless path (<code>@restormel/keys</code> only) and your own model picker plus a server-side allowed-models proxy. See <strong>npm packages</strong> in the repo (<code>docs/reference/npm-packages.md</code>) for verify-before-install and 404 handling.
  </div>

  <h2>Compatibility at a glance</h2>
  <table class="doc-table">
    <thead>
      <tr><th>Framework</th><th>Package</th><th>Status</th></tr>
    </thead>
    <tbody>
      <tr><td><strong>Next.js (App Router)</strong></td><td><code>@restormel/keys</code> + <code>@restormel/keys-react</code> + <code>@restormel/keys-elements</code></td><td>Supported when packages are on npm</td></tr>
      <tr><td><strong>React (generic)</strong></td><td><code>@restormel/keys</code> + <code>@restormel/keys-react</code> + <code>@restormel/keys-elements</code></td><td>Supported when packages are on npm</td></tr>
      <tr><td><strong>SvelteKit</strong></td><td><code>@restormel/keys</code> + <code>@restormel/keys-svelte</code></td><td>Supported when packages are on npm</td></tr>
      <tr><td><strong>Web Components / Astro / vanilla</strong></td><td><code>@restormel/keys</code> + <code>@restormel/keys-elements</code></td><td>Supported when packages are on npm</td></tr>
      <tr><td><strong>Vue / Nuxt</strong></td><td>—</td><td>🔵 Planned — use headless core or Web Components for now</td></tr>
    </tbody>
  </table>
  <p>All UI paths depend on the headless core (<code>@restormel/keys</code>) for resolution, cost, and storage. The React wrapper uses the Web Components under the hood; Svelte uses native Svelte 5 components. <strong>Headless only</strong> works today without the UI packages.</p>

  <h2>Install paths</h2>
  <p><strong>Headless only (no UI) — works today:</strong></p>
  <CodeBlock language="bash" code="pnpm add @restormel/keys" />

  <p><strong>Next.js or React (KeyManager, ModelSelector, CostEstimator):</strong> run <code>npm view @restormel/keys-react version</code> first; if 404, use headless + your own UI until published.</p>
  <CodeBlock language="bash" code="pnpm add @restormel/keys @restormel/keys-react @restormel/keys-elements" />

  <p><strong>SvelteKit (native Svelte components):</strong> run <code>npm view @restormel/keys-svelte version</code> first; if 404, use headless + your own UI until published.</p>
  <CodeBlock language="bash" code="pnpm add @restormel/keys @restormel/keys-svelte" />

  <p><strong>Web Components (Astro, vanilla HTML, or any framework):</strong> run <code>npm view @restormel/keys-elements version</code> first; if 404, use headless until published.</p>
  <CodeBlock language="bash" code="pnpm add @restormel/keys @restormel/keys-elements" />

  <p><strong>CLI (init, add keys, validate, doctor):</strong></p>
  <CodeBlock language="bash" code="pnpm add -D @restormel/keys-cli" />

  <h2>When to use which</h2>
  <ul>
    <li><strong>Headless core (<code>@restormel/keys</code> only)</strong> — You want resolution, cost, and server middleware without any UI.</li>
    <li><strong>React wrapper (<code>@restormel/keys-react</code>)</strong> — You're in a React or Next.js app and want drop-in KeyManager, ModelSelector, CostEstimator plus hooks. Recommended for Next.js App Router.</li>
    <li><strong>Web Components (<code>@restormel/keys-elements</code>)</strong> — One integration that works in Astro, vanilla HTML, or any framework.</li>
    <li><strong>Svelte components (<code>@restormel/keys-svelte</code>)</strong> — You're on SvelteKit or Svelte and want native KeyManager, ModelSelector, CostEstimator as Svelte 5 components.</li>
  </ul>

  <h2>Start with Next.js</h2>
  <ol>
    <li>Run <code>npm view @restormel/keys-react version</code> and <code>npm view @restormel/keys-elements version</code>. If either returns 404, use headless-only until published.</li>
    <li>Install: <code>pnpm add @restormel/keys @restormel/keys-react @restormel/keys-elements</code> (only when available)</li>
    <li>Add a settings (or similar) page with KeyManager and your key storage.</li>
    <li>Use the core on the server for resolution and cost; use the React components on the client for UI.</li>
  </ol>

  <h2>See also</h2>
  <ul>
    <li><a href="/keys/docs/cloud-api">Cloud API</a> — gateway URL, Developer Portal, and API reference</li>
    <li><a href="/keys/dashboard">Dashboard</a> — create projects and API keys</li>
    <li><a href="/keys/dashboard/login">Sign in</a> — authenticate with GitHub</li>
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
  .doc-content p, .doc-content li {
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
