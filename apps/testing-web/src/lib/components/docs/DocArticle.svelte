<script lang="ts">
  import type { Snippet } from "svelte";
  import { githubRepoUrl } from "$lib/site";

  let {
    title,
    description,
    stub = true,
    children,
  }: {
    title: string;
    description?: string;
    stub?: boolean;
    children?: Snippet;
  } = $props();
</script>

<svelte:head>
  <title>{title} — Restormel Testing docs</title>
</svelte:head>

<article class="doc-article">
  <h1>{title}</h1>
  {#if stub}
    <p class="doc-banner" role="status">
      Stub page — authoritative drafts and specs still live in the
      <a href="{githubRepoUrl}/tree/main/docs" rel="noopener noreferrer">repo</a>
      <code class="doc-code-inline">docs/</code> folder until this page is expanded.
    </p>
  {/if}
  {#if description}
    <p class="doc-lede">{description}</p>
  {/if}
  {#if children}
    {@render children()}
  {/if}
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
</style>
