<script lang="ts">
  /** Docs layout — docs sidebar is collapsible and width-constrained. */
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { developerPortalUrl } from "$lib/developer-portal-url";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { absoluteUrl } from "$lib/seo";

  const STORAGE_KEY = "rk_docs_sidebar_collapsed";
  let collapsed = false;
  let isMobile = false;

  onMount(() => {
    const media = window.matchMedia("(max-width: 900px)");

    const applyMode = () => {
      isMobile = media.matches;
      if (isMobile) {
        // Phone/tablet docs default to closed off-canvas navigation.
        collapsed = true;
      } else {
        collapsed = localStorage.getItem(STORAGE_KEY) === "true";
      }
    };

    applyMode();
    media.addEventListener("change", applyMode);

    return () => media.removeEventListener("change", applyMode);
  });

  function toggle() {
    collapsed = !collapsed;
    if (!isMobile) localStorage.setItem(STORAGE_KEY, String(collapsed));
  }

  function closeNavOnMobile() {
    if (isMobile) collapsed = true;
  }

  $: pathname = $page.url.pathname;
  $: docsPathRaw = pathname.startsWith("/keys/docs") ? pathname.slice("/keys/docs".length) || "" : "";
  $: docsPath = docsPathRaw.replace(/^\/+/, ""); // no leading slash to avoid "Docs / /segment"
  $: pathSegments = docsPath ? docsPath.split("/").filter(Boolean) : [];
  $: breadcrumbItems = [
    { name: "Keys", path: "/keys" },
    { name: "Docs", path: "/keys/docs" },
    ...pathSegments.map((segment, i) => {
      const path = "/keys/docs/" + pathSegments.slice(0, i + 1).join("/");
      const name = segment.replace(/-/g, " ");
      return { name, path };
    }),
  ];
</script>

<svelte:head>
  <title>Docs — Restormel Keys</title>
  <meta property="og:site_name" content="Restormel Keys" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={absoluteUrl($page.url, $page.url.pathname)} />
  <meta property="twitter:card" content="summary" />

  <script type="application/ld+json">
    {JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbItems.map((b, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        name: b.name,
        item: absoluteUrl($page.url, b.path),
      })),
    })}
  </script>
</svelte:head>

