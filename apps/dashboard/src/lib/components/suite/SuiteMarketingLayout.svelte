<script lang="ts">
  import "$lib/styles/marketing-shell.css";
  import SiteHeader from "$lib/components/site/SiteHeader.svelte";
  import SiteFooter from "$lib/components/site/SiteFooter.svelte";
  import { page } from "$app/stores";
  import { absoluteUrl } from "$lib/seo";

  /** Optional module-preview notice (e.g. Graph marketing while module flag is preview). */
  export let previewNotice: string | null = null;

  $: user = $page.data.user;
</script>

<svelte:head>
  <meta property="og:site_name" content="Restormel" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={absoluteUrl($page.url, $page.url.pathname)} />
  <meta property="twitter:card" content="summary" />
</svelte:head>

<div class="marketing-page">
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <SiteHeader {user} />
  {#if previewNotice}
    <div class="marketing-banner">
      <div class="marketing-banner-inner">
        {@html previewNotice}
      </div>
    </div>
  {:else if $$slots.banner}
    <div class="marketing-banner">
      <div class="marketing-banner-inner">
        <slot name="banner" />
      </div>
    </div>
  {/if}
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
  .marketing-main {
    flex: 1;
    width: 100%;
    padding: 0;
  }
</style>
