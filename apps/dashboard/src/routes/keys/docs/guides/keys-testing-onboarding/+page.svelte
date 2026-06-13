<svelte:head>
  <title>Keys + Restormel Testing onboarding — Restormel Keys</title>
  <meta
    name="description"
    content="Store provider credentials securely in Connections, use the Restormel Testing hub for project IDs, Gateway keys, and Testing CLI env."
  />
</svelte:head>

<div class="doc-content">
  <h1>Keys + Restormel Testing onboarding</h1>
  <p class="doc-intro">
    <strong>Canonical repo copy:</strong>
    <code class="inline-code">docs/guides/keys-testing-onboarding.md</code> — same operational steps; update that file first, then keep this page aligned.
  </p>

  <div class="callout callout-tip">
    <strong>Goal:</strong> Run <code class="inline-code">judge_rubric</code> and Keys-backed resolve from the Testing CLI without hand-rolling env from scattered docs. Use
    <strong>Connections</strong> for encrypted hosted provider keys (when the deployment is configured), <strong>Gateway keys</strong> for
    <code class="inline-code">RESTORMEL_GATEWAY_KEY</code> (alias <code class="inline-code">RESTORMEL_KEYS_API_TOKEN</code>), and the <strong>Restormel Testing</strong> dashboard page for
    <code class="inline-code">RESTORMEL_PROJECT_ID</code> and environment IDs.
  </div>

  <h2>Steps (summary)</h2>
  <ol class="doc-ol">
    <li>Sign in to the dashboard.</li>
    <li>
      <strong>Connections</strong> (<code class="inline-code">/keys/dashboard/integrations</code>): add a provider — paste a <strong>hosted API key</strong> once (encrypted at rest) or a
      <strong>vault reference</strong> only. Never shown in full after save.
    </li>
    <li>
      <strong>Gateway keys</strong> (<code class="inline-code">/keys/dashboard/access</code>): create an <code class="inline-code">rk_…</code> key for the Restormel Testing project (or a project you bind to).
    </li>
    <li>
      <strong>Restormel Testing</strong> (<code class="inline-code">/keys/dashboard/testing</code>): copy project ID, environment IDs, and the env snippet pattern.
    </li>
    <li>
      Run <code class="inline-code">pnpm exec testing doctor</code> locally; it checks Keys URL/token and reminds you if <code class="inline-code">RESTORMEL_PROJECT_ID</code> is missing when the Keys base URL is set.
    </li>
  </ol>

  <h2>Related</h2>
  <ul class="doc-ul">
    <li>
      <a href="/keys/docs/guides/database-neon-for-self-hosters">Database for self-hosters: Neon</a> — when you self-host the Keys dashboard (Postgres + Neon Auth).
    </li>
    <li><a href="/keys/docs/guides/environment-vocabulary">Environment vocabulary</a> — canonical <code class="inline-code">RESTORMEL_*</code> names.</li>
    <li>
      <a href="https://restormel.dev/testing/docs/integrations/keys">Testing docs — Restormel Keys</a> (runner env and <code class="inline-code">resolve-model</code>).
    </li>
  </ul>
</div>

<style>
  .doc-content {
    max-width: 42rem;
    padding: var(--space-6) var(--space-4);
  }
  .doc-intro {
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .inline-code {
    font-family: var(--rm-font-mono);
    font-size: 0.9em;
  }
  .callout {
    border-radius: var(--radius-md);
    padding: var(--space-4);
    margin: var(--space-4) 0;
    border: 1px solid var(--rm-border);
  }
  .callout-tip {
    background: var(--rm-surface-2);
  }
  .doc-ol,
  .doc-ul {
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
  }
  .doc-ol li,
  .doc-ul li {
    margin-bottom: var(--space-2);
  }
  .doc-ol a,
  .doc-ul a {
    color: var(--rm-sage);
  }
  h1 {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    margin: 0 0 var(--space-4);
  }
  h2 {
    font-size: var(--text-lg);
    margin: var(--space-6) 0 var(--space-2);
  }
</style>
