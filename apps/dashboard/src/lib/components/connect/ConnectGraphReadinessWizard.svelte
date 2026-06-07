<script lang="ts">
  import BrutalBadge from "$lib/components/brutalist/BrutalBadge.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import ConnectGraphProvenanceAudit from "$lib/components/connect/ConnectGraphProvenanceAudit.svelte";
  import type { ProvenanceAuditView } from "$lib/connect/graph-provenance-audit-types";
  import { createEventDispatcher } from "svelte";

  type PackMappingFields = {
    source_table: string;
    passage_table: string;
    source_text_field?: string;
    passage_text_field?: string;
    passage_source_field?: string;
  };

  type DiscoverResult = {
    storeType: string;
    total: number;
    withText: number;
    withoutText: number;
    withPassageText?: number;
    withInlineText?: number;
    scanMeta?: {
      sourceTable: string;
      passageTable: string;
      passageTextField: string;
      passageSourceField: string;
    };
    packSuggestion?: {
      reason: string;
      canAutoApply: boolean;
      suggested?: PackMappingFields;
    } | null;
    packSynced?: boolean;
    mappingInvalid?: boolean;
    pipelineCatalogCount?: number;
    importAlreadySatisfied?: boolean;
  };

  type ImportResult = {
    imported: number;
    skipped: number;
    alreadyPresent: number;
    error?: string;
    message?: string;
  };

  type LinkSourcesOptions = {
    enabled: boolean;
    unitsNeedingLink: number;
    estimate?: boolean;
    candidateSources: number;
    totalUnits: number;
  };

  type RouteOption = {
    id: string;
    name: string;
    isDefault: boolean;
  };

  type EmbeddingHealthView = {
    targetDimensions: number;
    dimensionBuckets: { dimensions: number; count: number }[];
    dominantDimension: number | null;
    hasMixedDimensions: boolean;
    mismatchedDimensionCount: number;
    workCount: number;
    actionNeeded: boolean;
    actionReason: "missing" | "mixed" | "wrong_dimension" | "none";
  };

  type VitalMetric = {
    key: string;
    value: number;
    label: string;
    alert?: boolean;
    suffix?: string;
  };

  export let graphStore: "postgres" | "surreal" | "none" = "none";
  /** Durable server flag — pipeline already has graph-imported sources. */
  export let sourcesInPipeline = false;
  export let initialPipelineCatalogCount = 0;

  export let packMappingTitle = "";
  export let packMappingForm: PackMappingFields;
  export let packMappingEditable = true;
  export let packMappingLoading = false;
  export let packMappingLoadError: string | null = null;
  export let savingMapping = false;
  export let saveMappingError: string | null = null;

  export let discoveringLoading = false;
  export let discoveringError: string | null = null;
  export let discoverResult: DiscoverResult | null = null;
  export let syncingPack = false;
  export let syncPackError: string | null = null;

  export let importingLoading = false;
  export let importError: string | null = null;
  export let importResult: ImportResult | null = null;

  export let linkSourcesOptions: LinkSourcesOptions | null = null;
  export let linkSourcesScope: "unlinked_only" | "all" = "unlinked_only";
  export let linkingSources = false;
  export let linkSourcesError: string | null = null;
  export let linkStepComplete = false;
  export let provenanceAudit: ProvenanceAuditView | null = null;
  export let provenanceAuditLoading = false;
  export let provenanceAuditError: string | null = null;

  export let embedEnabled = false;
  export let unembeddedCount = 0;
  export let embedWorkCount = 0;
  export let embedHealth: EmbeddingHealthView | null = null;
  export let embedRecommendedScope: "missing_only" | "uniform_target" = "missing_only";
  export let embedReady = true;
  export let embedRoutes: RouteOption[] = [];
  export let embedRouteId = "";
  export let embedModelsManageHref = "";
  export let embedRouteEditHref: string | null = null;
  export let selectedEmbedRouteLabel: string | null = null;
  export let embeddingBackfill = false;
  export let embedError: string | null = null;
  export let embedStepComplete = false;

  export let revalidateEnabled = false;
  export let uncheckedCount = 0;
  export let batchSize = 2000;
  export let continueInBackground = true;
  export let revalidateRouteId = "";
  export let revalidateRoutes: RouteOption[] = [];
  export let validateScope: "unchecked" | "linked" = "unchecked";
  export let batchValidating = false;
  export let batchValidateError: string | null = null;

  const dispatch = createEventDispatcher<{
    scan: { autoSyncPack?: boolean };
    saveMapping: void;
    applySuggestion: void;
    syncPack: void;
    import: void;
    linkSources: void;
    embed: void;
    validate: void;
  }>();

  const STEP_META = {
    catalog: { label: "Source catalog", detail: "Map Surreal tables and import source text" },
    link: { label: "Link sources", detail: "Match ideas to catalog source text" },
    embed: { label: "Embed ideas", detail: "Backfill vectors and unify embedding dimensions" },
    validate: { label: "Validate ideas", detail: "Check ideas against linked sources" },
  } as const;

  type StepId = keyof typeof STEP_META;
  const ALL_STEPS: StepId[] = ["catalog", "link", "embed", "validate"];

  function exactCount(n: number): string {
    return n.toLocaleString();
  }

  function formatCompactCount(n: number): string {
    if (!Number.isFinite(n)) return "0";
    if (Math.abs(n) < 1000) return String(Math.round(n));
    return new Intl.NumberFormat("en", {
      notation: "compact",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(n);
  }

  $: catalogImportSatisfied = Boolean(
    sourcesInPipeline ||
      discoverResult?.importAlreadySatisfied ||
      (discoverResult?.withText &&
        discoverResult.withText > 0 &&
        (discoverResult.pipelineCatalogCount ?? 0) >= discoverResult.withText) ||
      (importResult &&
        !importResult.error &&
        (importResult.imported > 0 || importResult.alreadyPresent > 0)),
  );

  $: catalogComplete = Boolean(
    catalogImportSatisfied ||
      (linkComplete && (linkSourcesOptions?.candidateSources ?? 0) > 0),
  );

  // Session flag alone is NOT enough — if data confirms work remains, the step stays open.
  // linkStepComplete is only used as a loading-state fallback when neither audit nor options
  // have loaded yet (prevents the wizard from freezing on a blank link panel).
  $: linkHasKnownWork =
    (provenanceAudit != null && provenanceAudit.needsEdgeRepair > 0) ||
    (linkSourcesOptions != null && !linkSourcesOptions.estimate && linkSourcesOptions.unitsNeedingLink > 0);

  $: linkComplete =
    provenanceAudit?.verdict === "native" ||
    (provenanceAudit != null &&
      provenanceAudit.verdict !== "unknown" &&
      provenanceAudit.needsEdgeRepair === 0) ||
    (linkSourcesOptions != null &&
      linkSourcesOptions.unitsNeedingLink === 0 &&
      !linkSourcesOptions.estimate) ||
    // Fallback: use session flag only while tools-options is still loading
    (linkStepComplete && !linkHasKnownWork && provenanceAudit == null && linkSourcesOptions == null);
  $: embedActionNeeded =
    embedHealth?.actionNeeded ?? (embedWorkCount > 0 || unembeddedCount > 0);
  $: embedComplete = embedStepComplete || !embedActionNeeded;
  $: validateComplete = uncheckedCount === 0;

  /** Direct reactive map — step rail must recompute when async provenance audit resolves. */
  $: stepCompletion = {
    catalog: catalogComplete,
    link: linkComplete,
    embed: embedComplete,
    validate: validateComplete,
  };

  $: provenanceNative =
    provenanceAudit?.verdict === "native" ||
    (provenanceAudit != null &&
      provenanceAudit.verdict !== "unknown" &&
      provenanceAudit.needsEdgeRepair === 0);

  $: ideasNeedingLink =
    provenanceAudit?.needsEdgeRepair ?? linkSourcesOptions?.unitsNeedingLink ?? 0;

  $: linkScopeWorkCount =
    linkSourcesScope === "all"
      ? (linkSourcesOptions?.totalUnits ?? 0)
      : ideasNeedingLink;

  $: linkRunDisabled =
    linkingSources || !linkSourcesOptions?.enabled || linkScopeWorkCount === 0;

  function stepNotApplicable(id: StepId): boolean {
    if (id === "catalog") return graphStore !== "surreal";
    if (id === "validate") return !revalidateEnabled;
    if (id === "embed") return !embedEnabled;
    return false;
  }

  type RailStatus = "not_applicable" | "satisfied" | "active" | "pending";

  /**
   * Step navigation is fully user-controlled. `selectedStep` is null until the
   * user navigates (rail / Back / Next), in which case the panel follows the
   * recommended step. Once set, it sticks — we never auto-advance past a step or
   * snap back, so partial / cohort passes stay where the user left them.
   */
  type StepTarget = StepId | "complete";
  let selectedStep: StepTarget | null = null;

  /** Where the system suggests the user goes next — the first incomplete applicable step. */
  $: recommendedStep = ((): StepTarget => {
    const completion = stepCompletion;
    if (discoveringLoading || savingMapping || importingLoading) {
      if (graphStore === "surreal") return "catalog";
    }
    for (const id of ALL_STEPS) {
      if (stepNotApplicable(id)) continue;
      if (!completion[id]) return id;
    }
    return "complete";
  })();

  $: currentStep = selectedStep ?? recommendedStep;

  /** True when validate is open while link work remains — the partial-cohort case. */
  $: inSubsetValidateMode = currentStep === "validate" && linkHasKnownWork && linkStepComplete;

  function navigateToStep(id: StepTarget) {
    selectedStep = id;
  }

  /** Linear order the Back/Next controls walk: applicable steps, then the overview. */
  $: navSequence = [...applicableSteps, "complete"] as StepTarget[];
  $: currentNavIndex = navSequence.indexOf(currentStep);
  $: canGoPrev = currentNavIndex > 0;
  $: canGoNext = currentNavIndex >= 0 && currentNavIndex < navSequence.length - 1;
  function goPrev() {
    if (canGoPrev) selectedStep = navSequence[currentNavIndex - 1];
  }
  function goNext() {
    if (canGoNext) selectedStep = navSequence[currentNavIndex + 1];
  }

  $: currentStepIndex =
    currentStep === "complete" ? ALL_STEPS.length : ALL_STEPS.indexOf(currentStep);

  $: stepStatuses = (() => {
    const completion = stepCompletion;
    return ALL_STEPS.map((id) => {
      if (currentStep === id) return "active" as const;
      if (stepNotApplicable(id)) return "not_applicable" as const;
      if (completion[id]) return "satisfied" as const;
      return "pending" as const;
    });
  })();

  $: applicableSteps = ALL_STEPS.filter((id) => !stepNotApplicable(id));
  $: stepsDone = applicableSteps.filter((id) => stepCompletion[id]).length;
  $: stepsTotal = applicableSteps.length;
  $: readinessPct = stepsTotal > 0 ? Math.round((stepsDone / stepsTotal) * 100) : 100;

  $: capHeadline =
    currentStep === "complete" ? "Ready for retrieval" : STEP_META[currentStep as StepId].label;

  $: stepStatusMessage =
    currentStep === "complete"
      ? "All readiness checks passed — your graph is ready for review and agent retrieval."
      : `Step ${currentStepIndex + 1} of ${stepsTotal} — ${STEP_META[currentStep as StepId].detail}`;

  $: vitalMetrics = ((): VitalMetric[] => {
    const metrics: VitalMetric[] = [];
    if (graphStore === "surreal") {
      metrics.push({
        key: "catalog",
        value: discoverResult?.pipelineCatalogCount ?? initialPipelineCatalogCount,
        label: "In catalog",
      });
    }
    if (provenanceAudit && provenanceAudit.verdict !== "unknown") {
      metrics.push({
        key: "link",
        value:
          provenanceAudit.verdict === "native"
            ? provenanceAudit.graphLinked
            : provenanceAudit.needsEdgeRepair,
        label: provenanceAudit.verdict === "native" ? "Graph-linked" : "Need link",
        alert: provenanceAudit.needsEdgeRepair > 0,
      });
    } else if (linkSourcesOptions) {
      metrics.push({
        key: "link",
        value: linkSourcesOptions.unitsNeedingLink,
        label: linkSourcesOptions.estimate ? "Need link (est.)" : "Need link",
        alert: linkSourcesOptions.unitsNeedingLink > 0,
      });
    }
    if (embedEnabled && embedHealth) {
      metrics.push({
        key: "embed-work",
        value: embedHealth.workCount,
        label: "Embed work",
        alert: embedHealth.workCount > 0,
      });
      metrics.push({
        key: "embed-dim",
        value: embedHealth.targetDimensions,
        label: "Target dim",
        suffix: "d",
      });
    } else if (embedEnabled) {
      metrics.push({
        key: "unembedded",
        value: unembeddedCount,
        label: "Unembedded",
        alert: unembeddedCount > 0,
      });
    }
    if (revalidateEnabled) {
      metrics.push({
        key: "unchecked",
        value: uncheckedCount,
        label: "Unchecked",
        alert: uncheckedCount > 0,
      });
    }
    return metrics;
  })();

  function railGlyph(status: RailStatus | "active"): string {
    if (status === "active") return "▶";
    if (status === "satisfied" || status === "not_applicable") return "■";
    return "□";
  }

  function railStateLabel(status: RailStatus | "active"): string {
    if (status === "not_applicable") return "not required";
    if (status === "satisfied") return "complete";
    if (status === "active") return "current step";
    return "pending";
  }

  $: embedButtonLabel = (() => {
    if (embeddingBackfill) return "Starting…";
    const work = embedWorkCount || unembeddedCount;
    if (embedHealth?.actionReason === "mixed" || embedHealth?.actionReason === "wrong_dimension") {
      return `Re-embed ${work.toLocaleString()} idea${work === 1 ? "" : "s"} to ${embedHealth?.targetDimensions ?? "?"}d`;
    }
    return `Embed ${work.toLocaleString()} missing idea${work === 1 ? "" : "s"}`;
  })();

  $: catalogPhase =
    currentStep !== "catalog" || catalogImportSatisfied
      ? "done"
      : !discoverResult ||
          discoverResult.mappingInvalid ||
          discoverResult.total === 0 ||
          discoverResult.withText === 0
        ? "scan"
        : "import";

  $: mappingDetailsOpen = currentStep === "catalog" && catalogPhase === "scan";
  $: batchEstimate = batchSize > 0 ? Math.ceil(uncheckedCount / batchSize) : 1;
  $: validateBatchCount = Math.min(batchSize || uncheckedCount, uncheckedCount);
  $: validateScopeLabel = validateScope === "linked" ? "linked" : "unchecked";
</script>

<section class="readiness-wizard" aria-label="Prepare knowledge graph">
  <header class="wizard-cap brut-fill-neon">
    <div class="wizard-cap-main">
      <p class="wizard-kicker">Connect · graph readiness</p>
      <h2 class="wizard-headline">{capHeadline}</h2>
      <p class="wizard-lede">
        Import source text, link provenance, embed at one dimension, then validate against sources.
        Steps you skip or already finished are ticked automatically.
      </p>
    </div>
    <div class="wizard-cap-side" aria-label="Readiness progress summary">
      <BrutalBadge variant="secondary" label="{stepsDone}/{stepsTotal} steps" />
      {#if currentStep !== "complete"}
        <BrutalBadge variant="primary" label="Step {currentStepIndex + 1}" />
      {:else}
        <BrutalBadge variant="primary" label="Complete" />
      {/if}
    </div>
  </header>

  <div class="wizard-body brut-fill-white">
    <div
      class="wizard-progress"
      role="progressbar"
      aria-valuenow={readinessPct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Graph readiness progress"
    >
      <div class="wizard-progress-fill" style:width="{readinessPct}%"></div>
    </div>

    {#if vitalMetrics.length > 0}
      <div class="wizard-vitals" aria-label="Readiness backlog counts">
        {#each vitalMetrics as metric (metric.key)}
          <article
            class="wizard-vital"
            class:wizard-vital-alert={metric.alert}
            class:wizard-vital-ok={!metric.alert && metric.value === 0 && metric.key !== "catalog" && metric.key !== "embed-dim"}
          >
            <span
              class="wizard-vital-num"
              title="{exactCount(metric.value)}{metric.suffix ?? ""} {metric.label.toLowerCase()}"
            >
              {formatCompactCount(metric.value)}{metric.suffix ?? ""}
            </span>
            <span class="wizard-vital-label">{metric.label}</span>
            <span class="visually-hidden">
              {exactCount(metric.value)}{metric.suffix ?? ""} {metric.label.toLowerCase()}
            </span>
          </article>
        {/each}
      </div>
    {/if}

    <nav class="wizard-stepper" aria-label="Readiness steps">
      <ol class="wizard-stepper-list" role="list">
        {#each ALL_STEPS as stepId, i (stepId)}
          {@const status = stepStatuses[i]}
          <li
            class="wizard-step wizard-step--{status}"
            aria-current={status === "active" ? "step" : undefined}
          >
            {#if status === "satisfied" && !stepNotApplicable(stepId)}
              <button
                type="button"
                class="wizard-step-btn brut-focus"
                aria-label="Return to {STEP_META[stepId].label} step"
                on:click={() => navigateToStep(stepId)}
              >
                <div class="wizard-step-head">
                  <span class="wizard-step-glyph" aria-hidden="true">{railGlyph(status)}</span>
                  <span class="wizard-step-num" aria-hidden="true">{i + 1}</span>
                </div>
                <span class="wizard-step-label">{STEP_META[stepId].label}</span>
                <span class="wizard-step-state">re-run</span>
              </button>
            {:else}
              <div class="wizard-step-head">
                <span class="wizard-step-glyph" aria-hidden="true">{railGlyph(status)}</span>
                <span class="wizard-step-num" aria-hidden="true">{i + 1}</span>
              </div>
              <span class="wizard-step-label">{STEP_META[stepId].label}</span>
              <span class="wizard-step-state">{railStateLabel(status)}</span>
            {/if}
            <span class="visually-hidden">
              {STEP_META[stepId].label} — {railStateLabel(status)}
            </span>
          </li>
        {/each}
      </ol>
    </nav>

    <section
      class="wizard-panel"
      aria-labelledby="readiness-step-title"
      aria-live="polite"
      aria-atomic="true"
    >
      <div class="wizard-panel-head">
        {#if currentStep === "complete"}
          <h3 id="readiness-step-title" class="wizard-panel-title">Graph readiness complete</h3>
        {:else}
          <h3 id="readiness-step-title" class="wizard-panel-title">
            Step {currentStepIndex + 1} — {STEP_META[currentStep].label}
          </h3>
        {/if}
        <p class="wizard-panel-lede">{stepStatusMessage}</p>
      </div>

      {#if currentStep === "complete"}
        <p class="wizard-success" role="status">
          No remaining catalog, linking, embedding, or validation backlog detected for this
          workspace.
        </p>
        <p class="wizard-note brut-muted">
          Re-open individual tools from the graph explorer if you add sources, ideas, or change your
          domain pack mapping.
        </p>
      {:else if currentStep === "catalog"}
        {#if catalogImportSatisfied}
          <p class="wizard-success" role="status">
            Source catalog is already in your pipeline
            {#if discoverResult?.pipelineCatalogCount || initialPipelineCatalogCount}
              ({(discoverResult?.pipelineCatalogCount ?? initialPipelineCatalogCount).toLocaleString()}
              graph-imported sources)
            {/if}
            — proceed unless your Surreal data changed.
          </p>
        {/if}

        <details class="wizard-details" open={mappingDetailsOpen}>
          <summary class="wizard-details-summary brut-focus">
            Source &amp; passage mapping
            {#if packMappingTitle}
              <span class="wizard-details-meta">({packMappingTitle})</span>
            {/if}
          </summary>
          {#if packMappingLoadError}
            <BrutalErrorBanner title="Could not load pack" message={packMappingLoadError} />
          {:else if packMappingLoading}
            <p class="wizard-note brut-muted" role="status">Loading mapping…</p>
          {:else}
            <fieldset class="wizard-fieldset" disabled={!packMappingEditable || savingMapping}>
              <legend class="visually-hidden">Source and passage field mapping</legend>
              <div class="wizard-form">
                <label class="wizard-field" for="rw-source-table">
                  <span class="wizard-field-label">Source table</span>
                  <input
                    id="rw-source-table"
                    class="wizard-input brut-focus"
                    type="text"
                    bind:value={packMappingForm.source_table}
                  />
                </label>
                <label class="wizard-field" for="rw-passage-table">
                  <span class="wizard-field-label">Passage table</span>
                  <input
                    id="rw-passage-table"
                    class="wizard-input brut-focus"
                    type="text"
                    bind:value={packMappingForm.passage_table}
                  />
                </label>
                <label class="wizard-field" for="rw-source-text">
                  <span class="wizard-field-label">Source text field (optional)</span>
                  <input
                    id="rw-source-text"
                    class="wizard-input brut-focus"
                    type="text"
                    bind:value={packMappingForm.source_text_field}
                  />
                </label>
                <label class="wizard-field" for="rw-passage-text">
                  <span class="wizard-field-label">Passage text field (optional)</span>
                  <input
                    id="rw-passage-text"
                    class="wizard-input brut-focus"
                    type="text"
                    bind:value={packMappingForm.passage_text_field}
                  />
                </label>
                <label class="wizard-field" for="rw-passage-source">
                  <span class="wizard-field-label">Passage → source field (optional)</span>
                  <input
                    id="rw-passage-source"
                    class="wizard-input brut-focus"
                    type="text"
                    bind:value={packMappingForm.passage_source_field}
                  />
                </label>
              </div>
            </fieldset>
            {#if packMappingEditable && catalogPhase === "scan"}
              <div class="wizard-actions wizard-actions-inline">
                {#if discoverResult?.packSuggestion?.suggested}
                  <button
                    type="button"
                    class="brutal-btn brutal-btn-outline brut-pressable brut-focus"
                    disabled={savingMapping || discoveringLoading}
                    on:click={() => dispatch("applySuggestion")}
                  >
                    Use detected values
                  </button>
                {/if}
                <button
                  type="button"
                  class="brutal-btn brutal-btn-outline brut-fill-canvas brut-pressable brut-focus"
                  disabled={savingMapping || discoveringLoading || !packMappingForm.source_table.trim()}
                  on:click={() => dispatch("saveMapping")}
                >
                  {savingMapping ? "Saving…" : "Save mapping"}
                </button>
              </div>
            {/if}
            {#if saveMappingError}
              <BrutalErrorBanner title="Mapping save failed" message={saveMappingError} />
            {/if}
          {/if}
        </details>

        {#if catalogPhase === "scan"}
          {#if discoverResult?.mappingInvalid}
            <BrutalErrorBanner
              title="Wrong source table"
              message="Point the pack at your bibliographic source table, not the idea/unit table."
            />
          {/if}
          {#if discoveringError}
            <BrutalErrorBanner title="Scan failed" message={discoveringError} />
          {/if}
          {#if discoverResult?.packSuggestion && !discoverResult.packSynced && discoverResult.packSuggestion.canAutoApply}
            <div class="wizard-actions wizard-actions-inline">
              <button
                type="button"
                class="brutal-btn brutal-btn-outline brut-pressable brut-focus"
                disabled={syncingPack}
                on:click={() => dispatch("syncPack")}
              >
                {syncingPack ? "Updating…" : "Apply detected mapping"}
              </button>
            </div>
          {/if}
          {#if syncPackError}
            <BrutalErrorBanner title="Pack update failed" message={syncPackError} />
          {/if}
          <div class="wizard-actions">
            <button
              type="button"
              class="brutal-btn brutal-btn-primary brut-pressable brut-focus"
              disabled={discoveringLoading || savingMapping}
              on:click={() => dispatch("scan", { autoSyncPack: false })}
            >
              {discoveringLoading ? "Scanning…" : discoverResult ? "Re-scan graph" : "Scan graph for sources"}
            </button>
          </div>
          {#if discoverResult && discoverResult.withText > 0}
            <p class="wizard-note brut-muted" role="status">
              {discoverResult.withText} of {discoverResult.total} sources have resolvable text.
            </p>
          {/if}
        {:else if catalogImportSatisfied}
          <details class="wizard-details">
            <summary class="wizard-details-summary brut-focus">Optional: re-import sources</summary>
            {#if importError}
              <BrutalErrorBanner title="Import failed" message={importError} />
            {/if}
            <div class="wizard-actions">
              <button
                type="button"
                class="brutal-btn brutal-btn-outline brut-pressable brut-focus"
                disabled={importingLoading || !discoverResult || discoverResult.withText === 0}
                on:click={() => dispatch("import")}
              >
                {importingLoading ? "Importing…" : "Re-import sources from graph"}
              </button>
            </div>
          </details>
        {:else}
          {#if importError}
            <BrutalErrorBanner title="Import failed" message={importError} />
          {/if}
          <div class="wizard-actions">
            <button
              type="button"
              class="brutal-btn brutal-btn-primary brut-pressable brut-focus"
              disabled={importingLoading || !discoverResult || discoverResult.withText === 0}
              on:click={() => dispatch("import")}
            >
              {importingLoading
                ? "Importing…"
                : `Import ${discoverResult?.withText ?? 0} sources into pipeline`}
            </button>
          </div>
        {/if}

      {:else if currentStep === "link"}
        {#if linkStepComplete && linkHasKnownWork}
          {@const linkedSoFar = (linkSourcesOptions?.totalUnits ?? 0) - ideasNeedingLink}
          <div class="wizard-subset-banner" role="status">
            <p class="wizard-subset-headline">
              Subset in progress —
              <strong>{linkedSoFar.toLocaleString()}</strong>
              {linkedSoFar === 1 ? "idea" : "ideas"} linked,
              <strong>{ideasNeedingLink.toLocaleString()}</strong>
              still to link.
            </p>
            <p class="wizard-subset-hint">
              You can validate this subset first to check quality before linking the rest, or continue linking more ideas now.
            </p>
            <div class="wizard-subset-actions">
              <button
                type="button"
                class="brutal-btn brutal-btn-outline brut-pressable brut-focus"
                on:click={() => {
                  selectedStep = "validate";
                  validateScope = "linked";
                }}
              >
                Validate this subset first →
              </button>
            </div>
          </div>
        {/if}

        {#if graphStore === "surreal"}
          <ConnectGraphProvenanceAudit
            audit={provenanceAudit}
            loading={provenanceAuditLoading}
            error={provenanceAuditError}
          />
        {/if}
        {#if provenanceNative}
          <p class="wizard-success" role="status">
            Nothing to link — {(
              provenanceAudit?.graphLinked ?? linkSourcesOptions?.totalUnits ?? 0
            ).toLocaleString()} ideas already use graph-native provenance. Continue to validation.
          </p>
        {:else if catalogComplete || graphStore !== "surreal"}
          <p class="wizard-success" role="status">
            Source catalog ready — {linkSourcesOptions?.candidateSources.toLocaleString() ?? "0"} sources
            available for matching.
          </p>
        {/if}
        {#if provenanceNative}
          <details class="wizard-details">
            <summary class="wizard-details-summary brut-focus">Advanced: re-match all ideas</summary>
            {#if linkSourcesOptions}
              <fieldset class="wizard-fieldset" disabled={linkingSources}>
                <legend class="wizard-fieldset-legend">Linking scope</legend>
                <label class="wizard-field wizard-field-wide" for="rw-link-scope-advanced">
                  <span class="wizard-field-label">Scope</span>
                  <select
                    id="rw-link-scope-advanced"
                    class="wizard-input brut-focus"
                    bind:value={linkSourcesScope}
                  >
                    <option value="unlinked_only">
                      Missing provenance only ({ideasNeedingLink.toLocaleString()})
                    </option>
                    <option value="all">
                      All ideas ({linkSourcesOptions.totalUnits.toLocaleString()})
                    </option>
                  </select>
                </label>
              </fieldset>
              {#if linkSourcesScope === "all"}
                <p class="wizard-note wizard-note-caution" role="status">
                  Re-matches all {linkSourcesOptions.totalUnits.toLocaleString()} ideas by text and can
                  overwrite existing graph-native <code class="wizard-inline-code">source</code> edges.
                </p>
              {/if}
            {/if}
            {#if linkSourcesError}
              <BrutalErrorBanner title="Linking not started" message={linkSourcesError} />
            {/if}
            <div class="wizard-actions">
              <button
                type="button"
                class="brutal-btn brutal-btn-outline brut-pressable brut-focus"
                disabled={linkRunDisabled}
                on:click={() => dispatch("linkSources")}
              >
                {linkingSources ? "Starting…" : "Find sources for ideas"}
              </button>
            </div>
          </details>
        {:else}
          {#if linkSourcesOptions}
            <fieldset class="wizard-fieldset" disabled={linkingSources}>
              <legend class="wizard-fieldset-legend">Linking scope</legend>
              <label class="wizard-field wizard-field-wide" for="rw-link-scope">
                <span class="wizard-field-label">Scope</span>
                <select id="rw-link-scope" class="wizard-input brut-focus" bind:value={linkSourcesScope}>
                  <option value="unlinked_only">
                    Missing provenance only ({ideasNeedingLink.toLocaleString()})
                  </option>
                  <option value="all">
                    All ideas ({linkSourcesOptions.totalUnits.toLocaleString()})
                  </option>
                </select>
              </label>
            </fieldset>
            {#if linkSourcesScope === "all"}
              <p class="wizard-note wizard-note-caution" role="status">
                Re-matches all {linkSourcesOptions.totalUnits.toLocaleString()} ideas by text and can
                overwrite existing graph-native <code class="wizard-inline-code">source</code> edges.
              </p>
            {/if}
          {/if}
          {#if linkSourcesError}
            <BrutalErrorBanner title="Linking not started" message={linkSourcesError} />
          {/if}
          <div class="wizard-actions">
            <button
              type="button"
              class="brutal-btn brutal-btn-primary brut-pressable brut-focus"
              disabled={linkRunDisabled}
              on:click={() => dispatch("linkSources")}
            >
              {linkingSources ? "Starting…" : "Find sources for ideas"}
            </button>
            <p class="wizard-note brut-muted">
              {#if provenanceAudit?.needsEdgeRepair}
                Repairs missing or legacy <code class="wizard-inline-code">source</code> edges via text
                matching. Validation still resolves full text from Surreal source → passage.
              {:else}
                Links ideas to pipeline source text before validation can compare faithfulness.
              {/if}
            </p>
          </div>
        {/if}

      {:else if currentStep === "embed"}
        {#if embedHealth}
          <div class="embed-health" aria-label="Embedding dimension check">
            {#if embedHealth.dimensionBuckets.length > 0}
              <p class="wizard-field-label">Current embedding dimensions</p>
              <ul class="embed-dim-list">
                {#each embedHealth.dimensionBuckets as bucket (bucket.dimensions)}
                  <li class="embed-dim-item">
                    <span class="embed-dim-count">{bucket.count.toLocaleString()}</span>
                    <span class="embed-dim-label">
                      at {bucket.dimensions}d{bucket.dimensions === embedHealth.targetDimensions
                        ? " (target)"
                        : ""}
                    </span>
                  </li>
                {/each}
              </ul>
            {:else if embedHealth.actionNeeded}
              <p class="wizard-success" role="status">
                No embedding vectors found yet — run embed backfill at {embedHealth.targetDimensions}d
                for semantic retrieval.
              </p>
            {/if}
            {#if embedHealth.hasMixedDimensions}
              <BrutalErrorBanner
                title="Mixed embedding dimensions"
                message="Retrieval requires one vector size across the graph. Re-embed mismatched ideas using your workspace embedding route."
              />
            {:else if embedHealth.actionReason === "wrong_dimension"}
              <BrutalErrorBanner
                title="Wrong embedding dimension"
                message="Existing vectors are not at the pack target of {embedHealth.targetDimensions}d. Re-embed to unify before agent retrieval."
              />
            {:else if embedComplete}
              <p class="wizard-success" role="status">
                All ideas are embedded at {embedHealth.targetDimensions}d — ready for dense retrieval.
              </p>
            {/if}
          </div>
        {/if}
        {#if !embedReady}
          <p class="wizard-note brut-muted">
            Publish an embedding ingestion route in AI models &amp; keys first.
          </p>
        {/if}
        <fieldset class="wizard-fieldset" disabled={embeddingBackfill || !embedReady}>
          <legend class="wizard-fieldset-legend">Embedding route</legend>
          <label class="wizard-field wizard-field-wide" for="rw-embed-route">
            <span class="wizard-field-label">Route</span>
            <select id="rw-embed-route" class="wizard-input brut-focus" bind:value={embedRouteId}>
              {#if embedRoutes.length === 0}
                <option value="">Workspace default</option>
              {:else}
                <option value="">Workspace default routing</option>
                {#each embedRoutes as route (route.id)}
                  <option value={route.id}>
                    {route.name}{route.isDefault ? " (default)" : ""}
                  </option>
                {/each}
              {/if}
            </select>
          </label>
        </fieldset>
        <div class="wizard-route-links">
          <a class="wizard-link brut-focus" href={embedModelsManageHref}>Manage ingest routes</a>
          {#if embedRouteEditHref}
            <a class="wizard-link brut-focus" href={embedRouteEditHref}>
              Edit route{#if selectedEmbedRouteLabel} ({selectedEmbedRouteLabel}){/if}
            </a>
          {/if}
        </div>
        {#if embedError}
          <BrutalErrorBanner title="Embed not started" message={embedError} />
        {/if}
        {#if embedRecommendedScope === "uniform_target" && embedActionNeeded}
          <p class="wizard-note brut-muted">
            This run re-embeds missing and mismatched ideas so every vector matches
            {embedHealth?.targetDimensions ?? "the pack target"}d.
          </p>
        {/if}
        <div class="wizard-actions">
          <button
            type="button"
            class="brutal-btn brutal-btn-primary brut-pressable brut-focus"
            disabled={embeddingBackfill || !embedReady || !embedActionNeeded}
            on:click={() => dispatch("embed")}
          >
            {embedButtonLabel}
          </button>
        </div>

      {:else if currentStep === "validate"}
        {#if inSubsetValidateMode}
          <div class="wizard-subset-banner wizard-subset-banner--validate" role="status">
            <p class="wizard-subset-headline">
              Validating linked subset —
              <strong>{ideasNeedingLink.toLocaleString()}</strong>
              {ideasNeedingLink === 1 ? "idea" : "ideas"} still to link.
            </p>
            <p class="wizard-subset-hint">
              Once you're satisfied with these results, go back and link more ideas to continue.
            </p>
            <div class="wizard-subset-actions">
              <button
                type="button"
                class="brutal-btn brutal-btn-outline brut-pressable brut-focus"
                on:click={() => { selectedStep = "link"; validateScope = "unchecked"; }}
              >
                ← Back to link more ideas
              </button>
            </div>
          </div>
        {/if}

        <aside class="wizard-estimate" aria-label="Validation batch estimate">
          <span class="wizard-estimate-num">{batchEstimate}</span>
          <div class="wizard-estimate-copy">
            <span class="wizard-estimate-label">
              batch{batchEstimate === 1 ? "" : "es"} to clear backlog
            </span>
            <span class="wizard-estimate-meta brut-muted">
              {exactCount(uncheckedCount)} unchecked at batch size {exactCount(batchSize)}
            </span>
          </div>
        </aside>

        <fieldset class="wizard-fieldset" disabled={batchValidating}>
          <legend class="wizard-fieldset-legend">Validation run</legend>
          <div class="wizard-form">
            <label class="wizard-field" for="rw-validate-scope">
              <span class="wizard-field-label">Scope</span>
              <select id="rw-validate-scope" class="wizard-input brut-focus" bind:value={validateScope}>
                <option value="unchecked">All unchecked ideas</option>
                <option value="linked">Linked ideas only (has source text)</option>
              </select>
            </label>
            <label class="wizard-field" for="rw-batch-size">
              <span class="wizard-field-label">Batch size</span>
              <input
                id="rw-batch-size"
                class="wizard-input brut-focus"
                type="number"
                min="100"
                max="100000"
                step="100"
                bind:value={batchSize}
              />
            </label>
            <label class="wizard-field" for="rw-validate-route">
              <span class="wizard-field-label">Validation route</span>
              <select id="rw-validate-route" class="wizard-input brut-focus" bind:value={revalidateRouteId}>
                {#if revalidateRoutes.length === 0}
                  <option value="">Workspace default</option>
                {:else}
                  <option value="">Workspace default routing</option>
                  {#each revalidateRoutes as route (route.id)}
                    <option value={route.id}>
                      {route.name}{route.isDefault ? " (default)" : ""}
                    </option>
                  {/each}
                {/if}
              </select>
            </label>
          </div>
          {#if validateScope === "unchecked"}
            <label class="wizard-check brut-focus" for="rw-continue-bg">
              <input
                id="rw-continue-bg"
                type="checkbox"
                bind:checked={continueInBackground}
              />
              <span>
                Keep validating in the background until the backlog is clear
                ({batchEstimate} batch{batchEstimate === 1 ? "" : "es"})
              </span>
            </label>
          {/if}
        </fieldset>

        {#if batchValidateError}
          <BrutalErrorBanner title="Validation not started" message={batchValidateError} />
        {/if}
        <div class="wizard-actions">
          <button
            type="button"
            class="brutal-btn brutal-btn-primary brut-pressable brut-focus"
            disabled={batchValidating}
            on:click={() => dispatch("validate")}
          >
            {batchValidating
              ? "Starting…"
              : `Validate ${validateBatchCount.toLocaleString()} ${validateScopeLabel}${continueInBackground && validateScope === "unchecked" ? " + continue" : ""}`}
          </button>
          {#if validateScope === "unchecked"}
            <p class="wizard-note brut-muted">
              Background mode chains batches overnight — safe to leave this tab open or return later.
            </p>
          {:else}
            <p class="wizard-note brut-muted">
              Validates only ideas that have source text linked — use this to spot-check a small batch before running the full backlog.
            </p>
          {/if}
        </div>
      {/if}
    </section>
  </div>
</section>

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

  .readiness-wizard {
    margin: 0;
    position: relative;
  }

  .wizard-cap {
    border: var(--border);
    border-radius: 0;
    box-shadow: var(--shadow-lg);
    padding: var(--space-5) var(--space-5) var(--space-6);
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
    position: relative;
    z-index: 2;
  }

  .wizard-cap-main {
    flex: 1 1 16rem;
    max-width: 42rem;
  }

  .wizard-cap-side {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .wizard-kicker {
    margin: 0 0 var(--space-1);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-ink);
  }

  .wizard-headline {
    margin: 0 0 var(--space-2);
    font-family: var(--font-display);
    font-size: var(--text-display-sm);
    font-weight: 900;
    line-height: var(--text-display-line-height);
    color: var(--color-ink);
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
  }

  .wizard-lede {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.5;
    max-width: 52ch;
    color: color-mix(in oklab, var(--color-ink) 82%, transparent);
  }

  .wizard-body {
    margin-top: -4px;
    margin-left: 4px;
    border: var(--border);
    border-radius: 0;
    box-shadow: 8px 8px 0 0 var(--color-ink);
    padding: var(--space-4) var(--space-5) var(--space-5);
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .wizard-progress {
    height: 12px;
    border: var(--border);
    border-radius: 0;
    background: var(--color-bg);
    overflow: hidden;
    box-shadow: 2px 2px 0 0 var(--color-ink);
  }

  .wizard-progress-fill {
    height: 100%;
    background: var(--color-ink);
    transition: width 0.25s ease;
  }

  @media (prefers-reduced-motion: reduce) {
    .wizard-progress-fill {
      transition: none;
    }
  }

  .wizard-vitals {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
    gap: var(--space-2);
  }

  .wizard-vital {
    padding: var(--space-3) var(--space-3) var(--space-2);
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--color-surface);
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-height: 4.5rem;
  }

  .wizard-vital-alert {
    background: var(--brut-neon, #e8ff47);
    box-shadow: var(--brut-shadow-sm);
  }

  .wizard-vital-ok {
    border-style: dashed;
    opacity: 0.88;
  }

  .wizard-vital-num {
    font-size: clamp(1.35rem, 2.5vw, 2rem);
    font-weight: 900;
    font-family: var(--font-display);
    line-height: 1;
    letter-spacing: -0.02em;
  }

  .wizard-vital-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: color-mix(in oklab, var(--color-ink) 72%, transparent);
  }

  .wizard-stepper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 2px;
  }

  .wizard-stepper-list {
    display: flex;
    flex-wrap: nowrap;
    gap: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    min-width: min(100%, 40rem);
  }

  .wizard-step {
    flex: 1 1 0;
    min-width: 7.5rem;
    display: grid;
    grid-template-rows: auto auto auto;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-2) var(--space-3);
    border: var(--brut-border-micro) solid var(--brut-ink);
    border-right: none;
    background: var(--brut-white);
    position: relative;
  }

  .wizard-step:last-child {
    border-right: var(--brut-border-micro) solid var(--brut-ink);
  }

  .wizard-step--active {
    background: var(--brut-neon, #e8ff47);
    box-shadow: inset 0 -4px 0 0 var(--brut-ink);
    z-index: 1;
  }

  .wizard-step--satisfied,
  .wizard-step--not_applicable {
    background: var(--brut-canvas, #f3ead0);
  }

  .wizard-step--satisfied .wizard-step-btn {
    display: contents;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    color: inherit;
    text-align: left;
    width: 100%;
  }

  .wizard-step--satisfied:has(.wizard-step-btn:hover),
  .wizard-step--satisfied:has(.wizard-step-btn:focus-visible) {
    background: color-mix(in oklab, var(--brut-neon, #e8ff47) 35%, var(--brut-canvas, #f3ead0));
    outline: none;
  }

  .wizard-step--pending {
    opacity: 0.62;
  }

  .wizard-step-head {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .wizard-step-glyph {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    line-height: 1;
  }

  .wizard-step-num {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    opacity: 0.55;
  }

  .wizard-step-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    line-height: 1.25;
  }

  .wizard-step-state {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: color-mix(in oklab, var(--color-ink) 58%, transparent);
  }

  .wizard-subset-banner {
    margin-bottom: var(--space-4);
    padding: var(--space-3) var(--space-4);
    border: var(--brut-border-micro) solid var(--brut-ink);
    border-left: 4px solid var(--brut-ink);
    background: color-mix(in oklab, var(--brut-neon, #e8ff47) 25%, var(--brut-white));
    box-shadow: var(--brut-shadow-sm);
  }

  .wizard-subset-banner--validate {
    background: color-mix(in oklab, var(--brut-blue, #4a9eff) 12%, var(--brut-white));
    border-left-color: var(--brut-blue, #4a9eff);
  }

  .wizard-subset-headline {
    margin: 0 0 var(--space-1);
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.4;
  }

  .wizard-subset-hint {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    color: color-mix(in oklab, var(--color-ink) 72%, transparent);
    line-height: 1.45;
  }

  .wizard-subset-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .wizard-panel {
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--color-bg);
    padding: var(--space-4);
    box-shadow: 4px 4px 0 0 var(--color-ink);
  }

  .wizard-panel-head {
    margin-bottom: var(--space-3);
    padding-bottom: var(--space-3);
    border-bottom: var(--brut-border-micro) dashed var(--brut-ink);
  }

  .wizard-panel-title {
    margin: 0 0 var(--space-1);
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .wizard-panel-lede {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: color-mix(in oklab, var(--color-ink) 78%, transparent);
    max-width: 58ch;
  }

  .wizard-success {
    margin: 0 0 var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: var(--brut-border-micro) solid var(--brut-ink);
    border-left-width: 6px;
    background: var(--brut-canvas, #f3ead0);
    font-size: var(--text-sm);
    line-height: 1.45;
  }

  .wizard-note {
    margin: 0;
    font-size: var(--text-xs);
    line-height: 1.45;
    max-width: 58ch;
  }

  .wizard-note-caution {
    margin: 0 0 var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: var(--brut-border-micro) solid var(--brut-ink);
    border-left-width: 4px;
    border-left-color: var(--brut-alert, #c45c26);
    background: color-mix(in oklab, var(--brut-canvas, #f3ead0) 92%, var(--brut-alert, #c45c26));
  }

  .wizard-estimate {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-neon, #e8ff47);
    box-shadow: var(--brut-shadow-sm);
  }

  .wizard-estimate-num {
    font-family: var(--font-display);
    font-size: clamp(2rem, 4vw, 2.75rem);
    font-weight: 900;
    line-height: 1;
    min-width: 2.5ch;
    text-align: center;
  }

  .wizard-estimate-copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .wizard-estimate-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .wizard-estimate-meta {
    font-size: var(--text-xs);
  }

  .wizard-details {
    margin-bottom: var(--space-3);
    padding: var(--space-3);
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
  }

  .wizard-details-summary {
    cursor: pointer;
    list-style: none;
    margin-bottom: var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-ink);
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .wizard-details-summary::-webkit-details-marker {
    display: none;
  }

  .wizard-details-summary::before {
    content: "▸";
    font-size: 0.85em;
    transition: transform 0.12s ease;
  }

  .wizard-details[open] > .wizard-details-summary::before {
    transform: rotate(90deg);
  }

  .wizard-details-meta {
    font-weight: 400;
    text-transform: none;
    letter-spacing: normal;
    color: color-mix(in oklab, var(--color-ink) 65%, transparent);
  }

  .wizard-fieldset {
    margin: 0 0 var(--space-3);
    padding: 0;
    border: none;
    min-width: 0;
  }

  .wizard-fieldset:disabled {
    opacity: 0.72;
  }

  .wizard-fieldset-legend {
    margin: 0 0 var(--space-2);
    padding: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: color-mix(in oklab, var(--color-ink) 72%, transparent);
  }

  .wizard-form {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--space-3);
  }

  .wizard-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .wizard-field-wide {
    max-width: 28rem;
  }

  .wizard-field-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: color-mix(in oklab, var(--color-ink) 72%, transparent);
  }

  .wizard-input {
    min-height: 44px;
    padding: 0.5rem 0.75rem;
    font: inherit;
    font-size: var(--text-sm);
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
    border-radius: 0;
  }

  .wizard-input:disabled {
    cursor: not-allowed;
    background: var(--color-bg);
  }

  .wizard-check {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    margin-top: var(--space-3);
    min-height: 44px;
    font-size: var(--text-sm);
    line-height: 1.45;
    cursor: pointer;
  }

  .wizard-check input {
    width: 1.125rem;
    height: 1.125rem;
    margin-top: 0.15em;
    flex-shrink: 0;
    accent-color: var(--color-ink);
  }

  .wizard-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .wizard-actions-inline {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
  }

  .wizard-route-links {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-3);
    margin: 0 0 var(--space-3);
  }

  .wizard-link {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    color: var(--color-ink);
    text-decoration: underline;
    text-underline-offset: 3px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }

  .wizard-inline-code {
    font-family: var(--font-mono);
    font-size: 0.95em;
    padding: 0 0.2em;
    border: 1px solid color-mix(in oklab, var(--color-ink) 25%, transparent);
    background: var(--color-bg);
  }

  .embed-health {
    margin-bottom: var(--space-3);
  }

  .embed-dim-list {
    margin: 0 0 var(--space-3);
    padding: 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .embed-dim-item {
    display: flex;
    align-items: baseline;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
    font-size: var(--text-xs);
  }

  .embed-dim-count {
    font-family: var(--font-mono);
    font-weight: 700;
  }

  .embed-dim-label {
    color: color-mix(in oklab, var(--color-ink) 72%, transparent);
  }

  @media (max-width: 720px) {
    .wizard-cap {
      padding: var(--space-4);
    }

    .wizard-body {
      margin-left: 0;
      padding: var(--space-3);
    }

    .wizard-stepper-list {
      min-width: 100%;
    }

    .wizard-step {
      min-width: 6.5rem;
    }
  }
</style>
