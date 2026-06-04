<script lang="ts">
  /** Restormel Keys landing — migrated from Astro (Phase B). Code samples use vars so bundler does not resolve workspace packages. */
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";
  import EcosystemStrip from "$lib/components/integrations/EcosystemStrip.svelte";
  import { getVariant } from "$lib/posthog";
  import VariantA from "$lib/components/landing/VariantA.svelte";
  import VariantB from "$lib/components/landing/VariantB.svelte";
  import { isSuiteMarketingExpanded } from "$lib/integration-catalog-for-flags";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
  import {
    CLI_INSTALL,
    ELEMENTS_INSTALL,
    ELEMENTS_SNIPPET,
    REST_RESOLVE_SNIPPET,
  } from "$lib/public-npm-packages";

  let variant = "control";

  onMount(() => {
    let attempts = 0;
    const check = () => {
      const v = getVariant();
      if (v !== "control" || attempts >= 10) {
        variant = v;
        return;
      }
      attempts++;
      setTimeout(check, 200);
    };
    check();
  });

  const restInstall = `# Gateway key + site base — no npm core required
# RESTORMEL_KEYS_BASE=https://restormel.dev
# RESTORMEL_GATEWAY_KEY=rk_…`;
  const restCode = REST_RESOLVE_SNIPPET;

  const elementsInstall = ELEMENTS_INSTALL;
  const elementsCode = ELEMENTS_SNIPPET;

  const cliInstall = CLI_INSTALL;
  const cliCode = `# Device login + doctor
pnpm exec keys login
pnpm exec keys doctor`;

  $: flags = $page.data.moduleFlags ?? MVP_MODULE_DEFAULTS;
  $: suiteExpanded = isSuiteMarketingExpanded(flags);
  $: keysMetaDescription = suiteExpanded
    ? "The missing application layer for AI apps: BYOK, routing, and product-level controls on top of your existing AI stack. Works with OpenRouter, Portkey, Vercel AI, or direct providers. No proxy. No infrastructure. No migration."
    : "BYOK routing and control for AI apps — direct providers, Gateway keys, and Connect knowledge paths. No proxy. No migration.";
</script>

<svelte:head>
  <title>Restormel Keys — BYOK for AI apps</title>
  <meta name="description" content={keysMetaDescription} />
</svelte:head>

