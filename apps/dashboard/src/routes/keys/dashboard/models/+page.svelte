<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import EmptyState from "$lib/components/EmptyState.svelte";

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
      variantsSummary: {
        providerCount: number;
        hasAvailableVariant: boolean;
        hasPricingRef: boolean;
        hasRateLimitRef: boolean;
        availabilityStates: string[];
      };
    }[];
    error: string | null;
  };

  let lifecycleFilter = $page.url.searchParams.get("lifecycleState") ?? "";
  let familyFilter = $page.url.searchParams.get("family") ?? "";
  let q = $page.url.searchParams.get("q") ?? "";
  let availabilityFilter = $page.url.searchParams.get("availability") ?? "";
  let costFilter = $page.url.searchParams.get("cost") ?? "";
  let rateLimitFilter = $page.url.searchParams.get("rateLimit") ?? "";
  let contextFilter = $page.url.searchParams.get("context") ?? "";
  let speedFilter = $page.url.searchParams.get("speed") ?? "";
  let useCaseFilter = $page.url.searchParams.get("useCase") ?? "";
  let selectedId = $page.url.searchParams.get("detail") ?? "";
  let filteredModels: typeof data.models = data.models;
  let groupedModels: { family: string; items: typeof data.models }[] = [];

  function applyFilters() {
    const params = new URLSearchParams();
    if (lifecycleFilter) params.set("lifecycleState", lifecycleFilter);
    if (familyFilter) params.set("family", familyFilter);
    if (q.trim()) params.set("q", q.trim());
    if (availabilityFilter) params.set("availability", availabilityFilter);
    if (costFilter) params.set("cost", costFilter);
    if (rateLimitFilter) params.set("rateLimit", rateLimitFilter);
    if (contextFilter) params.set("context", contextFilter);
    if (speedFilter) params.set("speed", speedFilter);
    if (useCaseFilter) params.set("useCase", useCaseFilter);
    goto(`${DASHBOARD_BASE}/models${params.toString() ? "?" + params.toString() : ""}`);
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
    const q = params.toString();
    goto(`${DASHBOARD_BASE}/models${q ? "?" + q : ""}`);
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
      matchesText(m) &&
      matchesUseCase(m) &&
      matchesAvailability(m) &&
      matchesCost(m) &&
      matchesRateLimit(m) &&
      matchesContext(m) &&
      matchesSpeed(m)
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

<h1 class="page-title">Model catalog</h1>
<p class="page-desc">
  Find models by operational constraints and use case: availability, pricing/rate-limit metadata, context size, speed profile, and what each model is best or worst at.
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
        <label for="family">Family</label>
        <input id="family" type="text" bind:value={familyFilter} class="input" placeholder="e.g. gpt-4, claude" />
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
      <a class="btn btn-secondary" href={DASHBOARD_BASE + "/models"}>Clear</a>
    </form>
  </section>

  {#if filteredModels.length === 0}
    <EmptyState
      title="No models match"
      description="Try changing filters or ensure the model catalog has been populated."
    >
      <a href={DASHBOARD_BASE + "/models"} class="btn btn-secondary">Clear filters</a>
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
                  <span class="model-name">{m.canonicalName}</span>
                  <span class="lifecycle-badge lifecycle-{lifecycleBadge(m.lifecycleState)}">
                    {m.lifecycleState ?? "—"}
                  </span>
                </span>
                <span class="model-meta">
                  <span class="chip">availability: {m.variantsSummary.hasAvailableVariant ? "available" : "degraded"}</span>
                  <span class="chip">providers: {m.variantsSummary.providerCount}</span>
                  <span class="chip">cost: {m.variantsSummary.hasPricingRef ? "known" : "unknown"}</span>
                  <span class="chip">rate limits: {m.variantsSummary.hasRateLimitRef ? "known" : "unknown"}</span>
                  <span class="chip">speed: {speedTier(m.id)}</span>
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
            </li>
          {/each}
        </ul>
      {/each}
    </section>
  {/if}
{/if}

{#if selectedId}
  <div class="drawer-backdrop" role="presentation" onclick={closeDetail}></div>
  <div class="drawer" role="dialog" aria-labelledby="drawer-title" aria-modal="true">
    <div class="drawer-header">
      <h2 id="drawer-title">Model detail</h2>
      <button type="button" class="btn-close" onclick={closeDetail} aria-label="Close">×</button>
    </div>
    <div class="drawer-body">
      <a href={DASHBOARD_BASE + "/models/" + selectedId} class="btn btn-secondary">Open full page</a>
      <p class="muted">Full detail and provider variants on the model page.</p>
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
    margin: 0 0 var(--space-4);
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
    border: 1px solid var(--rm-border);
    font-size: var(--text-sm);
    background: var(--rm-bg);
    color: var(--rm-text);
    min-width: 10rem;
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
  .btn-primary {
    background: var(--rm-sage);
    color: var(--rm-bg);
  }
  .btn-secondary {
    background: var(--rm-surface);
    color: var(--rm-text);
    border: 1px solid var(--rm-border);
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
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
    cursor: pointer;
    transition: background 0.15s;
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
    font-size: var(--text-sm);
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
    border: 1px solid var(--rm-border);
    border-radius: 999px;
    padding: 2px 8px;
    background: var(--rm-bg);
    color: var(--rm-muted);
  }
  .model-family {
    text-transform: lowercase;
  }
  .lifecycle-badge {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.7rem;
  }
  .lifecycle-current {
    background: var(--rm-sage);
    color: var(--rm-bg);
  }
  .lifecycle-preview {
    background: var(--rm-surface);
    color: var(--rm-text);
    border: 1px solid var(--rm-border);
  }
  .lifecycle-deprecated {
    background: var(--coral-alert);
    color: white;
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
    border-left: 1px solid var(--rm-border);
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
    border-bottom: 1px solid var(--rm-border);
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
