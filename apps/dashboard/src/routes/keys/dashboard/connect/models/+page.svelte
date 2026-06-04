<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { page } from "$app/stores";
  import { parseWizardStepParam, withWizardReturn } from "$lib/connect/pipeline-config";

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
  };

  type Models = {
    routing: { project_id?: string; environment_id?: string } | null;
    projects: { id: string; name: string }[];
    projectId: string | null;
    environmentId: string | null;
    environments: { id: string; name: string }[];
    stageRows: StageRow[];
    integrationsCount: number;
    llmReady: boolean;
    usesRoutes: boolean;
    defaults: { chat: string; embedding: string };
    apiBase: string;
  };

  export let data: { models: Models | null };

  $: wizardStep = parseWizardStepParam($page.url.searchParams.get("wizard_step"));

  let selectedProjectId = data.models?.projectId ?? "";
  let selectedEnvironmentId = data.models?.environmentId ?? "";
  let saving = false;
  let creatingStage: string | null = null;
  let msg: string | null = null;
  let error = false;

  $: if (data.models && !selectedProjectId && data.models.projectId) {
    selectedProjectId = data.models.projectId;
  }
  $: if (data.models && !selectedEnvironmentId && data.models.environmentId) {
    selectedEnvironmentId = data.models.environmentId;
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
            ? "A route already exists for this stage — refresh the page or open it in the visual builder."
            : typeof d.error === "string"
              ? d.error
              : (d.message ?? `Could not create route (HTTP ${res.status}).`);
        return;
      }
      const routeId = d.data?.id as string | undefined;
      if (!routeId) {
        error = true;
        msg = "Route was created but the server response had no id — refresh and try Open visual builder.";
        return;
      }
      window.location.href = withWizardReturn(
        `${DASHBOARD_BASE}/projects/${projectId}/routes/${routeId}?flow=visual`,
        wizardStep,
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
</script>

<svelte:head>
  <title>AI models & keys – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section aria-labelledby="models-heading">
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
        <a class="btn btn-primary" href={withWizardReturn(DASHBOARD_BASE + "/integrations", wizardStep)}>
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
        <h2 id="routes-heading" class="h2">Ingestion routes per stage</h2>
        <p class="card-desc">
          Open the visual route builder to add steps, fallback chains, and policies. Resolve discovers routes by
          <code>workload=ingestion</code> and stage (e.g. <code>ingestion_extraction</code>).
        </p>
        {#if msg}
          <p class:err={error} class:notice={!error} role="status">{msg}</p>
        {/if}
        <ul class="stage-list">
          {#each data.models.stageRows as row}
            <li class="stage-row">
              <div class="stage-main">
                <span class="stage-label">{row.label}</span>
                <span class="stage-meta">{row.help}</span>
                <span class="badge {row.route?.isPublished && row.route?.enabled ? 'status-success' : 'status-muted'}">
                  {routeStatusLabel(row)}
                  {#if row.route}
                    — {row.route.name}
                  {/if}
                </span>
              </div>
              <div class="stage-actions">
                {#if row.visualHref}
                  <a class="btn btn-primary" href={withWizardReturn(row.visualHref, wizardStep)}>Open visual builder</a>
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
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-3);
    background: var(--rm-surface-raised);
  }
  .stage-main {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
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
