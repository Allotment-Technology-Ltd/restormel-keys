<script lang="ts">
  /** Marketing layout: nav + footer for /keys (excluding /keys/dashboard, which uses the app shell). */
  import "$lib/styles/marketing-shell.css";
  import SiteHeader from "$lib/components/site/SiteHeader.svelte";
  import SiteFooter from "$lib/components/site/SiteFooter.svelte";
  import { page } from "$app/stores";
  import { absoluteUrl } from "$lib/seo";

  $: user = $page.data.user;

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

<div class="marketing-page">
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <SiteHeader {user} />
  <main id="main-content" class="marketing-main">
    <slot />
  </main>
  <SiteFooter />
</div>

<style>
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
  .marketing-main {
    padding: var(--space-8) var(--space-6);
  }
  @media (max-width: 760px) {
    .marketing-main {
      padding: var(--space-6) var(--space-4);
    }
  }
</style>
