<script lang="ts">
  /**
   * Social proof: live metrics (GitHub stars + summed npm 30d downloads) and/or shields.io badges.
   * Metrics variant renders nothing when data is missing or invalid.
   *
   * Uses legacy `export let` (not `$props`) because the dashboard sets `compilerOptions.runes: false`;
   * mixing runes here produced broken SSR (ReferenceError: props is not defined) in the Vercel ISR bundle.
   */
  import type { SocialProofMetrics } from "$lib/social-proof";
  import {
    formatCount,
    GITHUB_REPO_URL,
    NPM_PACKAGE_KEYS_URL,
    socialProofShieldNpmKeysUrl,
    socialProofShieldStarsUrl,
  } from "$lib/social-proof";

  type Variant = "metrics" | "badges";

  export let variant: Variant = "metrics";
  /** From root layout load; used when variant="metrics" */
  export let metrics: SocialProofMetrics | null = null;
  /** Optional extra classes on the root element */
  export let className = "";

  const shieldsStars = socialProofShieldStarsUrl();
  const shieldsNpm = socialProofShieldNpmKeysUrl();

  $: showMetrics =
    variant === "metrics" &&
    metrics != null &&
    metrics.stars > 0 &&
    metrics.npmDownloads30d > 0;
</script>

{#if variant === "badges"}
  <div class="social-proof social-proof--badges {className || ''}" aria-label="Community links">
    <a
      href={GITHUB_REPO_URL}
      class="social-proof-badge-link"
      rel="noopener noreferrer"
      target="_blank"
    >
      <img src={shieldsStars} alt="GitHub stars for Restormel" height="20" loading="lazy" decoding="async" />
    </a>
    <a
      href={NPM_PACKAGE_KEYS_URL}
      class="social-proof-badge-link"
      rel="noopener noreferrer"
      target="_blank"
    >
      <img
        src={shieldsNpm}
        alt="npm downloads for @restormel/keys"
        height="20"
        loading="lazy"
        decoding="async"
      />
    </a>
  </div>
{:else if showMetrics && metrics}
  <div class="social-proof social-proof--metrics {className || ''}">
    <p class="social-proof-heading">Community</p>
    <ul class="social-proof-stats">
      <li class="social-proof-stat">
        <span class="social-proof-value">{formatCount(metrics.stars)}</span>
        <span class="social-proof-label">GitHub stars</span>
      </li>
      <li
        class="social-proof-stat social-proof-stat--wide"
        aria-label={`${formatCount(metrics.npmDownloads30d)} downloads in the last 30 days across @restormel/keys, @restormel/graph-core, and @restormel/testing-core`}
      >
        <span class="social-proof-value social-proof-npm-line"
          >↓ {formatCount(metrics.npmDownloads30d)} downloads last 30 days</span
        >
        <span class="social-proof-label">npm (@restormel/keys, graph-core, testing-core)</span>
      </li>
    </ul>
    <div class="social-proof-badges" aria-hidden="true">
      <a href={GITHUB_REPO_URL} class="social-proof-badge-link" rel="noopener noreferrer" target="_blank" tabindex="-1">
        <img src={shieldsStars} alt="" height="20" loading="lazy" decoding="async" />
      </a>
      <a href={NPM_PACKAGE_KEYS_URL} class="social-proof-badge-link" rel="noopener noreferrer" target="_blank" tabindex="-1">
        <img src={shieldsNpm} alt="" height="20" loading="lazy" decoding="async" />
      </a>
    </div>
  </div>
{/if}

<style>
  .social-proof--metrics {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    text-align: center;
    width: 100%;
  }
  .social-proof-heading {
    margin: 0;
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--rm-dim);
  }
  .social-proof-stats {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-6);
    justify-content: center;
    align-items: flex-start;
  }
  .social-proof-stat {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 8rem;
  }
  .social-proof-stat--wide {
    max-width: 22rem;
  }
  .social-proof-npm-line {
    font-size: clamp(var(--text-lg), 2.5vw, var(--text-xl));
    line-height: var(--leading-snug);
  }
  .social-proof-value {
    font-family: var(--rm-font-display);
    font-size: clamp(var(--text-xl), 3vw, var(--text-2xl));
    font-weight: var(--font-semibold);
    color: var(--rm-sage);
    line-height: var(--leading-tight);
  }
  .social-proof-label {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-snug);
  }
  .social-proof-badges {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    justify-content: center;
    align-items: center;
    opacity: 0.92;
  }
  .social-proof--badges {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: center;
    justify-content: flex-start;
  }
  .social-proof-badge-link {
    line-height: 0;
    border-radius: 4px;
    opacity: 0.95;
    transition: opacity 0.15s ease;
  }
  .social-proof-badge-link:hover {
    opacity: 1;
  }
  .social-proof-badge-link:focus-visible {
    outline: 2px solid var(--rm-sage);
    outline-offset: 3px;
  }
  .social-proof-badge-link img {
    width: auto;
    max-width: 100%;
    height: 20px;
  }
</style>
