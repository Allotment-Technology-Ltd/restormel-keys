<script lang="ts">
  import { base } from "$app/paths";
  import { page } from "$app/stores";
  import { githubRepoUrl, suiteHomeUrl } from "$lib/site";

  const lockup = `${base}/restormel-lockup-nav.svg`;

  $: homeHref = base || "/";
  $: docsHref = `${base}/docs`.replace(/\/+/g, "/") || "/docs";
  $: normalizedPath = $page.url.pathname.replace(/\/$/, "") || "/";
  $: isDocs = normalizedPath === docsHref || normalizedPath.startsWith(`${docsHref}/`);
  $: baseNormalized = `${base}`.replace(/\/$/, "") || "/";
  $: onTestingHome = normalizedPath === baseNormalized;
</script>

<a class="skip-link" href="#main-content">Skip to main content</a>

<header class="site-header">
  <nav class="site-header-inner" aria-label="Main">
    <a href={suiteHomeUrl} class="logo-link" aria-label="Restormel home">
      <img src={lockup} alt="" class="logo-img" width="200" height="30" />
    </a>

    <ul class="site-header-links">
      <li>
        <a href={homeHref} class:is-active={onTestingHome} data-sveltekit-preload-data="hover">Testing</a>
      </li>
      <li>
        <a href={docsHref} class:is-active={isDocs} data-sveltekit-preload-data="hover">Docs</a>
      </li>
      <li>
        <a href={githubRepoUrl} rel="noopener noreferrer">GitHub</a>
      </li>
    </ul>

    <div class="site-header-right">
      <a class="btn btn-ghost" href={docsHref}>Browse the docs →</a>
      <a class="btn btn-primary" href="{base}/docs/walkthrough">Get started</a>
    </div>
  </nav>
</header>

<style>
  .skip-link {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .skip-link:focus {
    position: fixed;
    top: var(--space-4);
    left: var(--space-4);
    z-index: var(--z-toast);
    width: auto;
    height: auto;
    margin: 0;
    padding: var(--space-3) var(--space-4);
    clip: auto;
    overflow: visible;
    white-space: normal;
    background: var(--rm-surface-raised);
    color: var(--rm-text);
    border: var(--border-1) solid var(--rm-border);
    border-radius: var(--rm-radius);
    box-shadow: var(--rm-card-shadow);
    text-decoration: none;
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
  }

  .site-header {
    position: sticky;
    top: 0;
    z-index: var(--z-sticky);
    border-bottom: var(--border-1) solid var(--rm-border);
    background: color-mix(in oklab, var(--rm-bg) 88%, transparent);
    backdrop-filter: blur(10px);
  }

  .site-header-inner {
    max-width: var(--rm-container-max);
    margin: 0 auto;
    padding: var(--space-3) var(--space-6);
    display: flex;
    align-items: center;
    gap: var(--space-6);
    flex-wrap: wrap;
    min-height: 3.5rem;
  }

  .logo-link {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    line-height: 0;
  }

  .logo-link:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
    border-radius: var(--radius-sm);
  }

  .logo-img {
    display: block;
    height: 28px;
    width: auto;
  }

  .site-header-links {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-6);
    flex: 1;
  }

  .site-header-links a {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    text-decoration: none;
  }

  .site-header-links a:hover {
    color: var(--rm-text);
    text-decoration: underline;
  }

  .site-header-links a.is-active {
    color: var(--rm-text);
    font-weight: var(--font-medium);
  }

  .site-header-links a:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }

  .site-header-right {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  @media (max-width: 56rem) {
    .site-header-inner {
      padding-inline: var(--space-4);
    }

    .site-header-links {
      order: 3;
      width: 100%;
      padding-top: var(--space-3);
      border-top: var(--border-1) solid var(--rm-border);
    }

    .site-header-right {
      margin-left: auto;
    }
  }
</style>
