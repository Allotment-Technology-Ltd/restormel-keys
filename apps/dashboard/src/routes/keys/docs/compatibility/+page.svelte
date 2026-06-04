<script lang="ts">
  /** Framework compatibility */
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";
  import {
    CLI_INSTALL,
    DEPRECATED_PUBLIC_PACKAGES,
    ELEMENTS_INSTALL,
    ELEMENTS_SNIPPET,
    MVP_PUBLIC_PACKAGES,
    REST_RESOLVE_SNIPPET,
  } from "$lib/public-npm-packages";
</script>

<svelte:head>
  <title>Framework compatibility — Restormel Keys</title>
  <meta name="description" content="Keys REST, Web Components, CLI, MCP, and AAIF — recommended public packages for Keys MVP." />
</svelte:head>

<div class="doc-content">
  <h1>Framework compatibility</h1>
  <p>
    New integrations should use <strong>Keys REST</strong> for resolve/catalog and
    <code>{MVP_PUBLIC_PACKAGES.keysElements}</code> for UI. Legacy npm adapters are deprecated — see
    <a href="/keys/docs/guides/npm-to-rest-keys">npm → REST migration</a>.
  </p>

  <aside class="deprecation-note" aria-label="Deprecated npm packages">
    <strong>Deprecated (do not install for new apps):</strong>
    {#each DEPRECATED_PUBLIC_PACKAGES as pkg}
      <span><code>{pkg.name}</code> → {pkg.replacement}</span>
    {/each}
  </aside>

  <h2>Compatibility at a glance</h2>
  <table class="doc-table">
    <thead>
      <tr><th>Framework</th><th>Recommended path</th><th>Status</th></tr>
    </thead>
    <tbody>
      <tr><td><strong>Any (server)</strong></td><td>Keys REST + Gateway key</td><td>Supported</td></tr>
      <tr><td><strong>Next.js / React / SvelteKit / Astro</strong></td><td><code>{MVP_PUBLIC_PACKAGES.keysElements}</code></td><td>Supported</td></tr>
      <tr><td><strong>Agents / IDE</strong></td><td><code>{MVP_PUBLIC_PACKAGES.mcp}</code>, <code>{MVP_PUBLIC_PACKAGES.aaif}</code></td><td>Supported</td></tr>
      <tr><td><strong>Local tooling</strong></td><td><code>{MVP_PUBLIC_PACKAGES.keysCli}</code>, <code>{MVP_PUBLIC_PACKAGES.doctor}</code></td><td>Supported</td></tr>
      <tr><td><strong>Vue / Nuxt</strong></td><td>Keys REST + Web Components</td><td>Supported via elements</td></tr>
    </tbody>
  </table>

  <h2>Install paths</h2>
  <p><strong>Resolve (no npm core):</strong></p>
  <CodeBlock language="ts" code={REST_RESOLVE_SNIPPET} />

  <p><strong>UI (Web Components — all frameworks):</strong></p>
  <CodeBlock language="bash" code={ELEMENTS_INSTALL} />
  <CodeBlock language="html" code={ELEMENTS_SNIPPET} />

  <p><strong>CLI + doctor:</strong></p>
  <CodeBlock language="bash" code={CLI_INSTALL} />

  <h2>See also</h2>
  <ul>
    <li><a href="/keys/docs/cloud-api">Cloud API</a> — Gateway key, Developer Portal, OpenAPI</li>
    <li><a href="/keys/docs/guides/npm-to-rest-keys">Migrate from @restormel/keys npm</a></li>
    <li><a href="/keys/docs/integrations">CLI, MCP, AAIF</a></li>
    <li><a href="/keys/dashboard">Dashboard</a> — projects and provider vault</li>
  </ul>
</div>

<style>
  .doc-content {
    max-width: var(--rm-container-narrow);
  }
  .deprecation-note {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface-2);
    margin: 0 0 var(--space-6);
  }
  .deprecation-note strong {
    color: var(--rm-text);
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
  .doc-content ul {
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
