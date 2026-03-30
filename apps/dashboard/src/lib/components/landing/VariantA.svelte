<script lang="ts">
  import { trackSignupClick } from "$lib/posthog";
</script>

<section class="section section-hero" aria-labelledby="hero-heading">
  <div class="container">
    <h1 id="hero-heading" class="hero-headline">Stop rebuilding AI routing logic in every project</h1>
    <p class="hero-subhead">
      Restormel Keys is a one-middleware control layer for routing, fallback chains, and policy enforcement.
      Works above OpenRouter, Portkey, Vercel AI Gateway, or direct providers. No proxy. No new infrastructure.
    </p>

    <div class="variant-features">
      <div class="variant-card">
        <h3 class="variant-card-title">One middleware call</h3>
        <p class="variant-card-copy">
          One <code>createResolveMiddleware()</code> call replaces your custom provider-selection logic.
          Your backend asks Restormel which provider and model to use; you keep calling the provider directly.
        </p>
      </div>
      <div class="variant-card">
        <h3 class="variant-card-title">Dashboard-configured</h3>
        <p class="variant-card-copy">
          Fallback chains, model allowlists, and budget caps configured in the dashboard — not scattered
          across environment variables and try/catch blocks.
        </p>
      </div>
      <div class="variant-card">
        <h3 class="variant-card-title">Pre-deploy health checks</h3>
        <p class="variant-card-copy">
          Health checks run locally or in CI via <code>keys doctor</code> and <code>keys validate</code>
          before anything breaks in production.
        </p>
      </div>
    </div>

    <p class="variant-supporting">
      Works with OpenRouter, Portkey, Vercel AI Gateway, and direct providers. 15-minute integration path for Next.js, React, and SvelteKit.
    </p>

    <div class="hero-ctas">
      <a
        href="/keys/dashboard"
        class="btn btn-primary btn-cta-hero"
        on:click={trackSignupClick}
      >
        Start free — first 50 signups get 12 months of Pro
      </a>
    </div>
  </div>
</section>

<style>
  /* Reuse landing page token system — these styles are scoped to this component */
  .container {
    max-width: var(--rm-container-max);
    margin: 0 auto;
    padding: 0 var(--space-6);
  }
  .section-hero {
    padding-top: var(--space-8);
    padding-bottom: var(--space-12);
  }
  .hero-headline {
    font-family: var(--rm-font-display);
    font-size: clamp(2.25rem, 6vw, 3.5rem);
    font-weight: var(--font-semibold);
    line-height: var(--leading-tight);
    color: var(--rm-text);
    margin: 0 0 var(--space-3);
  }
  .hero-subhead {
    font-family: var(--rm-font-ui);
    font-size: var(--text-lg);
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
    max-width: 65ch;
    line-height: var(--leading-relaxed);
  }
  .variant-features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: var(--space-4);
    margin: 0 0 var(--space-6);
  }
  .variant-card {
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    padding: var(--space-5);
  }
  .variant-card-title {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--rm-sage);
    margin: 0 0 var(--space-2);
  }
  .variant-card-copy {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0;
    line-height: var(--leading-relaxed);
  }
  .variant-card-copy code {
    font-family: var(--rm-font-mono, "JetBrains Mono", monospace);
    font-size: 0.85em;
    background: var(--rm-surface);
    padding: 0.1em 0.35em;
    border-radius: 3px;
  }
  .variant-supporting {
    font-size: var(--text-sm);
    color: var(--rm-dim);
    margin: 0 0 var(--space-6);
    max-width: 65ch;
  }
  .hero-ctas {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
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
  .btn-cta-hero {
    padding: var(--space-4) var(--space-8);
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    min-width: 16rem;
    text-align: center;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
  }
  .btn-cta-hero:hover {
    filter: brightness(1.1);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  }
  @media (max-width: 480px) {
    .hero-ctas {
      flex-direction: column;
      align-items: stretch;
    }
    .btn-cta-hero {
      min-width: 0;
      width: 100%;
      padding: var(--space-3) var(--space-4);
      font-size: var(--text-base);
    }
  }
</style>
