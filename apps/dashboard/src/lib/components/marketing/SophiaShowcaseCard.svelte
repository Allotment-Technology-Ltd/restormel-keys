<script lang="ts">
  import { SOPHIA_SHOWCASE, sophiaStatsReady } from "$lib/content/sophia-showcase";

  export let featured = false;
  /** Single-column layout — full grid width (use on /use-cases). */
  export let stacked = false;
  export let showPullQuote = false;

  $: statsReady = sophiaStatsReady(SOPHIA_SHOWCASE.stats);
</script>

<article
  class="sophia-card"
  class:sophia-card--featured={featured}
  class:sophia-card--stacked={stacked}
>
  <p class="sophia-eyebrow">
    {#if featured}
      <span class="sophia-badge">Built by the Restormel team</span>
    {/if}
    <span class="sophia-eyebrow-tag">Live app · usesophia.app</span>
  </p>

  <header class="sophia-head">
    <h3 class="sophia-title">{SOPHIA_SHOWCASE.title}</h3>
    <p class="sophia-subtitle">{SOPHIA_SHOWCASE.subtitle}</p>
  </header>

  <div class="sophia-main">
    <p class="sophia-desc">{SOPHIA_SHOWCASE.description}</p>

    <ul class="sophia-pillars" aria-label="What SOPHIA offers">
      {#each SOPHIA_SHOWCASE.pillars as pillar, i}
        <li>
          <span class="sophia-pillar-idx" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
          <div>
            <span class="sophia-pillar-label">{pillar.label}</span>
            <p class="sophia-pillar-detail">{pillar.detail}</p>
          </div>
        </li>
      {/each}
    </ul>

    {#if statsReady}
      <dl class="sophia-stats" aria-label="Knowledge graph scale (operator snapshot)">
        <div class="sophia-stat">
          <dt>Graph units</dt>
          <dd>{SOPHIA_SHOWCASE.stats.nodes.toLocaleString()}</dd>
        </div>
        <div class="sophia-stat">
          <dt>Relations</dt>
          <dd>{SOPHIA_SHOWCASE.stats.edges.toLocaleString()}</dd>
        </div>
        <div class="sophia-stat sophia-stat--highlight">
          <dt>Verified claims</dt>
          <dd>{SOPHIA_SHOWCASE.stats.verified.toLocaleString()}</dd>
        </div>
      </dl>
      <p class="sophia-stats-meta">Backend graph snapshot as of {SOPHIA_SHOWCASE.statsAsOf} — not the in-app student experience.</p>
    {:else}
      <p class="sophia-stats-live">
        Under the hood, SOPHIA runs on a live argument graph; the product surface is lessons, Stoa, and formative essay feedback.
      </p>
    {/if}
  </div>

  <aside class="sophia-aside">
    {#if showPullQuote}
      <blockquote class="sophia-quote">
        <p>{SOPHIA_SHOWCASE.builderNote}</p>
      </blockquote>
    {:else}
      <p class="sophia-note">{SOPHIA_SHOWCASE.builderNote}</p>
    {/if}

    <a
      class="sophia-cta"
      href={SOPHIA_SHOWCASE.href}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span>Open usesophia.app</span>
      <span class="sophia-cta-arrow" aria-hidden="true">↗</span>
    </a>
  </aside>
</article>

<style>
  .sophia-card {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0;
    margin: 0;
    padding: 0;
    width: 100%;
    box-sizing: border-box;
    background: var(--color-surface);
    border: 2px solid var(--color-ink);
    box-shadow: 4px 4px 0 var(--color-ink);
    overflow: hidden;
    transition: transform 100ms ease, box-shadow 100ms ease;
  }

  .sophia-card--stacked {
    min-height: 22rem;
  }

  .sophia-card:hover {
    transform: translate(-3px, -3px);
    box-shadow: 7px 7px 0 var(--color-ink);
  }

  .sophia-eyebrow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    margin: 0;
    padding: var(--space-3) var(--space-4);
    border-bottom: 2px solid var(--color-ink);
    background: var(--color-bg-deep);
  }

  .sophia-badge {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--brut-purple, #7c3aed);
  }

  .sophia-eyebrow-tag {
    font-family: var(--font-mono);
    font-size: 0.5625rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 0.2rem 0.5rem;
    border: 2px solid var(--color-ink);
    background: var(--brut-purple, #7c3aed);
    color: var(--color-on-blue);
  }

  .sophia-head {
    padding: var(--space-5) var(--space-4) var(--space-4);
    border-bottom: 2px solid var(--color-ink);
    background: color-mix(in srgb, var(--brut-purple, #7c3aed) 18%, var(--color-yellow));
  }

  .sophia-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(2.5rem, 8vw, 4rem);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
    line-height: 0.95;
    color: var(--color-ink);
    text-shadow: 3px 3px 0 var(--color-surface);
  }

  .sophia-subtitle {
    margin: var(--space-2) 0 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-ink);
  }

  .sophia-main {
    padding: var(--space-4);
    border-bottom: 2px solid var(--color-ink);
  }

  .sophia-desc {
    margin: 0 0 var(--space-4);
    font-size: var(--text-body-md);
    line-height: 1.55;
    color: var(--color-ink);
  }

  .sophia-pillars {
    margin: 0 0 var(--space-4);
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0;
    border: 2px solid var(--color-ink);
    box-shadow: 3px 3px 0 var(--color-ink);
  }

  .sophia-pillars li {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-3);
    align-items: start;
    padding: var(--space-3);
    border-bottom: 2px solid var(--color-ink);
    background: var(--color-bg);
  }

  .sophia-pillars li:last-child {
    border-bottom: none;
  }

  .sophia-pillar-idx {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--brut-purple, #7c3aed);
  }

  .sophia-pillar-label {
    display: block;
    font-family: var(--font-display);
    font-size: var(--text-display-sm);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
    line-height: 1;
    color: var(--color-ink);
    margin-bottom: var(--space-1);
  }

  .sophia-pillar-detail {
    margin: 0;
    font-size: var(--text-body-sm);
    line-height: 1.45;
    color: var(--color-ink-muted);
  }

  .sophia-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
    margin: 0 0 var(--space-2);
    border: 2px solid var(--color-ink);
    box-shadow: 3px 3px 0 var(--color-ink);
  }

  .sophia-stat {
    padding: var(--space-3);
    border-right: 2px solid var(--color-ink);
    background: var(--color-surface);
  }

  .sophia-stat:last-child {
    border-right: none;
  }

  .sophia-stat--highlight {
    background: var(--color-yellow);
  }

  .sophia-stat dt {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.5625rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-ink-muted);
  }

  .sophia-stat dd {
    margin: var(--space-1) 0 0;
    font-family: var(--font-display);
    font-size: clamp(1.5rem, 4vw, 2rem);
    font-weight: 900;
    line-height: 1;
    color: var(--color-ink);
  }

  .sophia-stats-meta,
  .sophia-stats-live {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    line-height: 1.45;
    color: var(--color-ink-muted);
  }

  .sophia-aside {
    padding: var(--space-4);
    background: var(--color-bg-deep);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .sophia-quote {
    margin: 0;
    padding: var(--space-4);
    border: 2px solid var(--color-ink);
    border-left: 4px solid var(--brut-purple, #7c3aed);
    background: var(--color-surface);
    box-shadow: 3px 3px 0 var(--color-ink);
  }

  .sophia-quote p {
    margin: 0;
    font-size: var(--text-body-md);
    font-style: italic;
    line-height: 1.5;
    color: var(--color-ink);
  }

  .sophia-note {
    margin: 0;
    font-size: var(--text-body-sm);
    line-height: 1.5;
    color: var(--color-ink-muted);
    border-left: 4px solid var(--color-ink);
    padding-left: var(--space-3);
  }

  .sophia-cta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-decoration: none;
    color: var(--color-yellow);
    background: var(--color-ink);
    border: 2px solid var(--color-ink);
    box-shadow: 4px 4px 0 var(--brut-purple, #7c3aed);
    transition: transform 100ms ease, box-shadow 100ms ease;
  }

  .sophia-cta:hover {
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0 var(--brut-purple, #7c3aed);
    color: var(--color-yellow);
    background: var(--color-ink);
  }

  .sophia-cta-arrow {
    font-size: 1.25rem;
    line-height: 1;
  }

  /* Stacked: full-width single column (matches UseCaseCard rhythm on /use-cases) */
  .sophia-card--stacked {
    display: flex;
    flex-direction: column;
  }

  .sophia-card--stacked .sophia-main {
    flex: 1;
    border-bottom: none;
    border-right: none;
  }

  .sophia-card--stacked .sophia-aside {
    margin-top: auto;
    padding: 0;
    background: var(--color-bg-deep);
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .sophia-card--stacked .sophia-note {
    margin: 0;
    padding: var(--space-4);
    border: none;
    border-top: 2px solid var(--color-ink);
    border-left: none;
    background: var(--color-bg);
  }

  .sophia-card--stacked .sophia-cta {
    border-top: 2px solid var(--color-ink);
    box-shadow: none;
    background: var(--color-yellow);
    color: var(--color-ink);
  }

  .sophia-card--stacked .sophia-cta:hover {
    background: var(--color-ink);
    color: var(--color-yellow);
    box-shadow: none;
  }

  @media (min-width: 56rem) {
    .sophia-card--featured:not(.sophia-card--stacked) {
      grid-template-columns: 1.4fr 1fr;
      grid-template-rows: auto auto 1fr;
    }

    .sophia-card--featured:not(.sophia-card--stacked) .sophia-eyebrow,
    .sophia-card--featured:not(.sophia-card--stacked) .sophia-head {
      grid-column: 1 / -1;
    }

    .sophia-card--featured:not(.sophia-card--stacked) .sophia-main {
      border-bottom: 0;
      border-right: 2px solid var(--color-ink);
    }

    .sophia-card--featured:not(.sophia-card--stacked) .sophia-aside {
      justify-content: space-between;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sophia-card:hover,
    .sophia-cta:hover {
      transform: none;
      box-shadow: 4px 4px 0 var(--color-ink);
    }
  }
</style>
