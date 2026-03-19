<script lang="ts">
  import "../../app.css";
  import SiteHeader from "$lib/components/site/SiteHeader.svelte";
  import SiteFooter from "$lib/components/site/SiteFooter.svelte";
  import { page } from "$app/stores";
  import { absoluteUrl } from "$lib/seo";

  $: user = $page.data.user;
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap"
    rel="stylesheet"
  />
  <meta property="og:site_name" content="Restormel" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={absoluteUrl($page.url, $page.url.pathname)} />
  <meta property="twitter:card" content="summary" />
</svelte:head>

<div class="integrations-page">
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <SiteHeader active="integrations" {user} />
  <main id="main-content" class="integrations-main">
    <slot />
  </main>
  <SiteFooter />
</div>

<style>
  .integrations-page {
    --rm-font-display: "Cormorant Garamond", var(--font-sans);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
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
  .integrations-main {
    flex: 1;
    padding: var(--space-8) var(--space-6);
  }
  @media (max-width: 760px) {
    .integrations-main {
      padding: var(--space-6) var(--space-4);
    }
  }
</style>
