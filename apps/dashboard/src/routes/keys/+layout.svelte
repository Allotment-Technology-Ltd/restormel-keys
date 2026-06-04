<script lang="ts">
  /** Marketing layout for /keys marketing routes; app chrome (header/footer) for dashboard + admin. */
  import "$lib/styles/marketing-shell.css";
  import SuiteMarketingLayout from "$lib/components/suite/SuiteMarketingLayout.svelte";
  import SiteHeader from "$lib/components/site/SiteHeader.svelte";
  import SiteFooter from "$lib/components/site/SiteFooter.svelte";
  import { page } from "$app/stores";
  import { absoluteUrl } from "$lib/seo";

  $: user = $page.data.user;
  $: pathname = $page.url.pathname;
  $: skipMarketingShell =
    pathname.startsWith("/keys/dashboard") || pathname.startsWith("/keys/admin");

  const orgJsonLd = (baseUrl: URL) => ({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Restormel",
    url: absoluteUrl(baseUrl, "/"),
    logo: absoluteUrl(baseUrl, "/restormel-lockup-nav.svg"),
  });

  const productJsonLd = (baseUrl: URL) => ({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Restormel Keys",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    url: absoluteUrl(baseUrl, "/keys"),
  });
</script>

<svelte:head>
  <meta property="og:site_name" content="Restormel Keys" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={absoluteUrl($page.url, $page.url.pathname)} />
  <meta property="twitter:card" content="summary" />

  <script type="application/ld+json">{JSON.stringify(orgJsonLd($page.url))}</script>
  <script type="application/ld+json">{JSON.stringify(productJsonLd($page.url))}</script>
</svelte:head>

{#if skipMarketingShell}
  <div class="marketing-page app-chrome">
    <a href="#main-content" class="skip-link">Skip to main content</a>
    <SiteHeader {user} />
    <main id="main-content" class="app-main dashboard-chrome-main">
      <slot />
    </main>
    <SiteFooter />
  </div>
{:else}
  <SuiteMarketingLayout>
    <slot />
  </SuiteMarketingLayout>
{/if}

<style>
  .skip-link {
    position: absolute;
    top: -100%;
    left: var(--space-4);
    padding: var(--space-2) var(--space-3);
    background: var(--brut-neon);
    color: var(--brut-ink);
    font-weight: 800;
    font-size: var(--text-sm);
    text-decoration: none;
    border: var(--brut-border-width) solid var(--brut-ink);
    border-radius: 0;
    z-index: var(--z-modal);
    transition: top 0.2s ease;
  }
  .skip-link:focus {
    top: var(--space-4);
  }
  .app-chrome {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .app-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    width: 100%;
    box-sizing: border-box;
    padding: var(--space-8) var(--space-6);
  }
  @media (max-width: 760px) {
    .app-main {
      padding: var(--space-6) var(--space-4);
    }
  }
</style>
