<script lang="ts">
  import { trackSignupClick } from "$lib/posthog";
</script>

<section class="section section-hero" aria-labelledby="hero-heading">
  <div class="container">
    <h1 id="hero-heading" class="hero-headline">Stop paying your users' AI bills</h1>
    <p class="hero-subhead">
      Restormel Keys adds BYOK to your AI app — with drop-in key management UI, routing, and plan-based model control.
      One middleware call. No proxy, no infrastructure.
    </p>

    <div class="variant-features">
      <div class="variant-card">
        <h3 class="variant-card-title">User-supplied keys</h3>
        <p class="variant-card-copy">
          Users supply their own OpenAI, Anthropic, Google, or any of 15 supported provider keys.
          You control which models they access per plan tier — configured in the dashboard, not hardcoded.
        </p>
      </div>
      <div class="variant-card">
        <h3 class="variant-card-title">Drop-in components</h3>
        <p class="variant-card-copy">
          On any stack: use <code>&lt;rk-key-manager&gt;</code> and <code>&lt;rk-model-selector&gt;</code> from
          <code>@restormel/keys-elements</code> with Keys REST for resolve — one Web Components path for SvelteKit, React, and Astro.
        </p>
      </div>
      <div class="variant-card">
        <h3 class="variant-card-title">Dashboard-managed access</h3>
        <p class="variant-card-copy">
          Routes, policies, and budget caps live in the dashboard. Promote a user to Pro and their
          model access updates without a deploy.
        </p>
      </div>
    </div>

    <div class="hero-ctas">
      <a
        href="/keys/dashboard/login"
        class="btn btn-primary btn-cta-hero"
        on:click={trackSignupClick}
      >
        Start free — first 50 signups get 12 months of Pro
      </a>
      <a href="/keys/docs" class="hero-docs-link">Browse the docs →</a>
    </div>
  </div>
</section>

<style>
  /* Same token-based styles as VariantA — scoped to this component */
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
    font-family: var(--font-mono);
    font-size: 0.85em;
    background: var(--rm-surface);
    padding: 0.1em 0.35em;
    border-radius: 3px;
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
    background: var(--color-yellow);
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
  .hero-docs-link {
    display: inline-block;
    margin-top: var(--space-2);
    color: var(--rm-muted);
    font-size: var(--text-sm);
    text-decoration: none;
  }
  .hero-docs-link:hover {
    color: var(--rm-text);
    text-decoration: underline;
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
