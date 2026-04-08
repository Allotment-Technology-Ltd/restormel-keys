<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import { githubRepoUrl, keysDocsUrl, keysHomeUrl, suiteHomeUrl } from "$lib/testing/site.js";

  const lockup = `${base}/restormel-lockup-nav.svg`;
</script>

<footer class="site-footer">
  <div class="site-footer-inner">
    <div class="site-footer-col">
      <span class="site-footer-title">Product</span>
      <ul class="site-footer-links" aria-label="Product">
        <li><a href={base || "/"}>Testing</a></li>
        <li><a href="{base}/docs">Docs</a></li>
        <li><a href="{base}/docs/walkthrough">Walkthrough</a></li>
        <li><a href={keysHomeUrl}>Restormel Keys</a></li>
      </ul>
    </div>

    <div class="site-footer-col">
      <span class="site-footer-title">Resources</span>
      <ul class="site-footer-links" aria-label="Resources">
        <li><a href={githubRepoUrl} rel="noopener noreferrer">GitHub</a></li>
        <li><a href={keysDocsUrl}>Keys documentation</a></li>
        <li><a href={suiteHomeUrl}>restormel.dev</a></li>
      </ul>
    </div>

    <div class="site-footer-col site-footer-brand">
      <a href={suiteHomeUrl} class="site-footer-logo">
        <img src={lockup} alt="Restormel" width="160" height="24" />
      </a>
      <p class="site-footer-tagline">Goal-based testing for AI products</p>
    </div>
  </div>
  <p class="site-footer-copy">restormel.dev</p>
</footer>

<style>
  .site-footer {
    margin-top: auto;
    border-top: var(--border-1) solid var(--rm-border);
    background: var(--rm-bg);
    padding: var(--space-12) var(--space-6) var(--space-10);
  }

  .site-footer-inner {
    max-width: var(--rm-container-max);
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr 1.2fr;
    gap: var(--space-10);
    align-items: start;
  }

  @media (max-width: 48rem) {
    .site-footer-inner {
      grid-template-columns: 1fr;
      gap: var(--space-8);
    }
  }

  .site-footer-title {
    display: block;
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--rm-dim);
    margin-bottom: var(--space-3);
  }

  .site-footer-links {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .site-footer-links a {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    text-decoration: none;
  }

  .site-footer-links a:hover {
    color: var(--rm-sage);
    text-decoration: underline;
  }

  .site-footer-links a:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }

  .site-footer-brand {
    text-align: left;
  }

  @media (min-width: 48rem) {
    .site-footer-brand {
      text-align: right;
    }
  }

  .site-footer-logo {
    display: inline-block;
    line-height: 0;
    margin-bottom: var(--space-3);
  }

  .site-footer-logo:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
    border-radius: var(--radius-sm);
  }

  .site-footer-logo img {
    height: 24px;
    width: auto;
    display: block;
  }

  .site-footer-tagline {
    font-family: var(--rm-font-display);
    font-size: var(--text-lg);
    font-style: italic;
    color: var(--rm-muted);
    margin: 0;
    line-height: var(--leading-tight);
    max-width: 16rem;
  }

  @media (min-width: 48rem) {
    .site-footer-tagline {
      margin-left: auto;
    }
  }

  .site-footer-copy {
    max-width: var(--rm-container-max);
    margin: var(--space-10) auto 0;
    padding-top: var(--space-6);
    border-top: var(--border-1) solid var(--rm-border);
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    color: var(--rm-dim);
    text-align: center;
  }
</style>
