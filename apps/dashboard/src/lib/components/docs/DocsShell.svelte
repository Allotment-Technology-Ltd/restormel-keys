<script lang="ts">
  /**
   * Shared docs chrome: collapsible sidebar, mobile off-canvas, breadcrumbs, optional footer links.
   */
  import "$lib/styles/docs-prose.css";
  import type { DocsNavBlock } from "$lib/keys/docs-nav.js";
  import { onMount } from "svelte";
  import { page } from "$app/stores";

  export let storageKey: string;
  export let navBlocks: DocsNavBlock[];
  /** Breadcrumb trail including doc home (e.g. Keys → Docs → …) */
  export let breadcrumbItems: { name: string; path: string }[];
  export let footerLinks: { href: string; label: string; external?: boolean }[] = [];

  let collapsed = false;
  let isMobile = false;

  function normPath(p: string): string {
    return p.replace(/\/$/, "") || "/";
  }

  function isNavActive(href: string): boolean {
    const p = normPath($page.url.pathname);
    const h = normPath(href);
    if (p === h) return true;
    const docsIndexOnly = /\/docs$/.test(h);
    if (docsIndexOnly) return p === h;
    return p.startsWith(h + "/");
  }

  onMount(() => {
    const media = window.matchMedia("(max-width: 900px)");

    const applyMode = () => {
      isMobile = media.matches;
      if (isMobile) {
        collapsed = true;
      } else {
        collapsed = localStorage.getItem(storageKey) === "true";
      }
    };

    applyMode();
    media.addEventListener("change", applyMode);

    return () => media.removeEventListener("change", applyMode);
  });

  function toggle() {
    collapsed = !collapsed;
    if (!isMobile) localStorage.setItem(storageKey, String(collapsed));
  }

  function closeNavOnMobile() {
    if (isMobile) collapsed = true;
  }

  function onDocsWindowKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && isMobile && !collapsed) {
      e.preventDefault();
      collapsed = true;
    }
  }
</script>

<svelte:window on:keydown={onDocsWindowKeydown} />

