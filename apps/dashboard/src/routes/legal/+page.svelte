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
  <title>Legal — Restormel</title>
  <meta name="description" content="Published legal documents for Restormel (Allotment Technology Ltd), with effective dates and version history." />
</svelte:head>

<div class="legal-index">
  <h1>Legal</h1>
  <p class="lede">
    Published legal documents. Each shows its effective date and full version history. Only documents
    classified <code>public</code> appear here.
  </p>

  {#if data.records.length === 0}
    <p class="empty">No published legal documents yet.</p>
  {:else}
    <ul class="doc-list">
      {#each data.records as rec (rec.slug)}
        <li>
          <a href={`/legal/${rec.slug}`}>{rec.title}</a>
          <span class="meta">
            Effective {fmtDate(rec.effectiveDate)}
            {#if rec.versionCount > 1}· {rec.versionCount} versions{/if}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .legal-index {
    max-width: 48rem;
    margin: 0 auto;
    padding: 2rem 1.25rem 4rem;
  }
  .lede {
    color: var(--rm-text-muted, #555);
  }
  .empty {
    padding: 1.25rem;
    border: 1px solid var(--rm-border, #e2e2e2);
    border-radius: 0.5rem;
    color: var(--rm-text-muted, #555);
  }
  .doc-list {
    list-style: none;
    padding: 0;
  }
  .doc-list li {
    padding: 0.85rem 0;
    border-bottom: 1px solid var(--rm-border, #ececec);
  }
  .doc-list a {
    font-weight: 600;
  }
  .meta {
    display: block;
    font-size: 0.85rem;
    color: var(--rm-text-muted, #666);
    margin-top: 0.15rem;
  }
</style>
