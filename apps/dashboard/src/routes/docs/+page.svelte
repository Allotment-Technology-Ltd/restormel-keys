<script lang="ts">
  import { page } from "$app/stores";
  import { dashboardEntryHref } from "$lib/dashboard-entry";
  import { SUITE_CAPABILITY_TAGLINE, SUITE_MODULES } from "$lib/suite/suite-modules";

  $: suiteModules = $page.data.suiteModulesForUi ?? SUITE_MODULES;
  $: runRestormelHref = dashboardEntryHref($page.data.user);

  /** Each product's docs hub lives in its own tree; this page is the one map across them. */
  const DOCS_HREF: Record<string, string> = {
    keys: "/keys/docs",
    connect: "/connect/docs",
    testing: "/testing/docs",
    graph: "/graph/docs",
  };
</script>

<div class="doc-content">
  <h1>Restormel documentation</h1>
  <p class="doc-tagline">
    Restormel is the verified-context layer for AI. This is the suite map — start here, then go deep in each product's
    own docs tree.
  </p>

  <h2>What brings you here?</h2>
  <div class="intent-grid">
    <a class="intent-card" href={runRestormelHref}>
      <strong>Run Restormel</strong>
      <span>Sign in and use the dashboard wizards — the primary way to learn the product.</span>
    </a>
    <a class="intent-card" href="/docs/quickstart">
      <strong>Embed in my stack</strong>
      <span>Integrator quickstart: Keys resolve, optional Testing, Graph pointer.</span>
    </a>
    <a class="intent-card" href="/docs/how-it-fits-together">
      <strong>Map the suite</strong>
      <span>{SUITE_CAPABILITY_TAGLINE}.</span>
    </a>
  </div>

  <h2>Verified context</h2>
  <p>
    The thesis behind the suite: provenance-traced, quality-gated knowledge your agents can be held accountable to. Keys
    routes and policies decide what runs; Connect supplies the evidence-bound context. Start with
    <a href="/keys/docs/guides/verified-context">Verified context (Keys guide)</a> or the
    <a href="/connect/docs">Connect API docs</a>.
  </p>

  <h2>Product docs</h2>
  <p>Each product has its own docs tree. Jump to the one you need — no need to hunt across hubs.</p>
  <ul class="product-list">
    {#each suiteModules as mod}
      <li>
        <a href={DOCS_HREF[mod.id] ?? `${mod.href}/docs`}>
          <strong>{mod.product}</strong> — {mod.capability}
        </a>
        <span class="product-summary">{mod.summary}</span>
      </li>
    {/each}
  </ul>

  <p>
    Operator vocabulary (workspace, connections, hubs):
    <a href="/docs/operator-model">Suite operator model</a>.
  </p>
</div>

<style>
  .doc-tagline {
    color: var(--rm-muted);
    font-size: var(--text-base);
  }
  .intent-grid {
    display: grid;
    gap: var(--space-3);
    margin: var(--space-4) 0 var(--space-6);
  }
  @media (min-width: 640px) {
    .intent-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  .intent-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
    text-decoration: none;
    color: inherit;
    box-shadow: var(--brut-shadow-hover);
  }
  .intent-card:hover {
    transform: translate(2px, 2px);
    box-shadow: none;
  }
  .intent-card strong {
    font-family: var(--brut-font);
    text-transform: uppercase;
    font-size: var(--text-sm);
  }
  .intent-card span {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: 1.5;
  }
  .product-list {
    list-style: none;
    padding: 0;
    margin: var(--space-3) 0 var(--space-6);
    display: grid;
    gap: var(--space-3);
  }
  .product-list li {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .product-summary {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: 1.5;
  }
</style>
