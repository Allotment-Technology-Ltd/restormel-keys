<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import { page } from "$app/stores";
  import { docsNav } from "$lib/testing/docs-nav.js";

  function navHref(path: string): string {
    return `${base}${path}`;
  }

  function isActive(itemPath: string): boolean {
    const current = $page.url.pathname.replace(/\/$/, "") || "/";
    const target = `${base}${itemPath}`.replace(/\/$/, "") || "/";
    if (itemPath === "/docs") {
      return current === target;
    }
    return current === target || current.startsWith(`${target}/`);
  }
</script>

<div class="docs-shell">
  <aside class="docs-aside" aria-label="Documentation">
    <p class="docs-aside__label">Testing docs</p>
    <nav class="docs-aside__nav">
      {#each docsNav as section}
        <div class="docs-aside__section">
          <h2 class="docs-aside__heading">{section.label}</h2>
          <ul class="docs-aside__list" role="list">
            {#each section.items as item}
              <li>
                <a
                  class="docs-aside__link"
                  class:docs-aside__link--active={isActive(item.path)}
                  href={navHref(item.path)}
                  data-sveltekit-preload-data="hover"
                >
                  {item.title}
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </nav>
  </aside>

  <div class="docs-main">
    <aside class="docs-keys-cta" aria-label="Keys and Testing setup">
      <strong>Using Restormel Keys?</strong>
      Canonical setup for hosted credentials + CI env:
      <a href="https://restormel.dev/keys/docs/guides/keys-testing-onboarding" rel="noopener noreferrer"
        >Keys + Testing onboarding</a
      >
      · Dashboard hub:
      <a href="https://restormel.dev/keys/dashboard/testing" rel="noopener noreferrer">Restormel Testing</a>
      · Agents: MCP tools <code>testing.journey</code>, <code>testing.ci_env_template</code>,
      <code>testing.resolve_probe</code>.
    </aside>
    <slot />
  </div>
</div>

<style>
  .docs-shell {
    display: grid;
    grid-template-columns: minmax(12rem, 14rem) 1fr;
    gap: var(--space-8);
    align-items: start;
    max-width: var(--rm-container-max);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6) var(--space-16);
  }

  @media (max-width: 52rem) {
    .docs-shell {
      grid-template-columns: 1fr;
      padding-inline: var(--space-4);
    }
  }

  .docs-aside {
    position: sticky;
    top: calc(var(--space-4) + 3.5rem);
    padding-bottom: var(--space-8);
  }

  @media (max-width: 52rem) {
    .docs-aside {
      position: static;
      border-bottom: var(--border-1) solid var(--rm-border);
      padding-bottom: var(--space-6);
    }
  }

  .docs-aside__label {
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--rm-dim);
    margin: 0 0 var(--space-4);
  }

  .docs-aside__nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .docs-aside__heading {
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--rm-dim);
    margin: 0 0 var(--space-2);
  }

  .docs-aside__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .docs-aside__link {
    display: block;
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    text-decoration: none;
    padding: var(--space-1) 0;
    border-radius: var(--radius-sm);
  }

  .docs-aside__link:hover {
    color: var(--signal-teal-hover);
  }

  .docs-aside__link:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }

  .docs-aside__link--active {
    color: var(--rm-sage);
    font-weight: var(--font-medium);
  }

  .docs-main {
    min-width: 0;
    max-width: calc(var(--rm-container-max) - 14rem - var(--space-8));
  }

  @media (max-width: 52rem) {
    .docs-main {
      max-width: none;
    }
  }

  .docs-keys-cta {
    font-size: var(--text-xs);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-6);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface-2);
  }

  .docs-keys-cta a {
    color: var(--rm-sage);
    font-weight: 500;
  }

  .docs-keys-cta code {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: 0.88em;
  }
</style>
