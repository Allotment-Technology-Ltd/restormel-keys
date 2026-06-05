<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { get } from "svelte/store";
  import { page } from "$app/stores";
  import { goto, invalidateAll } from "$app/navigation";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import {
    activeProject,
    setActiveProject,
    syncActiveProjectFromSession,
    type ActiveProjectSelection,
  } from "$lib/stores/active-project";

  type RouteRecord = {
    id: string;
    environmentId: string;
    name: string;
    description: string | null;
    status: string;
    billingMode: string | null;
    routeMode: string | null;
    enabled?: boolean;
  };
  type EnvironmentRecord = { id: string; name: string; type: string };
  type PolicyRecord = { id: string; name: string; type: string };
  type PolicyBinding = { id: string; targetType: string; targetId: string };
  type ModelOption = {
    id: string;
    name: string;
    provider: string;
    contextWindow: number | null;
    speedBadge: string;
    availableProviderCount: number;
  };

  export let data: {
    projects: { id: string; name: string }[];
    routesByProject: Record<
      string,
      {
        environments: EnvironmentRecord[];
        routes: RouteRecord[];
        routeStepsByRoute: Record<
          string,
          {
            id: string;
            orderIndex: number;
            providerPreference: string | null;
            modelId: string | null;
          }[]
        >;
      }
    >;
    routeRequestCount24h: Record<string, number>;
    policies: PolicyRecord[];
    policyBindingsByPolicy: Record<string, PolicyBinding[]>;
    models: ModelOption[];
    error: string | null;
  };

  let selection: ActiveProjectSelection | null = null;
  let lazyRouteStepsByProject: Record<string, Record<string, { id: string; orderIndex: number; providerPreference: string | null; modelId: string | null }[]>> = {};
  let loadingStepProjects = new Set<string>();
  let deletingRouteId: string | null = null;
  let deleteRouteError = "";

  const unsubscribe = activeProject.subscribe((value) => {
    selection = value;
  });

  onMount(async () => {
    syncActiveProjectFromSession();
    ensureSelection();
    await tick();
    const params = $page.url.searchParams;
    if (params.get("newRoute") === "true") {
      const sel = get(activeProject);
      const pid =
        sel?.projectId && data.projects.some((p) => p.id === sel.projectId)
          ? sel.projectId
          : data.projects[0]?.id;
      if (pid) {
        await goto(`${DASHBOARD_BASE}/projects/${pid}/routes#create-heading`, { replaceState: true });
      }
    }
  });

  $: if (selectedProjectId) {
    void loadRouteStepsForProject(selectedProjectId);
  }

  onDestroy(() => {
    unsubscribe();
  });

  $: selectedProjectId =
    selection?.projectId && data.projects.some((project) => project.id === selection?.projectId)
      ? selection.projectId
      : data.projects[0]?.id ?? "";
  $: selectedProject = data.projects.find((project) => project.id === selectedProjectId) ?? null;
  $: selectedEnvironments = data.routesByProject[selectedProjectId]?.environments ?? [];
  $: selectedRoutes = data.routesByProject[selectedProjectId]?.routes ?? [];
  $: selectedRouteStepsByRoute =
    lazyRouteStepsByProject[selectedProjectId] ??
    data.routesByProject[selectedProjectId]?.routeStepsByRoute ??
    {};
  $: duplicateRouteNames = new Set(
    Object.entries(
      selectedRoutes.reduce((acc, route) => {
        acc[route.name] = (acc[route.name] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    )
      .filter(([, count]) => count > 1)
      .map(([name]) => name)
  );
  function ensureSelection() {
    if (!data.projects.length) return;
    const currentProjectId = selection?.projectId;
    const currentEnvironmentId = selection?.environmentId;
    const projectId = data.projects.some((project) => project.id === currentProjectId)
      ? currentProjectId!
      : data.projects[0].id;
    const environments = data.routesByProject[projectId]?.environments ?? [];
    const environmentId = environments.some((env) => env.id === currentEnvironmentId)
      ? currentEnvironmentId!
      : environments[0]?.id ?? "";
    if (!selection || selection.projectId !== projectId || selection.environmentId !== environmentId) {
      setActiveProject({ projectId, environmentId });
    }
  }

  function modeLabel(mode: string | null): string {
    return mode === "fallback_chain" ? "With fallback" : "1 provider";
  }

  function billingLabel(mode: string | null): string {
    if (mode === "metered") return "Metered";
    if (mode === "pass_through") return "Direct pass-through";
    return "—";
  }

  function envForRoute(route: RouteRecord): EnvironmentRecord | null {
    return selectedEnvironments.find((env) => env.id === route.environmentId) ?? null;
  }

  function routeSummary(route: RouteRecord): string {
    const steps = [...(selectedRouteStepsByRoute[route.id] ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);
    if (steps.length === 0) return "No providers configured yet - edit to add steps";
    const first = steps[0];
    const firstText = `${first.providerPreference ?? "provider"} ${first.modelId ?? "model"}`;
    if (steps.length === 1) return `Uses ${firstText}`;
    const second = steps[1];
    const secondText = `${second.providerPreference ?? "provider"} ${second.modelId ?? "model"}`;
    return `Uses ${firstText}, falls back to ${secondText}`;
  }

  async function loadRouteStepsForProject(projectId: string): Promise<void> {
    if (!projectId) return;
    if (lazyRouteStepsByProject[projectId]) return;
    if (loadingStepProjects.has(projectId)) return;
    const routes = data.routesByProject[projectId]?.routes ?? [];
    if (routes.length === 0) {
      lazyRouteStepsByProject = { ...lazyRouteStepsByProject, [projectId]: {} };
      return;
    }
    loadingStepProjects = new Set([...loadingStepProjects, projectId]);
    try {
      const res = await fetch(`/keys/dashboard/api/projects/${projectId}/route-steps`);
      const body = await res.json().catch(() => ({}));
      const stepMap = res.ok && body?.data && typeof body.data === "object" ? body.data : {};
      lazyRouteStepsByProject = {
        ...lazyRouteStepsByProject,
        [projectId]: stepMap,
      };
    } catch {
      // Keep summaries in fallback mode if steps fail to load.
      lazyRouteStepsByProject = { ...lazyRouteStepsByProject, [projectId]: {} };
    } finally {
      const next = new Set(loadingStepProjects);
      next.delete(projectId);
      loadingStepProjects = next;
    }
  }

  async function deleteRouteRecord(route: RouteRecord) {
    if (!selectedProjectId) return;
    deleteRouteError = "";
    if (
      !confirm(
        `Delete rule "${route.name}"? Traffic that matched this rule will no longer resolve until you add another rule. This cannot be undone.`
      )
    ) {
      return;
    }
    deletingRouteId = route.id;
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${selectedProjectId}/routes/${route.id}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        const nextLazy = { ...lazyRouteStepsByProject };
        delete nextLazy[selectedProjectId];
        lazyRouteStepsByProject = nextLazy;
        await invalidateAll();
      } else {
        deleteRouteError =
          (body as { error?: string }).error ?? `Delete failed (${res.status})`;
      }
    } catch (e) {
      deleteRouteError = e instanceof Error ? e.message : "Delete failed";
    } finally {
      deletingRouteId = null;
    }
  }
</script>

<h1 class="page-title">Routes</h1>
<p class="page-desc">Manage routes for the active project context.</p>

{#if data.error}
  <p class="error-msg" role="alert">{data.error}</p>
{:else if data.projects.length === 0}
  <EmptyState title="No projects yet" description="Create a project before defining routes.">
    <a href="/keys/dashboard/projects" class="btn btn-primary">Go to projects</a>
  </EmptyState>
{:else}
  <section class="routes-head">
    <div>
      <h2>{selectedProject?.name ?? "Project"}</h2>
      <p>{selectedRoutes.length} routes</p>
      <nav class="routes-toolbar" aria-label="Route list actions">
        <a class="routes-toolbar-link" href={`${DASHBOARD_BASE}/projects/${selectedProjectId}/routes`}>
          Project routes
        </a>
      </nav>
    </div>
    <div class="new-route-actions">
      <a
        class="btn btn-primary"
        href={`${DASHBOARD_BASE}/projects/${selectedProjectId}/routes#create-heading`}
      >
        New route
      </a>
    </div>
  </section>

  {#if deleteRouteError}
    <p class="error-msg" role="alert">{deleteRouteError}</p>
  {/if}
  {#if selectedRoutes.length === 0}
    <p class="muted">No routes for this project yet.</p>
  {:else}
    <ul class="route-cards">
      {#each selectedRoutes as route}
        <li class="route-card">
          <a
            class="route-card-main"
            href={`${DASHBOARD_BASE}/projects/${selectedProjectId}/routes/${route.id}?flow=visual`}
          >
            <h3>
              {route.name}
              {#if duplicateRouteNames.has(route.name)}
                <span class="dup-warning" title="This name is shared by multiple routes — consider renaming for clarity.">⚠</span>
              {/if}
            </h3>
            <p class="route-summary">{routeSummary(route)}</p>
            <div class="badge-row">
              <span class={`badge env-${envForRoute(route)?.type ?? "unknown"}`}>
                {envForRoute(route)?.type ?? "env"}
              </span>
              <span class="badge">{modeLabel(route.routeMode)}</span>
              <span class="badge">{billingLabel(route.billingMode)}</span>
              {#if route.status === "active"}
                <span class="badge badge-active">● Active</span>
              {:else if route.status === "paused"}
                <span class="badge status-warning">Paused</span>
              {:else if route.status === "inactive" || route.status === "draft"}
                <span class="badge status-muted">{route.status}</span>
              {:else}
                <span class="badge status-muted">{route.status}</span>
              {/if}
              <span class="badge">{(data.routeRequestCount24h[route.id] ?? 0).toLocaleString()} req/24h</span>
            </div>
          </a>
          <div class="route-card-actions">
            <button
              type="button"
              class="btn-delete-rule"
              disabled={deletingRouteId === route.id}
              aria-label="Delete rule {route.name}"
              on:click|stopPropagation={() => deleteRouteRecord(route)}
            >
              {deletingRouteId === route.id ? "Deleting…" : "Delete"}
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<style>
  .page-title {
    margin: 0 0 var(--space-2);
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    color: var(--rm-text);
  }
  .page-desc,
  .muted {
    margin: 0 0 var(--space-4);
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .routes-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  .new-route-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .new-route-actions .btn {
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
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
  .routes-head h2 {
    margin: 0;
    font-size: var(--text-lg);
    color: var(--rm-text);
  }
  .routes-head p {
    margin: var(--space-1) 0 0;
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .routes-toolbar {
    margin-top: var(--space-2);
  }
  .routes-toolbar-link {
    font-size: var(--text-sm);
    color: var(--rm-sage);
  }
  .route-cards {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }
  .route-card {
    display: flex;
    align-items: stretch;
    gap: 0;
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
  }
  .route-card-main {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    text-decoration: none;
  }
  .route-card-actions {
    display: flex;
    align-items: flex-start;
    padding: var(--space-3) var(--space-3) var(--space-3) 0;
  }
  .btn-delete-rule {
    font-size: var(--text-xs);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--rm-radius);
    border: 1px solid var(--rm-border);
    background: var(--rm-surface);
    color: var(--coral-alert);
    cursor: pointer;
  }
  .btn-delete-rule:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .btn-delete-rule:hover:not(:disabled) {
    border-color: color-mix(in oklab, var(--coral-alert) 40%, var(--rm-border));
  }
  .route-card-main h3 {
    margin: 0;
    color: var(--rm-text);
    font-size: var(--text-base);
  }
  .route-summary {
    margin: 0;
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .badge-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }
  .badge {
    font-size: var(--text-xs);
    color: var(--rm-muted);
    border: 1px solid var(--rm-border);
    border-radius: 999px;
    padding: 0.1rem 0.45rem;
    background: var(--rm-surface);
  }
  .badge-active {
    color: var(--signal-teal);
    border-color: color-mix(in oklab, var(--signal-teal) 55%, var(--rm-border));
  }
  .env-dev {
    border-color: color-mix(in oklab, #5ea8ff 45%, var(--rm-border));
    opacity: 0.8;
  }
  .env-prod {
    border-color: color-mix(in oklab, #44a676 45%, var(--rm-border));
    opacity: 0.8;
  }
  .dup-warning {
    margin-left: var(--space-1);
    color: var(--amber-insight);
    font-size: var(--text-xs);
  }
  .btn {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    background: var(--rm-bg);
    text-decoration: none;
    cursor: pointer;
  }
  .error-msg {
    color: var(--coral-alert);
    font-size: var(--text-sm);
  }
</style>
