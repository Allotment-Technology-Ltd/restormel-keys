<script lang="ts">
  import { tick } from "svelte";
  import { invalidateAll } from "$app/navigation";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { page } from "$app/stores";
  import ConnectBuilderReturnBar from "$lib/components/connect/ConnectBuilderReturnBar.svelte";
  import { parseReturnTo, withReturnTo } from "$lib/connect/pipeline-config";
  import { matchActiveToRecommended, type ActiveModelMatch } from "$lib/connect/stage-active-model";

  type StageRow = {
    key: string;
    label: string;
    help: string;
    ingestionStage: string;
    route: {
      id: string;
      name: string;
      status: string;
      isPublished: boolean;
      enabled: boolean;
    } | null;
    visualHref: string | null;
    activeModel?: { modelId: string; provider: string } | null;
    recommended?: {
      modelId: string;
      provider: string;
      rationale: string;
      sameProviderFallback?: boolean;
    } | null;
  };

  type Models = {
    routing: { project_id?: string; environment_id?: string } | null;
    projects: { id: string; name: string }[];
    projectId: string | null;
    environmentId: string | null;
    environments: { id: string; name: string }[];
    stageRows: StageRow[];
    canApplyRecommended: boolean;
    applyRecommendedApi: string;
    integrationsCount: number;
    llmReady: boolean;
    usesRoutes: boolean;
    defaults: { chat: string; embedding: string };
    embeddingLock: { dimensions: number; embeddedUnitCount: number; model?: string } | null;
    activePackEmbedding: { model: string; dimensions: number };
    upstreamValidationProviders: string[];
    apiBase: string;
  };

  export let data: { models: Models | null };

  $: returnContext = parseReturnTo($page.url.searchParams);
  $: builderReturnContext = returnContext;

  let selectedProjectId = data.models?.projectId ?? "";
  let selectedEnvironmentId = data.models?.environmentId ?? "";
  let saving = false;
  let creatingStage: string | null = null;
  let applyingRecommended = false;
  let resetUiState: "idle" | "confirming" | "success" = "idle";
  let msg: string | null = null;
  let error = false;

  let resetConfirmEl: HTMLDivElement | undefined;

  $: if (data.models && !selectedProjectId && data.models.projectId) {
    selectedProjectId = data.models.projectId;
  }
  $: if (data.models && !selectedEnvironmentId && data.models.environmentId) {
    selectedEnvironmentId = data.models.environmentId;
  }

  function withSideTaskReturn(href: string): string {
    if (returnContext) {
      return withReturnTo(href, returnContext);
    }
    return href;
  }

  function builderHref(visualHref: string): string {
    if (returnContext) {
      return withReturnTo(visualHref, returnContext);
    }
    return withReturnTo(visualHref, { kind: "ingest-routes" });
  }

  async function saveProjectBinding() {
    if (!data.models || !selectedProjectId) return;
    saving = true;
    msg = null;
    error = false;
    try {
      const res = await fetch(data.models.apiBase, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: selectedProjectId,
          ...(selectedEnvironmentId ? { environment_id: selectedEnvironmentId } : {}),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        error = true;
        msg = d.message ?? `Could not save (HTTP ${res.status}).`;
        return;
      }
      msg = "Project routing saved. Configure each stage route below.";
      window.location.reload();
    } catch {
      error = true;
      msg = "Network error while saving.";
    } finally {
      saving = false;
    }
  }

  async function createStageRoute(row: StageRow) {
    const projectId = selectedProjectId || data.models?.projectId;
    const environmentId = selectedEnvironmentId || data.models?.environmentId;
    if (!projectId || !environmentId) {
      error = true;
      msg = "Select a project and environment above before creating a route.";
      return;
    }
    creatingStage = row.key;
    msg = null;
    error = false;
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${projectId}/routes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environmentId,
          name: `Knowledge ${row.label}`,
          workload: "ingestion",
          stage: row.ingestionStage,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        error = true;
        msg =
          d.error === "ingestion_stage_route_already_exists"
            ? "A route already exists for this stage — refresh the page or open it in the route editor."
            : typeof d.error === "string"
              ? d.error
              : (d.message ?? `Could not create route (HTTP ${res.status}).`);
        return;
      }
      const routeId = d.data?.id as string | undefined;
      if (!routeId) {
        error = true;
        msg = "Route was created but the server response had no id — refresh and try Edit route.";
        return;
      }
      window.location.href = builderHref(
        `${DASHBOARD_BASE}/projects/${projectId}/routes/${routeId}?flow=visual`,
      );
    } catch {
      error = true;
      msg = "Network error while creating route.";
    } finally {
      creatingStage = null;
    }
  }

  function routeStatusLabel(row: StageRow): string {
    if (!row.route) return "Not configured";
    if (!row.route.isPublished) return "Draft — publish to use";
    if (!row.route.enabled) return "Disabled";
    if (row.route.status !== "active") return row.route.status;
    return "Ready";
  }

  function isRouteReady(row: StageRow): boolean {
    return routeStatusLabel(row) === "Ready";
  }

  function truncateRouteName(name: string, max = 30): string {
    return name.length > max ? `${name.slice(0, max)}…` : name;
  }

  function activeModelMatch(row: StageRow): ActiveModelMatch | null {
    if (!row.route || !isRouteReady(row)) return null;
    if (!row.activeModel) return "not_configured";
    return matchActiveToRecommended(row.activeModel, row.recommended ?? null);
  }

  function stageRowNotConfigured(row: StageRow): boolean {
    if (!row.route) return true;
    if (!isRouteReady(row)) return false;
    return activeModelMatch(row) === "not_configured";
  }

  function handleResetConfirmKeydown(event: KeyboardEvent) {
    if (resetUiState !== "confirming") return;
    if (event.key === "Escape") {
      event.preventDefault();
      cancelResetConfirm();
    } else if (event.key === "Enter" && !applyingRecommended) {
      event.preventDefault();
      void confirmApplyRecommended();
    }
  }

  async function startResetConfirm() {
    resetUiState = "confirming";
    msg = null;
    error = false;
    await tick();
    resetConfirmEl?.focus();
  }

  function cancelResetConfirm() {
    resetUiState = "idle";
  }

  async function confirmApplyRecommended() {
    if (!data.models?.canApplyRecommended) return;
    applyingRecommended = true;
    msg = null;
    error = false;
    try {
      const res = await fetch(data.models.applyRecommendedApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: selectedProjectId || data.models.projectId,
          environment_id: selectedEnvironmentId || data.models.environmentId,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        error = true;
        msg = d.message ?? `Could not apply recommended models (HTTP ${res.status}).`;
        resetUiState = "idle";
        return;
      }
      resetUiState = "success";
      window.setTimeout(async () => {
        resetUiState = "idle";
        await invalidateAll();
      }, 3000);
    } catch {
      error = true;
      msg = "Network error while applying recommended models.";
      resetUiState = "idle";
    } finally {
      applyingRecommended = false;
    }
  }