<div class="docs-shell" class:docs-shell-collapsed={collapsed}>
  {#if isMobile && !collapsed}
    <button type="button" class="docs-nav-backdrop" aria-label="Close docs navigation" on:click={toggle}></button>
  {/if}

  <nav class="docs-nav" aria-label="Docs navigation">
    <a href="/keys" on:click={closeNavOnMobile}>Keys</a>
    <div class="nav-section" aria-label="Concepts section">Concepts</div>
    <a href="/keys/docs" on:click={closeNavOnMobile}>Overview</a>
    <a href="/keys/docs/how-it-fits-together" on:click={closeNavOnMobile}>How it fits together</a>
    <div class="nav-divider" aria-hidden="true"></div>
    <div class="nav-section" aria-label="Quickstart section">Quickstart</div>
    <a href="/keys/docs/journeys/new-project" on:click={closeNavOnMobile}>New project</a>
    <a href="/keys/docs/journeys/existing-stack" on:click={closeNavOnMobile}>Existing stack</a>
    <a href="/keys/docs/journeys/byok-saas" on:click={closeNavOnMobile}>BYOK SaaS</a>
    <a href="/keys/docs/journeys/agent-ide" on:click={closeNavOnMobile}>Agent/IDE path</a>
    <a href="/keys/docs/journeys/platform-ops" on:click={closeNavOnMobile}>Platform ops</a>
    <a href="/keys/docs/search" on:click={closeNavOnMobile}>Search</a>
    <a href="/keys/docs/walkthrough" on:click={closeNavOnMobile}>Walkthrough</a>
    <div class="nav-divider" aria-hidden="true"></div>
    <div class="nav-section" aria-label="Guides section">Guides</div>
    <a href="/keys/docs/guides/environment-vocabulary" on:click={closeNavOnMobile}>Environment vocabulary</a>
    <a href="/keys/docs/guides/keys-testing-onboarding" on:click={closeNavOnMobile}>Keys + Testing onboarding</a>
    <a href="/keys/docs/guides/provider-access-modes" on:click={closeNavOnMobile}>Provider access modes</a>
    <a href="/keys/docs/reference/cli" on:click={closeNavOnMobile}>CLI options</a>
    <a href="/keys/docs/guides/openrouter" on:click={closeNavOnMobile}>OpenRouter</a>
    <a href="/keys/docs/guides/vercel-ai-gateway" on:click={closeNavOnMobile}>Vercel AI Gateway</a>
    <a href="/keys/docs/guides/portkey" on:click={closeNavOnMobile}>Portkey</a>
    <a href="/keys/docs/guides/canonical-catalog" on:click={closeNavOnMobile}>Canonical catalog</a>
    <a href="/keys/docs/guides/integration-vs-hosted-vault" on:click={closeNavOnMobile}>Integration vs key custody</a>
    <div class="nav-divider" aria-hidden="true"></div>
    <div class="nav-section" aria-label="Integrations section">Integrations</div>
    <a href="/keys/docs/integrations" on:click={closeNavOnMobile}>Overview</a>
    <a href="/keys/docs/integrations/cli" on:click={closeNavOnMobile}>CLI</a>
    <a href="/keys/docs/integrations/mcp" on:click={closeNavOnMobile}>MCP</a>
    <a href="/keys/docs/integrations/aaif" on:click={closeNavOnMobile}>AAIF</a>
    <a href="/keys/docs/integrations-walkthrough/" on:click={closeNavOnMobile}>Integrations walkthrough</a>
    <div class="nav-divider" aria-hidden="true"></div>
    <a href="/keys/docs/compatibility" on:click={closeNavOnMobile}>Compatibility</a>
    <a href="/keys/docs/cloud-api" on:click={closeNavOnMobile}>Cloud API</a>
    <div class="nav-divider" aria-hidden="true"></div>
    <a
      href={developerPortalUrl()}
      target="_blank"
      rel="noopener noreferrer"
      on:click={closeNavOnMobile}>API portal</a>
    <a href={DASHBOARD_BASE} on:click={closeNavOnMobile}>Dashboard</a>
    <a href={DASHBOARD_BASE + "/login"} on:click={closeNavOnMobile}>Sign in</a>
  </nav>
  <main class="docs-main">
    <nav class="docs-topbar" aria-label="Breadcrumb">
      <button
        type="button"
        class="docs-topbar-nav-toggle"
        aria-pressed={collapsed}
        aria-label={
          isMobile
            ? collapsed
              ? "Open docs navigation"
              : "Close docs navigation"
            : collapsed
              ? "Expand docs navigation"
              : "Collapse docs navigation"
        }
        aria-expanded={isMobile ? !collapsed : undefined}
        on:click={toggle}
      >
        {#if isMobile}
          {collapsed ? "Browse docs" : "Close"}
        {:else}
          {collapsed ? "Expand nav" : "Collapse nav"}
        {/if}
      </button>
      {#each breadcrumbItems as item, i}
        {#if i > 0}
          <span class="docs-crumb-sep" aria-hidden="true">/</span>
        {/if}
        {#if i < breadcrumbItems.length - 1}
          <a class="docs-crumb" href={item.path}>{item.name}</a>
        {:else}
          <span class="docs-crumb-current">{item.name}</span>
        {/if}
      {/each}
    </nav>
    <slot />
  </main>
</div>

<style>
  .docs-shell {
    display: flex;
    min-height: calc(100vh - var(--rm-nav-height));
    max-width: var(--rm-container-max);
    margin: 0 auto;
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    overflow: hidden;
    position: relative;
  }
  .docs-nav {
    width: 14rem;
    padding: var(--space-4);
    border-right: 1px solid var(--rm-border);
    background: var(--rm-surface);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .docs-nav a {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .nav-divider {
    height: 1px;
    background: var(--rm-border);
    margin: var(--space-2) 0;
  }
  .nav-section {
    font-size: var(--text-xs);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--rm-dim);
    margin: var(--space-1) 0;
  }
  .docs-main {
    flex: 1;
    min-width: 0;
    padding: var(--space-6);
  }
  .docs-topbar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0 0 var(--space-5);
    font-size: var(--text-sm);
    color: var(--rm-dim);
    font-family: var(--rm-font-ui);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .docs-topbar-nav-toggle {
    border: 1px solid var(--rm-border);
    background: var(--rm-bg);
    color: var(--rm-muted);
    border-radius: var(--rm-radius);
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    white-space: nowrap;
    flex: 0 0 auto;
  }
  .docs-topbar-nav-toggle:hover {
    background: var(--rm-surface);
    color: var(--rm-text);
  }
  .docs-crumb {
    color: var(--rm-muted);
    font-weight: 500;
  }
  .docs-crumb:hover {
    color: var(--rm-text);
    text-decoration: none;
  }
  .docs-crumb-sep {
    color: var(--rm-dim);
  }
  .docs-crumb-current {
    color: var(--rm-dim);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .docs-shell-collapsed .docs-nav {
    width: 0;
    padding: 0;
    border-right: 0;
    overflow: hidden;
  }
  .docs-nav-backdrop {
    display: none;
  }
  .docs-topbar-nav-toggle {
    min-width: 44px;
    min-height: 44px;
  }

  /* Shared callout styles — each type has a distinct tint and border so cards don't blend into the page */
  .docs-main :global(.callout) {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    margin: 0 0 var(--space-4);
    font-size: var(--text-sm);
    border: 1px solid var(--rm-border);
    border-left-width: 4px;
  }
  .docs-main :global(.callout a) {
    color: var(--rm-primary);
  }
  .docs-main :global(.callout strong:first-of-type) {
    font-weight: 600;
  }
  .docs-main :global(.callout-tip) {
    background: color-mix(in oklab, var(--rm-primary) 10%, var(--rm-surface));
    border-color: var(--rm-border);
    border-left-color: var(--rm-primary);
    color: var(--rm-muted);
  }
  .docs-main :global(.callout-tip strong:first-of-type) {
    color: var(--rm-primary);
  }
  .docs-main :global(.callout-note) {
    background: color-mix(in oklab, var(--rm-muted) 14%, var(--rm-surface));
    border-color: var(--rm-border);
    border-left-color: var(--rm-muted);
    color: var(--rm-muted);
  }
  .docs-main :global(.callout-note strong:first-of-type) {
    color: var(--rm-text, currentColor);
  }
  .docs-main :global(.callout-pitfall) {
    background: color-mix(in oklab, var(--rm-warning, #b45309) 12%, var(--rm-surface));
    border-color: color-mix(in oklab, var(--rm-warning, #b45309) 40%, transparent);
    border-left-color: var(--rm-warning, #b45309);
    border-left-width: 4px;
    color: var(--rm-muted);
    font-weight: var(--font-medium);
  }
  .docs-main :global(.callout-pitfall strong) {
    color: var(--rm-warning, #b45309);
  }
  .docs-main :global(.callout-security) {
    background: color-mix(in oklab, var(--rm-danger, #b91c1c) 12%, var(--rm-surface));
    border-color: color-mix(in oklab, var(--rm-danger, #b91c1c) 40%, transparent);
    border-left-color: var(--rm-danger, #b91c1c);
    border-left-width: 4px;
    color: var(--rm-muted);
    font-weight: var(--font-medium);
  }
  .docs-main :global(.callout-security strong) {
    color: var(--rm-danger, #b91c1c);
  }

  @media (max-width: 900px) {
    .docs-shell {
      border-radius: 0;
      border-left: 0;
      border-right: 0;
      min-height: auto;
    }
    .docs-nav {
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      width: min(18rem, 84vw);
      z-index: var(--z-modal);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
      transform: translateX(0);
      transition: transform 0.18s ease;
      border-right: 1px solid var(--rm-border);
    }
    .docs-shell-collapsed .docs-nav {
      transform: translateX(-100%);
      width: min(18rem, 84vw);
      padding: var(--space-4);
      border-right: 1px solid var(--rm-border);
      overflow: auto;
    }
    .docs-main {
      padding: var(--space-4);
    }
    .docs-topbar {
      flex-wrap: wrap;
      gap: var(--space-1);
      white-space: normal;
      overflow: visible;
    }
    .docs-nav-backdrop {
      display: block;
      position: absolute;
      inset: 0;
      border: 0;
      background: rgba(0, 0, 0, 0.42);
      z-index: calc(var(--z-modal) - 1);
      padding: 0;
    }
  }
</style>
