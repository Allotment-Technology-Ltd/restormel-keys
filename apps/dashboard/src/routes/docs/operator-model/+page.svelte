<script lang="ts">
  import { page } from "$app/stores";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

  $: flags = $page.data.moduleFlags ?? MVP_MODULE_DEFAULTS;
</script>

<div class="doc-content">
  <h1>Suite operator model</h1>
  <p>Canonical vocabulary for one Restormel workspace. Repo mirror: <code>docs/restormel/SUITE-OPERATOR-MODEL.md</code>.</p>

  <table class="doc-table">
    <thead>
      <tr><th>Concept</th><th>Configure in</th></tr>
    </thead>
    <tbody>
      <tr><td>Workspace / project</td><td><a href="/keys/dashboard/projects">Projects</a></td></tr>
      <tr><td>Provider access</td><td><a href="/keys/dashboard/integrations">Connections</a></td></tr>
      <tr><td>Execution keys</td><td><a href="/keys/dashboard/access">Gateway keys</a></td></tr>
      <tr>
        <td>Routes{#if flags.guardrails} &amp; policies{/if}</td>
        <td>
          <a href="/keys/dashboard/routes">Routes</a>
          {#if flags.guardrails}
            · <a href="/keys/dashboard/policies">Guard Rails</a>
          {/if}
        </td>
      </tr>
      {#if flags.testing}
        <tr><td>CI / goals</td><td><a href="/keys/dashboard/testing">Testing hub</a></td></tr>
      {/if}
      {#if flags.connect}
        <tr><td>Corpus / graph store</td><td><a href="/keys/dashboard/connect/pipeline">Knowledge pipeline</a></td></tr>
        <tr><td>Ingest runs</td><td><a href="/keys/dashboard/connect/ingest">Knowledge ingest</a></td></tr>
      {/if}
      {#if flags.graph !== "disabled"}
        <tr>
          <td>Embeddable graph UI</td>
          <td><a href="/graph/docs/integration/sveltekit">Graph integrator guide</a> + <a href="/keys/dashboard/dev-tools">Dev Tools</a></td>
        </tr>
      {/if}
    </tbody>
  </table>

  <p><a href="/docs">Back to docs home</a></p>
</div>
