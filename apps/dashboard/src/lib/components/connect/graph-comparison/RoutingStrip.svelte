<script lang="ts">
  /**
   * Phase 3 Stage 4 — inline routing strip on the Answer Console.
   *
   * Surfaces the model-per-stage routing (the Connect ingestion stages) RIGHT on the
   * console: each stage's default model + provider, whether it is published (live),
   * and a one-click "change model" picker that overrides a single stage WITHOUT
   * leaving the answer view ("switch model without screen-hopping").
   *
   * It reuses the existing endpoints — it does NOT duplicate route-step logic:
   *   - GET  /keys/dashboard/prove/api/routing-strip            → the snapshot
   *   - GET  /keys/dashboard/api/connect/ingest/stage-suitability → catalogue per stage
   *   - POST /keys/dashboard/api/connect/pipeline/stage-models/apply → apply a model
   *
   * The full 3,461-line route builder stays the ADVANCED surface (deep-linked per
   * stage); this strip is the default, in-context path — not a replacement.
   */
  import { createEventDispatcher } from "svelte";

  /** Emitted after a successful apply so the parent can refresh disclosure + publish state. */
  const dispatch = createEventDispatcher<{ changed: { stage: string } }>();

  const STRIP_API = "/keys/dashboard/prove/api/routing-strip";
  const SUITABILITY_API = "/keys/dashboard/api/connect/ingest/stage-suitability";
  const APPLY_API = "/keys/dashboard/api/connect/pipeline/stage-models/apply";

  type StripStage = {
    key: string;
    label: string;
    help: string;
    isChat: boolean;
    provider: string | null;
    modelId: string | null;
    routeId: string | null;
    isPublished: boolean;
    needsPublish: boolean;
    advancedHref: string | null;
  };

  type StripSnapshot = {
    configured: boolean;
    projectId: string | null;
    stages: StripStage[];
    validationProvider: string | null;
    needsPublishCount: number;
  };

  type AdvisoryModel = {
    id: string;
    name: string;
    provider: string;
    providerModelId: string | null;
    connected: boolean;
    blocked: boolean;
    verdict: string;
    runCost: string;
  };

  let snapshot: StripSnapshot | null = null;
  let loadError = false;
  let loading = true;

  // Which stage's model picker is open (null = none). Only one open at a time.
  let openStage: string | null = null;
  let pickerLoading = false;
  let pickerError: string | null = null;
  let pickerModels: AdvisoryModel[] = [];
  let pickerQuery = "";

  // Per-stage apply status keyed by stage.
  let applyStatus: Record<string, "idle" | "applying" | "applied" | "error"> = {};
  let applyError: Record<string, string> = {};

  export async function reload(): Promise<void> {
    loading = true;
    loadError = false;
    try {
      const res = await fetch(STRIP_API);
      if (!res.ok) throw new Error(String(res.status));
      snapshot = (await res.json()) as StripSnapshot;
    } catch {
      loadError = true;
    } finally {
      loading = false;
    }
  }

  // Initial load.
  void reload();

  function familyHint(provider: string | null): string {
    return provider ? provider.toLowerCase() : "—";
  }

  async function togglePicker(stage: StripStage): Promise<void> {
    if (openStage === stage.key) {
      openStage = null;
      return;
    }
    openStage = stage.key;
    pickerQuery = "";
    pickerError = null;
    pickerModels = [];
    pickerLoading = true;
    try {
      const res = await fetch(`${SUITABILITY_API}?stage=${encodeURIComponent(stage.key)}&keepUnknown=1`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { models?: AdvisoryModel[] };
      // Connected + not-blocked models are applyable; show those first, then the rest.
      const all = data.models ?? [];
      const applyable = all.filter((m) => m.connected && !m.blocked);
      const rest = all.filter((m) => !(m.connected && !m.blocked));
      pickerModels = [...applyable, ...rest];
    } catch (e) {
      pickerError = e instanceof Error ? e.message : "Could not load models.";
    } finally {
      pickerLoading = false;
    }
  }

  async function applyModel(stage: StripStage, model: AdvisoryModel): Promise<void> {
    applyStatus = { ...applyStatus, [stage.key]: "applying" };
    applyError = { ...applyError, [stage.key]: "" };
    try {
      const res = await fetch(APPLY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: stage.key,
          provider: model.provider,
          providerModelId: model.providerModelId ?? model.id,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !data.ok) {
        applyStatus = { ...applyStatus, [stage.key]: "error" };
        applyError = {
          ...applyError,
          [stage.key]: data.message ?? data.error ?? `HTTP ${res.status}`,
        };
        return;
      }
      applyStatus = { ...applyStatus, [stage.key]: "applied" };
      openStage = null;
      await reload();
      dispatch("changed", { stage: stage.key });
      setTimeout(() => {
        applyStatus = { ...applyStatus, [stage.key]: "idle" };
      }, 2500);
    } catch (e) {
      applyStatus = { ...applyStatus, [stage.key]: "error" };
      applyError = {
        ...applyError,
        [stage.key]: e instanceof Error ? e.message : "Unexpected error",
      };
    }
  }

  $: visibleStages = (snapshot?.stages ?? []).filter((s) => s.isChat);
  $: q = pickerQuery.trim().toLowerCase();
  $: filteredPickerModels = q
    ? pickerModels.filter(
        (m) =>
          (m.name || m.id).toLowerCase().includes(q) ||
          m.provider.toLowerCase().includes(q),
      )
    : pickerModels;
</script>

<section class="strip" aria-label="Model routing per stage">
  <header class="strip-head">
    <span class="strip-tag">ROUTING · MODEL PER STAGE</span>
    <p class="strip-lede">
      The models behind this answer. Change one without leaving the answer — defaults shown,
      fallbacks visible.
    </p>
  </header>

  {#if loading}
    <p class="strip-state" role="status">Loading routing…</p>
  {:else if loadError}
    <p class="strip-state strip-state-error" role="alert">
      Could not load routing. The answer is unaffected.
      <button type="button" class="strip-link" on:click={() => reload()}>Retry</button>
    </p>
  {:else if !snapshot?.configured || visibleStages.length === 0}
    <p class="strip-state" role="status">
      No model routing yet — apply a model to a stage to ground answers.
    </p>
  {:else}
    <ul class="stage-list">
      {#each visibleStages as stage (stage.key)}
        {@const status = applyStatus[stage.key] ?? "idle"}
        <li class="stage-row">
          <div class="stage-main">
            <div class="stage-name-row">
              <span class="stage-name">{stage.label}</span>
              {#if stage.modelId}
                {#if stage.isPublished}
                  <span class="status-dot status-live" title="Published — live for resolve" aria-label="Live">● LIVE</span>
                {:else}
                  <span class="status-dot status-draft" title="Unpublished working version — not yet live" aria-label="Draft">○ DRAFT</span>
                {/if}
              {/if}
            </div>
            <div class="stage-model-row">
              {#if stage.modelId}
                <span class="stage-model" title={stage.modelId}>{stage.modelId}</span>
                <span class="stage-provider">via {familyHint(stage.provider)}</span>
              {:else}
                <span class="stage-model stage-model-none">no model applied</span>
              {/if}
            </div>
          </div>

          <div class="stage-actions">
            {#if status === "applied"}
              <span class="apply-flash" aria-live="polite">applied ✓</span>
            {/if}
            <button
              type="button"
              class="change-btn brut-pressable brut-focus"
              aria-expanded={openStage === stage.key}
              on:click={() => togglePicker(stage)}
            >
              {stage.modelId ? "CHANGE MODEL" : "PICK MODEL"} {openStage === stage.key ? "▲" : "▾"}
            </button>
            {#if stage.advancedHref}
              <a
                class="advanced-link brut-focus"
                href={stage.advancedHref}
                title="Open the full route builder for this stage (advanced)"
              >
                ADVANCED ↗
              </a>
            {/if}
          </div>

          {#if status === "error"}
            <p class="apply-error" role="alert">✗ {applyError[stage.key] ?? "Apply failed"}</p>
          {/if}

          {#if openStage === stage.key}
            <div class="picker" role="region" aria-label="Choose a model for {stage.label}">
              {#if stage.key === "validation"}
                <p class="picker-note">
                  A validation model on a <strong>different family</strong> than extraction makes the
                  cross-model check meaningful.
                </p>
              {/if}
              {#if pickerLoading}
                <p class="picker-state" role="status">Loading models…</p>
              {:else if pickerError}
                <p class="picker-state picker-state-error" role="alert">{pickerError}</p>
              {:else}
                <input
                  type="search"
                  class="picker-search brut-focus"
                  placeholder="Filter by model or provider…"
                  autocomplete="off"
                  bind:value={pickerQuery}
                  aria-label="Filter models"
                />
                {#if filteredPickerModels.length === 0}
                  <p class="picker-state">No models match.</p>
                {:else}
                  <ul class="picker-list">
                    {#each filteredPickerModels.slice(0, 24) as model (model.provider + ":" + model.id)}
                      {@const applyable = model.connected && !model.blocked}
                      {@const isCurrent =
                        stage.modelId === (model.providerModelId ?? model.id) &&
                        (stage.provider ?? "").toLowerCase() === model.provider.toLowerCase()}
                      <li class="picker-row" class:picker-row-blocked={!applyable}>
                        <div class="picker-info">
                          <span class="picker-model">{model.name || model.id}</span>
                          <span class="picker-provider">{model.provider}</span>
                          {#if !model.connected}
                            <span class="picker-flag">not connected</span>
                          {:else if model.blocked}
                            <span class="picker-flag">wrong type</span>
                          {/if}
                        </div>
                        {#if isCurrent}
                          <span class="picker-current">■ current</span>
                        {:else if applyable}
                          <button
                            type="button"
                            class="picker-apply brut-pressable brut-focus"
                            disabled={status === "applying"}
                            on:click={() => applyModel(stage, model)}
                          >
                            {status === "applying" ? "applying…" : "Use →"}
                          </button>
                        {:else}
                          <span class="picker-apply-disabled">—</span>
                        {/if}
                      </li>
                    {/each}
                  </ul>
                {/if}
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .strip {
    border: var(--border);
    box-shadow: var(--shadow-md);
    background: var(--color-surface);
    display: flex;
    flex-direction: column;
  }

  .strip-head {
    padding: var(--space-3) var(--space-4);
    background: var(--color-ink);
    color: var(--color-surface);
  }

  .strip-tag {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
  }

  .strip-lede {
    margin: var(--space-1) 0 0;
    font-family: var(--font-body);
    font-size: var(--text-body-sm);
    line-height: 1.5;
    opacity: 0.85;
  }

  .strip-state {
    margin: 0;
    padding: var(--space-4);
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-ink-faint);
  }
  .strip-state-error {
    color: var(--color-ink);
  }
  .strip-link {
    background: none;
    border: 0;
    padding: 0 0 0 var(--space-2);
    cursor: pointer;
    color: var(--color-blue);
    font: inherit;
    text-decoration: underline;
  }

  .stage-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .stage-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: var(--border-thin);
  }
  .stage-row:last-child {
    border-bottom: none;
  }

  .stage-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .stage-name-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .stage-name {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-ink);
  }

  .status-dot {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 1px 5px;
    border: var(--border-thin);
  }
  .status-live {
    background: var(--color-yellow);
    color: var(--color-ink);
    border-color: var(--color-ink);
  }
  .status-draft {
    background: transparent;
    color: var(--color-ink-muted);
    border-color: var(--color-ink-muted);
    border-style: dashed;
  }

  .stage-model-row {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .stage-model {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    color: var(--color-ink);
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 18rem;
    white-space: nowrap;
  }
  .stage-model-none {
    color: var(--color-ink-muted);
    font-weight: 400;
    font-style: italic;
  }
  .stage-provider {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
  }

  .stage-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .apply-flash {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    color: var(--color-ink);
  }

  .change-btn {
    background: var(--color-yellow);
    border: var(--border);
    border-radius: 0;
    box-shadow: 2px 2px 0 0 var(--color-ink);
    padding: var(--space-1) var(--space-3);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-ink);
    white-space: nowrap;
    min-height: 32px;
  }

  .advanced-link {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-ink-muted);
    text-decoration: underline;
    text-underline-offset: 2px;
    white-space: nowrap;
  }
  .advanced-link:hover {
    color: var(--color-blue);
  }

  .apply-error {
    grid-column: 1 / -1;
    margin: var(--space-1) 0 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    color: var(--state-fail-fg, #991b1b);
    background: var(--state-fail-bg, #fee2e2);
    border: var(--border-thin);
    border-color: var(--state-fail-fg, #991b1b);
    padding: 2px 6px;
  }

  .picker {
    grid-column: 1 / -1;
    margin-top: var(--space-3);
    border: var(--border);
    background: var(--color-bg);
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .picker-note {
    margin: 0;
    font-family: var(--font-body);
    font-size: var(--text-body-sm);
    line-height: 1.4;
    color: var(--color-ink-muted);
  }

  .picker-state {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-ink-faint);
  }
  .picker-state-error {
    color: var(--state-fail-fg, #991b1b);
  }

  .picker-search {
    border: var(--border);
    border-radius: 0;
    background: var(--color-surface);
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink);
  }

  .picker-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 16rem;
    overflow-y: auto;
    border: var(--border-thin);
    background: var(--color-surface);
  }

  .picker-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-bottom: var(--border-thin);
  }
  .picker-row:last-child {
    border-bottom: none;
  }
  .picker-row-blocked {
    opacity: 0.65;
  }

  .picker-info {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    min-width: 0;
  }
  .picker-model {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    color: var(--color-ink);
  }
  .picker-provider {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
    text-transform: uppercase;
  }
  .picker-flag {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
    border: var(--border-thin);
    border-style: dashed;
    padding: 0 4px;
  }

  .picker-current {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    color: var(--color-ink);
    white-space: nowrap;
  }

  .picker-apply {
    background: var(--color-ink);
    color: var(--color-surface);
    border: var(--border);
    border-radius: 0;
    padding: 2px 10px;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    white-space: nowrap;
    min-height: 28px;
  }
  .picker-apply:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .picker-apply-disabled {
    color: var(--color-ink-faint);
  }

  @media (max-width: 640px) {
    .stage-row {
      grid-template-columns: 1fr;
    }
    .stage-actions {
      justify-content: flex-start;
      flex-wrap: wrap;
    }
    .stage-model {
      max-width: 100%;
      white-space: normal;
    }
  }
</style>
