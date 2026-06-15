<script lang="ts">
  import BrutalCard from "$lib/components/brutalist/BrutalCard.svelte";
  import BrutalBadge from "$lib/components/brutalist/BrutalBadge.svelte";
  import BrutalButton from "$lib/components/brutalist/BrutalButton.svelte";
  import BrutalLoadingState from "$lib/components/brutalist/BrutalLoadingState.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";

  // ── Types ──────────────────────────────────────────────────────────────────

  type Verdict = "recommended" | "usable" | "caveat" | "unknown" | "wrong_type";
  type Stage = "extraction" | "grouping" | "validation" | "remediation" | "embedding";

  interface AdvisoryModel {
    id: string;
    name: string;
    verdict: Verdict;
    rationale: string;
    blocked: boolean;
    homeJurisdiction: string | null;
    processingRegion: string | null;
    providerModelId: string;
    lifecycleState: string | null;
    costPerMillion: string;
    runCost: string;
  }

  interface AdvisoryProvider {
    provider: string;
    hiddenByRegion: number;
    hiddenUnknownRegion: number;
    models: AdvisoryModel[];
  }

  interface StageSuitabilityResponse {
    stage: Stage;
    provider_types: string[];
    region_filter: unknown;
    upstream_families: string[];
    providers: AdvisoryProvider[];
  }

  // ── Stage options ──────────────────────────────────────────────────────────

  const STAGES: { id: Stage; label: string }[] = [
    { id: "extraction", label: "Extraction" },
    { id: "grouping", label: "Grouping" },
    { id: "validation", label: "Validation" },
    { id: "remediation", label: "Remediation" },
    { id: "embedding", label: "Embedding" },
  ];

  // ── Region filter presets ──────────────────────────────────────────────────

  type RegionPreset = "none" | "eu_only" | "exclude_us_cn";

  const REGION_PRESETS: { id: RegionPreset; label: string }[] = [
    { id: "none", label: "All regions" },
    { id: "eu_only", label: "EU only" },
    { id: "exclude_us_cn", label: "Exclude US & CN" },
  ];

  // ── Verdict config (styling + labels) ─────────────────────────────────────

  const VERDICT_CONFIG: Record<Verdict, { label: string; shortLabel: string; glyphLabel: string }> = {
    recommended: {
      label: "Recommended",
      shortLabel: "Rec.",
      glyphLabel: "★ recommended",
    },
    usable: {
      label: "Usable",
      shortLabel: "Use",
      glyphLabel: "✓ usable",
    },
    caveat: {
      label: "Caveat",
      shortLabel: "Cav.",
      glyphLabel: "⚠ caveat",
    },
    unknown: {
      label: "Unknown",
      shortLabel: "?",
      glyphLabel: "? unknown",
    },
    wrong_type: {
      label: "Wrong type",
      shortLabel: "✗",
      glyphLabel: "✗ wrong type (disabled)",
    },
  };

  // ── Reactive state ─────────────────────────────────────────────────────────

  let selectedStage: Stage = "extraction";
  let regionPreset: RegionPreset = "none";
  let keepUnknown = true;
  let query = "";

  let loading = false;
  let error: string | null = null;
  let result: StageSuitabilityResponse | null = null;

  // Rationale expanded state: keyed by model id
  let expandedRationale: Record<string, boolean> = {};

  // ── Build API URL from current filter state ────────────────────────────────

  $: apiUrl = buildApiUrl(selectedStage, regionPreset, keepUnknown);

  function buildApiUrl(stage: Stage, preset: RegionPreset, keepUnk: boolean): string {
    const params = new URLSearchParams({ stage });
    if (preset === "eu_only") {
      // Home matching is hierarchy-aware server-side, so the coarse "EU" token also
      // matches country-qualified homes like "EU/FR"; processing region stays "EU".
      params.set("home", "EU");
      params.set("region", "EU");
    } else if (preset === "exclude_us_cn") {
      params.set("excludeHome", "US,CN");
      params.set("excludeRegion", "US,CN");
    }
    if (keepUnk) params.set("keepUnknown", "1");
    return `/keys/dashboard/api/connect/ingest/stage-suitability?${params.toString()}`;
  }

  // ── Fetch on filter change (with stale-response guard) ─────────────────────

  let fetchSeq = 0;

  $: if (apiUrl) {
    fetchAdvisory(apiUrl);
  }

  async function fetchAdvisory(url: string) {
    const seq = ++fetchSeq;
    loading = true;
    error = null;
    result = null;
    expandedRationale = {};
    try {
      const res = await fetch(url);
      if (seq !== fetchSeq) return; // superseded by a newer request
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 120)}` : ""}`);
      }
      const data = (await res.json()) as StageSuitabilityResponse;
      if (seq !== fetchSeq) return;
      result = data;
    } catch (e) {
      if (seq !== fetchSeq) return;
      error = e instanceof Error ? e.message : String(e);
    } finally {
      if (seq === fetchSeq) loading = false;
    }
  }

  function retry() {
    fetchAdvisory(apiUrl);
  }

  function toggleRationale(modelId: string) {
    expandedRationale = {
      ...expandedRationale,
      [modelId]: !expandedRationale[modelId],
    };
  }

  function regionLabel(model: AdvisoryModel): string {
    const home = model.homeJurisdiction ?? "unknown";
    const proc = model.processingRegion ?? "unknown";
    return `${home} → ${proc}`;
  }

  function isUnverified(model: AdvisoryModel): boolean {
    return (model.lifecycleState ?? "").toLowerCase() === "unverified";
  }

  // ── Derived view state ─────────────────────────────────────────────────────

  $: stageLabel = STAGES.find((s) => s.id === selectedStage)?.label ?? selectedStage;
  $: q = query.trim().toLowerCase();

  // Apply the client-side name search on top of the server result.
  $: visibleProviders = result
    ? result.providers.map((p) => ({
        ...p,
        models: q
          ? p.models.filter(
              (m) =>
                (m.name || m.id).toLowerCase().includes(q) ||
                m.providerModelId.toLowerCase().includes(q),
            )
          : p.models,
      }))
    : [];

  $: totalModels = visibleProviders.reduce((n, p) => n + p.models.length, 0);
  $: totalBlocked = visibleProviders.reduce(
    (n, p) => n + p.models.filter((m) => m.blocked).length,
    0,
  );
  $: totalViable = totalModels - totalBlocked;
  $: totalHiddenByRegion = result
    ? result.providers.reduce((n, p) => n + p.hiddenByRegion, 0)
    : 0;
  // Every provider returned, but the current filter/search leaves nothing to show.
  $: allEmpty = !!result && result.providers.length > 0 && totalModels === 0;

  // Short, screen-reader-announced summary of the current result.
  $: summary = !result
    ? ""
    : loading
      ? "Loading model advisory…"
      : allEmpty
        ? `${stageLabel}: no models match the current filters` +
          (totalHiddenByRegion > 0 ? ` (${totalHiddenByRegion} hidden by region)` : "")
        : `${stageLabel}: ${result.providers.length} provider${result.providers.length === 1 ? "" : "s"}, ` +
          `${totalViable} suitable, ${totalBlocked} blocked` +
          (totalHiddenByRegion > 0 ? `, ${totalHiddenByRegion} hidden by region` : "");

  // ── Radiogroup keyboard navigation (stage + region strips) ─────────────────

  function moveRadio(
    e: KeyboardEvent,
    ids: readonly string[],
    current: string,
    set: (next: string) => void,
  ) {
    let idx = ids.indexOf(current);
    if (idx < 0) idx = 0;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") idx = (idx + 1) % ids.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") idx = (idx - 1 + ids.length) % ids.length;
    else if (e.key === "Home") idx = 0;
    else if (e.key === "End") idx = ids.length - 1;
    else return;
    e.preventDefault();
    set(ids[idx]);
    const group = (e.currentTarget as HTMLElement).closest('[role="radiogroup"]');
    const radios = group?.querySelectorAll<HTMLElement>('[role="radio"]');
    radios?.[idx]?.focus();
  }
