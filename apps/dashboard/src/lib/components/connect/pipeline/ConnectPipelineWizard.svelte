<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import {
    PIPELINE_WIZARD_STEPS,
    type PipelineRunDefaults,
    type PipelineWizardProgress,
    type PipelineWizardStepId,
    withWizardReturn,
  } from "$lib/connect/pipeline-config";
  import ConnectGraphStorePanel from "$lib/components/connect/pipeline/ConnectGraphStorePanel.svelte";
  import ConnectDomainPacksPanel from "$lib/components/connect/pipeline/ConnectDomainPacksPanel.svelte";
  import ConnectSourcesPanel from "$lib/components/connect/pipeline/ConnectSourcesPanel.svelte";
  import ConnectPipelineRunStep from "$lib/components/connect/pipeline/ConnectPipelineRunStep.svelte";

  type WizardData = {
    step: PipelineWizardStepId;
    wizard: PipelineWizardProgress | null;
    runDefaults: PipelineRunDefaults | null;
  };

  export let data: WizardData;

  const CONNECT_BASE = DASHBOARD_BASE + "/connect";

  $: step = data.step;
  $: progress = data.wizard;
  $: runDefaults = data.runDefaults;
  $: stepIndex = PIPELINE_WIZARD_STEPS.findIndex((s) => s.id === step);
  $: current = PIPELINE_WIZARD_STEPS[stepIndex] ?? PIPELINE_WIZARD_STEPS[0];
  $: isFirst = stepIndex <= 0;
  $: isLast = stepIndex >= PIPELINE_WIZARD_STEPS.length - 1;

  function stepDone(id: PipelineWizardStepId): boolean {
    if (!progress) return false;
    const idx = PIPELINE_WIZARD_STEPS.findIndex((s) => s.id === id);
    if (id === "store") return progress.hasGraphStore;
    if (id === "domain") return stepIndex > idx || progress.hasCustomPack || Boolean(progress.selectedDomainPackId);
    if (id === "sources") return stepIndex > idx || progress.selectedDocumentCount > 0;
    if (id === "ready") return stepIndex > idx;
    if (id === "run") return false;
    return false;
  }

  function stepReachable(index: number): boolean {
    if (!progress) return index === 0;
    if (index === 0) return true;
    return progress.hasGraphStore;
  }

  function goToStep(id: PipelineWizardStepId, replace = false) {
    const url = new URL($page.url);
    url.searchParams.set("step", id);
    goto(`${url.pathname}?${url.searchParams.toString()}`, { replaceState: replace, keepFocus: true, invalidateAll: true });
  }

  function goNext() {
    if (isLast) return;
    goToStep(PIPELINE_WIZARD_STEPS[stepIndex + 1].id);
  }

  function goBack() {
    if (isFirst) return;
    goToStep(PIPELINE_WIZARD_STEPS[stepIndex - 1].id);
  }

  function onPanelUpdated() {
    goto($page.url.pathname + $page.url.search, { invalidateAll: true, keepFocus: true });
  }

  $: canContinue = step !== "store" || Boolean(progress?.hasGraphStore);
  $: runStepCanStart = Boolean(runDefaults?.documents.length);

  let runStep: ConnectPipelineRunStep | undefined;
  let runSubmitting = false;
</script>

