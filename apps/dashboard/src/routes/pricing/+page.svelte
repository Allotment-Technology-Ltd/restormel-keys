<script lang="ts">
  import SuiteMarketingLayout from "$lib/components/suite/SuiteMarketingLayout.svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const loginHref = `${DASHBOARD_BASE}/login`;
</script>

<svelte:head>
  <title>Suite pricing — Restormel</title>
  <meta
    name="description"
    content="Simple pricing for every stage: Restormel Keys, Testing, and Graph. Free tiers, Keys Pro, and Platform bundle at £35/mo for all three Pros."
  />
</svelte:head>

<SuiteMarketingLayout>
  <article class="suite-pricing container">
    <header class="suite-pricing-hero">
      <p class="suite-pricing-kicker">Restormel suite</p>
      <h1 class="suite-pricing-title">Simple pricing for every stage</h1>
      <p class="suite-pricing-sub">
        Start free. Upgrade when you ship. Use one module or all three.
      </p>
    </header>

    <section class="suite-pricing-modules" aria-labelledby="modules-heading">
      <h2 id="modules-heading" class="visually-hidden">Modules</h2>
      <div class="module-cards">
        <article class="module-card">
          <h3 class="module-card-title">Restormel Keys</h3>
          <p class="module-card-tiers">Free · Pro {data.keysProDisplayGbp}/mo · Team £35/mo</p>
          <p class="module-card-desc">
            BYOK routing, policies, resolve API, and dashboard — above OpenRouter, Portkey, and Vercel AI.
          </p>
          <ul class="module-card-list">
            <li>Free: projects + request limits for prototyping</li>
            <li>Pro: production limits, usage charts, alerts</li>
            <li>Team: collaboration, higher limits, audit log</li>
          </ul>
          <a class="module-card-link" href="/keys/pricing">Keys pricing &amp; checkout →</a>
        </article>

        <article class="module-card">
          <h3 class="module-card-title">Restormel Testing</h3>
          <p class="module-card-tiers">Free OSS · Pro = Platform plan</p>
          <p class="module-card-desc">
            Goal-based AI verification in CI — fail when the user outcome fails, not only when a selector breaks.
          </p>
          <ul class="module-card-list">
            <li>OSS: runner, config, and community path</li>
            <li>Pro (Platform): advanced gates, dashboard, and team workflows</li>
          </ul>
          <a class="module-card-link" href="/testing">Explore Testing →</a>
        </article>

        <article class="module-card">
          <h3 class="module-card-title">Restormel Graph</h3>
          <p class="module-card-tiers">Free MIT · Pro = Platform plan</p>
          <p class="module-card-desc">
            Contract-first graph UI for reasoning outputs — Svelte 5 canvas, portable contract, production patterns.
          </p>
          <ul class="module-card-list">
            <li>MIT: core libraries and integration guides</li>
            <li>Pro (Platform): premium components, priority alignment, and suite support</li>
          </ul>
          <a class="module-card-link" href="/graph">Explore Graph →</a>
        </article>
      </div>
    </section>

    <section class="platform-highlight section-alt" aria-labelledby="platform-heading">
      <div class="platform-highlight-inner">
        <p class="platform-badge">Platform</p>
        <h2 id="platform-heading" class="platform-highlight-title">All three Pro modules. One price.</h2>
        <p class="platform-highlight-price">
          <span class="platform-price">{data.platformMonthlyDisplayGbp}</span>
          <span class="platform-period">/ month + tax</span>
          {#if data.platformMonthlyDisplayUsd}
            <span class="platform-price-alt">· {data.platformMonthlyDisplayUsd} (Paddle USD price)</span>
          {/if}
        </p>
        <p class="platform-highlight-lead">
          <strong>Keys Pro</strong>, <strong>Testing Pro</strong>, and <strong>Graph Pro</strong> on a single subscription — best
          when you are standardising on the full product layer.
        </p>
        <ul class="platform-feature-list">
          <li>Keys: production limits, usage analytics, routing, policies, webhooks, priority support</li>
          <li>Testing: Pro-tier CI goals, dashboard, and workflows aligned with Keys</li>
          <li>Graph: Pro-tier UX, components, and roadmap alignment across the suite</li>
          <li>One invoice, one place to manage access as the stack grows</li>
        </ul>
        <p class="platform-note">
          Self-serve Platform checkout is not enabled in-dashboard yet. Use
          <a href="/founders">Founders Circle</a> for early access, or configure Paddle catalog via
          <code>pnpm run bootstrap-paddle -- --force-create</code>.
        </p>
      </div>
    </section>

    <section class="compare-section" aria-labelledby="compare-heading">
      <h2 id="compare-heading" class="section-heading">Compare at a glance</h2>
      <p class="section-intro">
        <strong>Free</strong> = module free tiers (Keys Free, Testing OSS, Graph MIT).
        <strong>Keys Pro</strong> = paid Keys only.
        <strong>Platform</strong> = all three Pros together ({data.platformMonthlyDisplayGbp}/mo).
      </p>
      <div class="table-wrap">
        <table class="compare-table">
          <caption class="visually-hidden">
            Feature comparison across Free, Keys Pro, and Platform
          </caption>
          <thead>
            <tr>
              <th scope="col">Feature</th>
              <th scope="col">Free</th>
              <th scope="col">Keys Pro ({data.keysProDisplayGbp}/mo)</th>
              <th scope="col">Platform ({data.platformMonthlyDisplayGbp}/mo)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Restormel Keys</th>
              <td>Free tier (projects + request limits)</td>
              <td>Pro limits, charts, alerts, priority support</td>
              <td>Keys Pro included</td>
            </tr>
            <tr>
              <th scope="row">Restormel Testing</th>
              <td>OSS / open-source path</td>
              <td>— (upgrade via Platform for Testing Pro)</td>
              <td>Testing Pro included</td>
            </tr>
            <tr>
              <th scope="row">Restormel Graph</th>
              <td>MIT core libraries</td>
              <td>— (upgrade via Platform for Graph Pro)</td>
              <td>Graph Pro included</td>
            </tr>
            <tr>
              <th scope="row">BYOK &amp; resolve (Keys)</th>
              <td>Yes (within Free limits)</td>
              <td>Yes</td>
              <td>Yes</td>
            </tr>
            <tr>
              <th scope="row">Usage dashboards (Keys)</th>
              <td>No</td>
              <td>Yes</td>
              <td>Yes</td>
            </tr>
            <tr>
              <th scope="row">CI goal verification (Testing)</th>
              <td>OSS baseline</td>
              <td>—</td>
              <td>Pro-tier features</td>
            </tr>
            <tr>
              <th scope="row">Graph canvas &amp; contract (Graph)</th>
              <td>MIT baseline</td>
              <td>—</td>
              <td>Pro-tier features</td>
            </tr>
            <tr>
              <th scope="row">Billing</th>
              <td>No card required</td>
              <td>Keys via Paddle</td>
              <td>One Platform subscription</td>
            </tr>
            <tr>
              <th scope="row">Best for</th>
              <td>Trying a single module</td>
              <td>Production on Keys only</td>
              <td>Keys + Testing + Graph together</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="compare-footnote">
        <strong>Keys Team</strong> (£35/mo) is a <strong>Keys-only</strong> tier with higher limits and seats — see
        <a href="/keys/pricing">Keys pricing</a>. It is not the same as Platform (three modules).
      </p>
    </section>

    <section class="faq-section section-alt" aria-labelledby="faq-heading">
      <h2 id="faq-heading" class="section-heading">FAQ</h2>
      <dl class="faq-list">
        <dt class="faq-q">Do I need a credit card to start?</dt>
        <dd class="faq-a">
          No. Create a free account and use Free tiers (and OSS/MIT modules) without a card. Upgrade when you are ready to
          ship.
        </dd>
        <dt class="faq-q">Can I use just one module?</dt>
        <dd class="faq-a">
          Yes. Each module is independently adoptable. Platform is for teams that want all three Pros under one subscription.
        </dd>
        <dt class="faq-q">What is the difference between Keys Pro and Platform?</dt>
        <dd class="faq-a">
          <strong>Keys Pro</strong> unlocks production-grade Keys only. <strong>Platform</strong> adds Testing Pro and Graph
          Pro for a single {data.platformMonthlyDisplayGbp}/mo price.
        </dd>
        <dt class="faq-q">How do Testing and Graph “Pro” work without Keys Pro?</dt>
        <dd class="faq-a">
          Testing Pro and Graph Pro are bundled on the <strong>Platform</strong> plan today. Use the OSS/MIT bases for each
          module until you need the full suite.
        </dd>
        <dt class="faq-q">What counts as an API request (Keys)?</dt>
        <dd class="faq-a">
          One call to the Restormel resolve endpoint. Health checks and validation runs do not count toward your monthly
          limit.
        </dd>
        <dt class="faq-q">What happens if I hit my Keys request limit?</dt>
        <dd class="faq-a">
          You get a warning around 80% usage. Above the limit, requests return 429 with a clear error — no silent failures.
        </dd>
        <dt class="faq-q">Is there a trial or founder offer?</dt>
        <dd class="faq-a">
          The first <strong>50</strong> founding members can get <strong>12 months of Keys Pro</strong> through
          <a class="faq-link" href="/founders">Founders Circle</a>. See that page for terms.
        </dd>
        <dt class="faq-q">Where does billing run?</dt>
        <dd class="faq-a">
          Keys subscriptions use <strong>Paddle</strong> (Merchant of Record). Taxes are calculated at checkout. Platform
          self-serve checkout is coming; Founders and sales paths apply meanwhile.
        </dd>
        <dt class="faq-q">Can I change plans later?</dt>
        <dd class="faq-a">
          Yes. Move between Free and paid tiers as your stack matures. Keys Team remains available for Keys-only production
          teams at <a class="faq-link" href="/keys/pricing">Keys pricing</a>.
        </dd>
      </dl>
    </section>

    <section class="cta-section" aria-labelledby="cta-heading">
      <h2 id="cta-heading" class="visually-hidden">Get started</h2>
      <a class="btn btn-primary cta-primary" href={loginHref}>Start free — no credit card required →</a>
      <p class="cta-secondary">
        New here? <a href="/keys/docs">Read the docs</a> · <a href="/founders">Founders Circle</a> ·
        <a href="/keys/pricing">Keys-only pricing</a>
      </p>
    </section>
  </article>
</SuiteMarketingLayout>

<style>
  .suite-pricing {
    max-width: var(--rm-container-max);
    margin: 0 auto;
    padding-bottom: var(--space-12);
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .suite-pricing-hero {
    max-width: var(--rm-container-narrow);
    margin-bottom: var(--space-10);
  }
  .suite-pricing-kicker {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--rm-dim);
  }
  .suite-pricing-title {
    font-family: var(--rm-font-display);
    font-size: clamp(var(--text-2xl), 4vw, var(--text-3xl));
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-4);
    line-height: var(--leading-tight);
  }
  .suite-pricing-sub {
    margin: 0;
    font-size: var(--text-lg);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
  }

  .module-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: var(--space-5);
    margin-bottom: var(--space-10);
  }
  .module-card {
    padding: var(--space-6);
    border-radius: var(--radius-md);
    border: 1px solid var(--rm-border);
    background: var(--rm-surface-raised);
    display: flex;
    flex-direction: column;
  }
  .module-card-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-lg);
    margin: 0 0 var(--space-2);
    color: var(--rm-text);
  }
  .module-card-tiers {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--rm-sage);
    line-height: var(--leading-snug);
  }
  .module-card-desc {
    margin: 0 0 var(--space-4);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    flex: 1;
  }
  .module-card-list {
    margin: 0 0 var(--space-4);
    padding-left: var(--space-5);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .module-card-list li {
    margin-bottom: var(--space-2);
  }
  .module-card-link {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
    margin-top: auto;
  }

  .section-alt {
    background: var(--rm-surface);
    margin-left: calc(-1 * var(--space-6));
    margin-right: calc(-1 * var(--space-6));
    padding: var(--space-10) var(--space-6);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-10);
  }
  .platform-highlight-inner {
    max-width: var(--rm-container-narrow);
  }
  .platform-badge {
    display: inline-flex;
    margin: 0 0 var(--space-3);
    padding: 0.18rem 0.55rem;
    border-radius: 999px;
    border: 1px solid color-mix(in oklab, var(--path-blue, var(--rm-sage)) 55%, transparent);
    background: color-mix(in oklab, var(--path-blue, var(--rm-sage)) 12%, transparent);
    color: var(--rm-text);
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .platform-highlight-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-3);
  }
  .platform-highlight-price {
    margin: 0 0 var(--space-4);
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2);
  }
  .platform-price {
    font-family: var(--rm-font-display);
    font-size: var(--text-3xl);
    font-weight: var(--font-semibold);
    color: var(--rm-sage);
  }
  .platform-period {
    font-size: var(--text-sm);
    color: var(--rm-dim);
  }
  .platform-price-alt {
    font-size: var(--text-sm);
    color: var(--rm-dim);
    width: 100%;
  }
  .platform-highlight-lead {
    margin: 0 0 var(--space-4);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
  }
  .platform-highlight-lead strong {
    color: var(--rm-text);
  }
  .platform-feature-list {
    margin: 0 0 var(--space-4);
    padding-left: var(--space-5);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    font-size: var(--text-sm);
  }
  .platform-feature-list li {
    margin-bottom: var(--space-2);
  }
  .platform-note {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--rm-dim);
    line-height: var(--leading-relaxed);
  }
  .platform-note a {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .platform-note code {
    font-size: 0.9em;
    padding: 0.1em 0.3em;
    border-radius: 4px;
    background: var(--rm-bg);
    border: 1px solid var(--rm-border);
  }

  .section-heading {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-3);
  }
  .section-intro {
    margin: 0 0 var(--space-6);
    max-width: 42rem;
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
  }
  .section-intro strong {
    color: var(--rm-text);
  }
  .table-wrap {
    overflow-x: auto;
    margin-bottom: var(--space-4);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface-raised);
  }
  .compare-table {
    width: 100%;
    min-width: 44rem;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }
  .compare-table th,
  .compare-table td {
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--rm-border);
    text-align: left;
    vertical-align: top;
  }
  .compare-table thead th {
    font-family: var(--rm-font-ui);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    background: color-mix(in oklab, var(--rm-surface) 70%, var(--rm-sage) 8%);
  }
  .compare-table tbody th[scope="row"] {
    font-weight: var(--font-medium);
    color: var(--rm-text);
    width: 11rem;
  }
  .compare-table td {
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .compare-table tbody tr:last-child th,
  .compare-table tbody tr:last-child td {
    border-bottom: 0;
  }
  .compare-footnote {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-dim);
    line-height: var(--leading-relaxed);
    max-width: 42rem;
  }
  .compare-footnote a {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .faq-list {
    margin: 0;
    max-width: var(--rm-container-narrow);
  }
  .faq-q {
    font-family: var(--rm-font-ui);
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    color: var(--rm-text);
    margin: var(--space-6) 0 var(--space-2);
  }
  .faq-q:first-child {
    margin-top: 0;
  }
  .faq-a {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .faq-link {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .cta-section {
    text-align: center;
    padding: var(--space-10) 0 var(--space-4);
    border-top: 1px solid var(--rm-border);
  }
  .cta-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: calc(var(--button-height-md) + var(--space-2));
    padding: var(--space-3) var(--space-6);
    border-radius: var(--rm-radius);
    font-family: var(--rm-font-ui);
    font-weight: var(--font-semibold);
    text-decoration: none;
    background: var(--rm-sage);
    color: var(--rm-bg);
    border: 1px solid var(--rm-sage);
    box-shadow: 0 0 0 2px color-mix(in oklab, var(--rm-sage) 18%, transparent);
    transition: transform 0.12s ease, filter 0.15s ease;
  }
  .cta-primary:hover {
    transform: translateY(-1px);
    filter: brightness(1.06);
  }
  .cta-primary:focus-visible {
    outline: 2px solid color-mix(in oklab, var(--rm-sage) 70%, white);
    outline-offset: 2px;
  }
  .cta-secondary {
    margin: var(--space-5) 0 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .cta-secondary a {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
</style>
