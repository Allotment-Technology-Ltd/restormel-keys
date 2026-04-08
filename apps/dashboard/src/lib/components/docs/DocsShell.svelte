<script lang="ts">
  /**
   * Shared docs chrome: collapsible sidebar, mobile off-canvas, breadcrumbs, optional footer links.
   */
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
    text-decoration: none;
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-1);
    min-height: 44px;
    display: flex;
    align-items: center;
  }
  .docs-nav a:hover {
    color: var(--rm-sage);
  }
  .docs-nav a.active {
    color: var(--rm-sage);
    font-weight: var(--font-medium);
  }
  .nav-divider {
    height: 1px;
    background: var(--rm-border);
    margin: var(--space-2) 0;
  }
  .nav-section {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--rm-dim);
    margin: var(--space-1) 0;
    line-height: var(--leading-normal);
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
    border: 1px solid var(--rm-border);
    background: var(--rm-bg);
    color: var(--rm-muted);
    border-radius: var(--rm-radius);
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    white-space: nowrap;
    flex: 0 0 auto;
    min-width: 44px;
    min-height: 44px;
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
