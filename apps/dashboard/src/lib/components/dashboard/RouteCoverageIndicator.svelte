<script lang="ts">
  /**
   * Versioned-config intelligence (Stage W3.5) — route-coverage indicator.
   *
   * A small, honest indicator over the existing project `route-coverage`
   * endpoint (`api/projects/{id}/route-coverage`). It quotes the endpoint's own
   * numbers verbatim — route count, routes with zero enabled steps, and the
   * per-environment workload×stage coverage — and links back to the routes it
   * summarizes (rubric X4). It is an indicator, not a dashboard: a headline
   * status plus the one actionable number, with the full matrix behind a toggle.
   *
   * docs/ux-contracts.md §3 state model: loading / error / empty / success.
   */
  import BrutalLoadingState from "$lib/components/brutalist/BrutalLoadingState.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";

  /** GET URL for the project's route-coverage endpoint. */
  export let coverageUrl: string;
  /** In-page anchor / href the indicator links to (the routes it summarizes). */
  export let routesHref: string;
  /** Optional map of environmentId → display name for the matrix. */
  export let environmentName: ((environmentId: string) => string) | undefined = undefined;

  type Cell = {
    workload: string;
    stage: string;
    routeCount: number;
    enabledStepCount: number;
    hasEnabledRoute: boolean;
  };
  type Env = {
    environmentId: string;
    coveredCells: number;
    totalCells: number;
    coveragePct: number;
    cells: Cell[];
  };
  type Coverage = {
    routeCount: number;
    zeroEnabledStepRoutes: number;
    environments: Env[];
  };

  type State =
    | { phase: "loading" }
    | { phase: "error"; message: string }
    | { phase: "ready"; data: Coverage };

  let state: State = { phase: "loading" };
  let showMatrix = false;

  const MAX_RETRIES = 3;

  async function load() {
    state = { phase: "loading" };
    let lastErr: Error | null = null;
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        const res = await fetch(coverageUrl, { credentials: "include" });
        const body = (await res.json()) as { data?: Coverage; error?: string };
        if (!res.ok) {
          state = { phase: "error", message: body.error ?? `Could not load coverage (${res.status})` };
          return;
        }
        state = {
          phase: "ready",
          data: {
            routeCount: body.data?.routeCount ?? 0,
            zeroEnabledStepRoutes: body.data?.zeroEnabledStepRoutes ?? 0,
            environments: body.data?.environments ?? [],
          },
        };
        return;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        if (i < MAX_RETRIES - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
      }
    }
    state = { phase: "error", message: lastErr?.message ?? "Could not load coverage" };
  }

  function envLabel(id: string): string {
    return environmentName ? environmentName(id) : id;
  }

  import { onMount } from "svelte";
  onMount(() => { void load(); });
</script>

<div class="coverage-indicator" aria-label="Route coverage">
  {#if state.phase === "loading"}
    <BrutalLoadingState message="Checking route coverage…" rows={1} />
  {:else if state.phase === "error"}
    <BrutalErrorBanner title="Could not load route coverage" message={state.message}>
      {#snippet actions()}
        <button type="button" class="cov-btn" onclick={() => void load()}>Retry</button>
      {/snippet}
    </BrutalErrorBanner>
  {:else if state.data.routeCount === 0}
    <p class="cov-empty muted" role="status">
      No routes yet — coverage appears once this project has at least one route.
    </p>
  {:else}
    {@const d = state.data}
    <div class="cov-head">
      <span class="cov-glyph" class:cov-glyph--warn={d.zeroEnabledStepRoutes > 0} aria-hidden="true">
        {d.zeroEnabledStepRoutes > 0 ? "!" : "✓"}
      </span>
      <p class="cov-headline" role="status">
        {#if d.zeroEnabledStepRoutes > 0}
          {d.zeroEnabledStepRoutes} of {d.routeCount}
          {d.routeCount === 1 ? "route has" : "routes have"} no enabled step
          — <a class="cov-link" href={routesHref}>review {d.routeCount === 1 ? "it" : "them"} below</a>.
        {:else}
          All {d.routeCount} {d.routeCount === 1 ? "route has" : "routes have"} at least one enabled step.
          <a class="cov-link" href={routesHref}>See routes below</a>.
        {/if}
      </p>
    </div>

    {#if d.environments.length > 0}
      <button
        type="button"
        class="cov-toggle"
        aria-expanded={showMatrix}
        onclick={() => (showMatrix = !showMatrix)}
      >
        {showMatrix ? "Hide" : "Show"} workload × stage coverage
      </button>
      {#if showMatrix}
        <div class="cov-matrix" role="group" aria-label="Coverage by environment">
          {#each d.environments as env (env.environmentId)}
            <div class="cov-env">
              <h4 class="cov-env-title">
                {envLabel(env.environmentId)}
                <span class="cov-env-pct">{env.coveredCells}/{env.totalCells} cells ({env.coveragePct}%)</span>
              </h4>
              <ul class="cov-cells">
                {#each env.cells as cell (cell.workload + "::" + cell.stage)}
                  <li class="cov-cell" class:cov-cell--gap={!cell.hasEnabledRoute}>
                    <span class="cov-cell-tuple">{cell.workload} · {cell.stage}</span>
                    <span class="cov-cell-state">
                      {cell.hasEnabledRoute
                        ? `${cell.routeCount} ${cell.routeCount === 1 ? "route" : "routes"}`
                        : "no enabled route"}
                    </span>
                  </li>
                {/each}
              </ul>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .coverage-indicator {
    margin: var(--space-3) 0;
  }
  .cov-head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    border: var(--brut-border-width, 2px) solid var(--brut-ink);
    background: var(--brut-canvas, var(--rm-surface-raised));
    padding: var(--space-3);
  }
  .cov-glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 1.5rem;
    height: 1.5rem;
    font-family: var(--font-mono);
    font-weight: 900;
    border: var(--brut-border-width, 2px) solid var(--brut-ink);
    background: var(--state-ok-bg);
    color: var(--state-ok-fg);
  }
  .cov-glyph--warn {
    background: var(--state-warn-bg);
    color: var(--state-warn-fg);
  }
  .cov-headline {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-text);
  }
  .cov-link {
    color: var(--rm-sage);
    font-weight: 600;
  }
  .cov-empty {
    margin: 0;
    font-size: var(--text-sm);
  }
  .cov-toggle {
    margin-top: var(--space-2);
    background: transparent;
    border: 1px solid var(--rm-border);
    color: var(--rm-text);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: var(--space-1) var(--space-2);
    cursor: pointer;
  }
  .cov-matrix {
    margin-top: var(--space-2);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .cov-env-title {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2);
    margin: 0 0 var(--space-1);
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--rm-text);
  }
  .cov-env-pct {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--rm-muted);
    font-weight: 600;
  }
  .cov-cells {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .cov-cell {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    font-size: var(--text-xs);
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--rm-border);
  }
  .cov-cell--gap {
    border-color: var(--state-warn-fg, var(--rm-border));
  }
  .cov-cell-tuple {
    font-family: var(--font-mono);
    color: var(--rm-text);
  }
  .cov-cell-state {
    color: var(--rm-muted);
  }
  .cov-btn {
    background: var(--brut-ink);
    color: var(--brut-white, #fff);
    border: var(--brut-border-width, 2px) solid var(--brut-ink);
    font-size: var(--text-sm);
    font-weight: 700;
    padding: var(--space-1) var(--space-3);
    cursor: pointer;
  }
  .muted {
    color: var(--rm-muted);
  }
</style>
