<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
</script>

<svelte:head>
  <title>Restormel Graph – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section class="hub-stub" aria-labelledby="graph-hub-heading">
  <p class="hub-eyebrow">Restormel Dashboard · Suite product</p>
  <h1 id="graph-hub-heading">Restormel Graph</h1>
  <p class="hub-lead">
    Visualise Contract v0 graph snapshots with layout REST and Web Components. Operator views for layout preview,
    contract health, and fixture validation ship here in Phase 6; public layout API in Phase 2.
  </p>
  <ul class="hub-links">
    <li><a href="/graph/docs">Graph docs</a></li>
    <li><a href={DASHBOARD_BASE + "/testing"}>Restormel Testing hub</a></li>
    <li><a href="/graph/docs/integration/sveltekit">Svelte integrator guide</a></li>
  </ul>
  <p class="hub-status" role="status">
    <strong>Layout REST + Web Components shipped (Phase 2).</strong> Operator persistence and hub tools land in Phase 6.
    Integrator docs:
    <a href="/graph/docs/integration/web-components">Web Components</a>.
    SOPHIA keeps <code>@restormel/ui-graph-svelte</code> until Phase 8.
  </p>
</section>

<style>
  .hub-stub {
    max-width: 42rem;
    padding: 0.5rem 0 2rem;
  }
  .hub-eyebrow {
    font-size: 0.8125rem;
    color: var(--rm-dim);
    margin: 0 0 0.5rem;
  }
  .hub-lead {
    line-height: 1.55;
    margin: 0 0 1.25rem;
  }
  .hub-links {
    margin: 0 0 1.25rem;
    padding-left: 1.25rem;
    line-height: 1.6;
  }
  .hub-status {
    font-size: 0.9375rem;
    padding: 0.75rem 1rem;
    border-radius: var(--rm-radius);
    border: var(--border-thin);
    background: var(--rm-surface-raised);
    color: var(--rm-muted);
  }
</style>
