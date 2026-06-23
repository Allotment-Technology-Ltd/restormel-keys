<script lang="ts">
  /**
   * Restormel Keys landing — migrated from Astro (Phase B). Code samples use vars so bundler does not resolve workspace packages.
   *
   * Marketing claims ledger citations (docs/verified-context-claims-ledger.md):
   * - "verbatim quote you can check yourself" + offsets/hash + re-verify → row #2 (proven)
   * - "second model family checks the extraction by default" → row #5 (proven)
   * - "misattribution caught structurally, not by model opinion" → row #3 (proven)
   * - "every claim carries a provenance trace" (state + citation + trace ref) → row #7 (proven)
   * - "unsupported claims excluded, not blended; strict retrieval returns only supported claims" → row #4 (proven)
   */
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
    ? "The control plane for verified context: provenance-traced, evidence-bound, quality-gated knowledge an agent or its auditor can trace to the exact source span. BYOK and policy-bounded model routing built in."
    : "Restormel Keys — the control plane for verified context. Provenance-traced, evidence-bound knowledge for AI products, with BYOK and model routing built in.";
</script>

<svelte:head>
  <title>Restormel Keys — the control plane for verified context</title>
  <meta name="description" content={keysMetaDescription} />
</svelte:head>

<article class="keys-page">
  {#if variant === "test"}
    <VariantB />
  {:else}
    <VariantA />
  {/if}

  <div class="container keys-eco-wrap">
    <EcosystemStrip variant="compact" moduleFlags={flags} />
  </div>

  <section class="section section-intents section-alt" aria-labelledby="intent-heading">
    <div class="container">
      <h2 id="intent-heading" class="section-title">What brings you here?</h2>
      <div class="intent-grid">
        <a class="intent-card" href="/keys/docs/guides/verified-context">
          <strong>Serving knowledge an agent can be held to</strong>
          <span>Evidence-bound, provenance-traced claims your auditor can check.</span>
        </a>
        <a class="intent-card" href="/keys/docs/walkthrough">
          <strong>Starting a new project</strong>
          <span>Get routing + first resolve in 15-20 minutes.</span>
        </a>
        <a class="intent-card" href="/keys/docs/walkthrough/migration-paths">
          <strong>Adding control to an existing stack</strong>
          <span>Bring your own providers; add a verified-context control plane on top.</span>
        </a>
        <a class="intent-card" href="/keys/docs/walkthrough/phase-5-ui">
          <strong>Adding BYOK to a SaaS</strong>
          <span>KeyManager + policy-bounded model choice for end users.</span>
        </a>
        <a class="intent-card" href="/keys/docs/integrations">
          <strong>CLI, agent, or IDE path</strong>
          <span>Developer tooling path (CLI, MCP, Dispatch).</span>
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
      <h2 id="why-heading" class="section-title">"The AI said so" is not a citation.</h2>
      <p class="section-intro">
        Most AI products can route to a model and get an answer back. What they can't do is tell you <em>why</em>
        an answer is trustworthy — which source it came from, whether that source actually says it, and what was left
        out. <strong>Restormel Keys is the control plane for verified context</strong>: provenance-traced,
        evidence-bound, quality-gated knowledge an agent — or its auditor — can trace to the exact source span.
        BYOK and model routing are the supporting plumbing that feeds it.
      </p>
    </div>
  </section>

  <section class="section section-proof" aria-labelledby="proof-heading">
    <div class="container">
      <h2 id="proof-heading" class="section-title">Claim → citation → trace</h2>
      <p class="section-intro">
        Every claim Keys serves can be followed from the answer back to the source. These guarantees are tied to
        tests and CI gates in the
        <a class="section-intro-link" href="/keys/docs/guides/verified-context">verified-context guide</a> — not to
        a marketing promise.
      </p>
      <ol class="proof-steps" aria-label="From claim to source span">
        <li class="proof-step">
          <span class="proof-step-num" aria-hidden="true">1</span>
          <div class="proof-step-body">
            <h3 class="proof-step-title">Claim</h3>
            <p>
              A second model family checks the extraction by default — the model that wrote a claim never grades its
              own work.
            </p>
          </div>
        </li>
        <li class="proof-step">
          <span class="proof-step-num" aria-hidden="true">2</span>
          <div class="proof-step-body">
            <h3 class="proof-step-title">Citation</h3>
            <p>
              Every supported claim is backed by a verbatim quote you can check yourself, bound to character offsets
              and a hash of the source version. A quote cited against the wrong source fails to bind — misattribution
              is caught structurally, not by model opinion.
            </p>
          </div>
        </li>
        <li class="proof-step">
          <span class="proof-step-num" aria-hidden="true">3</span>
          <div class="proof-step-body">
            <h3 class="proof-step-title">Trace</h3>
            <p>
              Every claim carries a provenance trace — its verification state, its citation, and a trace ref.
              Unsupported claims are excluded, not blended; strict retrieval returns only supported claims. Export
              the trace as JSON for your compliance file.
            </p>
          </div>
        </li>
      </ol>
      <p class="proof-cta">
        <a href="/keys/docs/guides/verified-context">Read what "verified" means on this API →</a>
      </p>
    </div>
  </section>

  <section class="section section-modes section-alt" aria-labelledby="modes-heading">
    <div class="container">
      <h2 id="modes-heading" class="section-title">Three ways to feed it</h2>
      <p class="section-intro">
        Verified context needs model access underneath it. Keys gives you three supporting ways to supply that —
        builder-managed direct, gateway-backed, or end-user BYOK — without changing how verification works on top.
      </p>
      <div class="modes-grid">
        <div class="mode-card">
          <h3 class="mode-title">Builder-managed direct</h3>
          <p class="mode-copy">Keep provider keys in your env/secrets manager. Restormel resolves the route/model/provider decision; you supply provider access from your own infrastructure.</p>
        </div>
        <div class="mode-card">
          <h3 class="mode-title">Gateway-backed</h3>
          <p class="mode-copy">Already route through a provider-access layer? Keep it. Restormel adds routing policies, health, analytics, and progressive rollout on top.</p>
        </div>
        <div class="mode-card">
          <h3 class="mode-title">End-user BYOK</h3>
          <p class="mode-copy">Offer a KeyManager UX for users while credentials stay in <em>your</em> backend. Policy-bounded model choice per plan tier — Restormel stays the control plane.</p>
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
      <p class="section-intro">Verified context first — with the routing, policy, and BYOK plumbing that feeds it.</p>
      <div class="features-grid">
        <div class="feature-card"><h3 class="feature-title">Verified context</h3><p>Provenance-traced, evidence-bound, quality-gated knowledge served to your agents — every claim tied to a source span.</p></div>
        <div class="feature-card"><h3 class="feature-title">Cross-model validation</h3><p>An independent model family checks each extraction by default, so a claim is never graded by the model that wrote it.</p></div>
        <div class="feature-card"><h3 class="feature-title">Provenance traces</h3><p>Every retrieval records which claims were considered, their verification state, and why anything was excluded — exportable as JSON.</p></div>
        <div class="feature-card"><h3 class="feature-title">Restormel Resolve</h3><p>Model → provider resolution. One middleware, multiple backends — the routing that feeds context.</p></div>
        <div class="feature-card"><h3 class="feature-title">BYOK &amp; embeddable UX</h3><p>ModelSelector, CostEstimator, and optional KeyManager for policy-bounded model choice. Svelte, React, or Web Components.</p></div>
        <div class="feature-card"><h3 class="feature-title">Restormel Doctor &amp; Validate</h3><p>Health checks you can run locally or in CI to catch bad config and broken provider access before deploy.</p></div>
      </div>
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
      <h2 id="cta-heading" class="cta-headline">Serve knowledge your agents can be held to</h2>
      <p class="cta-sub">Install the packages, supply model access the way that fits your stack, then serve verified context your auditors can check. The walkthrough guides you step by step.</p>
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
  .btn-primary:hover {
    filter: brightness(1.1);
  }
  .proof-steps {
    list-style: none;
    margin: 0 0 var(--space-6);
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-4);
  }
  .proof-step {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-top: 4px solid var(--rm-sage);
    border-radius: var(--radius-md);
    padding: var(--space-5);
  }
  .proof-step-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.85rem;
    height: 1.85rem;
    border-radius: 999px;
    background: color-mix(in oklab, var(--rm-sage) 16%, var(--rm-surface));
    color: var(--rm-sage);
    font-family: var(--rm-font-display);
    font-weight: var(--font-semibold);
    font-size: var(--text-sm);
  }
  .proof-step-title {
    font-family: var(--rm-font-ui);
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .proof-step-body p {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .proof-cta {
    margin: 0;
    font-size: var(--text-sm);
  }
  .proof-cta a {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
    font-weight: var(--font-medium);
  }
  @media (max-width: 860px) {
    .proof-steps {
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
    background: var(--color-yellow);
    color: var(--color-ink);
    border-color: var(--rm-sage);
  }
  .fw-pill-active {
    background: var(--color-yellow);
    color: var(--color-ink);
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
