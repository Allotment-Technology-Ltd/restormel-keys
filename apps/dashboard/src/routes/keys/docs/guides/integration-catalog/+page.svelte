<script lang="ts">
  import type { IntegrationCatalogCategory, IntegrationCatalogEntry } from "@restormel/aaif";
  import { page } from "$app/stores";
  import { integrationCatalogForFlags } from "$lib/integration-catalog-for-flags";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

  const categoryLabels: Record<IntegrationCatalogCategory, string> = {
    database: "Database, Postgres & graph stores",
    hosting: "Hosting & edge",
    gateway: "Gateways & API fronts",
    model_provider: "Model providers",
    ci: "CI & automation",
    auth: "Auth & identity",
  };

  const categoryOrder: IntegrationCatalogCategory[] = [
    "database",
    "hosting",
    "gateway",
    "model_provider",
    "ci",
    "auth",
  ];

  $: flags = $page.data.moduleFlags ?? MVP_MODULE_DEFAULTS;
  $: catalogEntries = integrationCatalogForFlags(flags);

  function byCategory(cat: IntegrationCatalogCategory): IntegrationCatalogEntry[] {
    return catalogEntries.filter((e) => e.category === cat);
  }
</script>

<svelte:head>
  <title>Integration catalog — Guides — Restormel Keys</title>
  <meta
    name="description"
    content="Index of third-party services Restormel documents: Neon, SurrealDB, model providers, gateways, CI, and Zuplo — with links to canonical setup guides."
  />
</svelte:head>

<h1 class="docs-h1">Integration catalog</h1>
<p class="docs-intro">
  This page is an <strong>index</strong> only: each link goes to a canonical guide or doc that owns the procedural steps.
  Restormel sits <strong>above</strong> gateways and providers — you keep your stack; we add routing
  {#if flags.testing}and Testing{/if}
  {#if flags.connect} and Connect knowledge paths{/if}.
  For machine-readable stack metadata in AAIF, see
  <a href="/keys/docs/integrations/aaif#integration-stack"><code>integrationStack</code> on AAIF</a>.
  Connect’s default graph path is <strong>Bring-your-own SurrealDB</strong>; Neon covers workspace Postgres and optional spine patterns — see
  <a href="/keys/docs/guides/connect-first-graph-onboarding">Connect first graph onboarding</a>.
</p>

<p class="docs-p">
  <strong>Two API surfaces</strong> (Gateway key vs Zuplo consumer key) are summarised on
  <a href="/keys/docs/cloud-api">Cloud API</a> — keep that distinction in mind when wiring CI or agents.
</p>

{#each categoryOrder as cat}
  {@const items = byCategory(cat)}
  {#if items.length > 0}
    <h2 class="docs-h2">{categoryLabels[cat]}</h2>
    <ul class="cat-list">
      {#each items as item}
        <li class="cat-item">
          <a class="cat-link" href={item.docsPath}>{item.label}</a>
          {#if item.externalUrl}
            <a class="cat-ext" href={item.externalUrl} rel="noopener noreferrer" target="_blank">Vendor site →</a>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
{/each}

<h2 class="docs-h2">Related</h2>
<ul class="docs-list">
  {#if flags.testing}
    <li><a href="/keys/docs/guides/keys-testing-onboarding">Keys + Restormel Testing onboarding</a></li>
  {/if}
  <li><a href="/keys/docs/integrations">Restormel Integrations</a> (CLI, MCP, AAIF)</li>
  <li><a href="/keys/docs/guides/third-party-brand-marks">Third-party brand marks</a> (logos policy)</li>
</ul>

<style>
  .docs-h1 {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-3);
  }
  .docs-intro {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-4);
    max-width: 44rem;
  }
  .docs-p {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-5);
    max-width: 44rem;
  }
  .docs-h2 {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--rm-text);
    margin: var(--space-5) 0 var(--space-2);
  }
  .cat-list {
    list-style: none;
    margin: 0 0 var(--space-4);
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .cat-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--text-sm);
  }
  .cat-link {
    font-weight: 500;
    color: var(--rm-sage);
    text-decoration: none;
  }
  .cat-link:hover {
    text-decoration: underline;
  }
  .cat-ext {
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  .docs-list {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .docs-list a {
    color: var(--rm-sage);
  }
</style>
