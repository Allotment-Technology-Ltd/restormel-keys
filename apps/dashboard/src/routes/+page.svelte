<script lang="ts">
  import { page } from "$app/stores";
  import SuiteMarketingLayout from "$lib/components/suite/SuiteMarketingLayout.svelte";
  import SocialProof from "$lib/components/site/SocialProof.svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";

  $: socialProof = $page.data.socialProof ?? null;
</script>

<svelte:head>
  <title>Restormel — The AI product layer for keys, CI verification, and graph UIs</title>
  <meta
    name="description"
    content="Govern keys, verify AI behavior in CI, and visualise reasoning outputs—above OpenRouter, Portkey, and Vercel AI. No migration, no proxy."
  />
</svelte:head>

<SuiteMarketingLayout>
  <div class="suite-landing">
    <div class="suite-hero-cluster">
      <section class="suite-hero container">
        <p class="suite-kicker">Restormel</p>
        <h1 class="suite-title">The AI product layer your stack is missing</h1>
        <p class="suite-lead">
          Restormel gives AI-native teams one place to govern keys, verify behavior in CI, and visualise reasoning outputs
          — without replacing the infrastructure you already use.
        </p>
        <p class="suite-hero-meta">
          <a href="/roadmap">Roadmap</a>
          <span class="suite-hero-meta-sep" aria-hidden="true">·</span>
          <a href="/changelog">Changelog</a>
        </p>
      </section>

      <section class="suite-diagram-wrap" aria-label="Restormel suite flow">
        <div class="container">
          <figure class="flow-diagram" aria-hidden="true">
            <svg
              viewBox="0 0 520 100"
              width="100%"
              height="auto"
              preserveAspectRatio="xMidYMid meet"
              class="suite-flow-svg"
            >
              <defs>
                <marker id="suite-flow-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 Z" class="flow-arrow-head" />
                </marker>
              </defs>
              <rect class="flow-rect" x="8" y="18" width="130" height="64" rx="4" ry="4" />
              <text class="flow-text" x="73" y="48" text-anchor="middle">Keys</text>
              <text class="flow-sub" x="73" y="66" text-anchor="middle">Route &amp; govern</text>
              <line class="flow-line" x1="138" y1="50" x2="178" y2="50" marker-end="url(#suite-flow-arrow)" />
              <rect class="flow-rect" x="178" y="18" width="130" height="64" rx="4" ry="4" />
              <text class="flow-text" x="243" y="48" text-anchor="middle">Testing</text>
              <text class="flow-sub" x="243" y="66" text-anchor="middle">Verify in CI</text>
              <line class="flow-line" x1="308" y1="50" x2="348" y2="50" marker-end="url(#suite-flow-arrow)" />
              <rect class="flow-keys" x="348" y="18" width="164" height="64" rx="4" ry="4" />
              <text class="flow-text" x="430" y="48" text-anchor="middle">Graph</text>
              <text class="flow-sub" x="430" y="66" text-anchor="middle">Visualise outputs</text>
            </svg>
          </figure>
        </div>
      </section>
    </div>

    <section class="why-section section-alt" aria-labelledby="why-heading">
      <div class="container why-inner">
        <h2 id="why-heading" class="why-heading">Why Restormel?</h2>
        <ol class="why-list">
          <li class="why-item">
            <h3 class="why-title">Your gateway stays. We add the product layer.</h3>
            <p class="why-copy">
              Restormel sits above OpenRouter, Portkey, and Vercel AI. No migration, no proxy, no new infra.
            </p>
          </li>
          <li class="why-item">
            <h3 class="why-title">AI behavior should be a CI gate, not a prayer.</h3>
            <p class="why-copy">
              Define what success looks like for every AI feature. Run it locally and in GitHub Actions.
            </p>
          </li>
          <li class="why-item">
            <h3 class="why-title">Reasoning you can see is reasoning you can trust.</h3>
            <p class="why-copy">
              Visualise agent outputs, argument maps, and knowledge graphs with a stable, portable contract.
            </p>
          </li>
        </ol>
      </div>
    </section>

    <section class="suite-cards section-alt" aria-label="Products">
      <div class="container suite-cards-inner">
        <article class="suite-card">
          <h2 class="suite-card-title">Restormel Keys</h2>
          <p class="suite-card-desc">
            Stop rebuilding AI routing logic in every project. One middleware call for provider resolution, fallbacks, and
            policy enforcement.
          </p>
          <ul class="suite-card-actions">
            <li><a class="btn btn-primary" href="/keys">Explore Keys</a></li>
            <li><a class="btn btn-ghost" href="/keys/docs">Documentation</a></li>
            <li><a class="btn btn-ghost" href={DASHBOARD_BASE}>Dashboard</a></li>
          </ul>
        </article>

        <article class="suite-card">
          <h2 class="suite-card-title">Restormel Testing</h2>
          <p class="suite-card-desc">
            Ship AI features without flying blind in CI. Goal-based tests that fail when your user outcome fails — not just
            when a selector breaks.
          </p>
          <ul class="suite-card-actions">
            <li><a class="btn btn-primary" href="/testing">Explore Testing</a></li>
            <li><a class="btn btn-ghost" href="/testing/docs">Documentation</a></li>
            <li><a class="btn btn-ghost" href="/testing/dashboard">Testing dashboard</a></li>
          </ul>
        </article>

        <article class="suite-card">
          <h2 class="suite-card-title">Restormel Graph</h2>
          <p class="suite-card-desc">
            Graph UIs shouldn't be rebuilt for every reasoning feature. A portable contract-first canvas for Svelte 5 —
            zoom, pan, ghost layers, orbital layout.
          </p>
          <ul class="suite-card-actions">
            <li><a class="btn btn-primary" href="/graph">Explore Graph</a></li>
            <li><a class="btn btn-ghost" href="/graph/docs">Documentation</a></li>
            <li><a class="btn btn-ghost" href="/graph/docs/integration/sveltekit">SvelteKit integration</a></li>
          </ul>
        </article>

        <article class="suite-card">
          <h2 class="suite-card-title">Integrations</h2>
          <p class="suite-card-desc">
            Connect gateways, IDEs, and workflows across the Restormel stack with copy-paste guides and examples.
          </p>
          <ul class="suite-card-actions">
            <li><a class="btn btn-primary" href="/integrations">View integrations</a></li>
            <li><a class="btn btn-ghost" href="/keys/docs/integrations">Keys integrations</a></li>
          </ul>
        </article>
      </div>
    </section>

    <section class="social-proof-section section-alt" aria-label="Community and social proof">
      <div class="container social-proof-section-inner">
        <SocialProof variant="metrics" metrics={socialProof} />
        <figure class="testimonial-card">
          <blockquote class="testimonial-quote">
            “We stopped rebuilding routing glue in every service. Keys and the dashboard finally match how we think about
            models and policies.”
          </blockquote>
          <figcaption class="testimonial-caption">Early adopter programme participant</figcaption>
        </figure>
      </div>
    </section>

    <section class="pricing-cta-section" aria-labelledby="suite-pricing-heading">
      <div class="container pricing-cta-inner">
        <h2 id="suite-pricing-heading" class="pricing-cta-title">One suite. One price.</h2>
        <p class="pricing-cta-lead">Get all three modules on the Platform plan — £35/mo.</p>
        <a class="btn btn-primary pricing-cta-btn" href="/pricing">See suite pricing →</a>
      </div>
    </section>

    <section class="founders-section section-alt" aria-labelledby="founders-heading">
      <div class="container founders-inner">
        <h2 id="founders-heading" class="founders-title">Join the Founders Circle</h2>
        <p class="founders-lead">
          50 founding member slots. 12 months Pro free. Direct access to the roadmap.
        </p>
        <div class="founders-actions">
          <a class="btn btn-primary founders-primary" href="/founders">Apply for founding access →</a>
          <p class="founders-secondary-wrap">
            <a class="founders-secondary" href="/founders#program">Learn more about the program</a>
          </p>
        </div>
      </div>
    </section>
  </div>
