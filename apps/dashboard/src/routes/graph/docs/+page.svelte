<script lang="ts">
  import { graphBase as base } from "$lib/graph/paths.js";
  import { GITHUB_REPO_URL } from "$lib/site-nav";

  const tiles = [
    {
      href: `${base}/docs/integration/sveltekit`,
      title: "SvelteKit integration",
      blurb: "Canonical path: install, import map, Vite SSR, CSS, minimal example, verify, migrate.",
    },
    {
      href: `${base}/docs/overview`,
      title: "Overview",
      blurb: "What Restormel Graph is—and what it deliberately is not.",
    },
    {
      href: `${base}/docs/how-it-fits-together`,
      title: "How it fits together",
      blurb: "Hosts produce GraphData; packages own DTOs, layout, and the canvas.",
    },
    {
      href: `${base}/docs/guides/migration-from-custom-canvas`,
      title: "Migrate from a custom canvas",
      blurb: "Checklist and risk callouts when replacing in-app graph code.",
    },
    {
      href: `${base}/docs/reference/api`,
      title: "API reference",
      blurb: "Types and props aligned with published .d.ts and package exports.",
    },
    {
      href: `${base}/docs/reference/releases-and-support`,
      title: "Releases & support",
      blurb: "Tags, compatibility, support boundary, changelog links.",
    },
  ] as const;
</script>

<svelte:head>
  <title>Docs — Restormel Graph</title>
  <meta
    name="description"
    content="Restormel Graph documentation: integrate @restormel/graph-core and @restormel/ui-graph-svelte in SvelteKit with a single canonical guide."
  />
</svelte:head>

<div class="graph-docs-home">
  <h1 class="graph-docs-home__title">Docs</h1>
  <p class="graph-docs-home__intro">
    <strong>Restormel Graph</strong> ships npm packages for a <strong>frozen Contract v0</strong> view-model and a
    <strong>Svelte&nbsp;5</strong> graph canvas. Start with the
    <a href="{base}/docs/integration/sveltekit">SvelteKit integration</a> guide—it is the
    <strong>canonical</strong> page for humans and agents (install → imports → Vite → CSS → example → verify → migrate).
    Maintainer-facing detail also lives in the repo:
    <a href="{GITHUB_REPO_URL}/blob/main/docs/restormel-graph-sophia-consumer.md" rel="noopener noreferrer"
      >restormel-graph-sophia-consumer.md</a
    >.
  </p>

  <section class="graph-docs-home__section" aria-labelledby="tiles-heading">
    <h2 id="tiles-heading" class="graph-docs-home__h2">Where to go next</h2>
    <ul class="graph-docs-home__tiles" role="list">
      {#each tiles as t}
        <li>
          <a class="graph-docs-home__tile" href={t.href} data-sveltekit-preload-data="hover">
            <span class="graph-docs-home__tile-title">{t.title}</span>
            <span class="graph-docs-home__tile-blurb">{t.blurb}</span>
          </a>
        </li>
      {/each}
    </ul>
  </section>

  <p class="graph-docs-home__back">
    <a href="{base}/">← Restormel Graph home</a>
  </p>
</div>

<style>
  .graph-docs-home {
    max-width: min(100%, 52rem);
    padding-bottom: var(--space-12);
  }

  .graph-docs-home__title {
    font-family: var(--rm-font-display);
    font-size: var(--text-3xl);
    font-weight: var(--font-semibold);
    letter-spacing: var(--tracking-tight);
    color: var(--rm-text);
    margin: 0 0 var(--space-4);
  }

  .graph-docs-home__intro {
    font-family: var(--rm-font-ui);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    margin: 0 0 var(--space-10);
  }

  .graph-docs-home__intro strong {
    color: var(--rm-text);
    font-weight: var(--font-semibold);
  }

  .graph-docs-home__intro a {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .graph-docs-home__section {
    margin-bottom: var(--space-10);
  }

  .graph-docs-home__h2 {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-4);
  }

  .graph-docs-home__tiles {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-4);
    grid-template-columns: 1fr;
  }

  @media (min-width: 40rem) {
    .graph-docs-home__tiles {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .graph-docs-home__tile {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    height: 100%;
    padding: var(--card-padding-md);
    background: var(--rm-surface);
    border: var(--border-1) solid var(--rm-border);
    border-radius: var(--rm-card-radius);
    box-shadow: var(--rm-card-shadow);
    text-decoration: none;
    color: inherit;
    transition: border-color var(--duration-fast) var(--ease);
  }

  .graph-docs-home__tile:hover {
    border-color: var(--rm-sage);
  }

  .graph-docs-home__tile:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }

  .graph-docs-home__tile-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
  }

  .graph-docs-home__tile-blurb {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
  }

  .graph-docs-home__back {
    margin: var(--space-10) 0 0;
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
  }

  .graph-docs-home__back a {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
</style>
