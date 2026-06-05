<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import { page } from "$app/stores";
  import { tick } from "svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import {
    PIPELINE_WIZARD_STEPS,
    type PipelineRunDefaults,
    type PipelineWizardProgress,
    type PipelineWizardStepId,
  } from "$lib/connect/pipeline-config";
  import PipelineWizardStepper from "$lib/components/connect/pipeline/PipelineWizardStepper.svelte";

  const storePanelImport = () => import("$lib/components/connect/pipeline/ConnectGraphStorePanel.svelte");
  const domainPanelImport = () => import("$lib/components/connect/pipeline/ConnectDomainPacksPanel.svelte");
  const sourcesPanelImport = () => import("$lib/components/connect/pipeline/ConnectSourcesPanel.svelte");
  const launchStepImport = () =>
    import("$lib/components/connect/pipeline/ConnectPipelineReviewLaunch.svelte");
  import { onMount } from "svelte";
  import {
    getUseCaseById,
    isUseCaseId,
    PENDING_TEMPLATE_STORAGE_KEY,
  } from "$lib/content/use-cases";

  type WizardData = {
    step: PipelineWizardStepId;
    wizard: PipelineWizardProgress | null;
    runDefaults: PipelineRunDefaults | null;
    modelsReady?: boolean;
    phase?: "initial" | "operational";
    workspaceId?: string;
  };

  export let data: WizardData;

  const CONNECT_BASE = DASHBOARD_BASE + "/connect";

  $: step = data.step;
  $: journeyPhase = data.phase ?? "initial";
  $: progress = data.wizard;
  $: runDefaults = data.runDefaults;
  $: stepIndex = PIPELINE_WIZARD_STEPS.findIndex((s) => s.id === step);
  $: current = PIPELINE_WIZARD_STEPS[stepIndex] ?? PIPELINE_WIZARD_STEPS[0];
  $: isFirst = stepIndex <= 0;
  $: showRepeatRunKicker = journeyPhase === "operational" && Boolean(progress?.hasGraph);

  function stepDone(id: PipelineWizardStepId): boolean {
    if (!progress) return false;
    const idx = PIPELINE_WIZARD_STEPS.findIndex((s) => s.id === id);
    if (id === "store") return progress.hasGraphStore;
    if (id === "domain") return stepIndex > idx || progress.hasCustomPack || Boolean(progress.selectedDomainPackId);
    if (id === "sources") return stepIndex > idx || progress.selectedDocumentCount > 0;
    if (id === "launch") return stepIndex > idx;
    return false;
  }

  function stepReachable(index: number): boolean {
    if (!progress) return index === 0;
    if (index === 0) return true;
    return progress.hasGraphStore;
  }

  async function scrollToWizardBody() {
    await tick();
    document.querySelector(".wizard-body")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function goToStep(id: PipelineWizardStepId, replace = false) {
    const url = new URL($page.url);
    url.searchParams.set("step", id);
    goto(`${url.pathname}?${url.searchParams.toString()}`, { replaceState: replace, keepFocus: true }).then(
      scrollToWizardBody,
    );
  }

  function goNext() {
    if (stepIndex >= PIPELINE_WIZARD_STEPS.length - 1) return;
    goToStep(PIPELINE_WIZARD_STEPS[stepIndex + 1].id);
  }

  function goBack() {
    if (isFirst) return;
    goToStep(PIPELINE_WIZARD_STEPS[stepIndex - 1].id);
  }

  async function onPanelUpdated() {
    const wsId = data.workspaceId;
    if (!wsId) return;
    await invalidate(`app:connect-pipeline:${wsId}`);
    if (step === "store" || step === "sources") {
      void invalidate(`app:connect-hub:${wsId}`);
    }
  }

  $: modelsReady = Boolean(data.modelsReady ?? progress?.modelsReady);
  $: canContinueStore = Boolean(progress?.hasGraphStore);
  $: canContinueDomain = Boolean(progress?.selectedDomainPackId || progress?.hasCustomPack || domainCanContinue);
  $: canContinueSources = (progress?.selectedDocumentCount ?? 0) > 0;
  $: runStepCanStart = Boolean(runDefaults?.documents.length) && modelsReady;

  let domainCanContinue = false;
  let launchStep: { submitRun: () => void } | undefined;
  let runSubmitting = false;

  let pendingTemplateId: string | null = null;
  let pendingTemplateTitle: string | null = null;

  onMount(() => {
    const fromUrl = $page.url.searchParams.get("template");
    const fromStorage =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem(PENDING_TEMPLATE_STORAGE_KEY)
        : null;
    const id = fromUrl && isUseCaseId(fromUrl) ? fromUrl : fromStorage && isUseCaseId(fromStorage) ? fromStorage : null;
    if (id) {
      pendingTemplateId = id;
      pendingTemplateTitle = getUseCaseById(id)?.title ?? id;
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(PENDING_TEMPLATE_STORAGE_KEY, id);
      }
    }
  });

  $: showTemplateBanner =
    Boolean(pendingTemplateId) && step !== "domain" && Boolean(progress?.hasGraphStore);

  function goToDomainForTemplate() {
    goToStep("domain");
  }

  function onDomainStepState(event: CustomEvent<{ canContinue: boolean }>) {
    domainCanContinue = event.detail.canContinue;
  }
</script>

