<script lang="ts">
  /** Keys pricing: Free, Pro (Paddle GBP/USD), Team & Platform (catalog ready; checkout when entitlements ship). */
  /** Legacy props + `$:` / `let` — `runes: false` (see changelog/+page.svelte). */
  import { onMount } from "svelte";
  import { initPaddleCheckout } from "$lib/paddle-checkout";
  import { browser } from "$app/environment";
  import type { PageData } from "./$types";

  export let data: PageData;

  let billingCurrency: "gbp" | "usd" = "gbp";

  $: canUseGbp = Boolean(data.proPriceIdMonthlyGbp);
  $: canUseUsd = Boolean(data.proPriceIdMonthlyUsd);
  $: selectedPriceId =
    billingCurrency === "usd"
      ? data.proPriceIdMonthlyUsd || data.proPriceIdMonthlyGbp
      : data.proPriceIdMonthlyGbp || data.proPriceIdMonthlyUsd;
  $: priceDisplay =
    billingCurrency === "usd" ? data.proMonthlyPriceDisplayUsd : data.proMonthlyPriceDisplayGbp;
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
  <meta
    name="description"
    content="Planned Restormel Keys tiers (reference only) for the control plane for verified context. Early access is invite-only — request access via Founders Circle."
  />

  <script type="application/ld+json">
    {JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What counts as an API request?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "One call to the Restormel resolve endpoint. Health checks and validation runs do not count toward your limit.",
          },
        },
        {
          "@type": "Question",
          name: "What happens when I hit my request limit?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "You'll receive a warning at 80% usage. Requests above the limit return a 429 with a clear error. No silent failures.",
          },
        },
        {
          "@type": "Question",
          name: "Is there a free trial of Pro?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes — the first 50 founding members receive 12 months of Pro free through the Founders Circle program.",
          },
        },
        {
          "@type": "Question",
          name: "Can I use Keys without Testing or Graph?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Absolutely. Each module is independently adoptable.",
          },
        },
        {
          "@type": "Question",
          name: "Can I use Keys without paying?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Start on Free for development and prototyping. Upgrade when you need production-grade limits and visibility.",
          },
        },
        {
          "@type": "Question",
          name: "What happens after I subscribe?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "You're sent to the dashboard. Sign in with GitHub if you aren't already. Your tier applies to your workspace; you can create API keys and use the cloud API from there.",
          },
        },
        {
          "@type": "Question",
          name: "Can I change plan later?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Billing is through Paddle. You can cancel any time and keep using Free.",
          },
        },
      ],
    })}
  </script>
</svelte:head>

