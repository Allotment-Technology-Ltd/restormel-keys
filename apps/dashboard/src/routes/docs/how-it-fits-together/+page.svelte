<script lang="ts">
  import { page } from "$app/stores";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { SUITE_MODULES } from "$lib/suite/suite-modules";

  $: suiteModules = $page.data.suiteModulesForUi ?? SUITE_MODULES;
</script>

<div class="doc-content">
  <h1>How Restormel fits together</h1>
  <p>
    Restormel is one signed-in workspace at <a href={DASHBOARD_BASE}>the dashboard</a>. Four capabilities share the same
    control plane (Keys): provider access, gateway keys, routes, and policies.
  </p>

  <h2>Flow</h2>
  <ol>
    {#each suiteModules as mod}
      <li>
        <strong>{mod.capability} ({mod.product.replace("Restormel ", "")})</strong> — {mod.summary}
      </li>
    {/each}
  </ol>

  <p>
    <a href="/docs/run-vs-embed">Run vs embed</a> ·
    <a href="/docs/operator-model">Operator model</a> ·
    <a href="/docs/quickstart">Suite quickstart</a>
  </p>
</div>
