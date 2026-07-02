<script lang="ts">
  /**
   * RES-113 PR-4 — the journey (flag-ON) signed-out welcome, copy pack §5.5
   * VERBATIM: one sentence + the canonical auth CTA. The stale "Sources → Runs →
   * Claims / Foundation" tour copy is deliberately absent from this branch.
   *
   * Extracted from +layout.svelte so the CTA is unit-testable with getByRole
   * (5-lens review, Lens 4 minor 2) — the flag-OFF welcome stays inline in the
   * layout, byte-identical. Styles mirror the layout's .welcome recipe (scoped
   * styles do not cross the component boundary); .btn/.btn-primary are global
   * (app.css). Tokens only — zero new design tokens.
   */
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
</script>

<div class="welcome" role="region" aria-labelledby="welcome-heading">
  <h1 id="welcome-heading" class="welcome-title">Restormel Dashboard</h1>
  <p class="welcome-intro">Restormel turns your documents into answers you can check.</p>
  <p class="welcome-signin">
    <a href={DASHBOARD_BASE + "/login"} class="btn btn-primary welcome-signin-cta">Sign in with GitHub</a>
  </p>
</div>

<style>
  .welcome {
    max-width: var(--rm-container-narrow);
  }
  .welcome-title {
    font-family: var(--brut-font);
    font-size: var(--text-3xl);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: -0.02em;
    color: var(--brut-ink);
    margin: 0 0 var(--space-3);
  }
  .welcome-intro {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    line-height: var(--leading-normal);
    margin: 0 0 var(--space-5);
  }
  /* Journey signed-out CTA (copy pack §5.5). Uses the shared .btn/.btn-primary
     chrome; the focus ring is ink-paired locally per the accessibility skill
     (never a bare yellow ring on cream). */
  .welcome-signin {
    margin: 0;
  }
  .welcome-signin-cta:focus-visible {
    outline: 2px solid var(--brut-ink);
    outline-offset: 2px;
  }
</style>