</script>

<section class="advisory-panel" aria-labelledby="advisory-panel-heading">
  {#snippet modelRow(model: AdvisoryModel)}
    <li class="model-row" class:model-row-blocked={model.blocked} data-blocked={model.blocked || undefined}>
      <!-- Verdict badge (5-state) -->
      <div
        class="verdict-badge verdict-{model.verdict}"
        aria-label={VERDICT_CONFIG[model.verdict].glyphLabel}
        role="img"
        title={VERDICT_CONFIG[model.verdict].label}
      >
        <span class="verdict-glyph" aria-hidden="true">
          {#if model.verdict === "recommended"}★{:else if model.verdict === "usable"}✓{:else if model.verdict === "caveat"}⚠{:else if model.verdict === "wrong_type"}✗{:else}?{/if}
        </span>
        <span class="verdict-label">{VERDICT_CONFIG[model.verdict].shortLabel}</span>
      </div>

      <!-- Model info -->
      <div class="model-info">
        <div class="model-name-row">
          <span class="model-name" class:model-name-blocked={model.blocked}>
            {model.name || model.id}
          </span>
          {#if isUnverified(model)}
            <span class="unverified-marker" aria-label="Lifecycle: unverified" title="Unverified lifecycle state">
              unverified
            </span>
          {/if}
          {#if model.blocked}
            <span class="blocked-marker" aria-label="Blocked: wrong model type for this stage">
              blocked
            </span>
          {/if}
        </div>

        <!-- Rationale: show inline, expandable for long text -->
        <div class="model-rationale">
          {#if expandedRationale[model.id] || model.rationale.length <= 120}
            <p class="rationale-text">{model.rationale}</p>
            {#if model.rationale.length > 120}
              <button
                type="button"
                class="rationale-toggle brut-focus"
                aria-expanded="true"
                aria-label="Collapse rationale for {model.name || model.id}"
                on:click={() => toggleRationale(model.id)}
              >
                Show less ↑
              </button>
            {/if}
          {:else}
            <p class="rationale-text rationale-truncated">{model.rationale.slice(0, 120)}…</p>
            <button
              type="button"
              class="rationale-toggle brut-focus"
              aria-expanded="false"
              aria-label="Expand rationale for {model.name || model.id}"
              on:click={() => toggleRationale(model.id)}
            >
              Show more ↓
            </button>
          {/if}
        </div>
      </div>

      <!-- Cost + region meta -->
      <dl class="model-meta">
        <div class="meta-pair">
          <dt class="meta-label">Cost/M tokens</dt>
          <dd class="meta-value">{model.costPerMillion}</dd>
        </div>
        <div class="meta-pair">
          <dt class="meta-label">Run cost</dt>
          <dd class="meta-value">{model.runCost}</dd>
        </div>
        <div class="meta-pair">
          <dt class="meta-label">Region</dt>
          <dd class="meta-value meta-region" title="home jurisdiction → processing region">
            {regionLabel(model)}
          </dd>
        </div>
      </dl>
    </li>
  {/snippet}

  <!-- ── Cap ──────────────────────────────────────────────────────────────── -->
  <header class="advisory-cap brut-fill-neon">
    <div class="advisory-cap-main">
      <p class="advisory-kicker">Connect · Model advisory</p>
      <h2 id="advisory-panel-heading" class="advisory-headline">Stage suitability</h2>
    </div>
    <div class="advisory-cap-side">
      {#if result && !loading}
        <BrutalBadge variant="secondary" label="{result.providers.length} provider{result.providers.length === 1 ? '' : 's'}" />
        <BrutalBadge variant="secondary" label="{totalViable} suitable" />
        {#if totalBlocked > 0}
          <BrutalBadge variant="secondary" label="{totalBlocked} blocked" />
        {/if}
      {/if}
    </div>
  </header>

  <!-- ── Body ─────────────────────────────────────────────────────────────── -->
  <div class="advisory-body brut-fill-white">
    <!-- Screen-reader announcement of the current result -->
    <p class="sr-only" role="status" aria-live="polite">{summary}</p>

    <!-- Stage selector -->
    <fieldset class="stage-fieldset" aria-label="Select pipeline stage">
      <legend class="section-title">Pipeline stage</legend>
      <div class="stage-strip" role="radiogroup" aria-label="Pipeline stage">
        {#each STAGES as s (s.id)}
          <button
            type="button"
            role="radio"
            class="stage-btn brut-focus"
            class:stage-btn-active={selectedStage === s.id}
            aria-checked={selectedStage === s.id}
            tabindex={selectedStage === s.id ? 0 : -1}
            on:click={() => { selectedStage = s.id; }}
            on:keydown={(e) => moveRadio(e, STAGES.map((x) => x.id), selectedStage, (n) => (selectedStage = n as Stage))}
          >
            {s.label}
          </button>
        {/each}
      </div>
    </fieldset>

    <!-- Region filters -->
    <fieldset class="filter-fieldset" aria-label="Region filter options">
      <legend class="section-title">Region filter</legend>
      <div class="filter-row">
        <div class="preset-strip" role="radiogroup" aria-label="Region preset">
          {#each REGION_PRESETS as preset (preset.id)}
            <button
              type="button"
              role="radio"
              class="preset-btn brut-focus"
              class:preset-btn-active={regionPreset === preset.id}
              aria-checked={regionPreset === preset.id}
              tabindex={regionPreset === preset.id ? 0 : -1}
              on:click={() => { regionPreset = preset.id; }}
              on:keydown={(e) => moveRadio(e, REGION_PRESETS.map((x) => x.id), regionPreset, (n) => (regionPreset = n as RegionPreset))}
            >
              {preset.label}
            </button>
          {/each}
        </div>
        <label class="unknown-toggle">
          <input
            type="checkbox"
            bind:checked={keepUnknown}
            class="unknown-checkbox"
          />
          <span class="unknown-label">Show unknown region</span>
        </label>
      </div>
    </fieldset>

    <!-- Model name search -->
    <div class="search-row">
      <label class="search-label" for="advisory-search">Find model</label>
      <input
        id="advisory-search"
        type="search"
        class="search-input brut-focus"
        placeholder="Filter by model name…"
        autocomplete="off"
        bind:value={query}
      />
    </div>

    <!-- Results -->
    {#if loading}
      <BrutalLoadingState message="Loading model advisory…" rows={3} />
    {:else if error}
      <BrutalErrorBanner
        title="Advisory unavailable"
        message="Could not load stage-suitability data. The API may be temporarily unavailable."
      >
        {#snippet actions()}
          <button type="button" class="btn btn-primary btn-sm" on:click={retry}>
            Try again
          </button>
        {/snippet}
      </BrutalErrorBanner>
    {:else if result}
      {#if allEmpty}
        <div class="empty-state" role="status">
          <p class="empty-title">
            {#if q}No models match “{query}”{:else}No models in this view{/if}
          </p>
          <p class="empty-desc">
            {#if q}
              Clear the search or pick a different stage.
            {:else if totalHiddenByRegion > 0}
              All {totalHiddenByRegion} model{totalHiddenByRegion === 1 ? "" : "s"} for {stageLabel} are
              hosted outside your selected region. Relax the region filter{keepUnknown
                ? ""
                : " or enable “Show unknown region”"} to see them.
            {:else}
              Try a different stage or region filter.
            {/if}
          </p>
        </div>
      {:else if result.providers.length === 0}
        <div class="empty-state" role="status">
          <p class="empty-title">No providers connected</p>
          <p class="empty-desc">Connect a model provider to see ranked suitability for this stage.</p>
        </div>
      {:else}
        <div class="providers-list" aria-label="Model advisory results">
          {#each visibleProviders as providerBlock (providerBlock.provider)}
            {@const viable = providerBlock.models.filter((m) => !m.blocked)}
            {@const blocked = providerBlock.models.filter((m) => m.blocked)}
            <section class="provider-section" aria-labelledby="provider-{providerBlock.provider}-heading">
              <header class="provider-header">
                <h3 id="provider-{providerBlock.provider}-heading" class="provider-name">
                  {providerBlock.provider}
                </h3>
                <span class="provider-count">
                  {viable.length} suitable{blocked.length ? ` · ${blocked.length} blocked` : ""}
                </span>
                {#if providerBlock.hiddenByRegion > 0}
                  <p class="hidden-notice" role="note">
                    <span class="hidden-notice-count">{providerBlock.hiddenByRegion}</span>
                    hidden by region filter
                    {#if providerBlock.hiddenUnknownRegion > 0}
                      ({providerBlock.hiddenUnknownRegion} unknown region)
                    {/if}
                  </p>
                {/if}
              </header>

              <BrutalCard fill="white">
                {#if providerBlock.models.length === 0}
                  <p class="no-models">No models match “{query}”.</p>
                {:else}
                  {#if viable.length > 0}
                    <ul class="model-list" aria-label="Suitable models for {providerBlock.provider}">
                      {#each viable as model (model.id)}
                        {@render modelRow(model)}
                      {/each}
                    </ul>
                  {/if}
                  {#if blocked.length > 0}
                    <details class="blocked-details">
                      <summary class="blocked-summary brut-focus">
                        {blocked.length} model{blocked.length === 1 ? "" : "s"} incompatible with {stageLabel}
                      </summary>
                      <ul class="model-list model-list-blocked" aria-label="Incompatible models for {providerBlock.provider}">
                        {#each blocked as model (model.id)}
                          {@render modelRow(model)}
                        {/each}
                      </ul>
                    </details>
                  {/if}
                {/if}
              </BrutalCard>
            </section>
          {/each}
        </div>
      {/if}
    {:else}
      <!-- No result yet, not loading — initial state if reactivity hasn't fired -->
      <BrutalLoadingState message="Initialising…" rows={2} />
    {/if}
  </div>
</section>

<style>
  /* ── Panel shell ─────────────────────────────────────────────────────────── */
  .advisory-panel {
    margin: 0 0 var(--space-5);
    position: relative;
  }

  /* ── Cap (yellow ledger header) ──────────────────────────────────────────── */
  .advisory-cap {
    border: var(--border);
    border-radius: 0;
    box-shadow: var(--shadow-lg);
    padding: var(--space-6) var(--space-5);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    position: relative;
    z-index: 2;
  }

  .advisory-cap-main {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .advisory-cap-side {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .advisory-kicker {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-ink);
  }

  .advisory-headline {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-display-metric);
    font-weight: 900;
    line-height: var(--text-display-line-height);
    color: var(--color-ink);
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
  }

  /* ── Body card (overlaps cap by 4px — ledger overlap idiom) ─────────────── */
  .advisory-body {
    margin-top: -4px;
    margin-left: 4px;
    border: var(--border);
    border-radius: 0;
    box-shadow: 8px 8px 0 0 var(--color-ink);
    padding: var(--space-4) var(--space-5) var(--space-6);
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  /* ── Shared section title (mono uppercase) ───────────────────────────────── */
  .section-title {
    margin: 0 0 var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-ink);
    border: none;
    padding: 0;
  }

  /* ── Stage selector strip ────────────────────────────────────────────────── */
  .stage-fieldset {
    border: none;
    padding: 0;
    margin: 0;
  }

  .stage-strip {
    display: flex;
    flex-wrap: wrap;
    border: var(--border);
    box-shadow: var(--shadow-md);
    overflow: hidden;
  }

  .stage-btn {
    flex: 1 1 auto;
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    border: none;
    border-right: var(--border-thin);
    background: var(--color-bg);
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.1s ease;
  }

  .stage-btn:last-child {
    border-right: none;
  }

  .stage-btn:hover {
    background: var(--color-surface);
  }

  .stage-btn-active {
    background: var(--color-ink);
    color: var(--color-yellow);
  }

  .stage-btn-active:hover {
    background: var(--color-ink);
  }

  /* ── Region filter fieldset ──────────────────────────────────────────────── */
  .filter-fieldset {
    border: none;
    padding: 0;
    margin: 0;
  }

  .filter-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }

  .preset-strip {
    display: flex;
    flex-wrap: wrap;
    border: var(--border);
    overflow: hidden;
  }

  .preset-btn {
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    border: none;
    border-right: var(--border-thin);
    background: var(--color-surface);
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.1s ease;
  }

  .preset-btn:last-child {
    border-right: none;
  }

  .preset-btn:hover {
    background: var(--color-bg-deep);
  }

  .preset-btn-active {
    background: var(--color-blue);
    color: var(--color-surface);
  }

  .preset-btn-active:hover {
    background: var(--color-blue);
  }

  .unknown-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    cursor: pointer;
    padding: var(--space-2) var(--space-3);
    border: var(--border-thin);
    background: var(--color-bg);
  }

  .unknown-checkbox {
    width: 1rem;
    height: 1rem;
    border: var(--border);
    border-radius: 0;
    accent-color: var(--color-ink);
    cursor: pointer;
  }

  .unknown-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-ink);
    user-select: none;
  }

  /* ── Provider sections ───────────────────────────────────────────────────── */
  .providers-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .provider-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .provider-header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-3);
  }

  .provider-name {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-ink);
  }

  .hidden-notice {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .hidden-notice-count {
    font-weight: 700;
    color: var(--color-ink);
  }

  /* ── Model list inside BrutalCard ────────────────────────────────────────── */
  .model-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .model-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: start;
    gap: var(--space-3);
    padding: var(--space-3) 0;
    border-bottom: var(--border-thin);
    min-height: 44px;
  }

  .model-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  /*
   * Blocked / wrong-type: a full-opacity disabled treatment. We do NOT use
   * `opacity` here — dimming a text container drops every cell below the WCAG AA
   * contrast threshold (worst case ~2.4:1), and the Embedding stage blocks ~all
   * models, so that would fail at scale. "Blocked" is instead conveyed by the
   * ✗ verdict badge, the strikethrough name, the coral `blocked` marker, AND a
   * coral left rule + faint tint on the row — none of which touch text contrast.
   */
  .model-row-blocked {
    border-left: 3px solid var(--state-fail-fg, #991b1b);
    padding-left: var(--space-3);
    background: var(--state-fail-bg, #fee2e2);
  }

  /* ── Verdict badge (5-state) ─────────────────────────────────────────────── */
  /*
   * Five distinct visual states — NOT relying on colour alone:
   *   recommended → yellow fill, ink text, "★" glyph
   *   usable      → ink fill, yellow text, "✓" glyph
   *   caveat      → warn-bg fill, ink text, "⚠" glyph + dashed border
   *   unknown     → transparent, muted text, "?" glyph + dashed border
   *   wrong_type  → coral / error fill, "✗" glyph
   */
  .verdict-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 3rem;
    min-height: 3rem;
    border: var(--border);
    border-radius: 0;
    padding: var(--space-1);
    gap: 2px;
    flex-shrink: 0;
  }

  .verdict-glyph {
    font-size: 1rem;
    line-height: 1;
    font-weight: 900;
  }

  .verdict-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    line-height: 1;
  }

  /* recommended — yellow fill, solid border */
  .verdict-recommended {
    background: var(--color-yellow);
    color: var(--color-ink);
    border-color: var(--color-ink);
    box-shadow: 2px 2px 0 0 var(--color-ink);
  }

  /* usable — ink fill, yellow text */
  .verdict-usable {
    background: var(--color-ink);
    color: var(--color-yellow);
    border-color: var(--color-ink);
  }

  /* caveat — warning state */
  .verdict-caveat {
    background: var(--state-warn-bg, #fef3c7);
    color: var(--state-warn-fg, #78350f);
    border-color: var(--state-warn-fg, #78350f);
    border-style: dashed;
  }

  /* unknown — muted / transparent */
  .verdict-unknown {
    background: transparent;
    color: var(--color-ink-muted);
    border-color: var(--color-ink-muted);
    border-style: dashed;
  }

  /* wrong_type — error / coral fill */
  .verdict-wrong_type {
    background: var(--state-fail-bg, #fee2e2);
    color: var(--state-fail-fg, #991b1b);
    border-color: var(--state-fail-fg, #991b1b);
  }

  /* ── Model info column ───────────────────────────────────────────────────── */
  .model-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  .model-name-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .model-name {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    color: var(--color-ink);
    text-transform: uppercase;
  }

  .model-name-blocked {
    text-decoration: line-through;
    color: var(--color-ink-muted);
  }

  .unverified-marker {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 1px 5px;
    border: var(--border-thin);
    border-style: dashed;
    color: var(--color-ink-muted);
    background: transparent;
  }

  .blocked-marker {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    padding: 1px 5px;
    border: var(--border-thin);
    background: var(--state-fail-bg, #fee2e2);
    color: var(--state-fail-fg, #991b1b);
    border-color: var(--state-fail-fg, #991b1b);
  }

  /* Rationale */
  .model-rationale {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .rationale-text {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--color-ink-muted);
  }

  .rationale-toggle {
    align-self: flex-start;
    background: none;
    border: none;
    padding: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    color: var(--color-ink);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }

  .rationale-toggle:hover {
    color: var(--color-ink-muted);
  }

  /* ── Cost + region meta DL ───────────────────────────────────────────────── */
  .model-meta {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 9rem;
    flex-shrink: 0;
  }

  @media (max-width: 640px) {
    .model-row {
      grid-template-columns: auto 1fr;
    }
    .model-meta {
      grid-column: 2;
      flex-direction: row;
      flex-wrap: wrap;
      gap: var(--space-2);
      min-width: 0;
    }
  }

  .meta-pair {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .meta-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-ink-muted);
  }

  .meta-value {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    color: var(--color-ink);
  }

  .meta-region {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 12rem;
  }

  /* ── Empty / no-models states ────────────────────────────────────────────── */
  .empty-state {
    border: var(--border);
    padding: var(--space-5);
    background: var(--color-bg);
    box-shadow: var(--shadow-md);
  }

  .empty-title {
    margin: 0 0 var(--space-1);
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
    color: var(--color-ink);
  }

  .empty-desc {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-ink-muted);
  }

  .no-models {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-ink-muted);
    padding: var(--space-2) 0;
  }

  /* ── Checkbox focus ring (match the brutalist 2px yellow ring) ───────────── */
  .unknown-toggle:focus-within {
    outline: 2px solid var(--color-yellow);
    outline-offset: 2px;
  }

  /* ── Model name search ───────────────────────────────────────────────────── */
  .search-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .search-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-ink);
  }

  .search-input {
    flex: 1 1 16rem;
    min-width: 12rem;
    border: var(--border);
    border-radius: 0;
    background: var(--color-surface);
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink);
  }

  .search-input::placeholder {
    color: var(--color-ink-muted);
  }

  /* ── Per-provider count chip ─────────────────────────────────────────────── */
  .provider-count {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-ink-muted);
  }

  /* ── Collapsed "incompatible models" disclosure ──────────────────────────── */
  .blocked-details {
    margin-top: var(--space-2);
    border-top: var(--border-thin);
  }

  .blocked-summary {
    cursor: pointer;
    padding: var(--space-2) 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-ink-muted);
    list-style-position: inside;
  }

  .blocked-summary:hover {
    color: var(--color-ink);
  }

  .model-list-blocked {
    margin-top: var(--space-1);
  }

  /* ── Screen-reader-only live region ──────────────────────────────────────── */
  .sr-only {
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