</SuiteMarketingLayout>

<style>
  .suite-landing {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    padding-bottom: var(--space-12);
  }
  .suite-hero {
    padding-top: var(--space-4);
    text-align: center;
    max-width: 44rem;
    margin-left: auto;
    margin-right: auto;
  }
  .suite-kicker {
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--rm-dim);
    margin: 0 0 var(--space-3);
  }
  .suite-title {
    font-family: var(--rm-font-display);
    font-size: clamp(var(--text-3xl), 4vw, var(--text-4xl));
    font-weight: var(--font-semibold);
    line-height: var(--leading-tight);
    margin: 0 0 var(--space-4);
    color: var(--rm-text);
  }
  .suite-lead {
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    margin: 0;
  }
  .suite-hero-meta {
    margin: var(--space-4) 0 0;
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .suite-hero-meta a {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .suite-hero-meta a:hover {
    color: var(--rm-text);
  }
  .suite-hero-meta-sep {
    margin: 0 var(--space-2);
    color: var(--rm-dim);
  }

  .suite-hero-cluster {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .suite-diagram-wrap {
    padding-top: 0;
  }
  .flow-diagram {
    margin: 0 auto;
    max-width: 52rem;
  }
  .suite-flow-svg {
    display: block;
    max-height: 7rem;
  }
  .suite-flow-svg .flow-rect {
    fill: var(--rm-surface-raised);
    stroke: var(--rm-border);
    stroke-width: 1;
  }
  .suite-flow-svg .flow-keys {
    fill: color-mix(in oklab, var(--rm-sage) 12%, var(--rm-surface-raised));
    stroke: var(--rm-sage);
    stroke-width: 1.5;
  }
  .suite-flow-svg .flow-line {
    stroke: var(--rm-border);
    stroke-width: 1.5;
    fill: none;
  }
  .suite-flow-svg .flow-arrow-head {
    fill: var(--rm-border);
  }
  .suite-flow-svg .flow-text {
    font-family: var(--rm-font-display);
    font-size: 13px;
    font-weight: var(--font-semibold);
    fill: var(--rm-text);
  }
  .suite-flow-svg .flow-sub {
    font-family: var(--rm-font-ui);
    font-size: 9px;
    fill: var(--rm-muted);
  }

  .why-inner {
    padding-top: var(--space-10);
    padding-bottom: var(--space-10);
    max-width: var(--rm-container-narrow);
    margin-left: auto;
    margin-right: auto;
  }
  .why-heading {
    font-family: var(--rm-font-display);
    font-size: clamp(1.5rem, 3vw, var(--text-2xl));
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-8);
    text-align: center;
  }
  .why-list {
    margin: 0;
    padding: 0 0 0 var(--space-8);
    list-style: decimal;
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }
  .why-item {
    padding-left: var(--space-4);
    border-left: 3px solid color-mix(in oklab, var(--rm-sage) 45%, var(--rm-border));
    margin: 0;
  }
  .why-item::marker {
    font-family: var(--rm-font-display);
    font-weight: var(--font-semibold);
    color: var(--rm-sage);
  }
  .why-title {
    font-family: var(--rm-font-ui);
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
    line-height: var(--leading-snug);
  }
  .why-copy {
    margin: 0;
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
  }

  .social-proof-section-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-8);
    padding-top: var(--space-10);
    padding-bottom: var(--space-10);
  }
  .testimonial-card {
    margin: 0;
    width: 100%;
    max-width: 36rem;
    padding: var(--space-6);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
    box-shadow: var(--rm-card-shadow, 0 4px 20px rgba(0, 0, 0, 0.12));
  }
  .testimonial-quote {
    margin: 0;
    font-family: var(--rm-font-ui);
    font-size: var(--text-base);
    font-style: italic;
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    text-align: center;
  }
  .testimonial-caption {
    margin: var(--space-3) 0 0;
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    color: var(--rm-dim);
    text-align: center;
  }

  .suite-cards-inner {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
    gap: var(--space-8);
    padding-top: var(--space-10);
    padding-bottom: var(--space-10);
  }
  .suite-card {
    background: var(--rm-bg);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .suite-card-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    margin: 0;
    color: var(--rm-text);
  }
  .suite-card-desc {
    margin: 0;
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    flex: 1;
  }
  .suite-card-actions {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .suite-card-actions a {
    text-align: center;
    justify-content: center;
  }

  .pricing-cta-section {
    text-align: center;
    padding-top: var(--space-4);
    padding-bottom: var(--space-4);
  }
  .pricing-cta-inner {
    max-width: 32rem;
    margin: 0 auto;
  }
  .pricing-cta-title {
    font-family: var(--rm-font-display);
    font-size: clamp(1.35rem, 3vw, var(--text-2xl));
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-3);
  }
  .pricing-cta-lead {
    margin: 0 0 var(--space-6);
    font-size: var(--text-base);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .pricing-cta-btn {
    display: inline-flex;
  }

  .founders-inner {
    text-align: center;
    padding-top: var(--space-12);
    padding-bottom: var(--space-12);
    max-width: 36rem;
    margin: 0 auto;
  }
  .founders-title {
    font-family: var(--rm-font-display);
    font-size: clamp(1.5rem, 3vw, var(--text-2xl));
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-4);
  }
  .founders-lead {
    margin: 0 0 var(--space-6);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
  }
  .founders-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
  }
  .founders-primary {
    display: inline-flex;
    text-align: center;
  }
  .founders-secondary-wrap {
    margin: 0;
  }
  .founders-secondary {
    font-size: var(--text-sm);
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .founders-secondary:hover {
    color: var(--signal-teal-hover, var(--rm-sage));
  }
</style>
