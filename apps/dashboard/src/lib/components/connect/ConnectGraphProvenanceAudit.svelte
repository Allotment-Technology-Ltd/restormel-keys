<script lang="ts">
  import type { ProvenanceAuditView } from "$lib/connect/graph-provenance-audit-types";

  export let audit: ProvenanceAuditView | null = null;
  export let loading = false;
  export let error: string | null = null;
  /** Collapsed by default — progressive disclosure per neu-brutalist skill. */
  export let open = false;

  function formatCompactCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (n >= 10_000) return `${Math.round(n / 1000)}k`;
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    return n.toLocaleString();
  }

  type AuditTile = {
    key: string;
    value: number;
    label: string;
    tone: "ok" | "alert" | "neutral";
  };

  $: tiles = audit
    ? ([
        {
          key: "linked",
          value: audit.graphLinked,
          label: "Graph-linked",
          tone: audit.graphLinked > 0 ? "ok" : "neutral",
        },
        {
          key: "unlinked",
          value: audit.unlinked,
          label: "No source edge",
          tone: audit.unlinked > 0 ? "alert" : "ok",
        },
        {
          key: "legacy",
          value: audit.legacyPlaceholder,
          label: "Legacy placeholder",
          tone: audit.legacyPlaceholder > 0 ? "alert" : "ok",
        },
        {
          key: "catalog",
          value: audit.pipelineCatalogSources,
          label: "Pipeline catalog",
          tone: audit.pipelineCatalogSources > 0 ? "ok" : "neutral",
        },
      ] satisfies AuditTile[])
    : [];
</script>

<details class="prov-audit" bind:open>
  <summary class="prov-audit-summary brut-focus">
    <span class="prov-audit-kicker">Provenance audit</span>
    {#if loading}
      <span class="prov-audit-status brut-muted">Refreshing…</span>
    {:else if audit}
      <span
        class="prov-audit-status"
        class:prov-audit-status-ok={audit.verdict === "native"}
        class:prov-audit-status-alert={audit.verdict === "needs_edge_repair"}
      >
        {audit.verdict === "native"
          ? "Graph-native"
          : audit.verdict === "needs_edge_repair"
            ? "Repair needed"
            : audit.verdict === "unknown"
              ? "Count unavailable"
              : "—"}
      </span>
    {/if}
  </summary>

  <div class="prov-audit-body">
    {#if error}
      <p class="prov-audit-error" role="status">{error}</p>
    {:else if loading && !audit}
      <p class="prov-audit-lede brut-muted" role="status">Loading Surreal provenance counts…</p>
    {:else if audit}
      <p class="prov-audit-lede" role="status">{audit.headline}</p>

      {#if tiles.length > 0}
        <div class="prov-audit-tiles" aria-label="Provenance breakdown">
          {#each tiles as tile (tile.key)}
            <article
              class="prov-audit-tile"
              class:prov-audit-tile-ok={tile.tone === "ok" && tile.value > 0}
              class:prov-audit-tile-alert={tile.tone === "alert" && tile.value > 0}
            >
              <span class="prov-audit-tile-num" title="{tile.value.toLocaleString()} {tile.label}">
                {formatCompactCount(tile.value)}
              </span>
              <span class="prov-audit-tile-label">{tile.label}</span>
            </article>
          {/each}
        </div>
      {/if}

      <p class="prov-audit-note brut-muted">
        {#if audit.store === "surreal"}
          Validation resolves text from <code class="prov-audit-code">idea → source → passage</code> in
          Surreal. “Find sources” only repairs missing or legacy edges — not ideas already graph-linked.
        {:else}
          Ideas point at Postgres bibliographic sources. Import pipeline catalog text before validation.
        {/if}
      </p>
    {/if}
  </div>
</details>

<style>
  .prov-audit {
    margin: 0 0 var(--space-3);
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
    border-radius: 0;
  }

  .prov-audit-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
    list-style: none;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    background: color-mix(in oklab, var(--color-bg) 55%, var(--brut-white));
    border-bottom: var(--brut-border-micro) solid transparent;
  }

  .prov-audit[open] .prov-audit-summary {
    border-bottom-color: var(--brut-ink);
  }

  .prov-audit-summary::-webkit-details-marker {
    display: none;
  }

  .prov-audit-kicker {
    color: var(--color-ink);
  }

  .prov-audit-status {
    font-size: var(--text-mono-xs, var(--text-xs));
    letter-spacing: 0.04em;
    padding: 0.15rem 0.45rem;
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
  }

  .prov-audit-status-ok {
    background: color-mix(in oklab, var(--color-sage, #c8e6c9) 35%, var(--brut-white));
  }

  .prov-audit-status-alert {
    background: color-mix(in oklab, var(--color-yellow) 45%, var(--brut-white));
  }

  .prov-audit-body {
    padding: var(--space-3);
  }

  .prov-audit-lede {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    line-height: 1.45;
  }

  .prov-audit-error {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-error, #8b0000);
  }

  .prov-audit-tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .prov-audit-tile {
    padding: var(--space-2);
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-height: 3.25rem;
  }

  .prov-audit-tile-ok {
    border-color: color-mix(in oklab, var(--color-sage, #4a7c59) 55%, var(--brut-ink));
  }

  .prov-audit-tile-alert {
    background: color-mix(in oklab, var(--color-yellow) 22%, var(--brut-white));
  }

  .prov-audit-tile-num {
    font-family: var(--font-display, var(--font-sans));
    font-size: var(--text-lg);
    font-weight: 800;
    line-height: 1;
    color: var(--color-ink);
  }

  .prov-audit-tile-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-xs, 0.65rem);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: color-mix(in oklab, var(--color-ink) 68%, transparent);
  }

  .prov-audit-note {
    margin: 0;
    font-size: var(--text-xs);
    line-height: 1.5;
  }

  .prov-audit-code {
    font-family: var(--font-mono);
    font-size: 0.95em;
    padding: 0 0.2em;
    border: 1px solid color-mix(in oklab, var(--color-ink) 25%, transparent);
    background: var(--color-bg);
  }
</style>
