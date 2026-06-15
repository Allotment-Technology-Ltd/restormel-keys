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
  <title>{data.title} — Restormel</title>
  <meta name="description" content={`${data.title} (Restormel / Allotment Technology Ltd). Effective ${fmtDate(data.effectiveDate)}.`} />
</svelte:head>

<article class="legal-doc">
  <nav class="crumb"><a href="/legal">← Legal</a></nav>
  <h1>{data.title}</h1>
  <p class="meta"><strong>Allotment Technology Ltd</strong> · Effective {fmtDate(data.effectiveDate)}</p>

  <!-- Body is rendered server-side from the public record markdown (html disabled in the renderer). -->
  <div class="body">{@html data.html}</div>

  {#if data.versions.length}
    <section class="versions" aria-label="Version history">
      <h2>Version history</h2>
      <ul>
        {#each data.versions as v (v.date + (v.sha ?? ""))}
          <li>
            <time datetime={v.date}>{fmtDate(v.date)}</time>
            {#if v.note}<span class="note">— {v.note}</span>{/if}
            {#if v.sha}<code class="sha">{v.sha}</code>{/if}
          </li>
        {/each}
      </ul>
      <p class="provenance">Versions derive from this document's <code>supersedes</code> lineage and git commit history.</p>
    </section>
  {/if}
</article>

<style>
  .legal-doc {
    max-width: 48rem;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 4rem;
  }
  .crumb {
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }
  .meta {
    color: var(--rm-text-muted, #555);
    margin-bottom: 1.5rem;
  }
  .body :global(h2) {
    margin-top: 2rem;
  }
  .versions {
    margin-top: 3rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--rm-border, #e2e2e2);
  }
  .versions ul {
    list-style: none;
    padding: 0;
  }
  .versions li {
    padding: 0.4rem 0;
    font-size: 0.95rem;
  }
  .versions time {
    font-weight: 600;
  }
  .note {
    color: var(--rm-text-muted, #666);
  }
  .sha {
    margin-left: 0.5rem;
    font-size: 0.8rem;
    color: var(--rm-text-muted, #888);
  }
  .provenance {
    font-size: 0.8rem;
    color: var(--rm-text-muted, #888);
    margin-top: 1rem;
  }
</style>
