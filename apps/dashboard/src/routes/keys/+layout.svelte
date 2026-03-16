<script lang="ts">
  /** Marketing layout: nav + footer for /keys and /keys/pricing. */
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="marketing-page">
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <header class="marketing-nav" role="banner">
    <nav class="marketing-nav-inner" aria-label="Main">
      <a href="/" class="logo">
        <img src="/restormel-lockup-nav.svg" alt="Restormel" class="logo-img" style="height: 28px; width: auto;" />
      </a>
      <ul class="marketing-nav-links">
        <li><a href="/keys">Keys</a></li>
        <li><a href="/keys/docs">Docs</a></li>
        <li><a href="/keys/pricing">Pricing</a></li>
        <li><a href="https://github.com/Allotment-Technology-Ltd/restormel-keys" target="_blank" rel="noopener noreferrer">GitHub</a></li>
        <li><a href={DASHBOARD_BASE}>Dashboard</a></li>
      </ul>
    </nav>
  </header>
  <main id="main-content" class="marketing-main" role="main">
    <slot />
  </main>
  <footer class="marketing-footer" role="contentinfo">
    <div class="marketing-footer-inner">
      <div class="marketing-footer-col">
        <span class="marketing-footer-title">Product</span>
        <ul class="marketing-footer-links" aria-label="Product">
          <li><a href="/keys">Keys</a></li>
          <li><a href="/keys/docs">Docs</a></li>
          <li><a href="/keys/pricing">Pricing</a></li>
          <li><a href={DASHBOARD_BASE}>Dashboard</a></li>
        </ul>
      </div>
      <div class="marketing-footer-col">
        <span class="marketing-footer-title">Resources</span>
        <ul class="marketing-footer-links" aria-label="Resources">
          <li><a href="https://github.com/Allotment-Technology-Ltd/restormel-keys" target="_blank" rel="noopener noreferrer">GitHub</a></li>
        </ul>
      </div>
      <div class="marketing-footer-col marketing-footer-brand">
        <a href="/" class="marketing-footer-logo">
          <img src="/restormel-lockup-nav.svg" alt="Restormel" style="height: 24px; width: auto;" />
        </a>
        <p class="marketing-footer-tagline">Developer tools for AI</p>
      </div>
    </div>
    <p class="marketing-footer-copy">restormel.dev</p>
  </footer>
</div>

<style>
  .marketing-page {
    --rm-container-max: 72rem;
    --rm-font-display: "Cormorant Garamond", var(--font-sans);
  }
  .skip-link {
    position: absolute;
    top: -100%;
    left: var(--space-4);
    padding: var(--space-2) var(--space-3);
    background: var(--rm-surface-raised);
    color: var(--rm-sage);
    font-size: var(--text-sm);
    text-decoration: none;
    border-radius: var(--rm-radius);
    z-index: var(--z-modal);
    transition: top 0.2s ease;
  }
  .skip-link:focus {
    top: var(--space-4);
  }
  .marketing-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .marketing-nav {
    border-bottom: 1px solid var(--rm-border);
    background: var(--rm-surface);
    min-height: var(--rm-nav-height);
  }
  .marketing-nav-inner {
    max-width: var(--rm-container-max);
    margin: 0 auto;
    padding: var(--space-4) var(--space-6);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-6);
    min-height: var(--rm-nav-height);
  }
  .logo, .marketing-footer-logo {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
    transition: opacity var(--duration-fast) var(--ease);
  }
  .logo:hover, .marketing-footer-logo:hover {
    opacity: 0.9;
  }
  .logo:focus-visible, .marketing-footer-logo:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
    border-radius: var(--rm-radius);
  }
  .logo-img {
    display: block;
    object-fit: contain;
  }
  .marketing-nav-links {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-5);
  }
  .marketing-nav-links a {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    text-decoration: none;
    padding: var(--space-2) 0;
    transition: color var(--duration-fast) var(--ease);
  }
  .marketing-nav-links a:hover {
    color: var(--rm-sage);
  }
  .marketing-main {
    flex: 1;
    padding: var(--space-8) var(--space-6);
  }
  .marketing-footer {
    margin-top: auto;
    border-top: 1px solid var(--rm-border);
    background: var(--rm-surface);
    padding: var(--space-8) var(--space-6) var(--space-4);
  }
  .marketing-footer-inner {
    max-width: var(--rm-container-max);
    margin: 0 auto;
    display: grid;
    grid-template-columns: auto auto 1fr;
    gap: var(--space-10);
    align-items: start;
  }
  @media (max-width: 640px) {
    .marketing-footer-inner {
      grid-template-columns: 1fr;
      gap: var(--space-6);
    }
  }
  .marketing-footer-title {
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: var(--rm-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: block;
    margin-bottom: var(--space-2);
  }
  .marketing-footer-links {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .marketing-footer-links li {
    margin-bottom: var(--space-1);
  }
  .marketing-footer-links a {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    text-decoration: none;
    transition: color var(--duration-fast) var(--ease);
  }
  .marketing-footer-links a:hover {
    color: var(--rm-sage);
  }
  .marketing-footer-brand {
    text-align: right;
  }
  @media (max-width: 640px) {
    .marketing-footer-brand {
      text-align: left;
    }
  }
  .marketing-footer-tagline {
    font-size: var(--text-sm);
    color: var(--rm-dim);
    margin: 0;
  }
  .marketing-footer-copy {
    font-size: var(--text-xs);
    color: var(--rm-dim);
    margin: var(--space-4) 0 0;
    text-align: center;
  }
</style>