{#if !progress}
  <p class="notice" role="status">Sign in to set up your pipeline.</p>
{:else}
  <nav class="wizard-stepper" aria-label="Pipeline setup progress">
    <ol class="wizard-steps">
      {#each PIPELINE_WIZARD_STEPS as s, i (s.id)}
        {@const done = stepDone(s.id)}
        {@const active = s.id === step}
        {@const reachable = stepReachable(i)}
        <li class="wizard-step" class:wizard-step-active={active} class:wizard-step-done={done && !active}>
          {#if reachable && !active}
            <button type="button" class="wizard-step-btn" on:click={() => goToStep(s.id)} aria-current={active ? "step" : undefined}>
              <span class="wizard-step-num" aria-hidden="true">{done && !active ? "✓" : i + 1}</span>
              <span class="wizard-step-label">{s.label}</span>
            </button>
          {:else}
            <span class="wizard-step-btn" aria-current={active ? "step" : undefined}>
              <span class="wizard-step-num" aria-hidden="true">{done && !active ? "✓" : i + 1}</span>
              <span class="wizard-step-label">{s.label}</span>
            </span>
          {/if}
        </li>
        {#if i < PIPELINE_WIZARD_STEPS.length - 1}
          <li class="wizard-connector" aria-hidden="true"></li>
        {/if}
      {/each}
    </ol>
  </nav>

  <header class="wizard-header">
    <p class="wizard-kicker">Step {stepIndex + 1} of {PIPELINE_WIZARD_STEPS.length}</p>
    <h2 class="wizard-title">{current.title}</h2>
    <p class="wizard-lead">{current.lead}</p>
  </header>

  <div class="wizard-body">
    {#if step === "store"}
      <ConnectGraphStorePanel embedded wizardStep={step} on:updated={onPanelUpdated} />
    {:else if step === "domain"}
      <ConnectDomainPacksPanel embedded wizardStep={step} on:updated={onPanelUpdated} />
    {:else if step === "sources"}
      <ConnectSourcesPanel embedded wizardStep={step} on:updated={onPanelUpdated} />
    {:else if step === "run" && runDefaults}
      <ConnectPipelineRunStep bind:this={runStep} bind:submitting={runSubmitting} {runDefaults} onBack={() => goToStep("sources")} />
    {:else}
      <section class="wizard-ready" aria-labelledby="ready-heading">
        <h3 id="ready-heading" class="visually-hidden">Setup summary</h3>
        <ul class="wizard-summary">
          <li class="wizard-summary-row">
            <span class="wizard-summary-label">Graph store</span>
            <span class="wizard-summary-value">
              {#if progress.hasGraphStore}
                <span class="badge status-success">connected</span>
                {progress.graphStoreLabel}
              {:else}
                Not configured
              {/if}
            </span>
          </li>
          <li class="wizard-summary-row">
            <span class="wizard-summary-label">Domain pack</span>
            <span class="wizard-summary-value">
              {progress.packTitle ?? "Built-in generic"}
              {#if progress.hasCustomPack}<span class="badge status-muted">custom</span>{/if}
            </span>
          </li>
          <li class="wizard-summary-row">
            <span class="wizard-summary-label">Documents</span>
            <span class="wizard-summary-value">
              {#if progress.selectedDocumentCount > 0}
                {progress.selectedDocumentCount} selected for next run
                {#if progress.parsedDocumentCount > progress.selectedDocumentCount}
                  <span class="badge status-muted">{progress.parsedDocumentCount} parsed total</span>
                {/if}
              {:else if progress.parsedDocumentCount > 0}
                {progress.parsedDocumentCount} parsed — select documents in Sources
              {:else if progress.connectionCount > 0}
                {progress.connectionCount} connection{progress.connectionCount === 1 ? "" : "s"} — import files in Sources
              {:else}
                None yet — add in Sources before you run
              {/if}
            </span>
          </li>
          <li class="wizard-summary-row">
            <span class="wizard-summary-label">Domain packs</span>
            <span class="wizard-summary-value">
              Switch pack on the Run step — save multiple custom packs under Domain.
            </span>
          </li>
        </ul>
        <p class="field-hint">
          Need different models per stage?
          <a href={withWizardReturn(CONNECT_BASE + "/models", "ready")}>Configure Models &amp; keys</a>
          — you'll return to this review step when done.
        </p>
      </section>
    {/if}
  </div>

  {#if step === "ready"}
    <footer class="wizard-footer">
      <div class="wizard-footer-left">
        <button type="button" class="btn btn-secondary" on:click={goBack}>Back</button>
      </div>
      <div class="wizard-footer-right">
        <button type="button" class="btn btn-primary" on:click={() => goToStep("run")}>Start your run</button>
      </div>
    </footer>
  {:else if step === "run"}
    <footer class="wizard-footer">
      <div class="wizard-footer-left">
        <button type="button" class="btn btn-secondary" on:click={() => goToStep("ready")}>Back</button>
      </div>
      <div class="wizard-footer-right">
        {#if runDefaults}
          <button
            type="button"
            class="btn btn-primary"
            disabled={!runStepCanStart || runSubmitting}
            on:click={() => runStep?.submitRun()}
          >
            {runSubmitting ? "Starting…" : "Start run"}
          </button>
        {/if}
      </div>
    </footer>
  {:else}
    <footer class="wizard-footer">
      <div class="wizard-footer-left">
        {#if !isFirst}
          <button type="button" class="btn btn-secondary" on:click={goBack}>Back</button>
        {/if}
      </div>
      <div class="wizard-footer-right">
        {#if !current.required}
          <button type="button" class="btn btn-secondary" on:click={goNext}>Skip for now</button>
        {/if}
        <button type="button" class="btn btn-primary" on:click={goNext} disabled={!canContinue}>
          Continue
        </button>
      </div>
    </footer>
    {#if step === "store" && !canContinue}
      <p class="wizard-hint" role="status">Connect a graph store to continue.</p>
    {/if}
  {/if}
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
