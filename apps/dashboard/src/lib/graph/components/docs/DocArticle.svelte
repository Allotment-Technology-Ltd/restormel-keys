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
    font-family: var(--font-display);
    font-size: clamp(1.75rem, 3vw, 2.25rem);
    font-weight: 900;
    letter-spacing: var(--text-display-tracking);
    text-transform: uppercase;
    color: var(--color-ink);
    margin: 0 0 var(--space-6);
    line-height: 1.05;
  }

  .doc-banner {
    font-size: var(--text-body-sm);
    line-height: var(--text-body-line-height);
    color: var(--color-ink-muted);
    margin: 0 0 var(--space-6);
    padding: var(--space-4);
    background: var(--color-surface);
    border: var(--border);
    border-left-width: 6px;
    border-left-color: var(--color-yellow);
    border-radius: 0;
  }

  .doc-banner a {
    color: var(--color-ink);
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .doc-banner a:hover {
    background: var(--color-yellow);
  }

  .doc-code-inline {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    padding: 0.08rem 0.35rem;
    border: var(--border-thin);
    background: var(--color-yellow);
    color: var(--color-ink);
  }

  .doc-lede {
    font-size: var(--text-body-md);
    line-height: var(--text-body-line-height);
    color: var(--color-ink-muted);
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

  :global(.doc-article .doc-prose ol) {
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
