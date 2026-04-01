<svelte:head>
  <title>Environment vocabulary — Restormel Keys</title>
  <meta
    name="description"
    content="Canonical RESTORMEL_* env names: Gateway key vs server token, KEYS_BASE vs control plane vs evaluate URL. Single vocabulary for apps, CI, and MCP."
  />
</svelte:head>

<div class="doc-content">
  <h1>Environment vocabulary (canonical)</h1>
  <p class="doc-intro">
    <strong>Single source of truth</strong> for what Restormel integration env vars are called and how they differ. Use these names in apps, CI, MCP, and admin wizards — do not invent alternate names for the same key or URL.
    Repository copy (for PRs and agents): <code class="inline-code">docs/guides/restormel-environment-vocabulary.md</code>.
  </p>

  <div class="callout callout-tip">
    <strong>Implementers:</strong> One Gateway key may appear as both <code class="inline-code">RESTORMEL_GATEWAY_KEY</code> and
    <code class="inline-code">RESTORMEL_SERVER_TOKEN</code> (same value). Three URL roles —
    <code class="inline-code">RESTORMEL_KEYS_BASE</code> (site origin),
    <code class="inline-code">RESTORMEL_CONTROL_PLANE_URL</code> (<code class="inline-code">…/keys/dashboard</code>),
    <code class="inline-code">RESTORMEL_EVALUATE_URL</code> (full …<code class="inline-code">/api/policies/evaluate</code>) — are never interchangeable.
  </div>

  <h2>Canonical variables</h2>
  <div class="doc-table-wrap">
    <table class="doc-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Role</th>
          <th>Hosted example</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>RESTORMEL_GATEWAY_KEY</code></td>
          <td>Project Gateway key; Bearer for Dashboard API</td>
          <td><code>rk_…</code></td>
        </tr>
        <tr>
          <td><code>RESTORMEL_SERVER_TOKEN</code></td>
          <td><strong>Same value</strong> as Gateway key unless you use a separate management token (MCP control-plane, some wizards)</td>
          <td>same <code>rk_…</code></td>
        </tr>
        <tr>
          <td><code>RESTORMEL_PROJECT_ID</code></td>
          <td>Project UUID</td>
          <td>UUID</td>
        </tr>
        <tr>
          <td><code>RESTORMEL_ENVIRONMENT_ID</code></td>
          <td>One dev/prod <em>slot</em> inside the project</td>
          <td>UUID</td>
        </tr>
        <tr>
          <td><code>RESTORMEL_KEYS_BASE</code></td>
          <td>Site origin only, <strong>no path</strong></td>
          <td><code>https://restormel.dev</code></td>
        </tr>
        <tr>
          <td><code>RESTORMEL_CONTROL_PLANE_URL</code></td>
          <td>Dashboard app base; append <code>/api/projects/…</code>; no trailing slash</td>
          <td><code>https://restormel.dev/keys/dashboard</code></td>
        </tr>
        <tr>
          <td><code>RESTORMEL_EVALUATE_URL</code></td>
          <td>Full <code>POST</code> URL for policy evaluate</td>
          <td><code>…/keys/dashboard/api/policies/evaluate</code></td>
        </tr>
      </tbody>
    </table>
  </div>

  <h2>CI secrets (<code>*_STAGING</code>)</h2>
  <p>
    GitHub secret names often end in <code class="inline-code">_STAGING</code>. Your workflow should still map them to the <strong>canonical</strong> runtime names above. The project dashboard
    <strong>Copy full CI snippet</strong> includes both prefixed and unprefixed lines.
  </p>

  <h2>Admin wizards</h2>
  <p>
    If a single field is labeled “Restormel URL” or “site”, use <code class="inline-code">RESTORMEL_KEYS_BASE</code>. “Control-plane” or MCP route/policy tools need
    <code class="inline-code">RESTORMEL_CONTROL_PLANE_URL</code>. Policy / Plot-style evaluate calls need <code class="inline-code">RESTORMEL_EVALUATE_URL</code>.
  </p>

  <h2>Further reading</h2>
  <ul>
    <li><a href="/keys/docs/integrations/mcp">MCP integration</a> — stdio env wiring</li>
    <li><a href="/keys/docs/cloud-api">Cloud API</a> — Policy evaluate</li>
    <li>
      <a
        href="https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/runbooks/mcp-implementation-workflow.md"
        target="_blank"
        rel="noopener noreferrer">MCP implementation workflow</a
      > (runbook)
    </li>
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
  .doc-content ul {
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-4);
  }
  .inline-code {
    font-family: var(--rm-font-ui);
    font-size: 0.9em;
    padding: 0.1em 0.3em;
    border-radius: 4px;
    background: var(--rm-bg);
    border: 1px solid var(--rm-border);
  }
  .callout {
    padding: var(--space-4);
    border-radius: var(--rm-radius);
    margin-bottom: var(--space-6);
    border: 1px solid var(--rm-border);
  }
  .callout-tip {
    border-left: 4px solid var(--rm-sage);
    background: color-mix(in oklab, var(--rm-sage) 8%, var(--rm-surface));
  }
  .doc-table-wrap {
    overflow-x: auto;
    margin-bottom: var(--space-6);
  }
  .doc-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }
  .doc-table th,
  .doc-table td {
    border: 1px solid var(--rm-border);
    padding: var(--space-2) var(--space-3);
    text-align: left;
    vertical-align: top;
  }
  .doc-table th {
    background: var(--rm-surface-raised);
    color: var(--rm-text);
  }
  .doc-table td {
    color: var(--rm-muted);
  }
  .doc-table code {
    font-size: 0.85em;
  }
</style>
