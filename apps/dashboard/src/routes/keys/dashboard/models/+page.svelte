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
      deprecationDate: number | null;
      retirementDate: number | null;
    }[];
    error: string | null;
  };

  let lifecycleFilter = $page.url.searchParams.get("lifecycleState") ?? "";
  let familyFilter = $page.url.searchParams.get("family") ?? "";
  let selectedId = $page.url.searchParams.get("detail") ?? "";

  function applyFilters() {
    const params = new URLSearchParams();
    if (lifecycleFilter) params.set("lifecycleState", lifecycleFilter);
    if (familyFilter) params.set("family", familyFilter);
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
</script>

<svelte:head>
  <title>Models – Restormel</title>
</svelte:head>

<h1 class="page-title">Model catalog</h1>
<p class="page-desc">
  Browse models by family and lifecycle. Each model can have multiple provider variants (e.g. OpenAI, Anthropic). Metadata may be placeholder until full ingestion is wired.
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
      <button type="submit" class="btn btn-primary">Apply</button>
    </form>
  </section>

  {#if data.models.length === 0}
    <EmptyState
      title="No models match"
      description="Try changing filters or ensure the model catalog has been populated."
    >
      <a href={DASHBOARD_BASE + "/models"} class="btn btn-secondary">Clear filters</a>
    </EmptyState>
  {:else}
    <section class="section" aria-labelledby="list-heading">
      <h2 id="list-heading" class="section-title">Models ({data.models.length})</h2>
      <ul class="model-list">
        {#each data.models as m}
          <li class="model-row">
            <button type="button" class="model-card" onclick={() => openDetail(m.id)}>
              <span class="model-name">{m.canonicalName}</span>
              <span class="model-meta">
                {#if m.family}
                  <span class="model-family">{m.family}</span>
                {/if}
                <span class="lifecycle-badge lifecycle-{lifecycleBadge(m.lifecycleState)}">
                  {m.lifecycleState ?? "—"}
                </span>
              </span>
              {#if m.contextWindow != null || m.maxOutputTokens != null}
                <span class="model-capacity">
                  {#if m.contextWindow != null}ctx: {m.contextWindow.toLocaleString()}{/if}
                  {#if m.contextWindow != null && m.maxOutputTokens != null} · {/if}
                  {#if m.maxOutputTokens != null}max out: {m.maxOutputTokens.toLocaleString()}{/if}
                </span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
{/if}

{#if selectedId}
  <div class="drawer-backdrop" role="presentation" onclick={closeDetail}></div>
  <aside class="drawer" role="dialog" aria-labelledby="drawer-title" aria-modal="true">
    <div class="drawer-header">
      <h2 id="drawer-title">Model detail</h2>
      <button type="button" class="btn-close" onclick={closeDetail} aria-label="Close">×</button>
    </div>
    <div class="drawer-body">
      <a href={DASHBOARD_BASE + "/models/" + selectedId} class="btn btn-secondary">Open full page</a>
      <p class="muted">Full detail and provider variants on the model page.</p>
    </div>
  </aside>
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
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-1);
    font-size: var(--text-xs);
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
