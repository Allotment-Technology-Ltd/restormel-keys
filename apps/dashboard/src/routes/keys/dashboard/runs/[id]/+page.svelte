<script lang="ts">
  import { page } from "$app/stores";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import ConnectIngestRunConsole from "$lib/components/connect/pipeline/ConnectIngestRunConsole.svelte";
  import ConnectSpineLedger from "$lib/components/connect/ConnectSpineLedger.svelte";
  import { pipelineWizardHref } from "$lib/connect/pipeline-config";
  import { CLAIMS_HREF, HOME_HREF, RUNS_HREF } from "$lib/nav-config";
  import type { ConnectSpine } from "$lib/connect/connect-spine";

  export let data: { spine?: Promise<ConnectSpine | null> } = {};

  type GraphRepairTask = "link-sources" | "revalidate" | "auto-remediate" | "embed-backfill";

  function parseGraphRepairTask(raw: string | null): GraphRepairTask | null {
    if (
      raw === "link-sources" ||
      raw === "revalidate" ||
      raw === "auto-remediate" ||
      raw === "embed-backfill"
    ) {
      return raw;
    }
    return null;
  }

  $: jobId = $page.params.id ?? "";
  $: fromPipeline = $page.url.searchParams.get("from") === "pipeline";
  $: fromGraph = $page.url.searchParams.get("from") === "graph";
  $: fromHub = $page.url.searchParams.get("from") === "hub";
  $: graphTaskRaw = $page.url.searchParams.get("task");
  $: graphTask = parseGraphRepairTask(graphTaskRaw);
  $: statusApi = DASHBOARD_BASE + "/api/connect/ingest/jobs/" + jobId + "/status";
</script>

<svelte:head>
  <title>Run – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section aria-labelledby="job-heading">
  <!-- Phase 2 spine: the run console is stage ② Ingest. Streamed; never blocks. -->
  {#if data.spine}
    {#await data.spine then spine}
      {#if spine}
        <ConnectSpineLedger {spine} activeStageId="ingest" />
      {/if}
    {/await}
  {/if}

  <p class="back">
    {#if fromGraph}
      <a href={CLAIMS_HREF}>← Claims review</a>
    {:else if fromPipeline}
      <a href={pipelineWizardHref("launch")}>← Back to pipeline</a>
    {:else if fromHub}
      <a href={HOME_HREF}>← Home</a>
    {:else}
      <a href={RUNS_HREF}>← All runs</a>
    {/if}
  </p>

  <ConnectIngestRunConsole {jobId} statusApiBase={statusApi} {fromPipeline} {fromGraph} {fromHub} {graphTask} />
</section>

<style>
  .back {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
  }
</style>