<article class="pricing-page">
  <div class="container">
    <aside class="early-access-banner" role="note">
      <p>
        <strong>Early access only.</strong> Restormel is not on general sale yet. Dashboard sign-in is invite-only —
        <a href="/founders">request access</a> and we’ll email you a personal link when approved.
      </p>
    </aside>

    <header class="pricing-header">
      <h1 class="pricing-title">Planned tiers</h1>
      <p class="pricing-kicker">Reference pricing — checkout disabled during Founders Circle</p>
      <p class="pricing-intro">
        <strong>Restormel Keys</strong> is the control plane for verified context — provenance-traced, evidence-bound
        knowledge for your AI products, with BYOK and model routing built in. We’re validating the full suite with
        founders before opening self-serve billing. Use the form below to get dashboard access now.
      </p>
      <aside class="suite-strip" aria-label="Early access">
        <p class="suite-strip-copy">
          <a href="/founders"><strong>Request early access →</strong></a>
          — Keys, Testing, Graph, and Connect in one invite-only workspace. No card required.
        </p>
      </aside>
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
            <li>1,000 API requests / month</li>
            <li>Multi-provider routing</li>
            <li>Key validation &amp; health checks</li>
            <li>Basic dashboard</li>
            <li>CLI access</li>
            <li>Community support</li>
          </ul>
          <p class="tier-limitations">
            <strong>Limitations:</strong> No usage charts, no team seats, not production-optimised.
          </p>
          <a href="/keys/docs" class="btn btn-secondary">Read the docs</a>
          <a href="/founders" class="btn btn-secondary tier-secondary-cta">Request dashboard access</a>
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
            <li>10 projects</li>
            <li>100,000 API requests / month</li>
            <li>Everything in Free</li>
            <li>Usage dashboard with request charts &amp; cost tracking</li>
            <li>Advanced routing controls</li>
            <li>Provider health history</li>
            <li>Webhook alerts (budget, provider failure)</li>
            <li>Priority email support</li>
          </ul>
          <p class="tier-footnote">Most developers upgrade when they're ready to ship.</p>
          <a href="/founders" class="btn btn-primary btn-upgrade-pro">Request early access</a>
          <p class="tier-hint">Self-serve checkout opens after the Founders Circle cohort. No card today.</p>
        </div>

        <div class="tier-card tier-card-team">
          <h3 class="tier-name">Team</h3>
          <p class="tier-desc"><strong>Best for:</strong> production teams</p>
          <p class="tier-price">{data.teamMonthlyDisplayGbp}</p>
          <p class="tier-period">/ month + tax</p>
          <ul class="tier-list">
            <li>Unlimited projects</li>
            <li>500,000 API requests / month</li>
            <li>Everything in Pro</li>
            <li>Team seats (up to 5 users)</li>
            <li>SSO (GitHub org)</li>
            <li>Audit log</li>
            <li>Priority support with SLA</li>
          </ul>
          <p class="tier-footnote">For teams shipping AI in production.</p>
          <a href="/founders" class="btn btn-secondary btn-upgrade-team">Request early access</a>
          <p class="tier-hint">Team checkout opens after the Founders Circle cohort.</p>
        </div>

        <div class="tier-card tier-card-platform">
          <p class="platform-badge">Suite</p>
          <h3 class="tier-name">Platform</h3>
          <p class="tier-desc"><strong>Best for:</strong> multi-module adoption</p>
          <p class="tier-price">{data.platformMonthlyDisplayGbp}</p>
          <p class="tier-period">/ month + tax</p>
          <ul class="tier-list">
            <li>Full suite (Keys, Testing, Graph, Connect) — planned</li>
            <li>Best value when you adopt more than one module.</li>
          </ul>
          <a class="btn btn-primary btn-platform-pricing" href="/founders">Request early access →</a>
          <p class="tier-hint">Platform billing is not live yet. Founders get the full suite invite-first.</p>
        </div>
      </div>
    </section>

    <section class="features-section" aria-labelledby="features-heading">
      <h2 id="features-heading" class="section-title">What you get across Keys</h2>
      <div class="features-grid">
        <div class="feat">
          <span class="feat-name">Verified context</span><span class="feat-desc"
            >Provenance-traced, evidence-bound knowledge served to your agents — every claim tied to a source span.</span
          >
        </div>
        <div class="feat">
          <span class="feat-name">Provider access modes</span><span class="feat-desc"
            >Builder-managed direct, gateway-backed, or end-user BYOK — the model access that feeds context.</span
          >
        </div>
        <div class="feat">
          <span class="feat-name">Restormel Resolve</span><span class="feat-desc">Model → provider resolution. One middleware.</span>
        </div>
        <div class="feat">
          <span class="feat-name">Policies</span><span class="feat-desc"
            >Allow/deny models, enforce route rules, and keep behavior inspectable.</span
          >
        </div>
        <div class="feat">
          <span class="feat-name">Health &amp; fallbacks</span><span class="feat-desc"
            >Detect failures and shift traffic safely with explicit fallback chains.</span
          >
        </div>
        <div class="feat">
          <span class="feat-name">Embeddable UX</span><span class="feat-desc"
            >ModelSelector, CostEstimator, and optional KeyManager for BYOK flows.</span
          >
        </div>
        <div class="feat">
          <span class="feat-name">Dashboard &amp; API</span><span class="feat-desc">Cloud API and dashboard; usage charts on Pro+.</span>
        </div>
      </div>
    </section>

    <section class="faq-section" aria-labelledby="faq-heading">
      <h2 id="faq-heading" class="section-title">FAQ</h2>
      <dl class="faq-list">
        <dt class="faq-q">What counts as an API request?</dt>
        <dd class="faq-a">
          One call to the Restormel resolve endpoint. Health checks and validation runs do not count toward your limit.
        </dd>
        <dt class="faq-q">What happens when I hit my request limit?</dt>
        <dd class="faq-a">
          You'll receive a warning at 80% usage. Requests above the limit return a 429 with a clear error. No silent failures.
        </dd>
        <dt class="faq-q">Is there a free trial of Pro?</dt>
        <dd class="faq-a">
          Yes — the first 50 founding members receive 12 months of Pro free through the
          <a class="faq-inline-link" href="/founders">Founders Circle</a> program (apply on that page).
        </dd>
        <dt class="faq-q">Can I use Keys without Testing or Graph?</dt>
        <dd class="faq-a">Absolutely. Each module is independently adoptable.</dd>
        <dt class="faq-q">Can I use Keys without paying?</dt>
        <dd class="faq-a">
          Yes. Start on Free for development and prototyping. Upgrade when you need production-grade limits and visibility.
        </dd>
        <dt class="faq-q">What happens after I subscribe?</dt>
        <dd class="faq-a">
          You're sent to the dashboard. Sign in with GitHub if you aren't already. Your tier applies to your workspace; you
          can create API keys and use the cloud API from there.
        </dd>
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
  .early-access-banner {
    margin-bottom: var(--space-6);
    padding: var(--space-4);
    border: 1px solid color-mix(in oklab, var(--rm-sage) 45%, var(--rm-border));
    border-radius: var(--radius-md);
    background: color-mix(in oklab, var(--rm-sage) 10%, var(--rm-surface-raised));
  }
  .early-access-banner p {
    margin: 0;
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
  }
  .early-access-banner a {
    color: var(--rm-sage);
    font-weight: var(--font-semibold);
  }
  .tier-secondary-cta {
    margin-top: var(--space-2);
    display: inline-flex;
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
    margin: 0 0 var(--space-5);
    max-width: var(--rm-container-narrow);
    line-height: var(--leading-relaxed);
  }
  .pricing-intro-link {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .suite-strip {
    margin: 0 0 var(--space-6);
    padding: var(--space-4) var(--space-5);
    max-width: var(--rm-container-narrow);
    border-radius: var(--radius-md);
    border: 1px solid color-mix(in oklab, var(--rm-sage) 35%, var(--rm-border));
    background: color-mix(in oklab, var(--rm-surface-raised) 92%, var(--rm-sage) 8%);
  }
  .suite-strip-copy {
    margin: 0;
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
  }
  .suite-strip-copy strong {
    color: var(--rm-text);
  }
  .suite-strip-copy a {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
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
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: var(--space-6);
    margin-bottom: var(--space-10);
  }
  @media (min-width: 1100px) {
    .tiers-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
  .tier-card {
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
  }
  .tier-card-pro {
    border-color: color-mix(in oklab, var(--rm-sage) 55%, var(--rm-border));
    background: color-mix(in oklab, var(--rm-surface-raised) 90%, var(--rm-sage) 10%);
    box-shadow:
      0 0 0 2px color-mix(in oklab, var(--rm-sage) 20%, transparent),
      0 14px 28px rgba(0, 0, 0, 0.16);
  }
  .tier-card-team {
    border-color: color-mix(in oklab, var(--rm-muted) 40%, var(--rm-border));
  }
  .tier-card-platform {
    border-color: color-mix(in oklab, var(--path-blue, var(--rm-sage)) 45%, var(--rm-border));
    background: color-mix(in oklab, var(--rm-surface-raised) 94%, var(--path-blue, var(--rm-sage)) 6%);
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
  .platform-badge {
    display: inline-flex;
    align-items: center;
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
    background: var(--color-yellow);
    color: var(--color-ink);
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
  .tier-card-platform .tier-price {
    color: var(--path-blue, var(--rm-sage));
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
    flex: 1;
  }
  .tier-limitations {
    margin: 0 0 var(--space-4);
    color: var(--rm-muted);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
  }
  .tier-footnote {
    margin: 0 0 var(--space-4);
    font-size: var(--text-xs);
    color: var(--rm-dim);
    line-height: var(--leading-normal);
    font-style: italic;
  }
  .tier-hint {
    font-size: var(--text-xs);
    color: var(--rm-dim);
    margin: var(--space-3) 0 0;
    line-height: var(--leading-normal);
  }
  .tier-hint-muted {
    color: var(--rm-muted);
    font-style: italic;
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
  .btn-todo-checkout {
    width: 100%;
    margin-top: auto;
    opacity: 0.72;
    cursor: not-allowed;
  }
  .btn-platform-pricing {
    width: 100%;
    text-align: center;
    justify-content: center;
    margin-bottom: var(--space-2);
  }
  .btn-platform-todo {
    margin-top: 0;
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
  .faq-inline-link {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .tier-code {
    font-size: 0.85em;
    padding: 0.08em 0.3em;
    border-radius: 4px;
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
  }
  .tier-hint-muted a {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
</style>
