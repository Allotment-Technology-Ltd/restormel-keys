<script lang="ts">
  /** Marketing layout for /keys marketing routes; app chrome (header/footer) for dashboard + admin. */
  import "$lib/styles/marketing-shell.css";
  import SuiteMarketingLayout from "$lib/components/suite/SuiteMarketingLayout.svelte";
  import SiteHeader from "$lib/components/site/SiteHeader.svelte";
  import SiteFooter from "$lib/components/site/SiteFooter.svelte";
  import { page } from "$app/stores";
  import { marketingShellPropsFromPage } from "$lib/marketing-shell-props";
  import { absoluteUrl, DEFAULT_OG_IMAGE_PATH } from "$lib/seo";

  $: shell = marketingShellPropsFromPage($page);
  $: user = shell.user;
  $: pathname = shell.pathname;
  $: skipMarketingShell =
    pathname.startsWith("/keys/dashboard") || pathname.startsWith("/keys/admin");

  // Canonical URL — strip query params
  $: canonicalUrl = absoluteUrl($page.url, $page.url.pathname);
  $: ogImageAbsolute = $page.url.origin + DEFAULT_OG_IMAGE_PATH;

  $: orgJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Restormel",
    url: absoluteUrl($page.url, "/"),
    logo: absoluteUrl($page.url, "/restormel-lockup-nav.svg"),
    description: "Verified-context layer for AI products — provenance-traced, evidence-bound, auditable knowledge for agents.",
    sameAs: ["https://restormel.dev"],
  });

  $: productJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Restormel Keys",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    url: absoluteUrl($page.url, "/keys"),
    description: "Verified-context API gateway — provenance-traced, evidence-bound AI model routing with auditable RAG.",
  });
</script>

<svelte:head>
  <link rel="canonical" href={canonicalUrl} />
  <meta property="og:site_name" content="Restormel Keys" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:image" content={ogImageAbsolute} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/png" />
  <meta property="twitter:card" content="summary_large_image" />
  <meta property="twitter:image" content={ogImageAbsolute} />

  <script type="application/ld+json">{@html orgJsonLd}</script>
  <script type="application/ld+json">{@html productJsonLd}</script>
</svelte:head>

{#if skipMarketingShell}
  <div class="marketing-page app-chrome">
    <a href="#main-content" class="skip-link">Skip to main content</a>
    <SiteHeader {user} {pathname} />
    <main id="main-content" class="app-main dashboard-chrome-main">
      <slot />
    </main>
    <SiteFooter moduleFlags={shell.moduleFlags} suiteModulesForUi={shell.suiteModulesForUi} />
  </div>
{:else}
  <SuiteMarketingLayout {...shell}>
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