<article class="keys-page">
  {#if variant === "test"}
    <VariantB />
  {:else}
    <VariantA />
  {/if}

  <div class="container keys-eco-wrap">
    <EcosystemStrip variant="compact" />
  </div>

  <section class="section section-intents section-alt" aria-labelledby="intent-heading">
    <div class="container">
      <h2 id="intent-heading" class="section-title">What brings you here?</h2>
      <div class="intent-grid">
        <a class="intent-card" href="/keys/docs/walkthrough">
          <strong>Starting a new project</strong>
          <span>Get routing + first resolve in 15-20 minutes.</span>
        </a>
        <a class="intent-card" href="/keys/docs/walkthrough/migration-paths">
          <strong>Adding control to an existing stack</strong>
          <span
            >{flags.gatewayProviders
              ? "OpenRouter/Vercel/Portkey + Restormel control-plane path."
              : "Direct providers + Restormel control-plane path."}</span
          >
        </a>
        <a class="intent-card" href="/keys/docs/walkthrough/phase-5-ui">
          <strong>Adding BYOK to a SaaS</strong>
          <span>KeyManager + policy-bounded model choice for end users.</span>
        </a>
        <a class="intent-card" href="/keys/docs/integrations">
          <strong>CLI, agent, or IDE path</strong>
          <span>Developer tooling path (CLI, MCP, AAIF).</span>
        </a>
        <a class="intent-card" href="/keys/docs/walkthrough/verification-strategy">
          <strong>Running platform operations</strong>
          <span>Lifecycle, readiness, coverage, CI/CD, governance.</span>
        </a>
      </div>
    </div>
  </section>

  <section class="section" aria-labelledby="use-cases-heading">
    <div class="container">
      <h2 id="use-cases-heading" class="section-title">Built in real products</h2>
      <p class="section-intro">
        See how different teams use Restormel Keys in production: a fast setup for privacy-sensitive extraction at PLOT, and a deeper multi-workload
        integration at Sophia.
      </p>
      <div class="use-cases-grid">
        <a class="use-case-card" href="/keys/use-cases#plot-title">
          <strong>PLOT (Plotbudget)</strong>
          <span>Policy-driven extraction routing with fallback chains and server-only key handling.</span>
        </a>
        <a class="use-case-card" href="/keys/use-cases#sophia-title">
          <strong>Sophia</strong>
          <span>Resolve + policy + catalog workflows across multi-pass analysis, ingestion, and BYOK surfaces.</span>
        </a>
      </div>
      <p class="use-cases-cta"><a href="/keys/use-cases">Read full use cases →</a></p>
    </div>
  </section>

  <section class="section section-alt" aria-labelledby="why-heading">
    <div class="container container-narrow">
      <h2 id="why-heading" class="section-title">AI infrastructure is solved. Product logic isn’t.</h2>
      <p class="section-intro">
        Tools like OpenRouter, Portkey, Vercel AI Gateway, and LiteLLM handle infrastructure concerns: provider access, aggregation, and (often) proxy-style routing.
        But every AI product still has to build the application layer: end-user BYOK, plan-based model access, budgets, and routing decisions based on user context.
        <strong>Restormel Keys</strong> is that missing application layer — designed to sit above your existing stack.
      </p>
    </div>
  </section>

  <section class="section section-modes" aria-labelledby="modes-heading">
    <div class="container">
      <h2 id="modes-heading" class="section-title">Restormel sits above your existing stack</h2>
      <p class="section-intro">
        Keep your infrastructure. Restormel adds the application layer: BYOK for your users, routing based on user + plan, cost awareness before execution, and embeddable UX for key management.
      </p>
      <div class="two-layer" aria-label="Two-layer model">
        <div class="layer-card">
          <p class="layer-kicker">Layer 1 — Infrastructure</p>
          <p class="layer-copy">OpenRouter / Portkey / Vercel AI / direct providers</p>
        </div>
        <div class="layer-card">
          <p class="layer-kicker">Layer 2 — Application</p>
          <p class="layer-copy">Restormel Keys (BYOK, routing, policies, entitlements, budgets)</p>
        </div>
      </div>

      <h3 class="section-subtitle">Three ways to use it</h3>
      <p class="section-intro">Gateway-backed, builder-managed direct, or end-user BYOK. Same core; adopt progressively.</p>
      <div class="modes-grid">
        <div class="mode-card">
          <h3 class="mode-title">Gateway-backed</h3>
          <p class="mode-copy">Keep OpenRouter / Portkey / Vercel AI Gateway as your provider-access layer. Use Restormel for routing policies, health, analytics, and progressive rollout.</p>
        </div>
        <div class="mode-card">
          <h3 class="mode-title">Builder-managed direct</h3>
          <p class="mode-copy">Keep provider keys in your env/secrets manager. Restormel resolves the route/model/provider decision; you supply provider access from your own infrastructure.</p>
        </div>
        <div class="mode-card">
          <h3 class="mode-title">End-user BYOK (builder-managed)</h3>
          <p class="mode-copy">Offer a KeyManager UX for users, but store credentials in <em>your</em> backend (or a gateway-backed scheme). Restormel remains the control layer.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section section-code section-alt" aria-labelledby="code-heading">
    <div class="container">
      <h2 id="code-heading" class="section-title">Add it to your stack</h2>
      <p class="section-intro">Choose your integration path. Tabs are CSS-only, so this section renders cleanly without client JavaScript.</p>

      <div class="code-tabs">
        <input id="tab-rest" class="code-tab-input" type="radio" name="framework-tab" checked />
        <input id="tab-elements" class="code-tab-input" type="radio" name="framework-tab" />
        <input id="tab-cli" class="code-tab-input" type="radio" name="framework-tab" />

        <div class="code-framework-tabs" role="tablist" aria-label="Integration snippets">
          <label class="code-fw-tab code-fw-tab-rest" for="tab-rest" role="tab">Keys REST</label>
          <label class="code-fw-tab code-fw-tab-elements" for="tab-elements" role="tab">Web Components</label>
          <label class="code-fw-tab code-fw-tab-cli" for="tab-cli" role="tab">CLI</label>
        </div>

        <div class="code-tab-panels">
          <section class="code-tab-panel panel-rest" aria-label="Keys REST example">
            <div class="code-pane">
              <span class="code-label">Env</span>
              <CodeBlock language="bash" code={restInstall} />
            </div>
            <div class="code-pane">
              <span class="code-label">Resolve</span>
              <CodeBlock language="ts" code={restCode} />
            </div>
          </section>

          <section class="code-tab-panel panel-elements" aria-label="Web Components example">
            <div class="code-pane">
              <span class="code-label">Install</span>
              <CodeBlock language="bash" code={elementsInstall} />
            </div>
            <div class="code-pane">
              <span class="code-label">Example</span>
              <CodeBlock language="html" code={elementsCode} />
            </div>
          </section>

          <section class="code-tab-panel panel-cli" aria-label="CLI example">
            <div class="code-pane">
              <span class="code-label">Install</span>
              <CodeBlock language="bash" code={cliInstall} />
            </div>
            <div class="code-pane">
              <span class="code-label">Example</span>
              <CodeBlock language="bash" code={cliCode} />
            </div>
          </section>
        </div>
      </div>
    </div>
  </section>

  <section class="section section-frameworks" aria-labelledby="frameworks-heading">
    <div class="container">
      <h2 id="frameworks-heading" class="section-title">Fits your framework</h2>
      <p class="frameworks-copy">
        <strong>SvelteKit</strong>, <strong>Next.js / React</strong>, and <strong>Web Components</strong> are supported package paths. You can also run fully headless in any framework with <code>@restormel/keys</code>. Same API; no Docker, Redis, or proxy.
      </p>
      <ul class="framework-list" aria-label="Supported frameworks">
        <li><span class="fw-pill fw-pill-active">SvelteKit</span></li>
        <li><span class="fw-pill">Next.js</span></li>
        <li><span class="fw-pill">React</span></li>
        <li><span class="fw-pill">Vue</span></li>
        <li><span class="fw-pill">Astro</span></li>
      </ul>
    </div>
  </section>

  <section class="section section-features section-alt" aria-labelledby="features-heading">
    <div class="container">
      <h2 id="features-heading" class="section-title">What's in the box</h2>
      <p class="section-intro">Routing, policies, health, cost, and embeddable UX that sit alongside your existing provider access.</p>
      <div class="features-grid">
        <div class="feature-card"><h3 class="feature-title">Integrations</h3><p>Works with OpenRouter, Vercel AI Gateway, Portkey, and direct providers.</p></div>
        <div class="feature-card"><h3 class="feature-title">Restormel Resolve</h3><p>Model → provider resolution. One middleware, multiple backends.</p></div>
        <div class="feature-card"><h3 class="feature-title">Cost</h3><p>Per-model cost and budget comparison. Estimate before you call.</p></div>
        <div class="feature-card"><h3 class="feature-title">Entitlements</h3><p>Gate features by tier. Optional usage limits.</p></div>
        <div class="feature-card"><h3 class="feature-title">Embeddable UX</h3><p>ModelSelector, CostEstimator, and optional KeyManager. Svelte, React, or Web Components.</p></div>
        <div class="feature-card"><h3 class="feature-title">Restormel Doctor & Validate</h3><p>Health checks you can run locally or in CI to catch bad config and broken provider access before deploy.</p></div>
      </div>
    </div>
  </section>

  <section class="section section-alt" aria-labelledby="fit-heading">
    <div class="container">
      <h2 id="fit-heading" class="section-title">Where Restormel fits in your AI stack</h2>
      <div class="table-wrap" role="region" aria-label="Where Restormel fits comparison table">
        <table class="fit-table">
          <thead>
            <tr>
              <th>Capability</th>
              <th>LiteLLM / Portkey / OpenRouter</th>
              <th>Restormel Keys</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Primary role</td><td>Infrastructure / gateway / proxy</td><td>Application-layer library</td></tr>
            <tr><td>How it runs</td><td>Hosted service or self-hosted infra</td><td>Runs inside your app</td></tr>
            <tr><td>Request routing</td><td>Yes (proxy-based)</td><td>Yes (in-app, key-aware)</td></tr>
            <tr><td>Request/response normalisation</td><td>Yes</td><td>Handled by your provider or gateway</td></tr>
            <tr><td>Caching</td><td>Sometimes built-in</td><td>Use your existing cache (Redis, CDN, gateway)</td></tr>
            <tr><td>Observability / tracing</td><td>Often built-in</td><td>Use your existing observability tools</td></tr>
            <tr><td>Access to multiple providers</td><td>Yes (via proxy or aggregation)</td><td>Yes (via your providers or OpenRouter)</td></tr>
            <tr><td>End-user BYOK (bring your own keys)</td><td>No</td><td>Yes — first-class</td></tr>
            <tr><td>Embeddable key management UI</td><td>No</td><td>Yes — drop-in components</td></tr>
            <tr><td>Per-user model availability</td><td>No</td><td>Yes — based on user keys</td></tr>
            <tr><td>Cost estimation (before request)</td><td>Limited</td><td>Yes — built-in</td></tr>
            <tr><td>Plan-based entitlements</td><td>Limited</td><td>Yes — first-class</td></tr>
            <tr><td>Library-first (no infra required)</td><td>No</td><td>Yes</td></tr>
            <tr><td>Works with existing stack</td><td>N/A (is the stack)</td><td>Yes — designed to sit on top</td></tr>
          </tbody>
        </table>
      </div>
      <p class="fit-note">
        Restormel doesn’t replace your AI gateway — it completes it. Use OpenRouter, Portkey, or direct providers for infrastructure. Use Restormel to add BYOK, routing logic, and product-level controls.
      </p>
    </div>
  </section>

  <section class="section section-pricing section-alt" aria-labelledby="pricing-heading">
    <div class="container">
      <h2 id="pricing-heading" class="section-title">Pricing</h2>
      <p class="section-intro">Free to build. Upgrade to Pro when you’re ready to ship.</p>
      <p class="section-intro">
        <strong>Early access:</strong> First <strong>50</strong> founding members get <strong>12 months of Pro</strong> via
        <a class="section-intro-link" href="/founders">Founders Circle</a>. Full tiers (Team, Platform bundle) are on the
        pricing page.
      </p>
      <div class="pricing-grid">
        <div class="pricing-card">
          <h3 class="pricing-tier">Free</h3>
          <p class="pricing-price">$0</p>
          <p class="pricing-desc">Best for prototyping. 2 projects and 1,000 requests/month.</p>
        </div>
        <div class="pricing-card">
          <h3 class="pricing-tier">Pro</h3>
          <p class="pricing-price">£10<span class="pricing-period">/mo</span></p>
          <p class="pricing-desc">
            Best for production. Higher limits, visibility, and routing controls. Other currencies at checkout (Paddle).
          </p>
        </div>
      </div>
      <p class="pricing-cta"><a href="/keys/pricing">See full pricing and FAQ →</a></p>
    </div>
  </section>

  <section class="section section-cta" aria-labelledby="cta-heading">
    <div class="container">
      <h2 id="cta-heading" class="cta-headline">Add governance to your AI stack</h2>
      <p class="cta-sub">Install the packages, pick gateway-backed or direct provider access, then add routes and policies. The walkthrough guides you step by step.</p>
      <a href="/keys/docs" class="btn btn-primary">Get started</a>
    </div>
  </section>
</article>

<style>
  .keys-eco-wrap {
    margin-top: var(--space-4);
    margin-bottom: var(--space-2);
  }
  .keys-page {
    --keys-max: var(--rm-container-max);
  }
  .container {
    max-width: var(--keys-max);
    margin: 0 auto;
    padding: 0 var(--space-6);
  }
  .container-narrow {
    max-width: var(--rm-container-narrow);
  }
  .section {
    padding: var(--rm-section-padding) 0;
  }
  .section-alt {
    background: var(--rm-surface);
  }
  .section-title {
    font-family: var(--rm-font-display);
    font-size: clamp(1.5rem, 4vw, 2rem);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-6);
  }
  .section-intro {
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    max-width: var(--rm-container-narrow);
  }
  .section-intro-link {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .btn {
    display: inline-block;
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    padding: var(--space-2) var(--space-5);
    min-height: var(--button-height-md);
    line-height: 1.25;
    border-radius: var(--rm-radius);
    text-decoration: none;
    font-weight: var(--font-medium);
  }
  .btn-primary {
    background: var(--rm-sage);
    color: var(--rm-bg);
  }
  .btn-primary:hover {
    filter: brightness(1.1);
  }
  .section-subtitle {
    margin: var(--space-8) 0 var(--space-3);
    font-size: var(--text-lg);
    color: var(--rm-text);
    font-family: var(--rm-font-display);
  }
  .two-layer {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
    margin: 0 0 var(--space-6);
  }
  .layer-card {
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface-raised);
    padding: var(--space-4);
  }
  .layer-kicker {
    margin: 0 0 var(--space-1);
    font-size: var(--text-xs);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--rm-dim);
  }
  .layer-copy {
    margin: 0;
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  @media (max-width: 760px) {
    .two-layer {
      grid-template-columns: 1fr;
    }
  }
  .modes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: var(--space-6);
  }
  .mode-card {
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    padding: var(--space-6);
  }
  .mode-title {
    font-family: var(--rm-font-ui);
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--rm-sage);
    margin: 0 0 var(--space-2);
  }
  .mode-copy {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0;
    line-height: var(--leading-relaxed);
  }
  .code-split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-6);
  }
  @media (max-width: 900px) {
    .code-split {
      grid-template-columns: 1fr;
    }
  }
  .code-pane {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
    overflow: hidden;
  }
  .code-pane :global(.codeblock) {
    min-width: 0;
  }
  .code-label {
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    color: var(--rm-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .frameworks-copy {
    font-size: var(--text-base);
    color: var(--rm-muted);
    margin: 0 0 var(--space-5);
    max-width: var(--rm-container-narrow);
  }
  .frameworks-copy :global(strong) {
    color: var(--rm-text);
  }
  .framework-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .fw-pill {
    display: inline-block;
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    padding: var(--space-2) var(--space-3);
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    color: var(--rm-muted);
  }
  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--space-4);
  }
  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface);
    margin: 0 0 var(--space-4);
  }
  .fit-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 52rem;
    font-size: var(--text-sm);
  }
  .fit-table th,
  .fit-table td {
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--rm-border);
    vertical-align: top;
    text-align: left;
  }
  .fit-table thead th {
    background: var(--rm-surface-raised);
    color: var(--rm-text);
    font-weight: var(--font-medium);
  }
  .fit-table tbody td {
    color: var(--rm-muted);
  }
  .fit-note {
    margin: 0;
    color: var(--rm-muted);
    max-width: var(--rm-container-narrow);
    line-height: var(--leading-relaxed);
  }
  .feature-card {
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    padding: var(--space-5);
  }
  .feature-title {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--rm-sage);
    margin: 0 0 var(--space-2);
  }
  .feature-card p {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0;
    line-height: var(--leading-relaxed);
  }
  .pricing-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: var(--space-6);
    margin-bottom: var(--space-6);
  }
  .pricing-card {
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    padding: var(--space-6);
  }
  .pricing-tier {
    font-family: var(--rm-font-ui);
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .pricing-price {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    color: var(--rm-sage);
    margin: 0 0 var(--space-1);
  }
  .pricing-period {
    font-size: var(--text-sm);
    color: var(--rm-dim);
  }
  .pricing-desc {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0;
    line-height: var(--leading-relaxed);
  }
  .pricing-cta {
    margin: 0;
  }
  .cta-headline {
    font-family: var(--rm-font-display);
    font-size: clamp(1.5rem, 4vw, 2rem);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-3);
  }
  .cta-sub {
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
  }
  .code-framework-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    margin: 0 0 var(--space-4);
  }
  .code-tab-input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .code-tab-panels {
    display: block;
  }
  .code-tab-panel {
    display: none;
  }
  #tab-rest:checked ~ .code-tab-panels .panel-rest,
  #tab-elements:checked ~ .code-tab-panels .panel-elements,
  #tab-cli:checked ~ .code-tab-panels .panel-cli {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-6);
  }
  @media (max-width: 900px) {
    #tab-rest:checked ~ .code-tab-panels .panel-rest,
    #tab-elements:checked ~ .code-tab-panels .panel-elements,
    #tab-cli:checked ~ .code-tab-panels .panel-cli {
      grid-template-columns: 1fr;
    }
  }
  .code-fw-tab {
    display: inline-flex;
    align-items: center;
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    padding: var(--space-2) var(--space-4);
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    color: var(--rm-muted);
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }
  .code-fw-tab:hover {
    color: var(--rm-text);
    border-color: var(--rm-sage);
  }
  #tab-rest:checked ~ .code-framework-tabs .code-fw-tab-rest,
  #tab-elements:checked ~ .code-framework-tabs .code-fw-tab-elements,
  #tab-cli:checked ~ .code-framework-tabs .code-fw-tab-cli {
    background: var(--rm-sage);
    color: var(--rm-bg);
    border-color: var(--rm-sage);
  }
  .fw-pill-active {
    background: var(--rm-sage);
    color: var(--rm-bg);
    border-color: var(--rm-sage);
  }
  .intent-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
  }
  .intent-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface-raised);
    padding: var(--space-3);
    text-decoration: none;
  }
  .intent-card strong {
    color: var(--rm-text);
    font-size: var(--text-sm);
  }
  .intent-card span {
    color: var(--rm-muted);
    font-size: var(--text-xs);
    line-height: 1.4;
  }
  .use-cases-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }
  .use-case-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface-raised);
    padding: var(--space-4);
    text-decoration: none;
  }
  .use-case-card strong {
    color: var(--rm-text);
    font-size: var(--text-sm);
  }
  .use-case-card span {
    color: var(--rm-muted);
    font-size: var(--text-xs);
    line-height: 1.45;
  }
  .use-cases-cta {
    margin: var(--space-3) 0 0;
  }
  @media (max-width: 960px) {
    .intent-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .use-cases-grid {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 640px) {
    .intent-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
