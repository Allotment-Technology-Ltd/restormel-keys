<script lang="ts">
  import { page } from "$app/stores";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import ConnectIngestRunConsole from "$lib/components/connect/pipeline/ConnectIngestRunConsole.svelte";
  import { pipelineWizardHref } from "$lib/connect/pipeline-config";

  const CONNECT_BASE = DASHBOARD_BASE + "/connect";
  $: jobId = $page.params.jobId ?? "";
  $: fromPipeline = $page.url.searchParams.get("from") === "pipeline";
  $: statusApi = DASHBOARD_BASE + "/api/connect/ingest/jobs/" + jobId + "/status";
</script>

<svelte:head>
  <title>Ingest run – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section aria-labelledby="job-heading">
  <p class="back">
    {#if fromPipeline}
      <a href={pipelineWizardHref("run")}>← Back to pipeline</a>
    {:else}
      <a href={CONNECT_BASE + "/ingest"}>← All runs</a>
    {/if}
  </p>

  <ConnectIngestRunConsole {jobId} statusApiBase={statusApi} {fromPipeline} />
</section>

<style>
  .back {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
  }
</style>
