<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import {
    CONNECT_PIPELINE_API,
    PIPELINE_STAGES,
    pipelineWizardHref,
    withReturnTo,
    type PipelineRunDefaults,
    type PipelineWizardProgress,
  } from "$lib/connect/pipeline-config";

  export let runDefaults: PipelineRunDefaults;
  export let progress: PipelineWizardProgress;
  export let modelsReady = true;
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

  $: selectedPack = runDefaults.packs.find((p) => p.id === selectedPackId);
  $: canStart = runDefaults.documents.length > 0 && Boolean(selectedPackId) && modelsReady && !submitting;
  $: docWarning =
    progress.parsedDocumentCount > 0 &&
    progress.selectedDocumentCount < progress.parsedDocumentCount;
  $: modelsWarning = !modelsReady;

  onMount(() => {
    label = defaultLabel();
  });

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

  $: estimatedCalls = Math.max(runDefaults.documents.length * 4, runDefaults.documents.length);
</script>

{#if runDefaults.documents.length === 0}
  <section class="wizard-run-empty" role="status">
    <p class="notice">
      No documents are selected for this run. Go back to <strong>Sources</strong>, import from any connector or URL,
      then check the documents you want included.
    </p>
    <button type="button" class="btn btn-outline btn-sm" on:click={onBack}>Back to Sources</button>
  </section>
{:else}
  <section class="wizard-launch" aria-labelledby="launch-heading">
    <h3 id="launch-heading" class="visually-hidden">Review and launch</h3>

    <ul class="preflight-checklist">
      <li class="preflight-row">
        <span class="preflight-bullet preflight-bullet-ok" aria-hidden="true">■</span>
        <div class="preflight-main">
          <span class="preflight-label">Graph store</span>
          <span class="preflight-value">{progress.graphStoreLabel ?? "Connected"}</span>
        </div>
        <a class="preflight-edit" href={pipelineWizardHref("store")}>Edit →</a>
      </li>
      <li class="preflight-row">
        <span class="preflight-bullet preflight-bullet-ok" aria-hidden="true">■</span>
        <div class="preflight-main">
          <span class="preflight-label">Domain pack</span>
          <span class="preflight-value">
            <strong>{selectedPack?.title ?? progress.packTitle ?? "Built-in generic"}</strong>
            {#if selectedPack?.is_builtin}
              <span class="tag tag-builtin">Built-in</span>
            {:else if selectedPack}
              <span class="tag tag-custom">Custom</span>
            {/if}
          </span>
        </div>
        <a class="preflight-edit" href={pipelineWizardHref("domain")}>Edit →</a>
      </li>
      <li class="preflight-row" class:preflight-row-warn={docWarning}>
        <span
          class="preflight-bullet"
          class:preflight-bullet-ok={!docWarning}
          class:preflight-bullet-warn={docWarning}
          aria-hidden="true"
        >{docWarning ? "□" : "■"}</span>
        <div class="preflight-main">
          <span class="preflight-label">Documents</span>
          <span class="preflight-value">
            <strong>{runDefaults.documents.length} document{runDefaults.documents.length === 1 ? "" : "s"} selected</strong>
          </span>
          {#if docWarning}
            <p class="preflight-warn-note">
              Only {progress.selectedDocumentCount} of {progress.parsedDocumentCount} parsed documents selected.
            </p>
          {/if}
        </div>
        <a class="preflight-edit" href={pipelineWizardHref("sources")}>Edit →</a>
      </li>
      <li class="preflight-row" class:preflight-row-warn={modelsWarning}>
        <span
          class="preflight-bullet"
          class:preflight-bullet-ok={!modelsWarning}
          class:preflight-bullet-warn={modelsWarning}
          aria-hidden="true"
        >{modelsWarning ? "□" : "■"}</span>
        <div class="preflight-main">
          <span class="preflight-label">Models</span>
          <span class="preflight-value">
            <strong>{modelsReady ? "Default routes" : "Routes not configured"}</strong>
          </span>
          {#if modelsWarning}
            <p class="preflight-warn-note">Publish chat and embedding routes before starting.</p>
          {/if}
        </div>
        <a class="preflight-edit" href={withReturnTo(CONNECT_BASE + "/models", { kind: "pipeline-setup", step: "launch" })}>Edit →</a>
      </li>
    </ul>

    <form class="form wizard-run-form" on:submit|preventDefault={startRun}>
      <label class="field">
        <span class="field-label">Run name (shown in run history)</span>
        <input
          class="input"
          type="text"
          bind:value={label}
          autocomplete="off"
          maxlength="200"
        />
      </label>

      <label class="field">
        <span class="field-label">Domain pack for this run</span>
        <select class="input" value={selectedPackId} on:change={onPackChange} required>
          {#each runDefaults.packs as pack (pack.id)}
            <option value={pack.id}>
              {pack.title}{pack.is_builtin ? " (built-in)" : ""}
            </option>
          {/each}
        </select>
        <span class="field-hint">Controls extraction vocabulary. Defaults to your saved domain.</span>
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

      <aside class="run-estimate" aria-label="Run estimates">
        <div class="run-estimate-row">
          <span class="run-estimate-label">Estimated run time</span>
          <span class="run-estimate-value">~3–8 min depending on document size</span>
        </div>
        <div class="run-estimate-row">
          <span class="run-estimate-label">Estimated LLM calls</span>
          <span class="run-estimate-value">~{estimatedCalls} calls across {runDefaults.documents.length} document{runDefaults.documents.length === 1 ? "" : "s"}</span>
        </div>
        <div class="run-estimate-row">
          <span class="run-estimate-label">Models used</span>
          <span class="run-estimate-value">{modelsReady ? "Configured ingest routes" : "Configure routes first"}</span>
        </div>
      </aside>

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
