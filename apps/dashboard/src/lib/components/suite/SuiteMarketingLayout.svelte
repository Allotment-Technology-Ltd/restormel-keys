<script lang="ts">
  import "$lib/styles/marketing-shell.css";
  import { onMount } from "svelte";
  import SiteHeader from "$lib/components/site/SiteHeader.svelte";
  import SiteFooter from "$lib/components/site/SiteFooter.svelte";
  import { agentLog } from "$lib/debug/agent-log";
  import { DEFAULT_OG_IMAGE_PATH } from "$lib/seo";
  import type { ModuleFlags } from "$lib/module-flags-types";
  import type { SuiteModule } from "$lib/suite/suite-modules";

  /** Optional module-preview notice (e.g. Graph marketing while module flag is preview). */
  export let previewNotice: string | null = null;
  /** Passed from route layouts — lib components must not subscribe to `$page` during SSR. */
  export let user: App.PageData["user"] | undefined = undefined;
  export let pathname: string;
  export let ogUrl: string;
  export let moduleFlags: ModuleFlags;
  export let suiteModulesForUi: SuiteModule[];

  // Derive origin from ogUrl for absolute OG image URL
  $: ogOrigin = (() => {
    try {
      return new URL(ogUrl).origin;
    } catch {
      return "";
    }
  })();

  $: ogImageAbsolute = ogOrigin ? ogOrigin + DEFAULT_OG_IMAGE_PATH : DEFAULT_OG_IMAGE_PATH;

  // Organization + SoftwareApplication JSON-LD for the suite marketing layout
  $: orgJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Restormel",
    url: ogOrigin ? ogOrigin + "/" : "/",
    logo: ogOrigin ? ogOrigin + "/restormel-lockup-nav.svg" : "/restormel-lockup-nav.svg",
    description: "Verified-context layer for AI products — provenance-traced, evidence-bound, auditable knowledge for agents.",
    sameAs: ["https://restormel.dev"],
  });

  onMount(() => {
    // #region agent log
    agentLog(
      "SuiteMarketingLayout.svelte:onMount",
      "marketing shell hydrated",
      { pathname },
      "H6",
      "post-fix"
    );
    // #endregion
  });
</script>

<svelte:head>
  <link rel="canonical" href={ogUrl} />
  <meta property="og:site_name" content="Restormel" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={ogUrl} />
  <meta property="og:image" content={ogImageAbsolute} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/png" />
  <meta property="twitter:card" content="summary_large_image" />
  <meta property="twitter:image" content={ogImageAbsolute} />
  <script type="application/ld+json">{@html orgJsonLd}</script>
</svelte:head>

<div class="marketing-page">
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <SiteHeader {user} {pathname} />
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
  <SiteFooter {moduleFlags} {suiteModulesForUi} />
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
