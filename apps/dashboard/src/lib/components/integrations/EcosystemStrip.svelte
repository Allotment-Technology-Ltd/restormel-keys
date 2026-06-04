<script lang="ts">
  /**
   * Compact stack compatibility rail — visual flow, not a catalog grid.
   * Uses {@link INTEGRATION_CATALOG}; filtered by suite module flags.
   */
  import { page } from "$app/stores";
  import {
    STACK_LAYER_ORDER,
    type IntegrationCatalogEntry,
    type StackLayer,
  } from "@restormel/aaif";
  import { integrationCatalogForFlags } from "$lib/integration-catalog-for-flags";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

  /** compact = legacy rail; diagram = suite landing stack flow (restormel_redesign.html) */
  export let variant: "full" | "compact" | "diagram" = "full";

  const maxPerLayerFull = 12;
  const maxPerLayerCompact = 6;

  const layerShort: Record<StackLayer, string> = {
    data: "Data",
    models: "Models",
    gateways: "Gateways",
    ship: "Ship",
  };

  $: flags = $page.data.moduleFlags ?? MVP_MODULE_DEFAULTS;
  $: catalogEntries = integrationCatalogForFlags(flags);
  $: cap = variant === "full" ? maxPerLayerFull : maxPerLayerCompact;
  $: isDiagram = variant === "diagram";

  function entriesForLayer(layer: StackLayer): IntegrationCatalogEntry[] {
    return catalogEntries.filter((e) => e.stackLayer === layer).slice(0, cap);
  }

  $: layerGroups = STACK_LAYER_ORDER.map((id) => ({
    id,
    label: layerShort[id],
    entries: entriesForLayer(id),
  })).filter((g) => g.entries.length > 0);

  $: flatChips = layerGroups.flatMap((g) => g.entries);
</script>

