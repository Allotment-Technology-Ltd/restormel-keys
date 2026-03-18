<script lang="ts">
  /** Pricing page — Free + Pro only (two-tier). */
  import { onMount } from "svelte";
  import { initPaddleCheckout } from "$lib/paddle-checkout";
  import { browser } from "$app/environment";

  export let data: { dashboardUrl: string; paddleToken: string; proPriceIdMonthlyGbp: string };

  onMount(() => {
    if (browser && data.paddleToken) {
      initPaddleCheckout({
        token: data.paddleToken,
        dashboardUrl: data.dashboardUrl,
        messageContainerId: "checkout-message",
      });
    }
    if (browser) {
      window.rmCapture?.("pricing_view", { surface: "keys_pricing" });
    }
  });
</script>

<svelte:head>
  <title>Pricing — Restormel Keys</title>
  <meta name="description" content="Restormel Keys pricing: Free (build/prototype) and Pro (£10/mo) for production limits and visibility. No hosted key custody. Library-first." />
</svelte:head>

<article class="pricing-page">
  <div class="container">
    <header class="pricing-header">
      <h1 class="pricing-title">Pricing</h1>
      <p class="pricing-kicker">Ship BYOK in minutes — not weeks</p>
      <p class="pricing-intro">
        <strong>Restormel Keys</strong> gives you production-grade key management, routing, and cost control — without running heavy infrastructure. Free for development. Upgrade when you’re ready to ship.
      </p>
      <div id="checkout-message" class="checkout-message" role="alert" aria-live="polite" hidden></div>
    </header>

    <section class="tiers-section" aria-labelledby="tiers-heading">
      <h2 id="tiers-heading" class="visually-hidden">Plans</h2>
      <div class="tiers-grid">
        <div class="tier-card">
          <h3 class="tier-name">Free</h3>
          <p class="tier-desc"><strong>Best for:</strong> experimenting and prototyping</p>
          <p class="tier-price">£0</p>
          <p class="tier-period">/ month</p>
          <ul class="tier-list">
            <li>2 projects</li>
            <li>First 50 signups: 12 months Pro included</li>
            <li>Local key handling (user-controlled storage)</li>
            <li>Multi-provider routing</li>
            <li>Key validation</li>
            <li>Basic dashboard</li>
            <li>1,000 API requests / month</li>
          </ul>
          <p class="tier-limitations"><strong>Limitations:</strong> no advanced usage insights; limited scale; not production-optimised.</p>
          <a href="/keys/docs" class="btn btn-secondary">Get started for free</a>
        </div>

        <div class="tier-card">
          <h3 class="tier-name">Pro</h3>
          <p class="tier-desc"><strong>Best for:</strong> shipping real AI products</p>
          <p class="tier-price">£10</p>
          <p class="tier-period">/ month</p>
          <ul class="tier-list">
            <li>Advanced routing controls</li>
            <li>Usage insights + cost tracking</li>
            <li>50k–100k API requests / month</li>
            <li>5–10 projects</li>
            <li>Key health + validation feedback</li>
            <li>Production-grade performance</li>
          </ul>
          <button
            type="button"
            class="btn btn-primary"
            data-paddle-checkout
            data-tier="pro"
            data-billing-period="monthly"
            data-price-id={data.proPriceIdMonthlyGbp}
            onclick={() => window.rmCapture?.("upgrade_clicked", { surface: "keys_pricing", tier: "pro" })}
          >
            Upgrade to Pro
          </button>
          <p class="tier-hint">Opens Paddle checkout. You’ll finish setup in the dashboard.</p>
        </div>
      </div>
      <p class="tiers-anchor">Most developers start on Free and upgrade when they deploy.</p>
    </section>

    <section class="features-section" aria-labelledby="features-heading">
      <h2 id="features-heading" class="section-title">What you get in every tier</h2>
      <div class="features-grid">
        <div class="feat"><span class="feat-name">Provider access modes</span><span class="feat-desc">Gateway-backed (OpenRouter/Vercel/Portkey) or builder-managed direct.</span></div>
        <div class="feat"><span class="feat-name">Restormel Resolve</span><span class="feat-desc">Model → provider resolution. One middleware.</span></div>
        <div class="feat"><span class="feat-name">Policies</span><span class="feat-desc">Allow/deny models, enforce route rules, and keep behavior inspectable.</span></div>
        <div class="feat"><span class="feat-name">Health & fallbacks</span><span class="feat-desc">Detect failures and shift traffic safely with explicit fallback chains.</span></div>
        <div class="feat"><span class="feat-name">Embeddable UX</span><span class="feat-desc">ModelSelector, CostEstimator, and optional KeyManager for BYOK flows.</span></div>
        <div class="feat"><span class="feat-name">Dashboard & API</span><span class="feat-desc">Cloud API and Dashboard (Pro+).</span></div>
      </div>
    </section>

    <section class="faq-section" aria-labelledby="faq-heading">
      <h2 id="faq-heading" class="section-title">FAQ</h2>
      <dl class="faq-list">
        <dt class="faq-q">Can I use Keys without paying?</dt>
        <dd class="faq-a">Yes. Start on Free for development and prototyping. Upgrade when you need production-grade limits and visibility.</dd>
        <dt class="faq-q">What happens after I subscribe?</dt>
        <dd class="faq-a">You're sent to the dashboard. Sign in with GitHub if you aren't already. Your tier applies to your project; you can create API keys and use the cloud API from there.</dd>
        <dt class="faq-q">Can I change plan later?</dt>
        <dd class="faq-a">Yes. Billing is through Paddle. You can cancel any time and keep using Free.</dd>
      </dl>
    </section>
  </div>
