<svelte:head>
  <title>Integrations — Docs — Restormel Keys</title>
  <meta name="description" content="Developer integrations for Restormel Keys: CLI, MCP, and AAIF." />
</svelte:head>

<h1 class="docs-h1">Integrations</h1>
<p class="docs-intro">
  Restormel Integrations connects Restormel Keys to your development workflow. Choose the surface
  that fits how you work.
</p>

<div class="integration-cards">
  <a href="/keys/docs/integrations/cli" class="integration-card">
    <h2 class="card-title">CLI</h2>
    <p class="card-desc">Debug, validate, and inspect from your terminal. Available now.</p>
    <span class="card-link">CLI quickstart &rarr;</span>
  </a>

  <a href="/keys/docs/integrations/mcp" class="integration-card">
    <h2 class="card-title">MCP</h2>
    <p class="card-desc">Use Restormel inside agent workflows and IDEs via Model Context Protocol.</p>
    <span class="card-link">MCP setup &rarr;</span>
  </a>

  <a href="/keys/docs/integrations/aaif" class="integration-card">
    <h2 class="card-title">AAIF</h2>
    <p class="card-desc">Structured request/response contract for predictable AI interactions.</p>
    <span class="card-link">AAIF overview &rarr;</span>
  </a>
</div>

<h2 class="docs-h2">Philosophy</h2>
<blockquote class="docs-quote">
  <p>Restormel doesn't replace your stack. It makes it intelligible, controllable, and portable.</p>
</blockquote>

<style>
  .docs-h1 {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-3);
  }
  .docs-intro {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-5);
    max-width: 42rem;
  }
  .integration-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }
  .integration-card {
    display: flex;
    flex-direction: column;
    padding: var(--space-4);
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s ease;
  }
  .integration-card:hover {
    border-color: var(--rm-sage);
  }
  .card-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .card-desc {
    flex: 1;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-3);
  }
  .card-link {
    font-size: var(--text-sm);
    color: var(--rm-sage);
    font-weight: 500;
  }
  .docs-h2 {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-3);
  }
  .docs-quote {
    border-left: 3px solid var(--rm-sage);
    padding-left: var(--space-4);
    margin: 0;
  }
  .docs-quote p {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    font-style: italic;
    line-height: var(--leading-relaxed);
  }
</style>
