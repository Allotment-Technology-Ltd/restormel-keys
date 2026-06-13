<script lang="ts">
  /**
   * Marketing claims ledger citations (docs/verified-context-claims-ledger.md):
   * - "backed by a verbatim quote you can check yourself" → row #2 (proven)
   * - "Every claim carries a provenance trace" → row #7 (proven)
   * - "A different model family checks the extraction" → row #5 (proven)
   */
  import { trackSignupClick } from "$lib/posthog";
</script>

<section class="section section-hero" aria-labelledby="hero-heading">
  <div class="container">
    <p class="hero-eyebrow">The control plane for verified context</p>
    <h1 id="hero-heading" class="hero-headline">Knowledge your agent can trace back to the source</h1>
    <p class="hero-subhead">
      Restormel Keys is the control plane for verified context: provenance-traced, evidence-bound, quality-gated
      knowledge an agent — or its auditor — can trace to the exact source span. BYOK and model routing come built in
      to feed it.
    </p>

    <div class="variant-features">
      <div class="variant-card">
        <h3 class="variant-card-title">Evidence-bound claims</h3>
        <p class="variant-card-copy">
          Every supported claim is backed by a verbatim quote you can check yourself — bound to character offsets
          and a hash of the source version, so a skeptic can re-verify it with no model in the loop.
        </p>
      </div>
      <div class="variant-card">
        <h3 class="variant-card-title">A second model family checks</h3>
        <p class="variant-card-copy">
          The model that extracts a claim never grades its own work. An independent model family validates the
          extraction by default, so the answer isn't graded by the system that wrote it.
        </p>
      </div>
      <div class="variant-card">
        <h3 class="variant-card-title">An audit trail per query</h3>
        <p class="variant-card-copy">
          Every claim carries a provenance trace: its verification state, its citation, and a trace ref —
          exportable as JSON for your compliance file.
        </p>
      </div>
    </div>

    <p class="variant-supporting">
      BYOK and policy-bounded model routing are built in — the supporting plumbing that feeds verified context, not a
      separate product to wire up. SvelteKit, Next.js, React, and Web Components paths.
    </p>

    <div class="hero-ctas">
      <a
        href="/keys/dashboard/login"
        class="btn btn-primary btn-cta-hero"
        on:click={trackSignupClick}
      >
        Start free — first 50 signups get 12 months of Pro
      </a>
      <a href="/keys/docs/guides/verified-context" class="hero-docs-link">See how verification works →</a>
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
  .hero-eyebrow {
    margin: 0 0 var(--space-2);
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-weight: var(--font-semibold);
    color: var(--rm-sage);
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
