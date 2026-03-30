<script lang="ts">
  /** Pricing page — Free + Pro only (two-tier). */
  import { onMount } from "svelte";
  import { initPaddleCheckout } from "$lib/paddle-checkout";
  import { browser } from "$app/environment";

  export let data: {
    dashboardUrl: string;
    paddleToken: string;
    proPriceIdMonthlyGbp: string;
    proPriceIdMonthlyUsd: string;
    proMonthlyPriceDisplayGbp: string;
    proMonthlyPriceDisplayUsd: string;
  };
  let billingCurrency: "gbp" | "usd" = "gbp";
  $: canUseGbp = Boolean(data.proPriceIdMonthlyGbp);
  $: canUseUsd = Boolean(data.proPriceIdMonthlyUsd);
  $: selectedPriceId =
    billingCurrency === "usd"
      ? (data.proPriceIdMonthlyUsd || data.proPriceIdMonthlyGbp)
      : (data.proPriceIdMonthlyGbp || data.proPriceIdMonthlyUsd);
  $: priceDisplay =
    billingCurrency === "usd"
      ? data.proMonthlyPriceDisplayUsd
      : data.proMonthlyPriceDisplayGbp;
  $: checkoutCurrencyLabel = billingCurrency === "usd" ? "USD" : "GBP";

  function selectBillingCurrency(next: "gbp" | "usd") {
    if (next === "usd" && !canUseUsd) return;
    if (next === "gbp" && !canUseGbp) return;
    billingCurrency = next;
  }

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
  <meta name="description" content="Restormel Keys pricing: Free (build/prototype) and Pro ($10/mo) for production limits and visibility. No hosted key custody. Library-first." />
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
          <p class="tier-price">$0</p>
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

        <div class="tier-card tier-card-pro">
          <p class="pro-badge">Most popular</p>
          <h3 class="tier-name">Pro</h3>
          <p class="tier-desc"><strong>Best for:</strong> shipping real AI products</p>
          <div class="currency-switch" role="group" aria-label="Billing currency">
            <button
              type="button"
              class="currency-option"
              aria-pressed={billingCurrency === "gbp"}
              disabled={!canUseGbp}
              onclick={() => selectBillingCurrency("gbp")}
            >
              GBP
            </button>
            <button
              type="button"
              class="currency-option"
              aria-pressed={billingCurrency === "usd"}
              disabled={!canUseUsd}
              onclick={() => selectBillingCurrency("usd")}
            >
              USD
            </button>
          </div>
          <p class="tier-price">{priceDisplay}</p>
          <p class="tier-period">/ month + tax</p>
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
            class="btn btn-primary btn-upgrade-pro"
            data-paddle-checkout
            data-tier="pro"
            data-billing-period="monthly"
            data-price-id={selectedPriceId}
            onclick={() =>
              window.rmCapture?.("upgrade_clicked", {
                surface: "keys_pricing",
                tier: "pro",
                currency: checkoutCurrencyLabel,
              })}
          >
            Upgrade to Pro ({checkoutCurrencyLabel})
          </button>
          <p class="tier-hint">Opens Paddle checkout in {checkoutCurrencyLabel}. Taxes are calculated at checkout.</p>
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
  .tier-card-pro {
    border-color: color-mix(in oklab, var(--rm-sage) 55%, var(--rm-border));
    background: color-mix(in oklab, var(--rm-surface-raised) 90%, var(--rm-sage) 10%);
    box-shadow:
      0 0 0 2px color-mix(in oklab, var(--rm-sage) 20%, transparent),
      0 14px 28px rgba(0, 0, 0, 0.16);
  }
  .pro-badge {
    display: inline-flex;
    align-items: center;
    margin: 0 0 var(--space-3);
    padding: 0.18rem 0.55rem;
    border-radius: 999px;
    border: 1px solid color-mix(in oklab, var(--rm-sage) 70%, transparent);
    background: color-mix(in oklab, var(--rm-sage) 16%, transparent);
    color: var(--rm-text);
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .currency-switch {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0 0 var(--space-3);
    padding: 0.2rem;
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
  }
  .currency-option {
    min-width: 3.3rem;
    padding: 0.35rem 0.55rem;
    border: 1px solid transparent;
    border-radius: calc(var(--rm-radius) - 2px);
    background: transparent;
    color: var(--rm-muted);
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    letter-spacing: 0.04em;
    cursor: pointer;
  }
  .currency-option[aria-pressed="true"] {
    background: var(--rm-sage);
    color: var(--rm-bg);
    border-color: var(--rm-sage);
  }
  .currency-option:disabled {
    opacity: 0.45;
    cursor: not-allowed;
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
  .btn-upgrade-pro {
    width: 100%;
    min-height: calc(var(--button-height-md) + var(--space-3));
    padding: var(--space-3) var(--space-5);
    border: 1px solid var(--rm-sage);
    border-radius: var(--rm-radius);
    font-family: var(--rm-font-ui);
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    letter-spacing: 0.01em;
    box-shadow: 0 0 0 2px color-mix(in oklab, var(--rm-sage) 18%, transparent);
    transition: transform 0.12s ease, box-shadow 0.15s ease, filter 0.15s ease;
  }
  .btn-upgrade-pro:hover {
    transform: translateY(-1px);
    filter: brightness(1.06);
    box-shadow:
      0 0 0 2px color-mix(in oklab, var(--rm-sage) 24%, transparent),
      0 8px 18px rgba(0, 0, 0, 0.18);
  }
  .btn-upgrade-pro:focus-visible {
    outline: 2px solid color-mix(in oklab, var(--rm-sage) 70%, white);
    outline-offset: 2px;
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
