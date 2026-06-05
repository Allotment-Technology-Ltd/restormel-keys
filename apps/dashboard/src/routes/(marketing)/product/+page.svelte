<script lang="ts">
  import SuiteProofGallery from "$lib/components/suite/SuiteProofGallery.svelte";
  import EcosystemStrip from "$lib/components/integrations/EcosystemStrip.svelte";
  import { page } from "$app/stores";
  import { dashboardEntryHref } from "$lib/dashboard-entry";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
  import { SUITE_CAPABILITY_TAGLINE, SUITE_MODULES } from "$lib/suite/suite-modules";

  $: flags = $page.data.moduleFlags ?? MVP_MODULE_DEFAULTS;
  $: suiteModules = $page.data.suiteModulesForUi ?? SUITE_MODULES;
  $: runRestormelHref = dashboardEntryHref($page.data.user);
</script>

<svelte:head>
  <title>Capabilities — Restormel suite</title>
  <meta name="description" content="{SUITE_CAPABILITY_TAGLINE} — four capabilities in one Restormel workspace." />
</svelte:head>

<div class="product-page container">
    <h1>Restormel capabilities</h1>
    <p class="lead">
      One signed-in workspace. Route model traffic with Keys, assure quality with Testing, visualise graphs in your
      app, and connect documents to agents with Connect.
    </p>
    <div class="ctas">
      <a class="btn btn-primary" href={runRestormelHref}>Run Restormel</a>
      <a class="btn btn-secondary" href="/docs/quickstart">Embed in my stack</a>
    </div>

    <EcosystemStrip variant="compact" stampEyebrow="Fits your stack" moduleFlags={flags} />

    <SuiteProofGallery compact stampEyebrow="Capability samples" />

    <ul class="cap-grid">
      {#each suiteModules as mod}
        <li style="--cap-accent: var({mod.colorVar})">
          <h2>{mod.capability}</h2>
          <p class="cap-product">{mod.product}</p>
          <p>{mod.summary}</p>
          <a href={mod.href}>{mod.dashboardLabel}</a>
        </li>
      {/each}
    </ul>

    <p><a href="/docs/how-it-fits-together">How the suite fits together</a></p>
  </div>

<style>
  .product-page {
    padding: var(--space-8) var(--space-4) var(--space-12);
    max-width: 52rem;
    margin: 0 auto;
  }
  .lead {
    color: var(--rm-muted);
    line-height: 1.6;
  }
  .ctas {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin: var(--space-6) 0;
  }

  :global(.proof-gallery-frame),
  :global(.stack-rail-outer-stamp) {
    margin: var(--space-6) 0;
  }
  .cap-grid {
    list-style: none;
    margin: var(--space-8) 0 0;
    padding: 0;
    display: grid;
    gap: var(--space-4);
  }
  @media (min-width: 640px) {
    .cap-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
  .cap-grid li {
    padding: var(--space-4);
    border: var(--brut-border-width) solid var(--brut-ink);
    background: color-mix(in srgb, var(--cap-accent, var(--brut-blue)) 14%, var(--brut-white));
    border-top: 8px solid var(--cap-accent, var(--brut-blue));
    box-shadow: var(--brut-shadow);
  }
  .cap-grid h2 {
    font-family: var(--brut-font);
    text-transform: uppercase;
    margin: 0 0 var(--space-1);
  }
  .cap-product {
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--rm-dim);
    margin: 0 0 var(--space-2);
  }
  .cap-grid p {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-2);
  }
</style>
