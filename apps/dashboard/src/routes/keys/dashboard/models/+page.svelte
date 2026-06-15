<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import ModelAdvisoryPanel from "$lib/components/connect/ModelAdvisoryPanel.svelte";

  /** Minimal model shape from list (server returns full ModelRecord; we use a subset). */
  export let data: {
    models: {
      id: string;
      canonicalName: string;
      family: string | null;
      lifecycleState: string | null;
      description: string | null;
      contextWindow: number | null;
      maxOutputTokens: number | null;
      editorialSummary: string | null;
      strengths: string[] | null;
      weaknesses: string[] | null;
      recommendedFor: string[] | null;
      avoidFor: string[] | null;
      deprecationDate: number | null;
      retirementDate: number | null;
      homeJurisdiction: string | null;
      processingRegions: string[];
      variantsSummary: {
        providerCount: number;
        providerIds: string[];
        variantCount: number;
        allowlistAlignedVariantCount: number;
        hasAvailableVariant: boolean;
        hasPricingRef: boolean;
        hasRateLimitRef: boolean;
        availabilityStates: string[];
        crowdDeprecatedReports: number;
        crowdRetiredReports: number;
        hasCrowdSignals: boolean;
      };
    }[];
    availableProviders: string[];
    availableJurisdictions: string[];
    availableRegions: string[];
    error: string | null;
  };

  // ── Lens (Browse | Rank for stage) ─────────────────────────────────────────
  type View = "browse" | "rank";
  const VIEWS: { id: View; label: string }[] = [
    { id: "browse", label: "Browse" },
    { id: "rank", label: "Rank for stage" },
  ];
  function readView(v: string | null): View {
    return v === "rank" ? "rank" : "browse";
  }
  let view: View = readView($page.url.searchParams.get("view"));
  // Keep the lens in sync if the URL changes underneath us (back/forward, nav links).
  $: view = readView($page.url.searchParams.get("view"));

  function setView(next: View) {
    if (next === view) return;
    const params = new URLSearchParams($page.url.searchParams);
    if (next === "browse") {
      // Browse is the canonical default — keep the URL clean and preserve any browse filters.
      params.delete("view");
    } else {
      params.set("view", next);
    }
    const qs = params.toString();
    goto(`${DASHBOARD_BASE}/models${qs ? "?" + qs : ""}`);
  }

  /** Tablist roving-focus keyboard nav (arrow keys + Home/End). */
  function moveLens(e: KeyboardEvent, current: View) {
    const ids = VIEWS.map((v) => v.id);
    let idx = ids.indexOf(current);
    if (idx < 0) idx = 0;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") idx = (idx + 1) % ids.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") idx = (idx - 1 + ids.length) % ids.length;
    else if (e.key === "Home") idx = 0;
    else if (e.key === "End") idx = ids.length - 1;
    else return;
    e.preventDefault();
    const next = ids[idx];
    setView(next);
    const strip = (e.currentTarget as HTMLElement).closest('[role="tablist"]');
    strip?.querySelectorAll<HTMLElement>('[role="tab"]')?.[idx]?.focus();
  }

  // ── Browse filters ─────────────────────────────────────────────────────────
  let lifecycleFilter = $page.url.searchParams.get("lifecycleState") ?? "";
  let selectedProviders = $page.url.searchParams.getAll("provider");
  let q = $page.url.searchParams.get("q") ?? "";
  let availabilityFilter = $page.url.searchParams.get("availability") ?? "";
  let costFilter = $page.url.searchParams.get("cost") ?? "";
  let rateLimitFilter = $page.url.searchParams.get("rateLimit") ?? "";
  let contextFilter = $page.url.searchParams.get("context") ?? "";
  let speedFilter = $page.url.searchParams.get("speed") ?? "";
  let jurisdictionFilter = $page.url.searchParams.get("home") ?? "";
  let regionFilter = $page.url.searchParams.get("region") ?? "";
  let useCaseFilter =
    $page.url.searchParams.get("useCase") ??
    $page.url.searchParams.get("goodFor") ??
    $page.url.searchParams.get("badFor") ??
    "";
  let selectedId = $page.url.searchParams.get("detail") ?? "";
  let filteredModels: typeof data.models = data.models;
  $: selectedModel = selectedId ? data.models.find((m) => m.id === selectedId) ?? null : null;
  let groupedModels: { family: string; items: typeof data.models }[] = [];
  let copiedModelId = "";
  let copiedTimeout: ReturnType<typeof setTimeout> | null = null;

  $: selectedProvidersLabel =
    selectedProviders.length === 0
      ? "Any"
      : selectedProviders.length === 1
        ? selectedProviders[0]
        : `${selectedProviders.length} selected`;

  function toggleProvider(providerId: string) {
    const normalized = providerId.trim().toLowerCase();
    if (!normalized) return;
    if (selectedProviders.includes(normalized)) {
      selectedProviders = selectedProviders.filter((p) => p !== normalized);
      return;
    }
    selectedProviders = [...selectedProviders, normalized].sort((a, b) => a.localeCompare(b));
  }

  function applyFilters() {
    const params = new URLSearchParams();
    // Browse is the default lens; applying filters never leaves the rank lens.
    if (lifecycleFilter) params.set("lifecycleState", lifecycleFilter);
    for (const provider of selectedProviders) {
      if (provider.trim()) params.append("provider", provider.trim());
    }
    if (q.trim()) params.set("q", q.trim());
    if (availabilityFilter) params.set("availability", availabilityFilter);
    if (costFilter) params.set("cost", costFilter);
    if (rateLimitFilter) params.set("rateLimit", rateLimitFilter);
    if (contextFilter) params.set("context", contextFilter);
    if (speedFilter) params.set("speed", speedFilter);
    if (jurisdictionFilter) params.set("home", jurisdictionFilter);
    if (regionFilter) params.set("region", regionFilter);
    if (useCaseFilter) params.set("useCase", useCaseFilter);
    goto(`${DASHBOARD_BASE}/models${params.toString() ? "?" + params.toString() : ""}`);
  }

  function clearFilters() {
    lifecycleFilter = "";
    selectedProviders = [];
    q = "";
    availabilityFilter = "";
    costFilter = "";
    rateLimitFilter = "";
    contextFilter = "";
    speedFilter = "";
    jurisdictionFilter = "";
    regionFilter = "";
    useCaseFilter = "";
    selectedId = "";
    goto(`${DASHBOARD_BASE}/models`);
  }

  function openDetail(id: string) {
    selectedId = id;
    const params = new URLSearchParams($page.url.searchParams);
    params.set("detail", id);
    goto(`${DASHBOARD_BASE}/models?${params.toString()}`);
  }

  function closeDetail() {
    selectedId = "";
    const params = new URLSearchParams($page.url.searchParams);
    params.delete("detail");
    const qs = params.toString();
    goto(`${DASHBOARD_BASE}/models${qs ? "?" + qs : ""}`);
  }

  function lifecycleBadge(state: string | null): string {
    if (!state) return "—";
    const s = state.toLowerCase();
    if (s === "deprecated" || s === "retired") return "deprecated";
    if (s === "preview" || s === "beta") return "preview";
    return "current";
  }

  function speedTier(modelId: string): "fast" | "balanced" | "deep_reasoning" {
    const id = modelId.toLowerCase();
    if (id.includes("mini") || id.includes("nano") || id.includes("flash") || id.includes("haiku")) return "fast";
    if (id.startsWith("o1") || id.startsWith("o3") || id.includes("reason")) return "deep_reasoning";
    return "balanced";
  }

  /** Compact "home → region" badge, consistent with the advisory panel's region cell. */
  function regionBadge(model: (typeof data.models)[number]): string {
    const home = model.homeJurisdiction ?? "unknown";
    const regions = model.processingRegions;
    const proc =
      regions.length === 0
        ? "unknown"
        : regions.length === 1
          ? regions[0]
          : `${regions.length} regions`;
    return `${home} → ${proc}`;
  }

  async function copyModelId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      copiedModelId = id;
      if (copiedTimeout) clearTimeout(copiedTimeout);
      copiedTimeout = setTimeout(() => {
        copiedModelId = "";
      }, 1500);
    } catch {
      // ignore clipboard failures
    }
  }

  function useInRoute(id: string) {
    goto(`${DASHBOARD_BASE}/routes?newRoute=true&model=${encodeURIComponent(id)}`);
  }

  function contextBucket(contextWindow: number | null): "small" | "medium" | "large" | "xlarge" | "unknown" {
    if (contextWindow == null) return "unknown";
    if (contextWindow < 64_000) return "small";
    if (contextWindow < 200_000) return "medium";
    if (contextWindow < 1_000_000) return "large";
    return "xlarge";
  }

  function matchesUseCase(model: (typeof data.models)[number]): boolean {
    if (!useCaseFilter.trim()) return true;
    const needle = useCaseFilter.trim().toLowerCase();
    const haystack = [
      ...(model.recommendedFor ?? []),
      ...(model.avoidFor ?? []),
      ...(model.strengths ?? []),
      ...(model.weaknesses ?? []),
      model.description ?? "",
      model.editorialSummary ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  }

  function matchesLifecycle(model: (typeof data.models)[number]): boolean {
    if (!lifecycleFilter) return true;
    return (model.lifecycleState ?? "").toLowerCase() === lifecycleFilter.toLowerCase();
  }

  function matchesProviders(model: (typeof data.models)[number]): boolean {
    if (selectedProviders.length === 0) return true;
    const providers = new Set(model.variantsSummary.providerIds);
    return selectedProviders.some((p) => providers.has(p.toLowerCase()));
  }

  function matchesJurisdiction(model: (typeof data.models)[number]): boolean {
    if (!jurisdictionFilter) return true;
    return (model.homeJurisdiction ?? "") === jurisdictionFilter;
  }

  function matchesRegion(model: (typeof data.models)[number]): boolean {
    if (!regionFilter) return true;
    return model.processingRegions.includes(regionFilter);
  }

  function matchesText(model: (typeof data.models)[number]): boolean {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    const haystack = [
      model.id,
      model.canonicalName,
      model.family ?? "",
      model.lifecycleState ?? "",
      model.description ?? "",
      model.editorialSummary ?? "",
      model.homeJurisdiction ?? "",
      ...model.processingRegions,
      ...(model.recommendedFor ?? []),
      ...(model.avoidFor ?? []),
      ...(model.strengths ?? []),
      ...(model.weaknesses ?? []),
      ...model.variantsSummary.availabilityStates,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  }

  function matchesAvailability(model: (typeof data.models)[number]): boolean {
    if (!availabilityFilter) return true;
    if (availabilityFilter === "available") return model.variantsSummary.hasAvailableVariant;
    if (availabilityFilter === "degraded") return !model.variantsSummary.hasAvailableVariant;
    return true;
  }

  function matchesCost(model: (typeof data.models)[number]): boolean {
    if (!costFilter) return true;
    if (costFilter === "known") return model.variantsSummary.hasPricingRef;
    if (costFilter === "unknown") return !model.variantsSummary.hasPricingRef;
    return true;
  }

  function matchesRateLimit(model: (typeof data.models)[number]): boolean {
    if (!rateLimitFilter) return true;
    if (rateLimitFilter === "known") return model.variantsSummary.hasRateLimitRef;
    if (rateLimitFilter === "unknown") return !model.variantsSummary.hasRateLimitRef;
    return true;
  }

  function matchesContext(model: (typeof data.models)[number]): boolean {
    if (!contextFilter) return true;
    return contextBucket(model.contextWindow) === contextFilter;
  }

  function matchesSpeed(model: (typeof data.models)[number]): boolean {
    if (!speedFilter) return true;
    return speedTier(model.id) === speedFilter;
  }

  $: filteredModels = data.models.filter(
    (m) =>
      matchesLifecycle(m) &&
      matchesProviders(m) &&
      matchesText(m) &&
      matchesUseCase(m) &&
      matchesAvailability(m) &&
      matchesCost(m) &&
      matchesRateLimit(m) &&
      matchesContext(m) &&
      matchesSpeed(m) &&
      matchesJurisdiction(m) &&
      matchesRegion(m)
  );

  $: groupedModels = groupByFamily(filteredModels);

  function groupByFamily(models: typeof filteredModels) {
    const map = new Map<string, typeof filteredModels>();
    for (const model of models) {
      const key = model.family?.trim() || "other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(model);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([family, items]) => ({ family, items }));
  }
</script>

<svelte:head>
  <title>Models – Restormel</title>
</svelte:head>

<h1 class="page-title">Models</h1>
<p class="page-desc">
  One catalogue, two lenses. <strong>Browse</strong> the full model reference — lifecycle, editorial fields, per-provider
  variants, home jurisdiction and processing region — or switch to <strong>Rank for stage</strong> for a provider-neutral
  suitability ranking of available models per ingestion pipeline stage.
</p>

<!-- ── Lens control (Browse | Rank for stage) ───────────────────────────────── -->
<div class="lens" role="tablist" aria-label="Models view">
  {#each VIEWS as v (v.id)}
    <button
      type="button"
      role="tab"
      id="lens-tab-{v.id}"
      aria-selected={view === v.id}
      aria-controls="lens-panel-{v.id}"
      tabindex={view === v.id ? 0 : -1}
      class="lens-btn"
      class:lens-btn-active={view === v.id}
      onclick={() => setView(v.id)}
      onkeydown={(e) => moveLens(e, view)}
    >
      {v.label}
    </button>
  {/each}
</div>

{#if view === "rank"}
  <!-- ── Rank lens: the DB-backed advisory panel (own stage/region/search controls) ── -->
  <div id="lens-panel-rank" role="tabpanel" aria-labelledby="lens-tab-rank" tabindex="0" class="lens-panel">
    <ModelAdvisoryPanel />
  </div>
{:else}
  <!-- ── Browse lens: the reference catalogue ──────────────────────────────────── -->
  <div id="lens-panel-browse" role="tabpanel" aria-labelledby="lens-tab-browse" tabindex="0" class="lens-panel">
    <p class="page-desc page-desc-secondary">
      This list reflects the <strong>dashboard database</strong>: lifecycle, editorial fields, per-provider variants,
      home jurisdiction and processing region. It is enriched with how each variant lines up with the
      <strong>default active-model allowlist</strong> shipped in <code>@restormel/keys</code>, and with
      <strong>crowd-reported</strong> vendor deprecation/retirement signals aggregated from apps. The public
      <a href="/keys/dashboard/api/catalog">canonical catalog API</a> merges the same rows with live provider signals
      (OpenRouter, status pages) and contract <code>2026-03-26.catalog.v6</code>. See the
      <a href="/keys/docs/guides/canonical-catalog">canonical catalog guide</a> for integration details.
    </p>

    {#if data.error}
      <p class="error-msg" role="alert">{data.error}</p>
    {:else}
      <section class="section filters" aria-labelledby="filters-heading">
        <h2 id="filters-heading" class="section-title">Filters</h2>
        <form class="filter-form" onsubmit={(e) => { e.preventDefault(); applyFilters(); }}>
          <div class="form-row">
            <label for="lifecycle">Lifecycle</label>
            <select id="lifecycle" bind:value={lifecycleFilter} class="input">
              <option value="">Any</option>
              <option value="current">current</option>
              <option value="preview">preview</option>
              <option value="deprecated">deprecated</option>
              <option value="retired">retired</option>
            </select>
          </div>
          <div class="form-row">
            <label for="providers-menu">Providers</label>
            <details id="providers-menu" class="provider-menu">
              <summary class="input provider-summary" aria-label="Select one or more providers">
                {selectedProvidersLabel}
              </summary>
              <div class="provider-options" role="group" aria-label="Provider options">
                {#each data.availableProviders as providerId}
                  <label class="provider-option">
                    <input
                      type="checkbox"
                      checked={selectedProviders.includes(providerId)}
                      onchange={() => toggleProvider(providerId)}
                    />
                    <span>{providerId}</span>
                  </label>
                {/each}
                {#if selectedProviders.length > 0}
                  <button type="button" class="btn btn-secondary btn-inline" onclick={() => (selectedProviders = [])}>
                    Clear providers
                  </button>
                {/if}
              </div>
            </details>
          </div>
          <div class="form-row">
            <label for="home">Home jurisdiction</label>
            <select id="home" bind:value={jurisdictionFilter} class="input">
              <option value="">Any</option>
              {#each data.availableJurisdictions as j}
                <option value={j}>{j}</option>
              {/each}
            </select>
          </div>
          <div class="form-row">
            <label for="region">Processing region</label>
            <select id="region" bind:value={regionFilter} class="input">
              <option value="">Any</option>
              {#each data.availableRegions as r}
                <option value={r}>{r}</option>
              {/each}
            </select>
          </div>
          <div class="form-row">
            <label for="search">Search</label>
            <input id="search" type="text" bind:value={q} class="input" placeholder="name, capabilities, good/bad for..." />
          </div>
          <div class="form-row">
            <label for="availability">Availability</label>
            <select id="availability" bind:value={availabilityFilter} class="input">
              <option value="">Any</option>
              <option value="available">At least one available provider</option>
              <option value="degraded">No available providers</option>
            </select>
          </div>
          <div class="form-row">
            <label for="cost">Cost metadata</label>
            <select id="cost" bind:value={costFilter} class="input">
              <option value="">Any</option>
              <option value="known">Known (pricingRef present)</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <div class="form-row">
            <label for="rateLimit">Rate limiting metadata</label>
            <select id="rateLimit" bind:value={rateLimitFilter} class="input">
              <option value="">Any</option>
              <option value="known">Known (rateLimitRef present)</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <div class="form-row">
            <label for="context">Context size</label>
            <select id="context" bind:value={contextFilter} class="input">
              <option value="">Any</option>
              <option value="small">&lt; 64k</option>
              <option value="medium">64k - 199k</option>
              <option value="large">200k - 999k</option>
              <option value="xlarge">1M+</option>
            </select>
          </div>
          <div class="form-row">
            <label for="speed">Speed profile</label>
            <select id="speed" bind:value={speedFilter} class="input">
              <option value="">Any</option>
              <option value="fast">Fast / lightweight</option>
              <option value="balanced">Balanced</option>
              <option value="deep_reasoning">Deep reasoning</option>
            </select>
          </div>
          <div class="form-row">
            <label for="useCase">Good/Bad for</label>
            <input id="useCase" type="text" bind:value={useCaseFilter} class="input" placeholder="e.g. extraction, coding, latency" />
          </div>
          <button type="submit" class="btn btn-primary">Apply</button>
          <button type="button" class="btn btn-secondary" onclick={clearFilters}>Clear</button>
        </form>
      </section>

      {#if filteredModels.length === 0}
        <EmptyState
          title="No models match"
          description="Try changing filters or ensure the model catalog has been populated."
        >
          <button type="button" class="btn btn-secondary" onclick={clearFilters}>Clear filters</button>
        </EmptyState>
      {:else}
        <section class="section" aria-labelledby="list-heading">
          <h2 id="list-heading" class="section-title">Models ({filteredModels.length})</h2>
          {#each groupedModels as group}
            <h3 class="group-title">{group.family}</h3>
            <ul class="model-list">
              {#each group.items as m}
                <li class="model-row">
                  <button type="button" class="model-card" onclick={() => openDetail(m.id)}>
                    <span class="model-head">
                      <span class="model-title-wrap">
                        <span class="model-family-label">{m.family ?? "other"}</span>
                        <span class="model-name">{m.canonicalName || m.id}</span>
                      </span>
                      <span class="lifecycle-badge lifecycle-{lifecycleBadge(m.lifecycleState)}">
                        {m.lifecycleState ?? "—"}
                      </span>
                    </span>
                    <span class="model-meta">
                      <span class="availability-dot {m.variantsSummary.hasAvailableVariant ? "availability-green" : "availability-grey"}" aria-hidden="true"></span>
                      <span class="chip">availability: {m.variantsSummary.hasAvailableVariant ? "available" : "degraded"}</span>
                      <span class="chip">providers: {m.variantsSummary.providerCount}</span>
                      {#if m.variantsSummary.variantCount > 0}
                        <span class="chip" title="Variants whose provider id + model id appear on the default allowlist in @restormel/keys">
                          allowlist: {m.variantsSummary.allowlistAlignedVariantCount}/{m.variantsSummary.variantCount}
                        </span>
                      {/if}
                      {#if m.variantsSummary.hasCrowdSignals}
                        <span class="chip chip-crowd" title="Aggregated app reports for this model’s provider variants">
                          crowd: dep {m.variantsSummary.crowdDeprecatedReports} · ret {m.variantsSummary.crowdRetiredReports}
                        </span>
                      {/if}
                      <span class="chip">cost: {m.variantsSummary.hasPricingRef ? "known" : "unknown"}</span>
                      <span class="chip">rate limits: {m.variantsSummary.hasRateLimitRef ? "known" : "unknown"}</span>
                      <span class="chip">speed: {speedTier(m.id)}</span>
                      <span class="chip chip-region" title="Home jurisdiction → processing region">
                        {regionBadge(m)}
                      </span>
                    </span>
                    {#if m.contextWindow != null || m.maxOutputTokens != null}
                      <span class="model-capacity">
                        {#if m.contextWindow != null}ctx: {m.contextWindow.toLocaleString()} ({contextBucket(m.contextWindow)}){/if}
                        {#if m.contextWindow != null && m.maxOutputTokens != null} · {/if}
                        {#if m.maxOutputTokens != null}max out: {m.maxOutputTokens.toLocaleString()}{/if}
                      </span>
                    {/if}
                    {#if m.recommendedFor?.length || m.avoidFor?.length}
                      <span class="model-usage">
                        {#if m.recommendedFor?.length}
                          <strong>Good for:</strong> {m.recommendedFor.slice(0, 3).join(", ")}
                        {/if}
                        {#if m.avoidFor?.length}
                          {#if m.recommendedFor?.length} · {/if}
                          <strong>Bad for:</strong> {m.avoidFor.slice(0, 3).join(", ")}
                        {/if}
                      </span>
                    {/if}
                  </button>
                  <div class="model-actions">
                    <button
                      type="button"
                      class="btn btn-secondary btn-inline"
                      onclick={() => copyModelId(m.id)}
                      title={copiedModelId === m.id ? "Copied!" : "Copy model ID"}
                    >
                      {copiedModelId === m.id ? "Copied!" : "Copy"}
                    </button>
                    <button type="button" class="btn btn-secondary btn-inline" onclick={() => useInRoute(m.id)}>
                      Use in route →
                    </button>
                  </div>
                </li>
              {/each}
            </ul>
          {/each}
        </section>
      {/if}
    {/if}
  </div>
{/if}

{#if view === "browse" && selectedId}
  <div class="drawer-backdrop" role="presentation" onclick={closeDetail}></div>
  <div class="drawer" role="dialog" aria-labelledby="drawer-title" aria-modal="true">
    <div class="drawer-header">
      <h2 id="drawer-title">Model detail</h2>
      <button type="button" class="btn-close" onclick={closeDetail} aria-label="Close">×</button>
    </div>
    <div class="drawer-body">
      <a href={DASHBOARD_BASE + "/models/" + selectedId} class="btn btn-secondary">Open full page</a>
      <p class="muted">Full detail, per-variant allowlist alignment, and crowd observation counts on the model page.</p>
      {#if selectedModel}
        <p class="drawer-summary">
          <span class="chip chip-region" title="Home jurisdiction → processing region">
            {regionBadge(selectedModel)}
          </span>
          {#if selectedModel.variantsSummary.variantCount > 0}
            <span class="chip">
              allowlist {selectedModel.variantsSummary.allowlistAlignedVariantCount}/{selectedModel.variantsSummary.variantCount}
            </span>
          {/if}
          {#if selectedModel.variantsSummary.hasCrowdSignals}
            <span class="chip chip-crowd">
              crowd dep {selectedModel.variantsSummary.crowdDeprecatedReports} · ret {selectedModel.variantsSummary.crowdRetiredReports}
            </span>
          {/if}
        </p>
        {#if selectedModel.processingRegions.length > 1}
          <p class="muted drawer-regions">
            Processing regions: {selectedModel.processingRegions.join(", ")}
          </p>
        {/if}
      {/if}
      <p class="muted drawer-links">
        <a href="/keys/docs/guides/canonical-catalog">Canonical catalog guide</a>
        ·
        <a href="/keys/dashboard/api/catalog">Public catalog JSON</a>
      </p>
    </div>
  </div>
{/if}

<style>
  .page-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .page-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-2);
    line-height: 1.5;
  }
  .page-desc-secondary {
    margin-bottom: var(--space-4);
  }

  /* ── Lens control (Browse | Rank for stage) — brutalist segmented strip ──────── */
  .lens {
    display: inline-flex;
    border: var(--border, 2px solid var(--color-ink, #111));
    box-shadow: var(--shadow-md, 4px 4px 0 0 var(--color-ink, #111));
    margin: 0 0 var(--space-5);
    overflow: hidden;
  }
  .lens-btn {
    min-height: 44px;
    padding: var(--space-2) var(--space-4);
    border: none;
    border-right: var(--border-thin, 1px solid var(--color-ink, #111));
    background: var(--color-bg, var(--rm-bg));
    color: var(--color-ink, var(--rm-text));
    font-family: var(--font-mono, monospace);
    font-size: var(--text-mono-sm, 0.8125rem);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.1s ease;
  }
  .lens-btn:last-child {
    border-right: none;
  }
  .lens-btn:hover {
    background: var(--color-surface, var(--rm-surface));
  }
  .lens-btn-active {
    background: var(--color-ink, var(--rm-text));
    color: var(--color-yellow, #f5d90a);
  }
  .lens-btn-active:hover {
    background: var(--color-ink, var(--rm-text));
  }
  .lens-btn:focus-visible {
    outline: 2px solid var(--color-yellow, #f5d90a);
    outline-offset: -4px;
  }
  .lens-panel {
    display: block;
  }
  .lens-panel:focus {
    outline: none;
  }

  .drawer-summary {
    margin: var(--space-3) 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .drawer-regions {
    margin-top: var(--space-2);
  }
  .drawer-links {
    margin-top: var(--space-3);
  }
  .drawer-links a {
    color: var(--rm-sage);
  }
  .chip-crowd {
    border-color: var(--coral-alert);
    color: var(--rm-text);
  }
  .chip-region {
    border-color: var(--rm-text);
    color: var(--rm-text);
    font-variant-numeric: tabular-nums;
  }
  .section {
    margin-bottom: var(--space-6);
  }
  .section-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-1);
  }
  .group-title {
    margin: var(--space-4) 0 var(--space-2);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .filter-form {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--space-3);
  }
  .form-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .form-row label {
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--rm-muted);
  }
  .input {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--rm-radius);
    border: var(--border-thin);
    font-size: var(--text-sm);
    background: var(--rm-bg);
    color: var(--rm-text);
    min-width: 10rem;
  }
  .provider-menu {
    position: relative;
    min-width: 12rem;
  }
  .provider-summary {
    list-style: none;
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 2.1rem;
  }
  .provider-summary::-webkit-details-marker {
    display: none;
  }
  .provider-summary::after {
    content: "▾";
    color: var(--rm-dim);
    margin-left: var(--space-2);
    font-size: var(--text-xs);
  }
  .provider-menu[open] .provider-summary::after {
    content: "▴";
  }
  .provider-options {
    position: absolute;
    z-index: 20;
    top: calc(100% + 4px);
    left: 0;
    width: 100%;
    max-height: 14rem;
    overflow: auto;
    background: var(--rm-surface-raised);
    border: var(--border-thin);
    border-radius: var(--rm-radius);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
    padding: var(--space-2);
    display: grid;
    gap: var(--space-1);
  }
  .provider-option {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: var(--rm-text);
  }
  .btn {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    font-weight: 500;
    border: none;
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
  }
  .btn-secondary {
    background: var(--rm-surface);
    color: var(--rm-text);
    border: var(--border-thin);
  }
  .error-msg {
    color: var(--coral-alert);
    font-size: var(--text-sm);
  }
  .model-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .model-row {
    margin-bottom: var(--space-2);
  }
  .model-card {
    display: block;
    width: 100%;
    text-align: left;
    padding: var(--space-3);
    border: var(--border-thin);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
    cursor: pointer;
    transition: background 0.15s;
  }
  .model-actions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  .btn-inline {
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-xs);
  }
  .model-title-wrap {
    display: grid;
    gap: 0.1rem;
  }
  .model-family-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--rm-dim);
    font-weight: 500;
  }
  .model-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .model-card:hover {
    background: var(--rm-surface);
  }
  .model-name {
    font-weight: 600;
    font-size: var(--text-base);
    color: var(--rm-text);
    display: block;
  }
  .model-meta {
    display: flex;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-1);
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  .chip {
    border: var(--border-thin);
    border-radius: 999px;
    padding: 2px 8px;
    background: var(--rm-bg);
    color: var(--rm-muted);
  }
  .availability-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 999px;
    margin-top: 0.35rem;
  }
  .availability-green {
    background: #3ca067;
  }
  .availability-grey {
    background: #8a8a8a;
  }
  .lifecycle-badge {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.7rem;
  }
  .lifecycle-current {
    background: var(--color-yellow);
    color: var(--color-ink);
  }
  .lifecycle-preview {
    background: var(--rm-surface);
    color: var(--rm-text);
    border: var(--border-thin);
  }
  .lifecycle-deprecated {
    /* Dark ink on the coral fill: white-on-coral fails WCAG AA (~3:1) at this
       0.7rem size; ink-on-coral clears AA (~6.9:1) while keeping the alert hue. */
    background: var(--coral-alert);
    color: var(--rm-text, #1a1a1a);
    font-weight: 600;
  }
  .model-capacity {
    display: block;
    font-size: var(--text-xs);
    color: var(--rm-dim);
    margin-top: var(--space-1);
  }
  .model-usage {
    display: block;
    margin-top: var(--space-1);
    font-size: var(--text-xs);
    color: var(--rm-dim);
    line-height: 1.4;
  }
  .drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.3);
    z-index: 40;
  }
  .drawer {
    position: fixed;
    top: 0;
    right: 0;
    width:  min(24rem, 100vw);
    height: 100vh;
    background: var(--rm-bg);
    border-left: var(--border-thin);
    z-index: 50;
    display: flex;
    flex-direction: column;
    box-shadow: -4px 0 12px rgba(0,0,0,0.1);
  }
  .drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4);
    border-bottom: var(--border-thin);
  }
  .drawer-header h2 {
    font-size: var(--text-base);
    font-weight: 600;
    margin: 0;
  }
  .btn-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--rm-muted);
    line-height: 1;
  }
  .drawer-body {
    padding: var(--space-4);
  }
  .muted {
    font-size: var(--text-sm);
    color: var(--rm-dim);
    margin-top: var(--space-2);
  }
</style>