</script>

<svelte:head>
  <title>AI models & keys – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section aria-labelledby="models-heading">
  {#if builderReturnContext}
    <ConnectBuilderReturnBar context={builderReturnContext} />
  {/if}
  <h1 id="models-heading" class="h1">AI models &amp; keys</h1>
  <p class="lede">
    Knowledge ingestion uses <strong>Keys routes</strong> — the same visual route builder you use elsewhere.
    Each pipeline stage gets its own route with provider keys, fallback steps, and policies.
  </p>

  <div class="callout" role="note">
    <strong>First graph minimum:</strong> publish one chat ingestion route (extraction stage covers grouping, validation, and remediation too) and one embedding route.
    <a href="/keys/docs/guides/connect-first-graph-onboarding">First graph setup guide</a>
  </div>

  {#if !data.models}
    <p class="muted" role="status">Sign in to configure models.</p>
  {:else}
    <section class="card" aria-labelledby="keys-heading">
      <h2 id="keys-heading" class="h2">Provider keys</h2>
      <p class="card-desc">
        Connect AI providers under Connections. Routes reference these keys when resolving each ingestion stage.
      </p>
      <ul class="status-list">
        <li>
          <span class="badge {data.models.integrationsCount > 0 ? 'status-success' : 'status-muted'}">
            {data.models.integrationsCount} provider connection(s)
          </span>
        </li>
        <li>
          <span class="badge {data.models.llmReady ? 'status-success' : 'status-warning'}">
            {data.models.usesRoutes ? "Keys routes configured" : data.models.llmReady ? "Legacy hosted model" : "Not ready"}
          </span>
        </li>
      </ul>
      <div class="actions">
        <a class="btn btn-primary" href={withSideTaskReturn(DASHBOARD_BASE + "/integrations")}>
          Manage provider keys
        </a>
      </div>
    </section>

    <section class="card" aria-labelledby="project-heading">
      <h2 id="project-heading" class="h2">Project &amp; environment</h2>
      <p class="card-desc">
        Routes live under a Keys project. Pick which project and environment ingestion should resolve against.
      </p>
      {#if data.models.projects.length === 0}
        <p class="muted">Create a project under Keys first, then return here.</p>
        <a class="btn btn-primary" href={DASHBOARD_BASE + "/projects"}>Go to projects</a>
      {:else}
        <form class="form" on:submit|preventDefault={saveProjectBinding}>
          <label class="field">
            <span class="field-label">Project</span>
            <select class="input" bind:value={selectedProjectId} required>
              {#each data.models.projects as p}
                <option value={p.id}>{p.name}</option>
              {/each}
            </select>
          </label>
          <label class="field">
            <span class="field-label">Environment</span>
            <select class="input" bind:value={selectedEnvironmentId}>
              {#each data.models.environments as e}
                <option value={e.id}>{e.name}</option>
              {/each}
            </select>
          </label>
          <div class="actions">
            <button type="submit" class="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save project binding"}
            </button>
          </div>
        </form>
      {/if}
    </section>

    {#if data.models.projectId && data.models.environmentId}
      <section class="card" aria-labelledby="routes-heading">
        <div class="routes-head">
          <div>
            <h2 id="routes-heading" class="h2">Ingestion routes per stage</h2>
            <p class="card-desc">
              Each stage needs a Keys route with a provider and model. Use recommended production picks
              to configure all stages in one step — validation uses a different provider than extraction,
              relate, and grouping when you have a second provider key.
            </p>
          </div>
          {#if resetUiState === "confirming"}
            <div
              bind:this={resetConfirmEl}
              class="reset-confirm"
              role="alertdialog"
              aria-labelledby="reset-confirm-title"
              tabindex="-1"
              on:keydown={handleResetConfirmKeydown}
            >
              <p id="reset-confirm-title">
                This will update all stage routes to use recommended models. Any custom routes you have configured will
                be overwritten.
              </p>
              <div class="reset-confirm-actions">
                <button type="button" class="btn btn-ghost" disabled={applyingRecommended} on:click={cancelResetConfirm}>
                  Cancel
                </button>
                <button
                  type="button"
                  class="btn btn-primary"
                  disabled={applyingRecommended}
                  on:click={confirmApplyRecommended}
                >
                  {applyingRecommended ? "Applying…" : "Confirm — reset to recommended"}
                </button>
              </div>
            </div>
          {:else if resetUiState === "success"}
            <p class="reset-success" role="status">Recommended models applied ✓</p>
          {:else if data.models.canApplyRecommended}
            <button type="button" class="btn btn-primary" disabled={applyingRecommended} on:click={startResetConfirm}>
              Reset to recommended
            </button>
          {:else if data.models.integrationsCount === 0}
            <a class="btn btn-secondary" href={withSideTaskReturn(DASHBOARD_BASE + "/integrations")}>
              Add provider keys first
            </a>
          {/if}
        </div>
        {#if data.models.embeddingLock}
          <p class="hint" role="status">
            Graph embeddings are locked at <strong>{data.models.embeddingLock.dimensions} dimensions</strong>
            ({data.models.embeddingLock.embeddedUnitCount} unit(s)). Embedding model recommendations match this size.
          </p>
        {/if}
        {#if msg}
          <p class:err={error} class:notice={!error} role="status">{msg}</p>
        {/if}
        <ul class="stage-list">
          {#each data.models.stageRows as row}
            {@const match = activeModelMatch(row)}
            {@const showActiveLine = !row.route || isRouteReady(row)}
            <li
              class="stage-row"
              class:stage-row--not-configured={stageRowNotConfigured(row)}
            >
              <div class="stage-main">
                <span class="stage-label">{row.label}</span>
                <span class="stage-meta">{row.help}</span>

                {#if showActiveLine}
                  <div class="stage-active" role="status">
                    <span class="stage-active-label">Active:</span>
                    {#if !row.route}
                      <span class="stage-match stage-match--unassigned">Not configured</span>
                    {:else if row.activeModel}
                      <span class="stage-active-model">{row.activeModel.modelId}</span>
                      <span class="stage-active-sep" aria-hidden="true">·</span>
                      <span class="stage-active-provider">{row.activeModel.provider}</span>
                      <span class="stage-active-sep" aria-hidden="true">·</span>
                      <span
                        class="stage-active-route"
                        title={row.route.name.length > 30 ? row.route.name : undefined}
                      >
                        {truncateRouteName(row.route.name)}
                      </span>
                      {#if match === "recommended"}
                        <span class="stage-match stage-match--recommended">✓ Recommended</span>
                      {:else if match === "custom"}
                        <span class="stage-match stage-match--custom">Custom</span>
                      {/if}
                    {:else}
                      <span
                        class="stage-active-route"
                        title={row.route.name.length > 30 ? row.route.name : undefined}
                      >
                        {truncateRouteName(row.route.name)}
                      </span>
                      <span class="stage-match stage-match--unassigned">Not configured</span>
                    {/if}
                  </div>
                {/if}

                {#if row.recommended}
                  <details class="stage-rec-details" open={!row.route}>
                    <summary class="stage-rec-summary">View recommendation</summary>
                    <span class="stage-rec">
                      Recommended: <code>{row.recommended.modelId}</code>
                      <span class="muted">({row.recommended.provider})</span>
                      {#if row.key === "validation" && row.recommended.sameProviderFallback}
                        <span class="muted"> — add another provider key for cross-model validation</span>
                      {/if}
                    </span>
                    <span class="stage-rec-rationale muted">{row.recommended.rationale}</span>
                  </details>
                {/if}

                <div class="stage-footer">
                  <span class="badge {row.route?.isPublished && row.route?.enabled ? 'status-success' : 'status-muted'}">
                    {routeStatusLabel(row)}
                    {#if row.route}
                      — {row.route.name}
                    {/if}
                  </span>
                </div>
              </div>
              <div class="stage-actions">
                {#if row.visualHref}
                  <a class="btn btn-outline" href={builderHref(row.visualHref)}>Edit route</a>
                {:else}
                  <button
                    type="button"
                    class="btn btn-secondary"
                    disabled={creatingStage === row.key}
                    on:click={() => createStageRoute(row)}
                  >
                    {creatingStage === row.key ? "Creating…" : "Create route"}
                  </button>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
        {#if !data.models.usesRoutes}
          <p class="hint">
            Save a project binding above to persist routing. Until then, ingestion falls back to
            <code>{data.models.defaults.chat}</code> when <code>OPENAI_API_KEY</code> is set on the server.
          </p>
        {/if}
      </section>
    {/if}

    {#if msg && !(data.models.projectId && data.models.environmentId)}
      <p class:err={error} class:notice={!error} role="status">{msg}</p>
    {/if}
  {/if}
</section>

<style>
  .h1 {
    margin: 0 0 var(--space-1);
    font-size: var(--text-2xl);
    color: var(--rm-text);
  }
  .lede {
    margin: 0 0 var(--space-4);
    color: var(--rm-muted);
    max-width: 46rem;
  }
  .callout {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-3) var(--space-4);
    margin: 0 0 var(--space-4);
    background: color-mix(in oklab, var(--rm-sage) 8%, var(--rm-surface));
    color: var(--rm-muted);
    font-size: var(--text-sm);
    line-height: 1.5;
    max-width: 46rem;
  }
  .callout a {
    margin-left: var(--space-2);
  }
  .muted,
  .hint {
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .hint {
    margin: var(--space-3) 0 0;
  }
  .card {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    padding: var(--space-4);
    margin-bottom: var(--space-4);
  }
  .h2 {
    margin: 0 0 var(--space-2);
    font-size: var(--text-base);
    color: var(--rm-text);
  }
  .card-desc {
    margin: 0 0 var(--space-3);
    color: var(--rm-muted);
    font-size: var(--text-sm);
    line-height: 1.5;
  }
  .status-list {
    list-style: none;
    margin: 0 0 var(--space-3);
    padding: 0;
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .badge {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: 0 var(--space-2);
    font-size: var(--text-xs);
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    max-width: 42rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .field-label {
    font-size: var(--text-sm);
    color: var(--rm-text);
    font-weight: 500;
  }
  .stage-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .stage-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: flex-start;
    justify-content: space-between;
    border: var(--border);
    border-radius: 0;
    padding: var(--space-3);
    background: var(--color-surface);
  }
  .stage-row--not-configured {
    border: 2px dashed var(--color-ink);
  }
  .stage-main {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 12rem;
    flex: 1;
  }
  .stage-label {
    font-weight: 600;
    color: var(--rm-text);
  }
  .stage-meta {
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  .stage-active {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 var(--space-2);
  }
  .stage-active-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-faint);
  }
  .stage-active-model {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    color: var(--color-ink);
  }
  .stage-active-provider,
  .stage-active-route {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-faint);
  }
  .stage-active-sep {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-faint);
  }
  .stage-match {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    display: inline-block;
    margin-left: var(--space-1);
  }
  .stage-match--recommended {
    border: var(--border-thin);
    background: transparent;
    color: var(--color-ink-faint);
  }
  .stage-match--custom {
    border: var(--border);
    background: var(--color-yellow);
    color: var(--color-ink);
  }
  .stage-match--unassigned {
    border: 2px dashed var(--color-ink);
    color: var(--color-ink-faint);
    padding: 1px 6px;
  }
  .stage-rec-details {
    margin: 0;
  }
  .stage-rec-summary {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-faint);
    cursor: pointer;
    list-style: none;
  }
  .stage-rec-summary::-webkit-details-marker {
    display: none;
  }
  .stage-rec {
    display: block;
    font-size: var(--text-xs);
    color: var(--rm-text);
    margin-top: var(--space-1);
  }
  .stage-rec code {
    font-size: var(--text-xs);
  }
  .stage-rec-rationale {
    display: block;
    font-size: var(--text-xs);
    margin-top: 2px;
  }
  .stage-footer {
    margin-top: var(--space-1);
  }
  .routes-head {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: var(--space-3);
  }
  .routes-head .h2 {
    margin-bottom: var(--space-1);
  }
  .routes-head .card-desc {
    margin: 0;
    max-width: 36rem;
  }
  .reset-confirm {
    flex: 1;
    min-width: 16rem;
    max-width: 28rem;
    padding: var(--space-3);
    background: var(--color-surface);
    border: var(--border);
    border-left: 4px solid var(--color-yellow);
    box-shadow: var(--shadow-sm);
  }
  .reset-confirm p {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    color: var(--rm-text);
    line-height: 1.5;
  }
  .reset-confirm-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    justify-content: flex-end;
  }
  .reset-success {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink);
    padding: var(--space-2) var(--space-3);
    border: var(--border-thin);
    background: var(--color-surface);
  }
  .stage-actions {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }
  .actions {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .notice {
    border: 1px solid var(--rm-border);
    background: var(--rm-surface-raised);
    color: var(--rm-muted);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--rm-radius);
    margin: 0;
  }
  .err {
    color: var(--coral-alert);
  }
</style>
