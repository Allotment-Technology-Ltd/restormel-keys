<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { developerPortalUrl } from "$lib/developer-portal-url";
</script>

<footer class="site-footer">
  <div class="site-footer-inner">
    <div class="site-footer-col">
      <span class="site-footer-title">Product</span>
      <ul class="site-footer-links" aria-label="Product">
        <li><a href="/keys">Keys</a></li>
        <li><a href="/keys/docs">Docs</a></li>
        <li><a href={developerPortalUrl()} target="_blank" rel="noopener noreferrer">API portal</a></li>
        <li><a href="/keys/pricing">Pricing</a></li>
        <li><a href="/keys/use-cases">Use cases</a></li>
        <li><a href={DASHBOARD_BASE}>Dashboard</a></li>
      </ul>
    </div>
    <div class="site-footer-col">
      <span class="site-footer-title">Resources</span>
      <ul class="site-footer-links" aria-label="Resources">
        <li><a href="https://github.com/Allotment-Technology-Ltd/restormel-keys" target="_blank" rel="noopener noreferrer">GitHub</a></li>
        <li><a href="/keys/terms">Terms</a></li>
        <li><a href="/keys/privacy">Privacy</a></li>
        <li><a href="/keys/refund-policy">Refund policy</a></li>
      </ul>
    </div>
    <div class="site-footer-col site-footer-brand">
      <a href="/" class="site-footer-logo">
        <img src="/restormel-lockup-nav.svg" alt="Restormel" style="height: 24px; width: auto;" />
      </a>
      <p class="site-footer-tagline">The missing layer for AI apps</p>
    </div>
  </div>
  <p class="site-footer-copy">restormel.dev</p>
</footer>

<style>
  .site-footer {
    margin-top: auto;
    border-top: 1px solid var(--rm-border);
    background: var(--rm-surface);
    padding: var(--space-8) var(--space-6) var(--space-4);
  }
  .site-footer-inner {
    max-width: var(--rm-container-max);
    margin: 0 auto;
    display: grid;
    grid-template-columns: auto auto 1fr;
    gap: var(--space-10);
    align-items: start;
  }
  @media (max-width: 640px) {
    .site-footer-inner {
      grid-template-columns: 1fr;
      gap: var(--space-6);
    }
  }
  .site-footer-title {
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: var(--rm-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: block;
    margin-bottom: var(--space-2);
  }
  .site-footer-links {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .site-footer-links li {
    margin-bottom: var(--space-1);
  }
  .site-footer-links a {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    text-decoration: none;
    transition: color var(--duration-fast) var(--ease);
  }
  .site-footer-links a:hover {
    color: var(--rm-sage);
    text-decoration: none;
  }
  .site-footer-brand {
    text-align: right;
  }
  @media (max-width: 640px) {
    .site-footer-brand {
      text-align: left;
    }
  }
  .site-footer-logo {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
  }
  .site-footer-tagline {
    font-size: var(--text-sm);
    color: var(--rm-dim);
    margin: 0;
  }
  .site-footer-copy {
    font-size: var(--text-xs);
    color: var(--rm-dim);
    margin: var(--space-4) 0 0;
    text-align: center;
  }
</style>

