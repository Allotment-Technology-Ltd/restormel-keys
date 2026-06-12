<script lang="ts">
  import BrutalLoadingState from "$lib/components/brutalist/BrutalLoadingState.svelte";

  export let variant: "hub" | "models" | "pipeline" | "mcp" | "ingest" | "proof" | "default" = "default";

  const copy: Record<typeof variant, { message: string; rows: number }> = {
    hub: { message: "Loading your workspace…", rows: 0 },
    models: { message: "Loading ingest routes — stage models and recommendations", rows: 4 },
    pipeline: { message: "Loading pipeline setup — store, sources, and run defaults", rows: 4 },
    mcp: { message: "Loading agent setup — gateway keys and MCP snippets", rows: 3 },
    ingest: { message: "Loading ingest runs", rows: 4 },
    proof: { message: "Loading Proof — pitting the raw model against your graph", rows: 4 },
    default: { message: "Loading Connect", rows: 3 },
  };

  $: meta = copy[variant] ?? copy.default;
</script>

<div class="connect-page-skeleton" aria-busy="true">
  {#if variant === "hub"}
    <p class="hub-skeleton-label" role="status" aria-live="polite">{meta.message}</p>
    <div class="hub-skeleton" aria-hidden="true">
      <div class="hub-skeleton-cap skeleton"></div>
      <div class="hub-skeleton-body">
        <div class="hub-skeleton-pulse">
          <div class="hub-skeleton-trust skeleton"></div>
          <div class="hub-skeleton-stats">
            {#each Array(4) as _, i (i)}
              <div class="hub-skeleton-stat skeleton"></div>
            {/each}
          </div>
          <div class="hub-skeleton-pulse-footer">
            <div class="hub-skeleton-bar skeleton" style="width: 100px"></div>
            <div class="hub-skeleton-bar skeleton" style="width: 100px"></div>
            <div class="hub-skeleton-bar skeleton" style="width: 140px; height: 48px"></div>
            <div class="hub-skeleton-bar skeleton" style="width: 180px"></div>
          </div>
        </div>
        <div class="hub-skeleton-section-label skeleton"></div>
        <div class="hub-skeleton-rails">
          {#each Array(5) as _, i (i)}
            <div class="hub-skeleton-rail skeleton"></div>
          {/each}
        </div>
        <div class="hub-skeleton-checklist-label skeleton"></div>
        {#each Array(3) as _, i (i)}
          <div class="hub-skeleton-checklist-row skeleton"></div>
        {/each}
      </div>
    </div>
  {:else}
    <BrutalLoadingState message={meta.message} rows={meta.rows} />
  {/if}
</div>

<style>
  .connect-page-skeleton {
    min-height: 12rem;
  }

  .hub-skeleton-label {
    margin: 0 0 var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-faint);
  }

  .hub-skeleton {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .hub-skeleton-cap {
    height: 5rem;
    border: var(--border);
    box-shadow: var(--shadow-lg);
  }

  .hub-skeleton-body {
    margin-top: -4px;
    margin-left: 4px;
    border: var(--border);
    box-shadow: 8px 8px 0 0 var(--color-ink);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    background: var(--color-surface);
  }

  .hub-skeleton-pulse {
    display: grid;
    grid-template-columns: minmax(5rem, 1fr) repeat(4, minmax(0, 1fr));
    grid-template-rows: auto auto;
    gap: 0;
    border: var(--border);
    overflow: hidden;
  }

  @media (max-width: 720px) {
    .hub-skeleton-pulse {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .hub-skeleton-trust {
      grid-column: 1 / -1;
    }
    .hub-skeleton-pulse-footer {
      grid-column: 1 / -1;
    }
  }

  .hub-skeleton-trust {
    grid-row: 1 / span 2;
    min-height: 8rem;
    border-right: var(--border-thin);
  }

  .hub-skeleton-stats {
    display: contents;
  }

  .hub-skeleton-stat {
    min-height: 4.5rem;
    border-right: var(--border-thin);
    border-bottom: var(--border-thin);
  }

  .hub-skeleton-pulse-footer {
    grid-column: 2 / -1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    min-height: 3.5rem;
  }

  .hub-skeleton-bar {
    height: 1.25rem;
    min-width: 4rem;
  }

  .hub-skeleton-section-label {
    width: 10rem;
    height: 0.875rem;
  }

  .hub-skeleton-rails {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0;
    border: var(--border);
  }

  .hub-skeleton-rail {
    aspect-ratio: 1;
    min-height: 4rem;
    border-right: var(--border-thin);
  }

  .hub-skeleton-rail:last-child {
    border-right: none;
  }

  .hub-skeleton-checklist-label {
    width: 10rem;
    height: 0.875rem;
  }

  .hub-skeleton-checklist-row {
    height: 2.75rem;
    width: 100%;
  }

  .skeleton {
    background: linear-gradient(
      90deg,
      var(--color-bg-deep) 25%,
      color-mix(in oklab, var(--color-bg-deep) 85%, var(--color-surface)) 50%,
      var(--color-bg-deep) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.4s ease-in-out infinite;
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton {
      animation: none;
      background: var(--color-bg-deep);
    }
  }
</style>
