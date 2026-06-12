<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { HOME_HREF, INGEST_ROUTES_HREF, RUNS_HREF } from "$lib/nav-config";
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
  import type { ConnectTrustScorecard } from "@restormel/contracts";
  import {
    failingPreflightRows,
    preflightAllowsLaunch,
    preflightIssueCopy,
    type ConnectRunPreflightProviderRow,
    type ConnectRunPreflightResult,
  } from "$lib/connect/run-preflight";

  export let runDefaults: PipelineRunDefaults;
  export let progress: PipelineWizardProgress;
  export let modelsReady = true;
  export let onBack: () => void;
  export let submitting = false;
  /** Bound by the wizard footer so its START RUN gate can't drift from this panel's. */
  export let canStart = false;
  /** Previous run's trust scorecard (Stage 1.2) — shown in "What to expect" when a graph exists. */
  export let previousScorecard: ConnectTrustScorecard | null = null;
  /**
   * K3 launch gate (K-P0-2): per-provider binding/credential preflight computed
   * server-side. Null means "could not check" — the gate stays open (the jobs BFF
   * re-enforces) so a compute hiccup never bricks launches.
   */
  export let preflight: ConnectRunPreflightResult | null = null;

  const dispatch = createEventDispatcher<{ started: void }>();
  const API_BASE = CONNECT_PIPELINE_API;

  let label = "";
  let stopAfterStage = runDefaults.defaultStopAfterStage ?? "";
  let error: string | null = null;
  let selectedPackId =
    runDefaults.selectedDomainPackId ?? runDefaults.domainPackId ?? runDefaults.packs[0]?.id ?? "";

  // Bind/recheck actions replace the server-loaded preflight with a fresh one.
  let refreshedPreflight: ConnectRunPreflightResult | null = null;
  /** Explicit operator opt-in for legacy environment-key runs (no stage routes). */
  let legacyOverride = false;
  let bindBusyProvider: string | null = null;
  let preflightMsg: string | null = null;

  $: livePreflight = refreshedPreflight ?? preflight;
  $: preflightFailing = failingPreflightRows(livePreflight);
  $: preflightWarning = livePreflight ? livePreflight.status !== "pass" : false;

  $: selectedPack = runDefaults.packs.find((p) => p.id === selectedPackId);
  // K3 ADDS the provider preflight to the existing gate — never bypasses it.
  $: canStart =
    runDefaults.documents.length > 0 &&
    Boolean(selectedPackId) &&
    modelsReady &&
    preflightAllowsLaunch(livePreflight, legacyOverride) &&
    !submitting;
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

  /** Re-pull the preflight from the project readiness endpoint (its first UI consumer). */
  async function refreshPreflight() {
    const projectId = livePreflight?.projectId;
    if (!projectId) return;
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${projectId}/readiness`);
      if (!res.ok) return;
      const d = await res.json().catch(() => null);
      if (d?.data?.connect_run_preflight) {
        refreshedPreflight = d.data.connect_run_preflight as ConnectRunPreflightResult;
      }
    } catch {
      // keep the last known preflight — re-check stays available
    }
  }

  /** One-click repair: bind the unambiguous workspace integration to the routing project. */
  async function bindNow(row: ConnectRunPreflightProviderRow) {
    const projectId = livePreflight?.projectId;
    if (!row.bind || !projectId || bindBusyProvider) return;
    bindBusyProvider = row.provider;
    preflightMsg = null;
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/integrations/${row.bind.integrationId}/bindings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          ...(livePreflight?.environmentId ? { environmentId: livePreflight.environmentId } : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        preflightMsg = d.error ?? `Could not bind ${row.provider} (HTTP ${res.status}).`;
        return;
      }
      await refreshPreflight();
    } catch {
      preflightMsg = "Network error while binding the provider.";
    } finally {
      bindBusyProvider = null;
    }
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
    if (!canStart) {
      error =
        preflightFailing.length > 0
          ? "Fix the provider credential issues above before starting."
          : "Select documents, a domain pack, and configure routes before starting.";
      return;
    }
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
        // Server-side preflight re-check (race: a binding/key changed since page load).
        if (res.status === 422 && d.error === "preflight_blocked" && d.preflight) {
          refreshedPreflight = d.preflight as ConnectRunPreflightResult;
          error = d.message ?? "Run preflight failed — fix the provider issues above and start again.";
          return;
        }
        error = d.message ?? `Could not start run (HTTP ${res.status}).`;
        return;
      }
      const id = d.job?.id;
      if (!id) {
        error = "Run was created but no job id was returned.";
        return;
      }
      dispatch("started");
      await goto(`${RUNS_HREF}/${id}?from=pipeline`);
    } catch {
      error = "Network error while starting the run.";
    } finally {
      submitting = false;
    }
  }

  $: totalChunks = runDefaults.documents.reduce((sum, d) => sum + (d.chunk_count || 0), 0);
  // Extraction + relations are roughly per-chunk passes; validation/grouping/remediation
  // add batched calls on top, so this is a floor, not a promise.
  $: estimatedCalls = Math.max(totalChunks * 2, runDefaults.documents.length * 4);
  $: estimatedTime =
    totalChunks <= 30 ? "~3–8 min" : totalChunks <= 120 ? "~10–25 min" : "30+ min — large corpus";

  // Quality expectations come from the selected pack (G2 bar: ok_pct >= 90, unsupported <= 2,
  // see packages/connect-core golden-eval).
  $: forecastPreset = selectedPack?.quality_preset ?? "production";
  $: forecastCrossModel = selectedPack?.cross_model_validation !== false;
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
        <a class="preflight-edit" href={withReturnTo(INGEST_ROUTES_HREF, { kind: "pipeline-setup", step: "launch" })}>Edit →</a>
      </li>
      {#if livePreflight}
        <li class="preflight-row" class:preflight-row-warn={preflightWarning}>
          <span
            class="preflight-bullet"
            class:preflight-bullet-ok={!preflightWarning}
            class:preflight-bullet-warn={preflightWarning}
            aria-hidden="true"
          >{preflightWarning ? "□" : "■"}</span>
          <div class="preflight-main">
            <span class="preflight-label">Provider credentials</span>
            <span class="preflight-value">
              {#if livePreflight.status === "pass"}
                <strong>
                  {livePreflight.providers.length} provider{livePreflight.providers.length === 1 ? "" : "s"} executable on the routing project
                </strong>
              {:else if livePreflight.status === "legacy_env"}
                <strong>Legacy environment key</strong>
              {:else}
                <strong>Needs attention</strong>
              {/if}
            </span>

            {#if preflightFailing.length > 0}
              <ul class="preflight-repair-list">
                {#each preflightFailing as row (row.provider)}
                  <li class="preflight-repair-item">
                    <p class="preflight-warn-note">{preflightIssueCopy(row)}</p>
                    <div class="preflight-repair-actions">
                      {#if row.bind && livePreflight.projectId}
                        <button
                          type="button"
                          class="btn btn-primary btn-sm"
                          disabled={bindBusyProvider !== null}
                          on:click={() => bindNow(row)}
                        >
                          {bindBusyProvider === row.provider
                            ? "Binding…"
                            : `Bind ${row.bind.label} to project`}
                        </button>
                      {/if}
                      <a class="btn btn-outline btn-sm" href={row.fixHref}>{row.fixLabel} →</a>
                    </div>
                  </li>
                {/each}
              </ul>
              <div class="preflight-repair-actions">
                <button type="button" class="btn btn-outline btn-sm" on:click={refreshPreflight}>
                  Re-check
                </button>
                <!-- K4: the launch gate consumes the same rows as the readiness ledger,
                     relocated onto /home with the dissolved Connect hub (R2). -->
                <a class="btn btn-outline btn-sm" href={HOME_HREF + "#readiness"}>
                  Open readiness ledger
                </a>
              </div>
            {/if}

            {#if livePreflight.status === "legacy_env"}
              <p class="preflight-warn-note">
                No published stage routes — this run would execute on the server's legacy
                environment key instead of your project's provider connections.
              </p>
              <label class="preflight-override">
                <input type="checkbox" bind:checked={legacyOverride} />
                <span>Run on the legacy environment key anyway</span>
              </label>
            {/if}

            {#if preflightMsg}
              <p class="preflight-warn-note" role="alert">{preflightMsg}</p>
            {/if}
          </div>
          <a class="preflight-edit" href={DASHBOARD_BASE + "/integrations"}>Edit →</a>
        </li>
      {/if}
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

      <aside class="run-estimate run-forecast" aria-label="Expected quality">
        <p class="run-forecast-title">What to expect</p>
        <div class="run-estimate-row">
          <span class="run-estimate-label">Quality preset</span>
          <span class="run-estimate-value" class:run-forecast-warn={forecastPreset === "starter"}>
            {#if forecastPreset === "starter"}
              Demo (Starter) — reduced chunk coverage, skips some production gates; not for agent-facing graphs
            {:else}
              Production — every claim validated against the source, weak claims remediated
            {/if}
          </span>
        </div>
        <div class="run-estimate-row">
          <span class="run-estimate-label">Cross-model validation</span>
          <span class="run-estimate-value">
            {forecastCrossModel ? "On — a different model family judges the extraction" : "Off — extractor output is judged by the same family"}
          </span>
        </div>
        <div class="run-estimate-row">
          <span class="run-estimate-label">Quality bar</span>
          <span class="run-estimate-value">≥90% of claims supported, ≤2% unsupported (G2) — reported after the run</span>
        </div>
        {#if previousScorecard}
          <div class="run-estimate-row">
            <span class="run-estimate-label">Current graph scorecard</span>
            <span class="run-estimate-value">
              Trust score <strong>{previousScorecard.trust_score}/100</strong> ·
              {previousScorecard.g2.ok_pct}% supported ·
              {previousScorecard.evidence.bound_pct}% evidence-bound ·
              {previousScorecard.embedding.pct}% embedded
              {#if previousScorecard.last_verified_at}
                · last verified {new Date(previousScorecard.last_verified_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              {/if}
              — this run adds to the same graph; the scorecard on the Connect hub updates when it completes.
            </span>
          </div>
        {/if}
      </aside>

      <aside class="run-estimate" aria-label="Run estimates">
        <div class="run-estimate-row">
          <span class="run-estimate-label">Estimated run time</span>
          <span class="run-estimate-value">{estimatedTime} ({totalChunks} chunk{totalChunks === 1 ? "" : "s"})</span>
        </div>
        <div class="run-estimate-row">
          <span class="run-estimate-label">Estimated LLM calls</span>
          <span class="run-estimate-value">~{estimatedCalls}+ across {runDefaults.documents.length} document{runDefaults.documents.length === 1 ? "" : "s"}</span>
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
