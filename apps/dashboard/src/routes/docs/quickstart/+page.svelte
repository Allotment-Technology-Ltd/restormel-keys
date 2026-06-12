<script lang="ts">
  import { page } from "$app/stores";
  import { SUITE_MODULES } from "$lib/suite/suite-modules";

  $: suiteModules = $page.data.suiteModulesForUi ?? SUITE_MODULES;
</script>

<div class="doc-content">
  <h1>Suite quickstart (integrators)</h1>
  <p>About 15–20 minutes to wire Keys resolve; optional Testing, Graph, and Knowledge pointers.</p>

  {#each suiteModules as mod, i}
    <h2>{i + 1}. {mod.capability} — {mod.product.replace("Restormel ", "")}</h2>
    {#if mod.id === "keys"}
      <ol>
        <li>Pick a journey: <a href="/keys/docs/journeys/new-project">new project</a> or <a href="/keys/docs/journeys/existing-stack">existing stack</a>.</li>
        <li>Read <a href="/keys/docs/guides/provider-access-modes">provider access modes</a>.</li>
        <li>Install packages from <a href="/keys/docs/compatibility">compatibility</a>.</li>
        <li>Create Gateway keys in the <a href="/keys/dashboard/access">dashboard</a>.</li>
      </ol>
    {:else if mod.id === "testing"}
      <p>
        <a href="/testing/docs/getting-started/existing-stack">Existing stack guide</a> ·
        <a href="/keys/docs/guides/keys-testing-onboarding">Keys + Testing onboarding</a>
      </p>
    {:else if mod.id === "graph"}
      <p><a href="/graph/docs/integration/sveltekit">SvelteKit integration</a> (canonical embed path).</p>
    {:else if mod.id === "connect"}
      <p>
        <a href="/keys/dashboard/home">Dashboard home</a> — connect sources, configure ingest, run it from Sources.
      </p>
    {/if}
  {/each}

  <p><a href="/docs/how-it-fits-together">How it fits together</a></p>
</div>