{#if flatChips.length > 0}
  <div class="stack-rail-outer" class:stack-rail-outer-diagram={isDiagram}>
  <section class="stack-rail" class:stack-rail-diagram={isDiagram} aria-labelledby="stack-rail-heading">
    <h2 id="stack-rail-heading" class="visually-hidden">Compatible with your stack</h2>

    <div class="stack-rail-track">
      <!-- Your stack -->
      <div class="stack-rail-cell stack-rail-stack">
        <p class="stack-rail-label">{isDiagram ? "Your stack" : "Your stack"}</p>
        {#if isDiagram}
          <p class="stack-rail-punch">What you already have</p>
          <ul class="stack-pills" aria-label="Compatible services">
            {#each flatChips as item (item.id)}
              <li>
                <a class="stack-pill" href={item.docsPath}>{item.label}</a>
              </li>
            {/each}
          </ul>
          <p class="stack-rail-note">Your keys. Your databases. Your providers.</p>
        {:else}
          <div class="stack-rail-chips" role="list" aria-label="Compatible services">
          {#each layerGroups as group (group.id)}
            <div class="stack-rail-group" role="presentation">
              <span class="stack-rail-group-tag">{group.label}</span>
              <ul class="stack-rail-group-list" role="list">
                {#each group.entries as item (item.id)}
                  <li role="listitem">
                    <a
                      class="stack-chip"
                      href={item.docsPath}
                      title={item.roleLabel ? `${item.label} — ${item.roleLabel}` : item.label}
                    >
                      {#if item.logoId}
                        <img
                          class="stack-chip-logo"
                          src="/integrations/brands/{item.logoId}.svg"
                          alt=""
                          width="16"
                          height="16"
                          loading="lazy"
                        />
                      {/if}
                      <span>{item.label}</span>
                    </a>
                  </li>
                {/each}
              </ul>
            </div>
          {/each}
        </div>
        {/if}
      </div>

      <div class="stack-rail-arrow" aria-hidden="true">
        <span class="stack-rail-arrow-glyph">→</span>
      </div>

      <!-- Restormel layer -->
      <div class="stack-rail-cell stack-rail-restormel">
        <p class="stack-rail-label">Restormel</p>
        <p class="stack-rail-punch">Control layer</p>
        {#if isDiagram}
          <div class="stack-pills stack-pills-capabilities" aria-label="Restormel capabilities">
            <span class="stack-pill stack-pill-route">Route</span>
            <span class="stack-pill stack-pill-ingest">Ingest</span>
            <span class="stack-pill stack-pill-ingest">Retrieve</span>
            <span class="stack-pill stack-pill-ingest">Verify</span>
          </div>
          <p class="stack-rail-note light">Signed-in workspace. Domain schemas. BYOK custody.</p>
        {:else}
          <p class="stack-rail-sub">Route · ingest · verify</p>
        {/if}
      </div>

      <div class="stack-rail-arrow" aria-hidden="true">
        <span class="stack-rail-arrow-glyph">→</span>
      </div>

      <!-- Outcome -->
      <div class="stack-rail-cell stack-rail-outcome">
        <p class="stack-rail-label">Your product</p>
        <p class="stack-rail-punch">Grounded agents</p>
        {#if isDiagram}
          <div class="stack-pills stack-pills-outcome" aria-label="Product outcomes">
            <span class="stack-pill">Cited answers</span>
            <span class="stack-pill">Your keys</span>
            <span class="stack-pill">Verified graphs</span>
          </div>
          <p class="stack-rail-note stack-rail-note-outcome">
            AI products that earn trust by showing their reasoning.
          </p>
        {:else}
          <p class="stack-rail-sub">Cited answers, your keys</p>
        {/if}
      </div>
    </div>

    {#if !isDiagram && flatChips.length > 0}
      <p class="stack-rail-foot">
        <span class="stack-rail-foot-note">No rip-and-replace — keep Neon, SurrealDB, and your providers.</span>
      </p>
    {/if}
  </section>
  </div>
{/if}

<style>
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .stack-rail {
    margin: var(--space-6) 0;
    border: var(--brut-border-width, 3px) solid var(--brut-ink, var(--rm-text));
    background: var(--brut-white, var(--rm-surface-raised));
    box-shadow: var(--brut-shadow, 4px 4px 0 var(--brut-ink, var(--rm-text)));
    overflow: hidden;
  }

  .stack-rail-track {
    display: grid;
    grid-template-columns: 1fr;
  }

  @media (min-width: 52rem) {
    .stack-rail-track {
      grid-template-columns: minmax(0, 2.2fr) auto minmax(0, 0.9fr) auto minmax(0, 0.9fr);
      align-items: stretch;
    }
  }

  .stack-rail-cell {
    padding: var(--space-3) var(--space-4);
    min-height: 5.5rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-1);
  }

  .stack-rail-stack {
    background: var(--brut-canvas, var(--rm-bg));
    border-bottom: var(--brut-border-micro, 1px) solid var(--brut-ink, var(--rm-border));
  }

  @media (min-width: 52rem) {
    .stack-rail-stack {
      border-bottom: 0;
      border-right: var(--brut-border-micro, 1px) solid var(--brut-ink, var(--rm-border));
    }
  }

  .stack-rail-restormel {
    background: var(--color-surface);
    border-bottom: var(--border-thin);
  }

  @media (min-width: 52rem) {
    .stack-rail-restormel {
      border-bottom: 0;
      border-right: var(--brut-border-micro, 1px) solid var(--brut-ink, var(--rm-border));
    }
  }

  .stack-rail-outcome {
    background: var(--color-yellow);
  }

  .stack-rail-label {
    margin: 0;
    font-size: 0.625rem;
    font-weight: 900;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--rm-dim);
  }

  .stack-rail-punch {
    margin: 0;
    font-family: var(--rm-font-display, var(--brut-font));
    font-size: var(--text-base);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: -0.02em;
    line-height: 1.1;
    color: var(--brut-ink, var(--rm-text));
  }

  .stack-rail-sub {
    margin: 0;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--rm-muted);
    line-height: 1.3;
  }

  .stack-rail-arrow {
    display: none;
  }

  @media (min-width: 52rem) {
    .stack-rail-arrow {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 var(--space-1);
      background: var(--brut-white, var(--rm-surface-raised));
      border-right: var(--brut-border-micro, 1px) solid var(--brut-ink, var(--rm-border));
    }
  }

  .stack-rail-arrow-glyph {
    font-size: var(--text-xl);
    font-weight: 900;
    line-height: 1;
    color: var(--brut-ink, var(--rm-text));
  }

  .stack-rail-chips {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--space-2) var(--space-3);
    margin-top: var(--space-1);
  }

  .stack-rail-group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-2);
  }

  .stack-rail-group-tag {
    flex: 0 0 auto;
    padding: 0.125rem 0.375rem;
    font-size: 0.5625rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border: var(--brut-border-micro, 1px) solid var(--brut-ink, var(--rm-text));
    background: var(--brut-white, var(--rm-surface));
    color: var(--brut-ink, var(--rm-text));
  }

  .stack-rail-group-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .stack-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.5rem;
    min-height: 2rem;
    border: var(--brut-border-micro, 1px) solid var(--brut-ink, var(--rm-border));
    background: var(--brut-white, var(--rm-surface-raised));
    color: var(--brut-ink, var(--rm-text));
    font-size: 0.6875rem;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
    box-shadow: 2px 2px 0 var(--brut-ink, var(--rm-text));
    transition:
      transform 0.1s ease,
      box-shadow 0.1s ease;
  }

  .stack-chip:hover {
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 var(--brut-ink, var(--rm-text));
    background: var(--brut-neon, var(--rm-surface-raised));
  }

  .stack-chip:focus-visible {
    outline: 2px solid var(--brut-ink, var(--rm-sage));
    outline-offset: 2px;
  }

  .stack-chip-logo {
    width: 1rem;
    height: 1rem;
    object-fit: contain;
    flex-shrink: 0;
  }

  .stack-rail-foot {
    margin: 0;
    padding: var(--space-2) var(--space-4);
    border-top: var(--brut-border-micro, 1px) solid var(--brut-ink, var(--rm-border));
    background: var(--brut-white, var(--rm-surface-raised));
  }

  .stack-rail-foot-note {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--rm-muted);
  }

  /* ── Diagram variant (suite landing) ── */
  .stack-rail-diagram {
    margin: 0;
    box-shadow: var(--shadow-md);
    border: var(--border);
  }

  .stack-rail-diagram .stack-rail-cell {
    padding: 1.5rem 1.25rem;
    min-height: 0;
    justify-content: flex-start;
  }

  .stack-rail-diagram .stack-rail-label {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.14em;
    margin-bottom: 0.75rem;
  }

  .stack-rail-diagram .stack-rail-punch {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 900;
    text-transform: uppercase;
    line-height: 1.2;
    letter-spacing: 0.01em;
    margin: 0 0 0.75rem;
    -webkit-font-smoothing: antialiased;
  }

  @media (min-width: 52rem) {
    .stack-rail-diagram .stack-rail-track {
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
    }
  }

  .stack-rail-diagram .stack-rail-restormel {
    background: var(--color-ink);
    color: var(--color-surface);
  }

  .stack-rail-diagram .stack-rail-restormel .stack-rail-label {
    color: #888888;
  }

  .stack-rail-diagram .stack-rail-restormel .stack-rail-punch {
    color: var(--color-yellow);
  }

  .stack-rail-diagram .stack-rail-outcome .stack-rail-label {
    color: #6a5800;
  }

  .stack-rail-diagram .stack-rail-outcome .stack-rail-punch {
    color: var(--color-ink);
  }

  .stack-rail-diagram .stack-rail-arrow {
    background: var(--color-yellow);
    border-right: var(--border);
    min-width: 2.25rem;
    padding: 0 0.625rem;
  }

  .stack-rail-diagram .stack-rail-stack,
  .stack-rail-diagram .stack-rail-restormel,
  .stack-rail-diagram .stack-rail-outcome {
    border-bottom: var(--border);
    border-right: none;
  }

  @media (min-width: 52rem) {
    .stack-rail-diagram .stack-rail-stack,
    .stack-rail-diagram .stack-rail-restormel {
      border-bottom: none;
      border-right: var(--border);
    }
  }

  .stack-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin: 0.5rem 0;
    list-style: none;
    padding: 0;
  }

  .stack-pill {
    display: inline-flex;
    align-items: center;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    border: 1.5px solid currentColor;
    padding: 2px 7px;
    letter-spacing: 0.04em;
    text-decoration: none;
    color: inherit;
    background: transparent;
  }

  .stack-pill:hover {
    background: var(--color-yellow);
    color: var(--color-ink);
  }

  .stack-pill-route {
    border-color: var(--color-yellow);
    color: var(--color-yellow);
  }

  .stack-rail-diagram .stack-pill-ingest {
    border-color: #7ecba8;
    color: #7ecba8;
  }

  .stack-rail-note {
    font-size: 12px;
    color: var(--color-ink-faint);
    line-height: 1.5;
    margin: 0.5rem 0 0;
  }

  .stack-rail-note.light {
    color: #aaaaaa;
  }

  .stack-rail-note-outcome {
    color: #5a4800;
  }

  .stack-rail-outer-diagram {
    margin-top: 2.5rem;
  }
</style>
