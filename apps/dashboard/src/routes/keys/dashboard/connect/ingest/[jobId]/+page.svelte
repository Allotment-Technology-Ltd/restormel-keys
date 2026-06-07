<script lang="ts">
  import { page } from "$app/stores";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import ConnectIngestRunConsole from "$lib/components/connect/pipeline/ConnectIngestRunConsole.svelte";
  import { pipelineWizardHref } from "$lib/connect/pipeline-config";

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

  const CONNECT_BASE = DASHBOARD_BASE + "/connect";
  $: jobId = $page.params.jobId ?? "";
  $: fromPipeline = $page.url.searchParams.get("from") === "pipeline";
  $: fromGraph = $page.url.searchParams.get("from") === "graph";
  $: fromHub = $page.url.searchParams.get("from") === "hub";
  $: graphTaskRaw = $page.url.searchParams.get("task");
  $: graphTask = parseGraphRepairTask(graphTaskRaw);
  $: statusApi = DASHBOARD_BASE + "/api/connect/ingest/jobs/" + jobId + "/status";
</script>

<svelte:head>
  <title>Ingest run – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section aria-labelledby="job-heading">
  <p class="back">
    {#if fromGraph}
      <a href={CONNECT_BASE + "/graph"}>← Graph review</a>
    {:else if fromPipeline}
      <a href={pipelineWizardHref("launch")}>← Back to pipeline</a>
    {:else if fromHub}
      <a href={CONNECT_BASE}>← Connect home</a>
    {:else}
      <a href={CONNECT_BASE + "/ingest"}>← All runs</a>
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
