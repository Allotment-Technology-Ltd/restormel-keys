<script lang="ts">
  /** Pricing page — full tiers, annual toggle, FAQ, Paddle checkout. */
  import { onMount } from "svelte";
  import { initPaddleCheckout } from "$lib/paddle-checkout";
  import { browser } from "$app/environment";

  export let data: { dashboardUrl: string; paddleToken: string };

  let annual = false;

  function toggleAnnual() {
    annual = !annual;
    document.querySelectorAll(".tier-price").forEach((el) => {
      const month = el.getAttribute("data-monthly");
      const year = el.getAttribute("data-annual");
      if (month != null && year != null) el.textContent = annual ? year : month;
    });
    document.querySelectorAll(".tier-period").forEach((el) => {
      const month = el.getAttribute("data-monthly");
      const year = el.getAttribute("data-annual");
      if (month != null && year != null) el.textContent = annual ? year : month;
    });
    document.querySelectorAll("[data-paddle-checkout]").forEach((btn) => {
      btn.setAttribute("data-billing-period", annual ? "annual" : "monthly");
    });
  }

  onMount(() => {
    if (browser && data.paddleToken) {
      initPaddleCheckout({
        token: data.paddleToken,
        dashboardUrl: data.dashboardUrl,
        messageContainerId: "checkout-message",
      });
    }
  });
</script>

<svelte:head>
  <title>Pricing — Restormel Keys</title>
  <meta name="description" content="Restormel Keys pricing: Free (open source), Pro, Team, Enterprise. Cloud API and dashboard when you need them." />
</svelte:head>

<article class="pricing-page">
  <div class="container">
    <header class="pricing-header">
      <h1 class="pricing-title">Pricing</h1>
      <p class="pricing-intro">The core library is free and open source. Use it self-hosted with no account. When you need cloud API, dashboard, or team features, subscribe below. No lock-in.</p>

      <div class="toggle-wrap" role="group" aria-label="Billing period">
        <span class="toggle-label" data-period="monthly">Monthly</span>
        <button type="button" class="toggle-btn" id="annual-toggle" aria-pressed={annual} aria-label="Toggle annual billing" onclick={toggleAnnual}>
          <span class="toggle-track"><span class="toggle-thumb"></span></span>
        </button>
        <span class="toggle-label" data-period="annual">Annual</span>
      </div>
      <div id="checkout-message" class="checkout-message" role="alert" aria-live="polite" hidden></div>
    </header>

    <section class="tiers-section" aria-labelledby="tiers-heading">
      <h2 id="tiers-heading" class="visually-hidden">Plans</h2>
      <div class="tiers-grid">
        <div class="tier-card">
          <h3 class="tier-name">Free</h3>
          <p class="tier-desc">Open source. Self-host. Memory + encrypted-local storage. No Paddle.</p>
          <p class="tier-price" data-monthly="£0" data-annual="£0">£0</p>
          <p class="tier-period">—</p>
          <a href="/keys/docs" class="btn btn-secondary">Get started</a>
        </div>

        <div class="tier-card">
          <h3 class="tier-name">Pro</h3>
          <p class="tier-desc">Cloud API, dashboard. 100K requests/mo, 1K stored keys. Firestore, Supabase, Postgres.</p>
          <p class="tier-price" data-monthly="£19" data-annual="£192">£19</p>
          <p class="tier-period" data-monthly="/mo" data-annual="/yr">/mo</p>
          <button type="button" class="btn btn-primary" data-paddle-checkout data-tier="pro" data-billing-period="monthly" data-price-id="">Subscribe</button>
        </div>

        <div class="tier-card">
          <h3 class="tier-name">Team</h3>
          <p class="tier-desc">Unlimited users, 10K keys, unlimited requests. Usage dashboard, team sharing, audit log.</p>
          <p class="tier-price" data-monthly="£49" data-annual="£468">£49</p>
          <p class="tier-period" data-monthly="/mo" data-annual="/yr">/mo</p>
          <button type="button" class="btn btn-primary" data-paddle-checkout data-tier="team" data-billing-period="monthly" data-price-id="">Subscribe</button>
        </div>

        <div class="tier-card">
          <h3 class="tier-name">Enterprise</h3>
          <p class="tier-desc">Unlimited keys & API. SSO, SLA, export. Zuplo gateway + custom.</p>
          <p class="tier-price" data-monthly="£149" data-annual="£1,428">£149</p>
          <p class="tier-period" data-monthly="/mo" data-annual="/yr">/mo</p>
          <button type="button" class="btn btn-primary" data-paddle-checkout data-tier="enterprise" data-billing-period="monthly" data-price-id="">Subscribe</button>
        </div>
      </div>
      <p class="tiers-overage">Overage: £3/1K keys, £4/100K requests, £4/1K API calls. Free tier has no overage.</p>
    </section>

    <section class="features-section" aria-labelledby="features-heading">
      <h2 id="features-heading" class="section-title">What you get in every tier</h2>
      <div class="features-grid">
        <div class="feat"><span class="feat-name">Key management</span><span class="feat-desc">Add, validate, list, delete. Masked in UI.</span></div>
        <div class="feat"><span class="feat-name">Provider routing</span><span class="feat-desc">Model → provider resolution. One middleware.</span></div>
        <div class="feat"><span class="feat-name">Cost & budget</span><span class="feat-desc">Per-model cost, budget comparison.</span></div>
        <div class="feat"><span class="feat-name">Embeddable UI</span><span class="feat-desc">KeyManager, ModelSelector, CostEstimator.</span></div>
        <div class="feat"><span class="feat-name">Storage adapters</span><span class="feat-desc">In-memory, file, Firestore, Supabase, Neon.</span></div>
        <div class="feat"><span class="feat-name">Dashboard & API</span><span class="feat-desc">Cloud API, project dashboard (Pro+).</span></div>
      </div>
    </section>

    <section class="faq-section" aria-labelledby="faq-heading">
      <h2 id="faq-heading" class="section-title">FAQ</h2>
      <dl class="faq-list">
        <dt class="faq-q">Can I use Keys without paying?</dt>
        <dd class="faq-a">Yes. The core is MIT. Self-host with in-memory or local storage; no Paddle, no account. Pro and above add cloud API, dashboard, and paid storage adapters.</dd>
        <dt class="faq-q">What happens after I subscribe?</dt>
        <dd class="faq-a">You're sent to the dashboard. Sign in with GitHub if you aren't already. Your tier applies to your project; you can create API keys and use the cloud API from there.</dd>
        <dt class="faq-q">Can I change plan later?</dt>
        <dd class="faq-a">Yes. In the dashboard, use "Manage subscription" to upgrade, downgrade, or cancel. Billing is through Paddle.</dd>
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
  .toggle-wrap {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  .toggle-label {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .toggle-btn {
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-full);
    width: 2.5rem;
    height: 1.25rem;
    padding: 0;
    cursor: pointer;
  }
  .toggle-track {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: var(--radius-full);
    background: var(--rm-border);
    position: relative;
  }
  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: calc(1.25rem - 4px);
    height: calc(1.25rem - 4px);
    background: var(--rm-sage);
    border-radius: var(--radius-full);
    transition: transform var(--duration-fast) var(--ease);
  }
  .toggle-btn[aria-pressed="true"] .toggle-thumb {
    transform: translateX(1.25rem);
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
  .tiers-overage {
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
