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
  <title>Sub-processors — Restormel</title>
  <meta name="description" content="Restormel sub-processors (Allotment Technology Ltd): who we use, what they provide, and where they are located." />
</svelte:head>

<article class="legal-doc">
  <nav class="crumb"><a href="/legal">← Legal</a></nav>
  <h1>{data.title}</h1>
  <p class="meta"><strong>Allotment Technology Ltd</strong> · Effective {fmtDate(data.effectiveDate)}</p>

  <div class="body">{@html data.introHtml}</div>

  {#if data.subprocessors.length}
    <table class="subs">
      <thead>
        <tr><th>Sub-processor</th><th>Provides</th><th>Role</th><th>Location</th></tr>
      </thead>
      <tbody>
        {#each data.subprocessors as s (s.name)}
          <tr>
            <td>{s.name}</td>
            <td>{s.provides}</td>
            <td>{s.role}</td>
            <td>{s.location}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p class="empty">No sub-processors are currently listed.</p>
  {/if}

  {#if data.versions.length}
    <section class="versions" aria-label="Version history">
      <h2>Change history</h2>
      <ul>
        {#each data.versions as v (v.date + (v.sha ?? ""))}
          <li><time datetime={v.date}>{fmtDate(v.date)}</time>{#if v.sha}<code class="sha">{v.sha}</code>{/if}</li>
        {/each}
      </ul>
    </section>
  {/if}
</article>

<style>
  .legal-doc {
    max-width: 52rem;
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
  .subs {
    width: 100%;
    border-collapse: collapse;
    margin: 1.5rem 0;
    font-size: 0.92rem;
  }
  .subs th,
  .subs td {
    text-align: left;
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid var(--rm-border, #ececec);
    vertical-align: top;
  }
  .subs th {
    font-weight: 600;
    border-bottom: 2px solid var(--rm-border, #ddd);
  }
  .empty {
    color: var(--rm-text-muted, #555);
  }
  .versions {
    margin-top: 2.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--rm-border, #e2e2e2);
  }
  .versions ul {
    list-style: none;
    padding: 0;
  }
  .versions li {
    padding: 0.3rem 0;
    font-size: 0.9rem;
  }
  .versions time {
    font-weight: 600;
  }
  .sha {
    margin-left: 0.5rem;
    font-size: 0.8rem;
    color: var(--rm-text-muted, #888);
  }
</style>