</article>

<style>
  .pricing-page .container {
    max-width: var(--rm-container-max);
    margin: 0 auto;
    padding: 0 var(--space-6);
  }
  .pricing-header {
    margin-bottom: var(--space-10);
  }
  .pricing-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-3);
  }
  .pricing-intro {
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
    max-width: var(--rm-container-narrow);
  }
  .pricing-kicker {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--rm-dim);
  }
  .checkout-message {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-4);
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
  .tiers-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--space-6);
    margin-bottom: var(--space-6);
  }
  .tier-card {
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    padding: var(--space-6);
  }
  .tier-card:nth-child(2) {
    border-color: color-mix(in oklab, var(--rm-sage) 55%, var(--rm-border));
    box-shadow: 0 0 0 2px color-mix(in oklab, var(--rm-sage) 20%, transparent);
  }
  .tier-name {
    font-family: var(--rm-font-ui);
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .tier-desc {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-4);
    line-height: var(--leading-relaxed);
  }
  .tier-price {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    color: var(--rm-sage);
    margin: 0 0 var(--space-1);
  }
  .tier-period {
    font-size: var(--text-sm);
    color: var(--rm-dim);
    margin: 0 0 var(--space-4);
  }
  .tier-list {
    margin: 0 0 var(--space-4);
    padding-left: var(--space-5);
    color: var(--rm-muted);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
  }
  .tier-limitations {
    margin: 0 0 var(--space-4);
    color: var(--rm-muted);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
  }
  .tier-hint {
    font-size: var(--text-xs);
    color: var(--rm-dim);
    margin: var(--space-3) 0 0;
    line-height: var(--leading-normal);
  }
  .tiers-anchor {
    font-size: var(--text-sm);
    color: var(--rm-dim);
    margin: 0;
  }
  .section-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-6);
  }
  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: var(--space-4);
    margin-bottom: var(--space-10);
  }
  .feat {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .feat-name {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--rm-text);
  }
  .feat-desc {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .faq-list {
    margin: 0;
  }
  .faq-q {
    font-family: var(--rm-font-ui);
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    color: var(--rm-text);
    margin: var(--space-4) 0 var(--space-2);
  }
  .faq-q:first-child {
    margin-top: 0;
  }
  .faq-a {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-4);
    line-height: var(--leading-relaxed);
  }
</style>
