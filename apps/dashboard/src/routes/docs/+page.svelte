<script lang="ts">
  import { page } from "$app/stores";
  import { dashboardEntryHref } from "$lib/dashboard-entry";
  import { SUITE_CAPABILITY_TAGLINE, SUITE_MODULES } from "$lib/suite/suite-modules";

  $: suiteModules = $page.data.suiteModulesForUi ?? SUITE_MODULES;
  $: runRestormelHref = dashboardEntryHref($page.data.user);
</script>

<div class="doc-content">
  <h1>Restormel documentation</h1>
  <p class="doc-tagline">One suite map — deep reference lives in product trees and search.</p>

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

  <h2>Capability docs</h2>
  <ul>
    {#each suiteModules as mod}
      <li>
        <a href={mod.id === "connect" ? "/connect/docs" : `${mod.href}/docs`}>
          {mod.capability} — {mod.product}
        </a>
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
</style>
