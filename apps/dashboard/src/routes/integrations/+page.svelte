<script lang="ts">
  import IntegrationCard from "$lib/components/integrations/IntegrationCard.svelte";
  import EcosystemStrip from "$lib/components/integrations/EcosystemStrip.svelte";
</script>

<svelte:head>
  <title>Integrations — Restormel</title>
  <meta name="description" content="Connect your app, terminal, and agent workflows to Restormel using developer-first tools." />
</svelte:head>

<div class="container">
  <!-- Hero -->
  <section class="hero" aria-labelledby="hero-heading">
    <h1 id="hero-heading" class="hero-headline">Restormel, wherever your agents run</h1>
    <p class="hero-body">
      Connect your app, terminal, and agent workflows to Restormel using developer-first tools.
    </p>
    <div class="hero-ctas">
      <a href="/keys" class="btn btn-primary">Get started with Keys</a>
      <a href="#integrations" class="btn btn-secondary">Explore integrations</a>
    </div>
  </section>

  <EcosystemStrip variant="full" heading="Works with your stack" />

  <!-- Integration Cards -->
  <section id="integrations" class="section" aria-labelledby="cards-heading">
    <h2 id="cards-heading" class="section-title">Restormel developer surfaces</h2>
    <p class="section-intro">
      CLI, MCP, and AAIF are how you wire Restormel into terminals and agents. Third-party databases, gateways, and CI
      are indexed in the <a href="/keys/docs/guides/integration-catalog">integration catalog</a>.
    </p>
    <div class="cards-grid">
      <IntegrationCard
        title="CLI"
        description="Debug, validate, and inspect from your terminal."
        status="available"
        cta="View CLI docs"
        href="/keys/docs/integrations/cli"
      />
      <IntegrationCard
        title="MCP"
        description="Agent and IDE tools over stdio: routing, cost, live policy evaluate, and optional control-plane automation — with clear server-only env wiring."
        status="early"
        cta="Set up MCP"
        href="/keys/docs/integrations/mcp"
      />
      <IntegrationCard
        title="AAIF"
        description="Structured request/response contract with runtime routing + spend estimation via Keys."
        status="advanced"
        cta="Learn more"
        href="/keys/docs/integrations/aaif"
      />
    </div>
  </section>

  <!-- Day 0.1 Setup -->
  <section class="section" aria-labelledby="setup-heading">
    <h2 id="setup-heading" class="section-title">Start in minutes</h2>
    <ol class="setup-steps">
      <li class="setup-step">
        <span class="step-number">1</span>
        <div>
          <strong>Install Keys</strong>
          <p class="step-desc">Add the core package to your project.</p>
          <code class="step-code">npm install @restormel/keys</code>
        </div>
      </li>
      <li class="setup-step">
        <span class="step-number">2</span>
        <div>
          <strong>Add provider keys</strong>
          <p class="step-desc">Configure your provider access — env vars, secrets manager, or a gateway.</p>
        </div>
      </li>
      <li class="setup-step">
        <span class="step-number">3</span>
        <div>
          <strong>Choose your workflow</strong>
          <p class="step-desc">Pick the surface that fits how you work.</p>
          <div class="workflow-options">
            <a href="/keys/docs" class="workflow-option">SDK</a>
            <a href="/keys/docs/integrations/cli" class="workflow-option">CLI</a>
            <a href="/keys/docs/integrations/mcp" class="workflow-option">MCP</a>
          </div>
        </div>
      </li>
    </ol>
  </section>

  <!-- Philosophy -->
  <section class="section philosophy" aria-labelledby="philosophy-heading">
    <h2 id="philosophy-heading" class="sr-only">Philosophy</h2>
    <blockquote class="philosophy-quote">
      <p>Restormel doesn't replace your stack.</p>
      <p>It makes it intelligible, controllable, and portable.</p>
    </blockquote>
  </section>

  <!-- Docs Links -->
  <section class="section" aria-labelledby="docs-heading">
    <h2 id="docs-heading" class="section-title">Documentation</h2>
    <ul class="docs-links">
      <li><a href="/keys/docs/integrations/cli">CLI Quickstart</a></li>
      <li><a href="/keys/docs/integrations/mcp">MCP Setup</a></li>
      <li><a href="/keys/docs/integrations/aaif">AAIF Overview</a></li>
    </ul>
  </section>
</div>

<style>
  .container {
    max-width: var(--rm-container-max);
    margin: 0 auto;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  /* Hero */
  .hero {
    text-align: center;
    padding: var(--space-8) 0;
    margin-bottom: var(--space-6);
  }
  .hero-headline {
    font-family: var(--rm-font-display);
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-4);
    line-height: 1.15;
  }
  .hero-body {
    font-size: var(--text-lg);
    color: var(--rm-muted);
    max-width: 36rem;
    margin: 0 auto var(--space-6);
    line-height: var(--leading-relaxed);
  }
  .hero-ctas {
    display: flex;
    justify-content: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  /* Buttons */
  .btn {
    display: inline-block;
    padding: var(--space-3) var(--space-5);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    font-weight: 500;
    text-decoration: none;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }
  .btn-primary {
    background: var(--rm-sage);
    color: var(--rm-bg);
  }
  .btn-primary:hover {
    opacity: 0.9;
  }
  .btn-secondary {
    background: transparent;
    color: var(--rm-sage);
    border: 1px solid var(--rm-border);
  }
  .btn-secondary:hover {
    border-color: var(--rm-sage);
    color: var(--rm-text);
  }

  /* Sections */
  .section {
    margin-bottom: var(--space-8);
  }
  .section-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-4);
  }
  .section-intro {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: calc(-1 * var(--space-2)) 0 var(--space-5);
    max-width: 42rem;
  }
  .section-intro a {
    color: var(--rm-sage);
  }

  /* Cards grid */
  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: var(--space-5);
  }

  /* Setup steps */
  .setup-steps {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    max-width: 36rem;
  }
  .setup-step {
    display: flex;
    gap: var(--space-4);
    align-items: flex-start;
  }
  .step-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background: var(--rm-sage);
    color: var(--rm-bg);
    font-size: var(--text-sm);
    font-weight: 600;
    flex-shrink: 0;
  }
  .setup-step strong {
    font-size: var(--text-sm);
    color: var(--rm-text);
  }
  .step-desc {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: var(--space-1) 0;
  }
  .step-code {
    display: inline-block;
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-1) var(--space-3);
    font-family: "JetBrains Mono", monospace;
    font-size: var(--text-xs);
    color: var(--rm-text);
  }
  .workflow-options {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  .workflow-option {
    font-size: var(--text-sm);
    color: var(--rm-sage);
    text-decoration: none;
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .workflow-option:hover {
    border-color: var(--rm-sage);
    background: color-mix(in oklab, var(--rm-sage) 8%, transparent);
  }

  /* Philosophy */
  .philosophy {
    text-align: center;
    padding: var(--space-6) 0;
  }
  .philosophy-quote {
    margin: 0 auto;
    max-width: 32rem;
    border: none;
    padding: 0;
  }
  .philosophy-quote p {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    font-style: italic;
    color: var(--rm-muted);
    margin: 0 0 var(--space-2);
    line-height: var(--leading-relaxed);
  }
  .philosophy-quote p:last-child {
    margin-bottom: 0;
  }

  /* Docs links */
  .docs-links {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .docs-links a {
    font-size: var(--text-sm);
    color: var(--rm-sage);
    text-decoration: none;
    font-weight: 500;
  }
  .docs-links a:hover {
    text-decoration: underline;
    color: var(--rm-text);
  }
</style>
