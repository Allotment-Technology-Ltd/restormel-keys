<script lang="ts">
  import { GITHUB_REPO_URL } from "$lib/site-nav";

  export let title: string;
  export let description: string | undefined = undefined;
  export let stub = false;
</script>

<svelte:head>
  <title>{title} — Restormel Graph docs</title>
</svelte:head>

<article class="doc-article">
  <h1>{title}</h1>
  {#if stub}
    <p class="doc-banner" role="status">
      Stub page — expand from the canonical integration guide or repo
      <a href={GITHUB_REPO_URL} rel="noopener noreferrer">restormel-keys</a>
      <code class="doc-code-inline">packages/graph-core</code> /
      <code class="doc-code-inline">packages/ui-graph-svelte</code>.
    </p>
  {/if}
  {#if description}
    <p class="doc-lede">{description}</p>
  {/if}
  <slot />
</article>

<style>
  .doc-article {
    max-width: var(--rm-reading-width);
    padding-bottom: var(--space-12);
  }

  .doc-article h1 {
    font-family: var(--rm-font-display);
    font-size: var(--text-3xl);
    font-weight: var(--font-semibold);
    letter-spacing: var(--tracking-tight);
    color: var(--rm-text);
    margin: 0 0 var(--space-6);
    line-height: var(--leading-tight);
  }

  .doc-banner {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
    padding: var(--space-4);
    background: var(--rm-surface);
    border: var(--border-1) solid var(--rm-border);
    border-radius: var(--rm-card-radius);
    border-left: var(--border-4) solid var(--rm-sage);
  }

  .doc-banner a {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .doc-banner a:hover {
    color: var(--signal-teal-hover);
  }

  .doc-code-inline {
    font-size: 0.9em;
    color: var(--rm-text);
  }

  .doc-lede {
    font-family: var(--rm-font-ui);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
  }

  :global(.doc-article .doc-prose) {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
  }

  :global(.doc-article .doc-prose p) {
    margin: 0 0 var(--space-4);
  }

  :global(.doc-article .doc-prose ul) {
    margin: 0 0 var(--space-4);
    padding-left: var(--space-6);
  }

  :global(.doc-article .doc-prose li) {
    margin-bottom: var(--space-2);
  }

  :global(.doc-article .doc-prose strong) {
    color: var(--rm-text);
    font-weight: var(--font-semibold);
  }

  :global(.doc-article .doc-prose a) {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  :global(.doc-article .doc-prose a:hover) {
    color: var(--signal-teal-hover);
  }

  :global(.doc-article .doc-prose code) {
    font-size: 0.9em;
    color: var(--rm-text);
  }

  :global(.doc-article .doc-prose pre) {
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    padding: var(--space-4);
    background: var(--rm-surface);
    border: var(--border-1) solid var(--rm-border);
    border-radius: var(--rm-radius);
    overflow-x: auto;
    margin: 0 0 var(--space-4);
  }

  :global(.doc-article .doc-prose h2) {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: var(--space-10) 0 var(--space-4);
    line-height: var(--leading-tight);
  }

  :global(.doc-article .doc-prose h3) {
    font-family: var(--rm-font-ui);
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: var(--space-8) 0 var(--space-3);
  }

  :global(.doc-article .doc-prose table) {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-xs);
    margin: 0 0 var(--space-4);
  }

  :global(.doc-article .doc-prose th),
  :global(.doc-article .doc-prose td) {
    border: 1px solid var(--rm-border);
    padding: var(--space-2) var(--space-3);
    text-align: left;
    vertical-align: top;
  }

  :global(.doc-article .doc-prose th) {
    background: var(--rm-surface-2);
    color: var(--rm-text);
    font-weight: var(--font-semibold);
  }
</style>
