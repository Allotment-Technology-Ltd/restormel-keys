<script lang="ts">
  import { graphBase as base } from "$lib/graph/paths.js";
</script>

<svelte:head>
  <title>Restormel Graph — Interactive graph UI for Svelte apps</title>
  <meta
    name="description"
    content="Contract-first graph packages for Svelte 5: frozen GraphData DTOs, orbital layout, and an accessible canvas—without coupling your app to Restormel reasoning contracts."
  />
</svelte:head>

<div class="graph-landing">
  <section class="graph-hero container">
    <p class="graph-kicker">Restormel Graph</p>
    <h1 class="graph-title">Ship graph UIs with a stable contract</h1>
    <p class="graph-lead">
      <strong>@restormel/graph-core</strong> defines portable <strong>GraphData</strong> and layout helpers.
      <strong>@restormel/ui-graph-svelte</strong> renders an interactive SVG canvas for Svelte&nbsp;5—zoom, pan,
      selection, and ghost layers—so your product can focus on adapters and domain logic.
    </p>
    <ul class="graph-cta-row">
      <li><a class="btn btn-primary" href="{base}/docs/integration/sveltekit">Integrate in SvelteKit</a></li>
      <li><a class="btn btn-ghost" href="{base}/docs">Documentation</a></li>
      <li>
        <a
          class="btn btn-ghost"
          href="https://www.npmjs.com/package/@restormel/graph-core"
          rel="noopener noreferrer">npm — graph-core</a>
      </li>
    </ul>
  </section>

  <section class="graph-points section-alt" aria-label="What you get">
    <div class="container graph-points-inner">
      <article class="graph-point">
        <h2 class="graph-point-title">Contract v0</h2>
        <p>
          Frozen DTOs in <code>viewModel.ts</code>—nodes, edges, ghosts, viewport commands—so hosts and renderers agree on
          shape without importing application-specific contracts.
        </p>
      </article>
      <article class="graph-point">
        <h2 class="graph-point-title">Svelte-native canvas</h2>
        <p>
          Production-ready <strong>GraphCanvas</strong> with accessibility affordances, semantic styling hooks, and the
          same interaction patterns we prove in CI via tarball smoke tests.
        </p>
      </article>
      <article class="graph-point">
        <h2 class="graph-point-title">Suite-aligned docs</h2>
        <p>
          Lives alongside <a href="/keys/docs">Keys</a> and <a href="/testing/docs">Testing</a> on restormel.dev—one nav,
          copy-paste wiring, and a single canonical integration page for agents and humans.
        </p>
      </article>
    </div>
  </section>
</div>

<style>
  .graph-landing {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    padding-bottom: var(--space-12);
  }
  .container {
    max-width: var(--rm-container-max);
    margin: 0 auto;
    padding-left: var(--space-4);
    padding-right: var(--space-4);
  }
  .graph-hero {
    text-align: center;
    max-width: 44rem;
  }
  .graph-kicker {
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--rm-dim);
    margin: 0 0 var(--space-3);
  }
  .graph-title {
    font-family: var(--rm-font-display);
    font-size: clamp(var(--text-3xl), 4vw, var(--text-4xl));
    font-weight: var(--font-semibold);
    line-height: var(--leading-tight);
    margin: 0 0 var(--space-4);
    color: var(--rm-text);
  }
  .graph-lead {
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
    text-align: left;
  }
  .graph-lead strong {
    color: var(--rm-text);
    font-weight: var(--font-medium);
  }
  .graph-cta-row {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    justify-content: center;
  }
  .graph-cta-row a {
    text-align: center;
    justify-content: center;
  }
  .section-alt {
    background: var(--rm-surface-2);
    border-top: 1px solid var(--rm-border);
    border-bottom: 1px solid var(--rm-border);
  }
  .graph-points-inner {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: var(--space-8);
    padding-top: var(--space-10);
    padding-bottom: var(--space-10);
  }
  .graph-point {
    background: var(--rm-bg);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-6);
  }
  .graph-point-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-lg);
    margin: 0 0 var(--space-3);
    color: var(--rm-text);
  }
  .graph-point p {
    margin: 0;
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
  }
  .graph-point code {
    font-size: 0.88em;
    color: var(--rm-text);
  }
  .graph-point a {
    color: var(--rm-sage);
    font-weight: var(--font-medium);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
</style>
