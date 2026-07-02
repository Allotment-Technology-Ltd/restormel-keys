<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import { browser } from "$app/environment";
  import { HOME_HREF } from "$lib/nav-config";
  import { page } from "$app/stores";
  import { tick } from "svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import {
    PIPELINE_WIZARD_STEPS,
    DEMOTED_PIPELINE_WIZARD_STEP,
    nextPipelineWizardStep,
    pipelineWizardHref,
    resolveM1BuildPanel,
    m1BuildEyebrow,
    m1LaunchMetaLine,
    M1_BUILD_PANEL_COPY,
    type M1BuildPanelId,
    type PipelineRunDefaults,
    type PipelineWizardProgress,
    type PipelineWizardStepId,
  } from "$lib/connect/pipeline-config";
  import { INGEST_ROUTES_HREF } from "$lib/nav-config";
  import PipelineWizardStepper from "$lib/components/connect/pipeline/PipelineWizardStepper.svelte";
  import type { ConnectTrustScorecard } from "@restormel/contracts";
  import type { ConnectRunPreflightResult } from "$lib/connect/run-preflight";

  const storePanelImport = () => import("$lib/components/connect/pipeline/ConnectGraphStorePanel.svelte");
  const providerPanelImport = () => import("$lib/components/connect/pipeline/ConnectProviderKeyPanel.svelte");
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

  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import BrutalLoadingState from "$lib/components/brutalist/BrutalLoadingState.svelte";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

  type WizardData = {
    step: PipelineWizardStepId;
    wizard: PipelineWizardProgress | null;
    runDefaults: PipelineRunDefaults | null;
    previousScorecard?: ConnectTrustScorecard | null;
    runPreflight?: ConnectRunPreflightResult | null;
    modelsReady?: boolean;
    phase?: "initial" | "operational";
    workspaceId?: string;
    loadFailed?: boolean;
    providerVerify?: {
      providerType: string;
      detail: string | null;
      checkedAt: number | null;
    } | null;
  };

  export let data: WizardData;


  $: step = data.step;
  $: journeyPhase = data.phase ?? "initial";
  $: progress = data.wizard;
  $: runDefaults = data.runDefaults;
  // R4: the store step is demoted off the stepper strip — it's an aside reached
  // via "Configure store" or a `?step=store` deep link, not a numbered flow step.
  $: isStoreAside = step === "store";
  // R4-S2(c): the auto-provision promise only holds when the host-managed Postgres store is ON.
  $: hostManagedGraphStoreOn = ($page.data.moduleFlags ?? MVP_MODULE_DEFAULTS).connectHostManagedGraphStore;
  // RES-113 PR-5: the journey Build (plan §3.2). DEFAULT-OFF — with the flag off
  // the {:else} wizard below renders byte-for-byte unchanged. With it ON the
  // interactive stepper is GONE: `resolveM1BuildPanel` derives the ONE panel from
  // real signals, so no two asks can ever co-exist (structural guarantee).
  $: onboardingJourney = ($page.data.moduleFlags ?? MVP_MODULE_DEFAULTS).onboardingJourney;
  // Flag-gated store lead: append the "provisioned automatically" claim ONLY when
  // the module is ON. With it OFF (MVP default) the base BYO-honest lead stands.
  $: storeLead = hostManagedGraphStoreOn
    ? `${DEMOTED_PIPELINE_WIZARD_STEP.lead} Your host-managed Postgres graph store is provisioned automatically on flow entry — connect a store you manage here to override it.`
    : DEMOTED_PIPELINE_WIZARD_STEP.lead;
  // Provisioning receipt: when auto-provision is ON and a target now exists, the
  // workspace store was provisioned for them — say so honestly (no fabricated
  // receipt when the flag is OFF or no store exists).
  $: showProvisionReceipt =
    isStoreAside && hostManagedGraphStoreOn && Boolean(progress?.hasGraphStore);
  $: stepIndex = PIPELINE_WIZARD_STEPS.findIndex((s) => s.id === step);
  $: current =
    isStoreAside
      ? DEMOTED_PIPELINE_WIZARD_STEP
      : (PIPELINE_WIZARD_STEPS[stepIndex] ?? PIPELINE_WIZARD_STEPS[0]);
  $: isFirst = !isStoreAside && stepIndex <= 0;
  $: showRepeatRunKicker = journeyPhase === "operational" && Boolean(progress?.hasGraph);

  // ── RES-113 PR-5 · journey Build derivations (flag-ON only) ────────────────
  // Store + domain are off the spine: store keeps its existing aside; domain
  // (plan §3.2 point 3) becomes an Advanced aside — a built-in pack applies
  // silently on the spine, and pack/schema design is reached from the Sources
  // page's "Advanced — full pipeline control" disclosure or a deep link.
  $: journeyAside = onboardingJourney && (step === "store" || step === "domain") ? step : null;
  // The ONE spine panel (reveal predicate, quoted per ux-craft 2.1):
  // `!hasProviderKey` → provider ask; `selectedDocumentCount === 0` → sources
  // ask; else → launch. Exactly one renders; the others do not mount.
  $: journeyPanel = onboardingJourney && progress && !journeyAside ? resolveM1BuildPanel(progress) : null;
  // Copy pack Appendix A-1: eyebrow on the two ask panels only; launch owns its frame.
  $: journeyEyebrow = journeyPanel ? m1BuildEyebrow(journeyPanel) : null;
  $: journeyLaunchDocCount = runDefaults?.documents.length ?? progress?.selectedDocumentCount ?? 0;

  // Keep the URL `?step=` aligned with the derived panel so the server loads the
  // launch data (runDefaults / preflight / previous scorecard) exactly when the
  // launch panel shows. replaceState — the correction is not a history entry.
  let journeyNavPending: M1BuildPanelId | null = null;
  $: if (step === journeyNavPending) journeyNavPending = null;
  $: if (browser && journeyPanel && step !== journeyPanel && journeyNavPending !== journeyPanel) {
    journeyNavPending = journeyPanel;
    goToStep(journeyPanel, true);
  }

  // Focus relocation on the state-derived panel swap (a11y skill: never destroy
  // the focused element in an {#if} swap without relocating focus — e.g. the
  // sources ask advancing to launch unmounts the control the user just used).
  // Programmatic-only target: tabindex="-1", visible outline suppressed.
  let journeyHeadingEl: HTMLHeadingElement | undefined;
  let lastJourneyPanel: M1BuildPanelId | null = null;
  $: trackJourneyPanelFocus(journeyPanel);
  function trackJourneyPanelFocus(panel: M1BuildPanelId | null) {
    if (panel === null || panel === lastJourneyPanel) return;
    const isFirstPanel = lastJourneyPanel === null;
    lastJourneyPanel = panel;
    if (isFirstPanel || !browser) return;
    void tick().then(() => journeyHeadingEl?.focus());
  }

  // Real completion per step (not position): drives the stepper's ✓ marks so a
  // deep link to a later step can't show unconfigured steps as done.
  function stepDone(p: PipelineWizardProgress, id: PipelineWizardStepId): boolean {
    if (id === "provider") return p.hasProviderKey;
    if (id === "store") return p.hasGraphStore;
    if (id === "domain") return p.hasCustomPack || Boolean(p.selectedDomainPackId);
    if (id === "sources") return p.selectedDocumentCount > 0;
    return false;
  }

  $: completedStepIds = progress
    ? PIPELINE_WIZARD_STEPS.filter((s) => stepDone(progress!, s.id)).map((s) => s.id)
    : [];
  // R4: the graph store is auto-provisioned (demoted off the strip), so the flow's
  // steps are reachable from entry — the stepper no longer gates on a store.
  $: laterStepsReachable = true;

  async function scrollToWizardBody() {
    await tick();
    const reduceMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .querySelector(".wizard-body")
      ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  function goToStep(id: PipelineWizardStepId, replace = false) {
    const url = new URL($page.url);
    url.searchParams.set("step", id);
    goto(`${url.pathname}?${url.searchParams.toString()}`, { replaceState: replace, keepFocus: true }).then(
      scrollToWizardBody,
    );
  }

  // R4-U1: a provisioned workspace enters at `sources` with a pack already
  // satisfied. Strict positional advance would land Continue on `domain`, making
  // the golden path 3 panels (sources → domain → launch). `nextPipelineWizardStep`
  // skips `domain` when a pack is satisfied so the provisioned path is
  // sources+pack → launch = 2 panels. `domain` stays reachable via the stepper
  // and the launch panel's "Edit →" affordance.
  $: packSatisfied = Boolean(progress?.selectedDomainPackId || progress?.hasCustomPack);

  function goNext() {
    const next = nextPipelineWizardStep(step, packSatisfied);
    if (!next) return;
    goToStep(next);
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
  $: canContinueDomain = Boolean(progress?.selectedDomainPackId || progress?.hasCustomPack || domainCanContinue);
  $: canContinueSources = (progress?.selectedDocumentCount ?? 0) > 0;

  let domainCanContinue = false;
  let launchStep: { submitRun: () => void } | undefined;
  let runSubmitting = false;
  // Single source of truth for the START RUN gate — bound from the launch panel so
  // the footer can't drift from the panel's own canStart logic.
  let runCanStart = false;

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

  // Once the user has visited the Domain step, the selector there has consumed the
  // template (it clears storage and strips the URL param) — stop promising a pre-fill.
  let templateHandled = false;
  $: if (step === "domain" && pendingTemplateId) templateHandled = true;

  $: showTemplateBanner =
    Boolean(pendingTemplateId) && !templateHandled && step !== "domain" && Boolean(progress?.hasGraphStore);

  function goToDomainForTemplate() {
    goToStep("domain");
  }

  function retryLoad() {
    if (typeof location !== "undefined") location.reload();
  }

  function onDomainStepState(event: CustomEvent<{ canContinue: boolean }>) {
    domainCanContinue = event.detail.canContinue;
  }
</script>

{#if !progress}
  {#if data.loadFailed}
    <BrutalErrorBanner
      title="Pipeline setup"
      message="Could not load your pipeline setup. Your configuration is unchanged — try again."
    />
    <div class="wizard-fallback-actions">
      <button type="button" class="btn btn-primary btn-sm" on:click={retryLoad}>Try again</button>
      <a class="btn btn-outline btn-sm" href={HOME_HREF}>Home</a>
    </div>
  {:else}
    <p class="notice" role="status">Sign in to set up your pipeline.</p>
    <div class="wizard-fallback-actions">
      <a class="btn btn-primary btn-sm" href="{DASHBOARD_BASE}/login">Sign in</a>
    </div>
  {/if}
{:else if onboardingJourney}
  <!-- ── RES-113 PR-5: journey Build — ONE state-derived panel (plan §3.2) ─────
       No interactive stepper on this path. `resolveM1BuildPanel(progress)` returns
       exactly one of provider-ask / sources-ask / launch, so competing asks are
       structurally impossible. All strings verbatim from the copy pack §2.
       Reveal predicates: provider ask ⇐ `!hasProviderKey`; sources ask ⇐
       `selectedDocumentCount === 0`; launch otherwise. Flag-OFF renders the
       {:else} wizard below byte-for-byte unchanged. -->
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
      Template <strong>{pendingTemplateTitle}</strong> selected — we'll pre-fill your domain config when you reach the
      Domain step.
    </div>
  {/if}

  {#if journeyAside === "store"}
    <nav class="wizard-crumb" aria-label="Breadcrumb">
      <a href={HOME_HREF}>Home</a>
      <span aria-hidden="true">›</span>
      <a href={pipelineWizardHref("launch")}>Build</a>
      <span aria-hidden="true">›</span>
      <span aria-current="page">Configure store</span>
    </nav>
    <header class="wizard-header">
      <p class="wizard-kicker">Optional · graph store override</p>
      <h2 class="wizard-title">{DEMOTED_PIPELINE_WIZARD_STEP.title}</h2>
      <p class="wizard-lead">{storeLead}</p>
      {#if showProvisionReceipt}
        <p class="wizard-provision-receipt" role="status">
          ✓ Provisioned automatically — <strong>{progress?.graphStoreLabel ?? "Host-managed Postgres graph store"}</strong>
          is your graph store. Connect a store you manage below to override it.
        </p>
      {/if}
    </header>
    <div class="wizard-body">
      {#await storePanelImport()}
        <BrutalLoadingState message="Loading graph store panel…" rows={3} />
      {:then { default: ConnectGraphStorePanel }}
        <ConnectGraphStorePanel embedded on:updated={onPanelUpdated} />
      {:catch}
        <BrutalErrorBanner title="Graph store" message="Could not load this panel." />
        <div class="wizard-fallback-actions">
          <button type="button" class="btn btn-primary btn-sm" on:click={retryLoad}>Refresh and try again</button>
        </div>
      {/await}
    </div>
    <footer class="wizard-footer">
      <div class="wizard-footer-left">
        <a class="btn btn-outline btn-sm" href={pipelineWizardHref("launch")}>← Back to Build</a>
      </div>
    </footer>
  {:else if journeyAside === "domain"}
    <!-- Domain is OFF the spine (plan §3.2 point 3): a built-in pack applies
         silently on the golden path; pack/schema design lives here, reached from
         the Sources page's "Advanced — full pipeline control" disclosure. -->
    <nav class="wizard-crumb" aria-label="Breadcrumb">
      <a href={HOME_HREF}>Home</a>
      <span aria-hidden="true">›</span>
      <a href={pipelineWizardHref("launch")}>Build</a>
      <span aria-hidden="true">›</span>
      <span aria-current="page">Domain packs</span>
    </nav>
    <header class="wizard-header">
      <p class="wizard-kicker">Advanced · domain packs</p>
      <h2 class="wizard-title">Define how documents become a graph</h2>
      <p class="wizard-lead">
        A built-in pack is already applied for you — nothing here is required. Design or import
        your own pack only if your domain needs a different shape.
      </p>
    </header>
    <div class="wizard-body">
      {#await domainPanelImport()}
        <BrutalLoadingState message="Loading domain packs…" rows={3} />
      {:then { default: ConnectDomainPacksPanel }}
        <ConnectDomainPacksPanel
          embedded
          wizardStep={step}
          {modelsReady}
          on:updated={onPanelUpdated}
          on:stepState={onDomainStepState}
        />
      {:catch}
        <BrutalErrorBanner title="Domain packs" message="Could not load this panel." />
        <div class="wizard-fallback-actions">
          <button type="button" class="btn btn-primary btn-sm" on:click={retryLoad}>Refresh and try again</button>
        </div>
      {/await}
    </div>
    <footer class="wizard-footer">
      <div class="wizard-footer-left">
        <a class="btn btn-outline btn-sm" href={pipelineWizardHref("launch")}>← Back to Build</a>
      </div>
    </footer>
  {:else if journeyPanel}
    <header class="wizard-header">
      {#if journeyEyebrow}
        <!-- Non-interactive orientation eyebrow (copy pack §2 / Appendix A-1):
             plain "STEP N OF 4", ask panels only — suppressed on launch, where
             the CTA owns the frame. -->
        <p class="wizard-kicker">{journeyEyebrow}</p>
      {/if}
      {#if journeyPanel === "provider"}
        <h2 class="wizard-title journey-panel-title" tabindex="-1" bind:this={journeyHeadingEl}>
          {M1_BUILD_PANEL_COPY.provider.headline}
        </h2>
        <p class="wizard-lead">{M1_BUILD_PANEL_COPY.provider.supporting}</p>
      {:else if journeyPanel === "sources"}
        <h2 class="wizard-title journey-panel-title" tabindex="-1" bind:this={journeyHeadingEl}>
          {M1_BUILD_PANEL_COPY.sources.headline}
        </h2>
        <p class="wizard-lead">{M1_BUILD_PANEL_COPY.sources.supporting}</p>
      {:else}
        <h2 class="wizard-title journey-panel-title" tabindex="-1" bind:this={journeyHeadingEl}>
          {progress.hasGraph
            ? M1_BUILD_PANEL_COPY.launch.headlineReRun
            : M1_BUILD_PANEL_COPY.launch.headlineFirstRun}
        </h2>
        <p class="journey-launch-meta">{m1LaunchMetaLine(journeyLaunchDocCount)}</p>
        <p class="wizard-lead">{M1_BUILD_PANEL_COPY.launch.outcome}</p>
        <p class="journey-expectation">{M1_BUILD_PANEL_COPY.launch.expectation}</p>
      {/if}
    </header>

    <div class="wizard-body">
      {#if journeyPanel === "provider"}
        {#await providerPanelImport()}
          <BrutalLoadingState message="Loading provider step…" rows={2} />
        {:then { default: ConnectProviderKeyPanel }}
          <ConnectProviderKeyPanel
            hasProviderKey={Boolean(progress?.hasProviderKey)}
            verifyReceipt={data.providerVerify ?? null}
            {modelsReady}
          />
        {:catch}
          <BrutalErrorBanner title="Provider key" message="Could not load this panel." />
          <div class="wizard-fallback-actions">
            <button type="button" class="btn btn-primary btn-sm" on:click={retryLoad}>Refresh and try again</button>
          </div>
        {/await}
        <!-- Configure = one field (REC-ADR-015): recommended models pre-chosen;
             the per-stage picker is an Advanced disclosure, collapsed by default.
             Reveal predicate: static disclosure licensed by REC-ADR-015 (model
             choice happens at ingest — this is where ingest is configured). -->
        <p class="journey-models-line">{M1_BUILD_PANEL_COPY.provider.modelsLine}</p>
        <details class="wizard-advanced-models">
          <summary>{M1_BUILD_PANEL_COPY.provider.advancedLabel}</summary>
          <p class="wizard-advanced-models-lead">
            Recommended models are already chosen for each pipeline stage. Models are picked
            <strong>now, at ingest</strong> — not changed retroactively on an existing graph. Open the
            ingest routes to assign a specific model per stage.
          </p>
          <a class="btn btn-outline btn-sm" href={INGEST_ROUTES_HREF}>Edit ingest routes</a>
        </details>
      {:else if journeyPanel === "sources"}
        {#await sourcesPanelImport()}
          <BrutalLoadingState message="Loading sources…" rows={3} />
        {:then { default: ConnectSourcesPanel }}
          <!-- wizardStep is pinned to "sources" (not the raw URL step) so the
               panel's returnTo side-task links come back to the spine. -->
          <ConnectSourcesPanel embedded wizardStep="sources" on:updated={onPanelUpdated} />
        {:catch}
          <BrutalErrorBanner title="Sources" message="Could not load this panel." />
          <div class="wizard-fallback-actions">
            <button type="button" class="btn btn-primary btn-sm" on:click={retryLoad}>Refresh and try again</button>
          </div>
        {/await}
      {:else if runDefaults}
        {#await launchStepImport()}
          <BrutalLoadingState message="Loading review…" rows={3} />
        {:then { default: ConnectPipelineReviewLaunch }}
          <ConnectPipelineReviewLaunch
            bind:this={launchStep}
            bind:submitting={runSubmitting}
            bind:canStart={runCanStart}
            {runDefaults}
            {progress}
            {modelsReady}
            previousScorecard={data.previousScorecard ?? null}
            preflight={data.runPreflight ?? null}
            onBack={() => goToStep("sources")}
          />
        {:catch}
          <BrutalErrorBanner title="Review" message="Could not load this panel." />
          <div class="wizard-fallback-actions">
            <button type="button" class="btn btn-primary btn-sm" on:click={retryLoad}>Refresh and try again</button>
          </div>
        {/await}
      {:else}
        <!-- Derived panel is launch but the URL step hasn't caught up yet — the
             replaceState correction above is in flight and brings runDefaults. -->
        <BrutalLoadingState message="Loading review…" rows={3} />
      {/if}
    </div>

    {#if journeyPanel === "launch" && runDefaults}
      <!-- One yellow primary, no Skip beside it (plan §3.2). Disabled reason is
           announced via aria-describedby (a title alone is not reliably read on
           a disabled control). -->
      <footer class="wizard-footer">
        <div class="wizard-footer-right">
          <button
            type="button"
            class="btn btn-primary btn-lg"
            disabled={!runCanStart || runSubmitting}
            title={!runCanStart ? "Select documents, a domain pack, a graph store, configure routes, and clear the provider preflight to start" : undefined}
            aria-describedby={!runCanStart ? "start-run-hint" : undefined}
            on:click={() => launchStep?.submitRun()}
          >
            {runSubmitting ? "Starting…" : M1_BUILD_PANEL_COPY.launch.cta}
          </button>
          {#if !runCanStart}
            <span id="start-run-hint" class="sr-only">
              Select documents, a domain pack, a graph store, configure routes, and clear the provider preflight to start.
            </span>
          {/if}
        </div>
      </footer>
    {/if}
  {/if}
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
      Template <strong>{pendingTemplateTitle}</strong> selected — we'll pre-fill your domain config when you reach the
      Domain step.
    </div>
  {/if}

  {#if !isStoreAside}
    <PipelineWizardStepper
      currentStep={step}
      onNavigate={goToStep}
      completedIds={completedStepIds}
      navigable={laterStepsReachable}
    />
  {/if}

  <nav class="wizard-crumb" aria-label="Breadcrumb">
    <a href={HOME_HREF}>Home</a>
    <span aria-hidden="true">›</span>
    {#if isStoreAside}
      <a href={pipelineWizardHref("launch")}>Setup</a>
      <span aria-hidden="true">›</span>
      <span aria-current="page">Configure store</span>
    {:else}
      <span aria-current="page">Setup · {current.label}</span>
    {/if}
  </nav>

  <header class="wizard-header">
    {#if isStoreAside}
      <p class="wizard-kicker">Optional · graph store override</p>
    {:else}
      <p class="wizard-kicker">
        {#if showRepeatRunKicker}
          Repeat run · step {stepIndex + 1} of {PIPELINE_WIZARD_STEPS.length}
        {:else}
          Step {stepIndex + 1} of {PIPELINE_WIZARD_STEPS.length}
        {/if}
      </p>
    {/if}
    <h2 class="wizard-title">{current.title}</h2>
    {#if journeyPhase === "initial" || isStoreAside}
      <p class="wizard-lead">{isStoreAside ? storeLead : current.lead}</p>
    {/if}
    {#if showProvisionReceipt}
      <p class="wizard-provision-receipt" role="status">
        ✓ Provisioned automatically — <strong>{progress?.graphStoreLabel ?? "Host-managed Postgres graph store"}</strong>
        is your graph store. Connect a store you manage below to override it.
      </p>
    {/if}
  </header>

  <div class="wizard-body">
    {#if step === "provider"}
      {#await providerPanelImport()}
        <BrutalLoadingState message="Loading provider step…" rows={2} />
      {:then { default: ConnectProviderKeyPanel }}
        <ConnectProviderKeyPanel
          hasProviderKey={Boolean(progress?.hasProviderKey)}
          verifyReceipt={data.providerVerify ?? null}
          {modelsReady}
        />
      {:catch}
        <BrutalErrorBanner title="Provider step" message="Could not load this step." />
        <div class="wizard-fallback-actions">
          <button type="button" class="btn btn-primary btn-sm" on:click={retryLoad}>Refresh and try again</button>
        </div>
      {/await}
    {:else if step === "store"}
      {#await storePanelImport()}
        <BrutalLoadingState message="Loading graph store panel…" rows={3} />
      {:then { default: ConnectGraphStorePanel }}
        <ConnectGraphStorePanel embedded on:updated={onPanelUpdated} />
      {:catch}
        <BrutalErrorBanner title="Graph store step" message="Could not load this step." />
        <div class="wizard-fallback-actions">
          <button type="button" class="btn btn-primary btn-sm" on:click={retryLoad}>Refresh and try again</button>
        </div>
      {/await}
    {:else if step === "domain"}
      {#await domainPanelImport()}
        <BrutalLoadingState message="Loading domain packs…" rows={3} />
      {:then { default: ConnectDomainPacksPanel }}
        <ConnectDomainPacksPanel
          embedded
          wizardStep={step}
          {modelsReady}
          on:updated={onPanelUpdated}
          on:stepState={onDomainStepState}
        />
      {:catch}
        <BrutalErrorBanner title="Domain step" message="Could not load this step." />
        <div class="wizard-fallback-actions">
          <button type="button" class="btn btn-primary btn-sm" on:click={retryLoad}>Refresh and try again</button>
        </div>
      {/await}
    {:else if step === "sources"}
      {#await sourcesPanelImport()}
        <BrutalLoadingState message="Loading sources…" rows={3} />
      {:then { default: ConnectSourcesPanel }}
        <ConnectSourcesPanel embedded wizardStep={step} on:updated={onPanelUpdated} />
      {:catch}
        <BrutalErrorBanner title="Sources step" message="Could not load this step." />
        <div class="wizard-fallback-actions">
          <button type="button" class="btn btn-primary btn-sm" on:click={retryLoad}>Refresh and try again</button>
        </div>
      {/await}
    {:else if step === "launch" && runDefaults}
      {#await launchStepImport()}
        <BrutalLoadingState message="Loading review…" rows={3} />
      {:then { default: ConnectPipelineReviewLaunch }}
        <ConnectPipelineReviewLaunch
          bind:this={launchStep}
          bind:submitting={runSubmitting}
          bind:canStart={runCanStart}
          {runDefaults}
          {progress}
          {modelsReady}
          previousScorecard={data.previousScorecard ?? null}
          preflight={data.runPreflight ?? null}
          onBack={() => goToStep("sources")}
        />
      {:catch}
        <BrutalErrorBanner title="Review step" message="Could not load this step." />
        <div class="wizard-fallback-actions">
          <button type="button" class="btn btn-primary btn-sm" on:click={retryLoad}>Refresh and try again</button>
        </div>
      {/await}
    {/if}
  </div>

  <footer class="wizard-footer">
    <div class="wizard-footer-left">
      {#if isStoreAside}
        <a class="btn btn-outline btn-sm" href={pipelineWizardHref("launch")}>← Back to setup</a>
      {:else if isFirst}
        <a class="btn btn-outline btn-sm" href={HOME_HREF}>Back</a>
      {:else}
        <button type="button" class="btn btn-outline btn-sm" on:click={goBack}>Back</button>
      {/if}
    </div>
    <div class="wizard-footer-right">
      {#if step === "launch"}
        {#if runDefaults}
          <!-- F-P2-1: a disabled CTA's reason is announced via aria-describedby (a
               title attribute alone is not reliably read on a disabled control). -->
          <button
            type="button"
            class="btn btn-primary btn-lg"
            disabled={!runCanStart || runSubmitting}
            title={!runCanStart ? "Select documents, a domain pack, a graph store, configure routes, and clear the provider preflight to start" : undefined}
            aria-describedby={!runCanStart ? "start-run-hint" : undefined}
            on:click={() => launchStep?.submitRun()}
          >
            {runSubmitting ? "Starting…" : "START RUN →"}
          </button>
          {#if !runCanStart}
            <span id="start-run-hint" class="sr-only">
              Select documents, a domain pack, a graph store, configure routes, and clear the provider preflight to start.
            </span>
          {/if}
        {/if}
      {:else if step === "store"}
        <a
          class="btn btn-primary"
          href={pipelineWizardHref("launch")}
        >
          Done → Back to setup
        </a>
      {:else if step === "provider"}
        <button type="button" class="btn btn-outline btn-sm" on:click={goNext}>Skip for now</button>
        <button
          type="button"
          class="btn btn-primary"
          on:click={goNext}
          title={!progress.hasProviderKey ? "Add a provider key, or skip and add it before launch" : undefined}
        >
          {progress.hasProviderKey ? "Key connected → Continue" : "Continue"}
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
          aria-describedby={!canContinueDomain ? "domain-continue-hint" : undefined}
        >
          Domain selected → Continue
        </button>
        {#if !canContinueDomain}
          <span id="domain-continue-hint" class="sr-only">Select or generate a domain pack to continue.</span>
        {/if}
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
          aria-describedby={!canContinueSources ? "sources-continue-hint" : undefined}
        >
          Sources ready → Continue ({progress.selectedDocumentCount} document{progress.selectedDocumentCount === 1 ? "" : "s"})
        </button>
        {#if !canContinueSources}
          <span id="sources-continue-hint" class="sr-only">Select at least one document to continue.</span>
        {/if}
      {/if}
    </div>
  </footer>
{/if}
