<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { goto } from "$app/navigation";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { CONNECT_PIPELINE_API, PIPELINE_STAGES, type PipelineRunDefaults } from "$lib/connect/pipeline-config";

  export let runDefaults: PipelineRunDefaults;
  export let onBack: () => void;
  export let submitting = false;

  const dispatch = createEventDispatcher<{ started: void }>();
  const CONNECT_BASE = DASHBOARD_BASE + "/connect";
  const API_BASE = CONNECT_PIPELINE_API;

  let label = "";
  let stopAfterStage = runDefaults.defaultStopAfterStage ?? "";
  let error: string | null = null;
  let selectedPackId =
    runDefaults.selectedDomainPackId ?? runDefaults.domainPackId ?? runDefaults.packs[0]?.id ?? "";

  $: canStart = runDefaults.documents.length > 0 && Boolean(selectedPackId) && !submitting;

  async function persistPackSelection(packId: string) {
    if (!packId) return;
    const res = await fetch(API_BASE + "/domain-packs/selection", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain_pack_id: packId }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      error = d.message ?? "Could not save domain pack selection.";
    }
  }

  async function onPackChange(event: Event) {
    const target = event.currentTarget as HTMLSelectElement;
    selectedPackId = target.value;
    error = null;
    await persistPackSelection(selectedPackId);
  }

  function defaultLabel(): string {
    const date = new Date().toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `Ingest run — ${date}`;
  }

  export async function submitRun() {
    await startRun();
  }

  async function startRun() {
    if (!canStart) return;
    error = null;
    submitting = true;
    try {
      const res = await fetch(API_BASE + "/ingest/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || defaultLabel(),
          document_ids: runDefaults.documents.map((d) => d.id),
          ...(runDefaults.pipelineProfileId
            ? { pipeline_profile_id: runDefaults.pipelineProfileId }
            : {}),
          ...(selectedPackId ? { domain_pack_id: selectedPackId } : {}),
          ...(runDefaults.graphTargetId ? { graph_target_id: runDefaults.graphTargetId } : {}),
          ...(stopAfterStage ? { stop_after_stage: stopAfterStage } : {}),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        error = d.message ?? `Could not start run (HTTP ${res.status}).`;
        return;
      }
      const id = d.job?.id;
      if (!id) {
        error = "Run was created but no job id was returned.";
        return;
      }
      dispatch("started");
      await goto(`${CONNECT_BASE}/ingest/${id}?from=pipeline`);
    } catch {
      error = "Network error while starting the run.";
    } finally {
      submitting = false;
    }
  }
</script>

{#if runDefaults.documents.length === 0}
  <section class="wizard-run-empty" role="status">
    <p class="notice">
      No documents are selected for this run. Go back to <strong>Sources</strong>, import from any connector or URL,
      then check the documents you want included — you can mix web pages, uploads, and connector imports in one run.
    </p>
    <button type="button" class="btn btn-secondary" on:click={onBack}>Back to Sources</button>
  </section>
{:else}
  <section class="wizard-run" aria-labelledby="run-form-heading">
    <h3 id="run-form-heading" class="visually-hidden">Run configuration</h3>

    <ul class="wizard-summary wizard-summary-compact">
      <li class="wizard-summary-row">
        <span class="wizard-summary-label">Graph store</span>
        <span class="wizard-summary-value">{runDefaults.graphStoreLabel ?? "Connected"}</span>
      </li>
      <li class="wizard-summary-row">
        <span class="wizard-summary-label">Domain pack</span>
        <span class="wizard-summary-value">
          {runDefaults.packs.find((p) => p.id === selectedPackId)?.title ?? runDefaults.packTitle ?? "Not selected"}
        </span>
      </li>
      <li class="wizard-summary-row">
        <span class="wizard-summary-label">Documents</span>
        <span class="wizard-summary-value">
          {runDefaults.documents.length} parsed document{runDefaults.documents.length === 1 ? "" : "s"}
        </span>
      </li>
    </ul>

    <form class="form wizard-run-form" on:submit|preventDefault={startRun}>
      <label class="field">
        <span class="field-label">Domain pack</span>
        <select class="input" value={selectedPackId} on:change={onPackChange} required>
          {#each runDefaults.packs as pack (pack.id)}
            <option value={pack.id}>
              {pack.title}{pack.is_builtin ? " (built-in)" : ""}
            </option>
          {/each}
        </select>
        <span class="field-hint">Controls extraction vocabulary and graph shape for this run.</span>
      </label>

      <label class="field">
        <span class="field-label">Run name</span>
        <input
          class="input"
          type="text"
          bind:value={label}
          placeholder={defaultLabel()}
          autocomplete="off"
          maxlength="200"
        />
        <span class="field-hint">Shown on the monitoring screen while your run progresses.</span>
      </label>

      <details class="disclosure">
        <summary>Advanced run options</summary>
        <label class="field">
          <span class="field-label">Stop after stage (optional)</span>
          <select class="input" bind:value={stopAfterStage}>
            <option value="">Full pipeline</option>
            {#each PIPELINE_STAGES as stage}
              <option value={stage}>{stage}</option>
            {/each}
          </select>
          <span class="field-hint">Useful for debugging — e.g. stop after extracting without embedding.</span>
        </label>
      </details>

      <details class="disclosure">
        <summary>{runDefaults.documents.length} document{runDefaults.documents.length === 1 ? "" : "s"} included</summary>
        <ul class="run-doc-list">
          {#each runDefaults.documents as doc (doc.id)}
            <li><span class="run-doc-name">{doc.name}</span> <span class="run-doc-meta">{doc.chunk_count} chunks</span></li>
          {/each}
        </ul>
      </details>

      {#if error}<p class="err" role="alert">{error}</p>{/if}
    </form>
  </section>
{/if}

<style>
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
