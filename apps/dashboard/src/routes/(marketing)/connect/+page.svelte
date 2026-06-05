<script lang="ts">
  import SuiteProofGallery from "$lib/components/suite/SuiteProofGallery.svelte";
  import EcosystemStrip from "$lib/components/integrations/EcosystemStrip.svelte";
  import { page } from "$app/stores";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { moduleById } from "$lib/suite/suite-modules";

  const connectMod = moduleById("connect");

  $: flags = $page.data.moduleFlags ?? MVP_MODULE_DEFAULTS;

  const outcomes = [
    {
      title: "Ingest once, structure forever",
      body: "Point at Drive, S3, crawls, or uploads. Connect extracts ideas, maps relationships, groups themes, embeds for search, and validates claims — automatically.",
    },
    {
      title: "Give agents something to think with",
      body: "Your graph becomes the retrieval layer for copilots and agent workflows: depth-controlled context via REST or MCP, scoped to your Keys workspace.",
    },
    {
      title: "Ground answers before they ship",
      body: "Verify checks claims against your corpus and reasoning rules — so agents cite what you actually know, not what the model guessed.",
    },
  ];
</script>

<svelte:head>
  <title>Restormel Connect — agent-ready knowledge infrastructure</title>
  <meta
    name="description"
    content="Turn documents into a structured knowledge graph and serve verified context to AI agents — ingest, retrieve, and verify on the Restormel control plane."
  />
</svelte:head>

<section class="landing container" aria-labelledby="connect-heading">
    <p class="eyebrow">Restormel · {connectMod.capability}</p>
    <h1 id="connect-heading">{connectMod.product}</h1>
    <p class="lead">
      Build the knowledge foundation your AI products depend on. Connect turns scattered documents into a living
      graph — then exposes it to agents through retrieve and verify APIs, without standing up a separate RAG stack.
    </p>
    <div class="ctas">
      <a class="btn btn-primary" href={DASHBOARD_BASE + "/connect"}>Start in the Connect hub</a>
      <a class="btn btn-secondary" href="/docs/connect">What you can build</a>
    </div>

    <ul class="outcomes" aria-label="What Connect enables">
      {#each outcomes as item}
        <li class="outcome">
          <h2 class="outcome-title">{item.title}</h2>
          <p class="outcome-body">{item.body}</p>
        </li>
      {/each}
    </ul>

    <p class="bridge">
      Pair with <a href="/keys">Restormel Keys</a> for BYOK on every ingest stage,
      <a href="/graph">Restormel Graph</a> to visualise the graph in your app, and
      <a href="/testing">Restormel Testing</a> to assure agent behaviour in CI.
    </p>

    <EcosystemStrip variant="compact" stampEyebrow="Fits your stack" moduleFlags={flags} />

    <SuiteProofGallery compact stampEyebrow="See the stack" />
  </section>

<style>
  .landing {
    padding: var(--space-8) var(--space-4) var(--space-12);
    max-width: 48rem;
    margin: 0 auto;
  }
  .eyebrow {
    font-size: var(--text-xs);
    color: var(--rm-dim);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .lead {
    line-height: 1.6;
    color: var(--rm-muted);
    font-size: var(--text-lg);
  }
  .ctas {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin: var(--space-6) 0;
  }
  .outcomes {
    list-style: none;
    margin: var(--space-8) 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .outcome {
    border: 2px solid var(--brut-ink);
    border-radius: 0;
    background: var(--brut-white);
    box-shadow: 4px 4px 0 var(--brut-ink);
    padding: var(--space-3) var(--space-4);
    transition: transform 100ms ease, box-shadow 100ms ease;
  }

  .outcome:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0 var(--brut-ink);
  }
  .outcome-title {
    margin: 0 0 var(--space-2);
    font-family: var(--brut-font);
    font-size: var(--text-sm);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .outcome-body {
    margin: 0;
    line-height: 1.55;
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .bridge {
    line-height: 1.55;
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-6);
  }
  .bridge a {
    color: var(--brut-blue);
    font-weight: 700;
  }
  :global(.proof-gallery-frame),
  :global(.stack-rail-outer-stamp) {
    margin-top: var(--space-6);
  }
</style>