<div class="docs-shell" class:docs-shell-collapsed={collapsed}>
  {#if isMobile && !collapsed}
    <button type="button" class="docs-nav-backdrop" aria-label="Close docs navigation" on:click={toggle}></button>
  {/if}

  <nav class="docs-nav" aria-label="Docs navigation">
    {#each navBlocks as block}
      {#if block.kind === "link"}
        <a
          href={block.href}
          class:active={isNavActive(block.href)}
          aria-current={isNavActive(block.href) ? "page" : undefined}
          {...block.external ? { target: "_blank", rel: "noopener noreferrer" } : {}}
          on:click={closeNavOnMobile}
        >
          {block.label}
        </a>
      {:else if block.kind === "section"}
        {#if block.defaultCollapsed}
          <details class="nav-section-details">
            <summary class="nav-section-summary">{block.label}</summary>
            {#each block.items as item}
              <a
                href={item.href}
                class:active={isNavActive(item.href)}
                aria-current={isNavActive(item.href) ? "page" : undefined}
                on:click={closeNavOnMobile}
              >
                {item.label}
              </a>
            {/each}
          </details>
        {:else}
          <h2 class="nav-section">{block.label}</h2>
          {#each block.items as item}
            <a
              href={item.href}
              class:active={isNavActive(item.href)}
              aria-current={isNavActive(item.href) ? "page" : undefined}
              on:click={closeNavOnMobile}
            >
              {item.label}
            </a>
          {/each}
        {/if}
      {:else}
        <div class="nav-divider" aria-hidden="true"></div>
      {/if}
    {/each}

    {#if footerLinks.length > 0}
      <div class="nav-divider" aria-hidden="true"></div>
      {#each footerLinks as fl}
        <a
          href={fl.href}
          class:active={isNavActive(fl.href)}
          aria-current={isNavActive(fl.href) ? "page" : undefined}
          {...fl.external ? { target: "_blank", rel: "noopener noreferrer" } : {}}
          on:click={closeNavOnMobile}
        >
          {fl.label}
        </a>
      {/each}
    {/if}
  </nav>

  <main class="docs-main">
    <nav class="docs-topbar" aria-label="Breadcrumb">
      <button
        type="button"
        class="docs-topbar-nav-toggle"
        aria-pressed={collapsed}
        aria-label={isMobile
          ? collapsed
            ? "Open docs navigation"
            : "Close docs navigation"
          : collapsed
            ? "Expand docs navigation"
            : "Collapse docs navigation"}
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

    {#if $$slots.banner}
      <div class="docs-banner-slot">
        <slot name="banner" />
      </div>
    {/if}

    <slot />
  </main>
</div>

<style>
  .docs-shell {
    display: flex;
    min-height: calc(100vh - var(--rm-nav-height));
    max-width: var(--rm-container-max);
    margin: 0 auto;
    border: var(--brut-border-width) solid var(--brut-ink);
    border-radius: 0;
    overflow: hidden;
    position: relative;
  }
  .docs-nav {
    width: 14rem;
    padding: var(--space-4);
    border-right: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-white);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .docs-nav a {
    font-size: var(--text-sm);
    color: var(--brut-ink);
    font-weight: 600;
    text-decoration: none;
    border-radius: 0;
    padding: var(--space-2);
    min-height: 44px;
    display: flex;
    align-items: center;
  }
  .docs-nav a:hover {
    color: var(--brut-ink);
    background: var(--brut-neon);
  }
  .docs-nav a.active {
    color: var(--brut-ink);
    background: var(--color-yellow);
    font-weight: 900;
  }
  .nav-divider {
    height: 0;
    border-top: var(--brut-border-micro) solid var(--brut-ink);
    margin: var(--space-2) 0;
  }
  .nav-section {
    font-size: var(--text-xs);
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--brut-ink);
    margin: var(--space-2) 0 var(--space-1);
    line-height: var(--leading-normal);
  }
  .nav-section-details {
    margin: var(--space-2) 0 0;
  }
  .nav-section-summary {
    font-size: var(--text-xs);
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--brut-ink);
    cursor: pointer;
    list-style: none;
    padding: var(--space-1) 0;
    min-height: 44px;
    display: flex;
    align-items: center;
  }
  .nav-section-summary::-webkit-details-marker {
    display: none;
  }
  .nav-section-summary::after {
    content: " ▾";
    font-size: 0.65em;
    margin-left: auto;
  }
  .docs-main {
    flex: 1;
    min-width: 0;
    padding: var(--space-6);
  }
  .docs-banner-slot {
    margin-bottom: var(--space-6);
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
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-neon);
    color: var(--brut-ink);
    font-weight: 800;
    text-transform: uppercase;
    border-radius: 0;
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-xs);
    white-space: nowrap;
    flex: 0 0 auto;
    min-width: 44px;
    min-height: 44px;
  }
  .docs-topbar-nav-toggle:hover {
    background: var(--brut-neon);
    color: var(--brut-ink);
  }
  .docs-crumb {
    color: var(--brut-ink);
    font-weight: 700;
  }
  .docs-crumb:hover {
    color: var(--brut-ink);
    background: var(--brut-neon);
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

  .docs-main :global(.callout) {
    padding: var(--space-3) var(--space-4);
    border-radius: 0;
    margin: 0 0 var(--space-4);
    font-size: var(--text-sm);
    border: var(--border);
    border-left-width: 6px;
  }
  .docs-main :global(.callout a) {
    color: var(--color-ink);
    font-weight: 700;
  }
  .docs-main :global(.callout strong:first-of-type) {
    font-weight: 700;
  }
  .docs-main :global(.callout-tip) {
    background: var(--color-surface);
    border-color: var(--color-ink);
    border-left-color: var(--color-yellow);
    color: var(--color-ink-muted);
  }
  .docs-main :global(.callout-tip strong:first-of-type) {
    color: var(--color-ink);
  }
  .docs-main :global(.callout-note) {
    background: var(--color-bg-deep);
    border-color: var(--color-ink);
    border-left-color: var(--color-ink-faint);
    color: var(--color-ink-muted);
  }
  .docs-main :global(.callout-note strong:first-of-type) {
    color: var(--color-ink);
  }
  .docs-main :global(.callout-pitfall) {
    background: var(--color-surface);
    border-color: var(--color-ink);
    border-left-color: var(--amber-insight);
    color: var(--color-ink-muted);
    font-weight: 500;
  }
  .docs-main :global(.callout-pitfall strong) {
    color: var(--color-ink);
  }
  .docs-main :global(.callout-security) {
    background: var(--color-surface);
    border-color: var(--color-ink);
    border-left-color: var(--coral-alert);
    color: var(--color-ink-muted);
    font-weight: 500;
  }
  .docs-main :global(.callout-security strong) {
    color: var(--color-ink);
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
      box-shadow: var(--brut-shadow);
      transform: translateX(0);
      transition: transform 0.18s ease;
      border-right: var(--brut-border-width) solid var(--brut-ink);
    }
    .docs-shell-collapsed .docs-nav {
      transform: translateX(-100%);
      width: min(18rem, 84vw);
      padding: var(--space-4);
      border-right: var(--brut-border-width) solid var(--brut-ink);
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
