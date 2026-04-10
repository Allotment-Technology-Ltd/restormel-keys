<script lang="ts">
  /**
   * Legacy `export let` (not `$props`) — dashboard uses `compilerOptions.runes: false`;
   * runes here break SSR in the Vercel bundle (ReferenceError: props is not defined).
   */
  import SuiteMarketingLayout from "$lib/components/suite/SuiteMarketingLayout.svelte";
  import { GITHUB_REPO_URL } from "$lib/site-nav";
  import type { PageData } from "./$types";

  export let data: PageData;
</script>

<svelte:head>
  <title>Changelog — Restormel</title>
  <meta
    name="description"
    content="Release history for the Restormel Keys monorepo — published from GitHub releases."
  />
</svelte:head>

<SuiteMarketingLayout>
  <div class="doc-content changelog-page">
    <h1>Changelog</h1>
    <p class="doc-tagline">
      Published releases from
      <a href={GITHUB_REPO_URL} rel="noopener noreferrer" target="_blank">Allotment-Technology-Ltd/restormel-keys</a> on
      GitHub.
    </p>

    {#if data.releases.length === 0}
      <p class="changelog-empty">
        Changelog coming soon. Follow the repo for updates.
        <a href={GITHUB_REPO_URL} rel="noopener noreferrer" target="_blank">Open on GitHub →</a>
      </p>
    {:else}
      <ul class="changelog-list">
        {#each data.releases as release, i}
          <li class="changelog-item">
            <article class="changelog-release" aria-labelledby="release-title-{i}">
              <header class="changelog-release-header">
                <h2 id="release-title-{i}" class="changelog-release-title">
                  <a href={release.url} rel="noopener noreferrer" target="_blank">{release.name}</a>
                </h2>
                <p class="changelog-release-meta">
                  <span class="changelog-tag">{release.tag}</span>
                  <span class="changelog-date">{release.publishedLabel}</span>
                </p>
              </header>
              {#if release.bodyHtml}
                <div class="changelog-body">{@html release.bodyHtml}</div>
              {/if}
            </article>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</SuiteMarketingLayout>

<style>
  .changelog-page {
    max-width: var(--rm-container-narrow);
  }
  .doc-tagline {
    font-size: var(--text-lg);
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
    line-height: var(--leading-relaxed);
  }
  .doc-tagline a {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .changelog-page h1 {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    color: var(--rm-text);
    margin: 0 0 var(--space-4);
  }
  .changelog-empty {
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-6);
    font-size: var(--text-base);
  }
  .changelog-empty a {
    display: inline-block;
    margin-top: var(--space-3);
    color: var(--rm-sage);
    font-weight: var(--font-medium);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .changelog-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
  }
  .changelog-item {
    margin: 0;
  }
  .changelog-release-header {
    margin-bottom: var(--space-4);
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--rm-border);
  }
  .changelog-release-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    margin: 0 0 var(--space-2);
    line-height: var(--leading-snug);
  }
  .changelog-release-title a {
    color: var(--rm-text);
    text-decoration: none;
  }
  .changelog-release-title a:hover {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .changelog-release-meta {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--text-sm);
    color: var(--rm-dim);
  }
  .changelog-tag {
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    padding: 0.15rem 0.45rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--rm-border);
    background: var(--rm-surface-raised);
    color: var(--rm-muted);
  }
  .changelog-date {
    font-variant-numeric: tabular-nums;
  }

  /* Markdown body — align with keys/docs .doc-content prose */
  .changelog-body :global(p) {
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-4);
  }
  .changelog-body :global(p:last-child) {
    margin-bottom: 0;
  }
  .changelog-body :global(ul),
  .changelog-body :global(ol) {
    margin: 0 0 var(--space-4);
    padding-left: var(--space-5);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .changelog-body :global(li) {
    margin-bottom: var(--space-2);
  }
  .changelog-body :global(h2),
  .changelog-body :global(h3),
  .changelog-body :global(h4) {
    font-family: var(--rm-font-display);
    color: var(--rm-text);
    margin: var(--space-6) 0 var(--space-3);
    line-height: var(--leading-snug);
  }
  .changelog-body :global(h2) {
    font-size: var(--text-lg);
  }
  .changelog-body :global(h3) {
    font-size: var(--text-base);
  }
  .changelog-body :global(h4) {
    font-size: var(--text-sm);
  }
  .changelog-body :global(a) {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .changelog-body :global(code) {
    font-family: var(--rm-font-ui);
    font-size: 0.9em;
    padding: 0.1em 0.35em;
    border-radius: 4px;
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
  }
  .changelog-body :global(pre) {
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    overflow-x: auto;
    border-radius: var(--radius-md);
    border: 1px solid var(--rm-border);
    background: var(--rm-surface-raised);
    font-size: var(--text-sm);
  }
  .changelog-body :global(pre code) {
    padding: 0;
    border: 0;
    background: transparent;
    font-size: inherit;
  }
  .changelog-body :global(blockquote) {
    margin: 0 0 var(--space-4);
    padding-left: var(--space-4);
    border-left: 3px solid color-mix(in oklab, var(--rm-sage) 45%, var(--rm-border));
    color: var(--rm-muted);
  }
  .changelog-body :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 var(--space-4);
    font-size: var(--text-sm);
  }
  .changelog-body :global(th),
  .changelog-body :global(td) {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rm-border);
    text-align: left;
  }
  .changelog-body :global(th) {
    background: var(--rm-surface-raised);
    color: var(--rm-text);
    font-weight: var(--font-medium);
  }
  .changelog-body :global(td) {
    color: var(--rm-muted);
  }
  .changelog-body :global(hr) {
    border: 0;
    border-top: 1px solid var(--rm-border);
    margin: var(--space-6) 0;
  }
</style>