{#if !progress}
  <p class="notice" role="status">Sign in to set up your pipeline.</p>
{:else}
  {#if showTemplateBanner}
    <div class="notice template-banner" role="status">
      You came from the <strong>{pendingTemplateTitle}</strong> template — finish setup and we'll pre-fill your domain
      config at the Domain step.
      <button type="button" class="btn btn-outline btn-sm template-banner-btn" on:click={goToDomainForTemplate}>
        Go to Domain step →
      </button>
    </div>
  {:else if pendingTemplateId && !progress?.hasGraphStore}
    <div class="notice template-banner" role="status">
      Template <strong>{pendingTemplateTitle}</strong> selected — connect a graph store first; we'll pre-fill domain
      config at step 2.
    </div>
  {/if}

  <PipelineWizardStepper currentStep={step} onNavigate={goToStep} />

  <nav class="wizard-crumb" aria-label="Breadcrumb">
    <a href={CONNECT_BASE}>Connect home</a>
    <span aria-hidden="true">›</span>
    <span aria-current="page">Setup · {current.label}</span>
  </nav>

  <header class="wizard-header">
    <p class="wizard-kicker">
      {#if showRepeatRunKicker}
        Repeat run · step {stepIndex + 1} of {PIPELINE_WIZARD_STEPS.length}
      {:else}
        Step {stepIndex + 1} of {PIPELINE_WIZARD_STEPS.length}
      {/if}
    </p>
    <h2 class="wizard-title">{current.title}</h2>
    {#if journeyPhase === "initial"}
      <p class="wizard-lead">{current.lead}</p>
    {/if}
  </header>

  <div class="wizard-body">
    {#if step === "store"}
      {#await storePanelImport()}
        <p class="wizard-panel-loading" role="status">Loading graph store panel…</p>
      {:then { default: ConnectGraphStorePanel }}
        <ConnectGraphStorePanel embedded on:updated={onPanelUpdated} />
      {:catch}
        <p class="wizard-panel-error" role="alert">Could not load this step. Refresh and try again.</p>
      {/await}
    {:else if step === "domain"}
      {#await domainPanelImport()}
        <p class="wizard-panel-loading" role="status">Loading domain packs…</p>
      {:then { default: ConnectDomainPacksPanel }}
        <ConnectDomainPacksPanel
          embedded
          wizardStep={step}
          {modelsReady}
          on:updated={onPanelUpdated}
          on:stepState={onDomainStepState}
        />
      {:catch}
        <p class="wizard-panel-error" role="alert">Could not load this step. Refresh and try again.</p>
      {/await}
    {:else if step === "sources"}
      {#await sourcesPanelImport()}
        <p class="wizard-panel-loading" role="status">Loading sources…</p>
      {:then { default: ConnectSourcesPanel }}
        <ConnectSourcesPanel embedded wizardStep={step} on:updated={onPanelUpdated} />
      {:catch}
        <p class="wizard-panel-error" role="alert">Could not load this step. Refresh and try again.</p>
      {/await}
    {:else if step === "launch" && runDefaults}
      {#await launchStepImport()}
        <p class="wizard-panel-loading" role="status">Loading review…</p>
      {:then { default: ConnectPipelineReviewLaunch }}
        <ConnectPipelineReviewLaunch
          bind:this={launchStep}
          bind:submitting={runSubmitting}
          {runDefaults}
          {progress}
          {modelsReady}
          onBack={() => goToStep("sources")}
        />
      {:catch}
        <p class="wizard-panel-error" role="alert">Could not load this step. Refresh and try again.</p>
      {/await}
    {/if}
  </div>

  <footer class="wizard-footer">
    <div class="wizard-footer-left">
      {#if isFirst}
        <a class="btn btn-outline btn-sm" href={CONNECT_BASE}>Back</a>
      {:else}
        <button type="button" class="btn btn-outline btn-sm" on:click={goBack}>Back</button>
      {/if}
    </div>
    <div class="wizard-footer-right">
      {#if step === "launch"}
        {#if runDefaults}
          <button
            type="button"
            class="btn btn-primary btn-lg"
            disabled={!runStepCanStart || runSubmitting}
            title={!runStepCanStart ? "Select documents and configure routes to start" : undefined}
            on:click={() => launchStep?.submitRun()}
          >
            {runSubmitting ? "Starting…" : "START RUN →"}
          </button>
        {/if}
      {:else if step === "store"}
        <button
          type="button"
          class="btn btn-primary"
          on:click={goNext}
          disabled={!canContinueStore}
          title={!canContinueStore ? "Connect your graph store to continue" : undefined}
        >
          Store confirmed → Continue
        </button>
      {:else if step === "domain"}
        {#if !current.required}
          <button type="button" class="btn btn-outline btn-sm" on:click={goNext}>Skip for now</button>
        {/if}
        <button
          type="button"
          class="btn btn-primary"
          on:click={goNext}
          disabled={!canContinueDomain}
          title={!canContinueDomain ? "Select or generate a domain pack to continue" : undefined}
        >
          Domain selected → Continue
        </button>
      {:else if step === "sources"}
        {#if !current.required}
          <button type="button" class="btn btn-outline btn-sm" on:click={goNext}>Skip for now</button>
        {/if}
        <button
          type="button"
          class="btn btn-primary"
          on:click={goNext}
          disabled={!canContinueSources}
          title={!canContinueSources ? "Select at least one document to continue" : undefined}
        >
          Sources ready → Continue ({progress.selectedDocumentCount} document{progress.selectedDocumentCount === 1 ? "" : "s"})
        </button>
      {/if}
    </div>
  </footer>
{/if}
