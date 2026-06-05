<script lang="ts">
  import { developerPortalUrl } from "$lib/developer-portal-url";
  import RestormelLogo from "$lib/components/RestormelLogo.svelte";
  import { integrationCatalogForFlags } from "$lib/integration-catalog-for-flags";
  import type { ModuleFlags } from "$lib/module-flags-types";
  import type { SuiteModule } from "$lib/suite/suite-modules";
  import {
    capabilityLinksFromModules,
    companyNavLinks,
    developerLinks,
    productNavLinks,
    SUITE_DOCS_HREF,
  } from "$lib/site-nav";

  export let moduleFlags: ModuleFlags;
  export let suiteModulesForUi: SuiteModule[];

  $: portalUrl = developerPortalUrl();
  $: devLinks = developerLinks(portalUrl);
  $: capabilityLinks = capabilityLinksFromModules(suiteModulesForUi);
  $: flags = moduleFlags;
  $: showIntegrationCatalog = integrationCatalogForFlags(flags).length > 0;
</script>

<footer class="site-footer">
  <div class="site-footer-inner">
    <div class="site-footer-brand">
      <a href="/" class="site-footer-logo" aria-label="Restormel home">
        <RestormelLogo variant="lockup" height={28} decorative />
      </a>
      <p class="site-footer-tagline">One AI product layer for your whole stack. Route · Ingest · Verify.</p>
    </div>
    <div class="site-footer-col">
      <span class="site-footer-title">Product</span>
      <ul class="site-footer-links" aria-label="Product">
        <li><a href="/">Restormel home</a></li>
        {#each productNavLinks as item}
          <li><a href={item.href}>{item.label}</a></li>
        {/each}
      </ul>
    </div>
    <div class="site-footer-col">
      <span class="site-footer-title">Capabilities</span>
      <ul class="site-footer-links" aria-label="Capabilities">
        {#each capabilityLinks as item}
          <li><a href={item.href}>{item.label}</a></li>
        {/each}
      </ul>
    </div>
    <div class="site-footer-col">
      <span class="site-footer-title">Integrations</span>
      <ul class="site-footer-links" aria-label="Integrations">
        <li><a href="/integrations">Overview</a></li>
        {#if showIntegrationCatalog}
          <li><a href="/keys/docs/guides/integration-catalog">Integration catalog</a></li>
        {/if}
      </ul>
    </div>
    <div class="site-footer-col">
      <span class="site-footer-title">Company</span>
      <ul class="site-footer-links" aria-label="Company">
        {#each companyNavLinks as item}
          <li><a href={item.href}>{item.label}</a></li>
        {/each}
      </ul>
    </div>
    <div class="site-footer-col">
      <span class="site-footer-title">Developers</span>
      <ul class="site-footer-links" aria-label="Developers">
        <li><a href={SUITE_DOCS_HREF}>Suite docs</a></li>
        {#each devLinks as item}
          <li>
            <a href={item.href} target="_blank" rel="noopener noreferrer">{item.label}</a>
          </li>
        {/each}
      </ul>
    </div>
  </div>
  <div class="site-footer-bottom">
    <span>© {new Date().getFullYear()} Allotment Technology Ltd</span>
    <span class="site-footer-bottom-links">
      <a href="/keys/terms">Terms</a>
      <span aria-hidden="true">·</span>
      <a href="/keys/privacy">Privacy</a>
      <span aria-hidden="true">·</span>
      <a href="/keys/refund-policy">Refund policy</a>
    </span>
  </div>
</footer>

<style>
  .site-footer {
    border-top: var(--border);
    background: var(--color-bg-deep);
    margin-top: auto;
  }
  .site-footer-inner {
    max-width: 75rem;
    margin: 0 auto;
    padding: 3rem var(--space-8) 2rem;
    display: grid;
    grid-template-columns: 2fr repeat(5, minmax(0, 1fr));
    gap: 2rem;
  }
  .site-footer-brand {
    grid-column: span 1;
  }
  .site-footer-logo {
    display: inline-flex;
    margin-bottom: 0.75rem;
    text-decoration: none;
  }
  .site-footer-tagline {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--color-ink-muted);
    margin: 0;
    max-width: 14rem;
    line-height: 1.6;
  }
  .site-footer-col {
    min-width: 0;
  }
  .site-footer-title {
    display: block;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--color-ink-faint);
    margin-bottom: 0.875rem;
  }
  .site-footer-links {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .site-footer-links a {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--color-ink-muted);
    text-decoration: none;
  }
  .site-footer-links a:hover {
    color: var(--color-ink);
    text-decoration: none;
  }
  .site-footer-bottom {
    max-width: 75rem;
    margin: 0 auto;
    padding: 1.25rem var(--space-8);
    border-top: 1px solid var(--color-bg);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    letter-spacing: 0.06em;
    color: var(--color-ink-faint);
  }
  .site-footer-bottom-links {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .site-footer-bottom-links a {
    color: inherit;
    text-decoration: none;
  }
  .site-footer-bottom-links a:hover {
    color: var(--color-ink);
  }
  @media (max-width: 900px) {
    .site-footer-inner {
      grid-template-columns: 1fr 1fr;
    }
    .site-footer-brand {
      grid-column: 1 / -1;
    }
  }
</style>
