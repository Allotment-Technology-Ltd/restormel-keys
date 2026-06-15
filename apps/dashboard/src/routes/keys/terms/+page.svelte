<script lang="ts">
  // Legacy `export let` (not `$props`) — dashboard uses `compilerOptions.runes: false`.
  import type { PageData } from "./$types";

  export let data: PageData;

  function fmtDate(d: string): string {
    if (!d) return "—";
    const t = new Date(`${d}T00:00:00Z`).getTime();
    return Number.isNaN(t)
      ? d
      : new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  }
</script>

<svelte:head>
  <title>Terms of Service — Restormel Keys</title>
  <meta
    name="description"
    content="Terms of service for Restormel Keys (Allotment Technology Ltd). Subscription terms, acceptable use, and refund policy."
  />
</svelte:head>

<div class="legal">
  <h1>{data.title}</h1>
  <p class="meta"><strong>Allotment Technology Ltd</strong> · Effective {fmtDate(data.effectiveDate)}</p>
  <div class="body">{@html data.html}</div>
</div>

<style>
  .legal {
    max-width: var(--rm-container-narrow);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }
  h1 {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    margin: 0 0 var(--space-2);
    color: var(--rm-text);
  }
  .meta {
    margin: 0 0 var(--space-6);
    color: var(--rm-dim);
    font-size: var(--text-sm);
  }
  .body :global(h2) {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    margin: var(--space-8) 0 var(--space-3);
    color: var(--rm-text);
  }
  .body :global(h3) {
    font-size: var(--text-base);
    margin: var(--space-5) 0 var(--space-2);
    color: var(--rm-text);
  }
  .body :global(p),
  .body :global(li) {
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-3);
  }
  .body :global(ul) {
    margin: 0 0 var(--space-4);
    padding-left: var(--space-5);
  }
  .body :global(a) {
    color: var(--rm-sage);
    text-decoration: none;
  }
  .body :global(a:hover) {
    text-decoration: underline;
  }
</style>
