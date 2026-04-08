<script lang="ts">
  import { developerPortalUrl } from "$lib/developer-portal-url";
  import {
    developerLinks,
    keysPillarLinks,
    testingPillarLinks,
  } from "$lib/site-nav";

  $: portalUrl = developerPortalUrl();
  $: devLinks = developerLinks(portalUrl);
</script>

<footer class="site-footer">
  <div class="site-footer-inner">
    <div class="site-footer-col">
      <span class="site-footer-title">Keys</span>
      <ul class="site-footer-links" aria-label="Keys">
        <li><a href="/">Restormel home</a></li>
        {#each keysPillarLinks as item}
          <li><a href={item.href}>{item.label}</a></li>
        {/each}
      </ul>
    </div>
    <div class="site-footer-col">
      <span class="site-footer-title">Testing</span>
      <ul class="site-footer-links" aria-label="Testing">
        {#each testingPillarLinks as item}
          <li><a href={item.href}>{item.label}</a></li>
        {/each}
      </ul>
    </div>
    <div class="site-footer-col">
      <span class="site-footer-title">Integrations</span>
      <ul class="site-footer-links" aria-label="Integrations">
        <li><a href="/integrations">Overview</a></li>
      </ul>
    </div>
    <div class="site-footer-col">
      <span class="site-footer-title">Developers</span>
      <ul class="site-footer-links" aria-label="Developers">
        {#each devLinks as item}
          <li>
            <a href={item.href} target="_blank" rel="noopener noreferrer">{item.label}</a>
          </li>
        {/each}
      </ul>
    </div>
    <div class="site-footer-col">
      <span class="site-footer-title">Legal &amp; resources</span>
      <ul class="site-footer-links" aria-label="Legal and resources">
        <li><a href="/keys/terms">Terms</a></li>
        <li><a href="/keys/privacy">Privacy</a></li>
        <li><a href="/keys/refund-policy">Refund policy</a></li>
      </ul>
    </div>
    <div class="site-footer-col site-footer-brand">
      <a href="/" class="site-footer-logo">
        <img src="/restormel-lockup-nav.svg" alt="Restormel" style="height: 24px; width: auto;" />
      </a>
      <p class="site-footer-tagline">Keys, Testing, and integrations for production AI teams</p>
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
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: var(--space-10);
    align-items: start;
  }
  @media (max-width: 640px) {
    .site-footer-inner {
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
    grid-column: 1 / -1;
    text-align: center;
    padding-top: var(--space-6);
    border-top: 1px solid var(--rm-border);
    margin-top: var(--space-2);
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
