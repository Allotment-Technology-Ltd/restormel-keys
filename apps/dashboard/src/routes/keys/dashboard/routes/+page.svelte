<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { page } from "$app/stores";
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
      }
    >;
    routeRequestCount24h: Record<string, number>;
    policies: PolicyRecord[];
    policyBindingsByPolicy: Record<string, PolicyBinding[]>;
    models: ModelOption[];
    error: string | null;
  };

  let selection: ActiveProjectSelection | null = null;
  let showWizard = false;
  let wizardStep = 1;
  let creating = false;
  let createError = "";
  let createSuccess:
    | { routeId: string; routeName: string; projectId: string; environmentId: string; snippet: string }
    | null = null;

  let routeName = "";
  let routeEnvironmentId = "";
  let routeDescription = "";
  let billingMode = "pass_through";
  let routeMode = "single";
  let primaryModelId = "";
  let fallbackModelIds = ["", "", ""];
  let selectedPolicyIds: string[] = [];
  let modelSearch = "";

  const unsubscribe = activeProject.subscribe((value) => {
    selection = value;
  });

  onMount(() => {
    syncActiveProjectFromSession();
    ensureSelection();

    const params = $page.url.searchParams;
    if (params.get("newRoute") === "true") {
      openWizard();
      const modelId = params.get("model");
      if (modelId) primaryModelId = modelId;
      const envParam = params.get("env");
      if (envParam) {
        const matchById = selectedEnvironments.find((env) => env.id === envParam);
        const matchByType = selectedEnvironments.find((env) => env.type === envParam);
        routeEnvironmentId = matchById?.id ?? matchByType?.id ?? routeEnvironmentId;
      }
    }
  });

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
  $: if (!routeEnvironmentId && selectedEnvironments[0]) routeEnvironmentId = selectedEnvironments[0].id;
  $: filteredModels = data.models.filter((model) =>
    modelSearch.trim()
      ? `${model.name} ${model.provider}`.toLowerCase().includes(modelSearch.trim().toLowerCase())
      : true
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

  function openWizard() {
    wizardStep = 1;
    showWizard = true;
    createError = "";
    createSuccess = null;
    routeName = "";
    routeDescription = "";
    billingMode = "pass_through";
    routeMode = "single";
    routeEnvironmentId = selection?.environmentId ?? selectedEnvironments[0]?.id ?? "";
    primaryModelId = primaryModelId || data.models[0]?.id || "";
    fallbackModelIds = ["", "", ""];
    selectedPolicyIds = [];
  }

  function closeWizard() {
    showWizard = false;
  }

  function nextStep() {
    if (wizardStep === 1) {
      if (!routeName.trim() || !routeEnvironmentId) {
        createError = "Route name and environment are required.";
        return;
      }
      createError = "";
      wizardStep = 2;
      return;
    }
    if (wizardStep === 2) {
      if (!primaryModelId) {
        createError = "Select a primary model.";
        return;
      }
      createError = "";
      wizardStep = 3;
    }
  }

  function prevStep() {
    if (wizardStep > 1) wizardStep -= 1;
  }

  function inheritedPolicy(policyId: string): boolean {
    const bindings = data.policyBindingsByPolicy[policyId] ?? [];
    return bindings.some(
      (binding) =>
        binding.targetType === "workspace" ||
        (binding.targetType === "project" && binding.targetId === selectedProjectId)
    );
  }

  function togglePolicy(policyId: string) {
    if (inheritedPolicy(policyId)) return;
    if (selectedPolicyIds.includes(policyId)) {
      selectedPolicyIds = selectedPolicyIds.filter((id) => id !== policyId);
      return;
    }
    selectedPolicyIds = [...selectedPolicyIds, policyId];
  }

  function resolvePreview() {
    const fallback = routeMode === "fallback_chain" ? fallbackModelIds.filter(Boolean) : [];
    return JSON.stringify(
      {
        model: primaryModelId || "model-id",
        provider: data.models.find((model) => model.id === primaryModelId)?.provider ?? "provider",
        fallbackChain: fallback,
      },
      null,
      2
    );
  }

  function modeLabel(mode: string | null): string {
    return mode === "fallback_chain" ? "Fallback chain" : "Single";
  }

  function billingLabel(mode: string | null): string {
    if (mode === "metered") return "Metered";
    if (mode === "pass_through") return "Pass-through";
    return "—";
  }

  function envForRoute(route: RouteRecord): EnvironmentRecord | null {
    return selectedEnvironments.find((env) => env.id === route.environmentId) ?? null;
  }

  async function submitWizard() {
    if (!selectedProjectId) return;
    creating = true;
    createError = "";
    try {
      const createRes = await fetch(`/keys/dashboard/api/projects/${selectedProjectId}/routes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environmentId: routeEnvironmentId,
          name: routeName.trim(),
          description: routeDescription.trim() || undefined,
          defaultModelId: primaryModelId,
          billingMode,
          routeMode: routeMode === "fallback_chain" ? "fallback_chain" : "single",
        }),
      });
      const createBody = await createRes.json().catch(() => ({}));
      if (!createRes.ok || !createBody.data?.id) {
        createError = createBody.error ?? `Route create failed (${createRes.status})`;
        return;
      }

      const routeId = createBody.data.id as string;
      const chain = [primaryModelId, ...fallbackModelIds.filter(Boolean)];
      if (routeMode === "fallback_chain" || chain.length > 1) {
        for (let i = 0; i < chain.length; i += 1) {
          const modelId = chain[i];
          const stepRes = await fetch(
            `/keys/dashboard/api/projects/${selectedProjectId}/routes/${routeId}/steps`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderIndex: i,
                modelId,
                fallbackOn: "error",
                enabled: true,
              }),
            }
          );
          if (!stepRes.ok) {
            const stepBody = await stepRes.json().catch(() => ({}));
            createError = stepBody.error ?? "Route created, but fallback chain setup failed.";
            return;
          }
        }
      }

      for (const policyId of selectedPolicyIds) {
        const res = await fetch(`/keys/dashboard/api/policies/${policyId}/bindings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetType: "route", targetId: routeId }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          createError = body.error ?? "Route created, but policy binding failed.";
          return;
        }
      }

      const snippet = `createResolveMiddleware({\n  projectId: "${selectedProjectId}",\n  routeId: "${routeId}"\n});`;
      createSuccess = {
        routeId,
        routeName: routeName.trim(),
        projectId: selectedProjectId,
        environmentId: routeEnvironmentId,
        snippet,
      };
      wizardStep = 4;
    } catch (error) {
      createError = error instanceof Error ? error.message : "Route create failed";
    } finally {
      creating = false;
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore clipboard failures
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
    </div>
    <button type="button" class="btn btn-primary" on:click={openWizard}>New route</button>
  </section>

  {#if selectedRoutes.length === 0}
    <p class="muted">No routes for this project yet.</p>
  {:else}
    <ul class="route-cards">
      {#each selectedRoutes as route}
        <li class="route-card">
          <a href={`/keys/dashboard/projects/${selectedProjectId}/routes/${route.id}`}>
            <h3>{route.name}</h3>
            <div class="badge-row">
              <span class={`badge env-${envForRoute(route)?.type ?? "unknown"}`}>
                {envForRoute(route)?.type ?? "env"}
              </span>
              <span class="badge">{modeLabel(route.routeMode)}</span>
              <span class="badge">{billingLabel(route.billingMode)}</span>
              <span class="badge">{route.status}</span>
              <span class="badge">{(data.routeRequestCount24h[route.id] ?? 0).toLocaleString()} req/24h</span>
            </div>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
{/if}

{#if showWizard}
  <div class="overlay" role="presentation" on:click={(e) => e.target === e.currentTarget && closeWizard()}>
    <div class="wizard" role="dialog" aria-modal="true" aria-labelledby="new-route-title">
      <button class="close" type="button" on:click={closeWizard} aria-label="Close">×</button>

      {#if wizardStep < 4}
        <h2 id="new-route-title">New route</h2>
        <p class="step-label">Step {wizardStep} of 3</p>
      {/if}

      {#if createError}
        <p class="error-msg" role="alert">{createError}</p>
      {/if}

      {#if wizardStep === 1}
        <h3>Name &amp; environment</h3>
        <label>
          Route name
          <input type="text" bind:value={routeName} placeholder="e.g. chat-default" />
        </label>
        <label>
          Environment
          <select bind:value={routeEnvironmentId}>
            {#each selectedEnvironments as env}
              <option value={env.id}>{env.name} ({env.type})</option>
            {/each}
          </select>
        </label>
        <label>
          Description (optional)
          <textarea bind:value={routeDescription} rows="2"></textarea>
        </label>
        <label>
          Billing mode
          <select bind:value={billingMode}>
            <option value="pass_through">Pass-through</option>
            <option value="metered">Metered</option>
          </select>
        </label>
        <fieldset>
          <legend>Route mode</legend>
          <label><input type="radio" bind:group={routeMode} value="single" /> Single model</label>
          <label><input type="radio" bind:group={routeMode} value="fallback_chain" /> Fallback chain</label>
        </fieldset>
      {:else if wizardStep === 2}
        <h3>Model &amp; fallback</h3>
        <label>
          Search models
          <input type="text" bind:value={modelSearch} placeholder="Filter model catalog" />
        </label>
        <label>
          Primary model
          <select bind:value={primaryModelId}>
            <option value="">Select model</option>
            {#each filteredModels as model}
              <option value={model.id}>
                {model.name} · {model.provider} · {model.speedBadge} · {model.contextWindow ?? "—"} ctx
              </option>
            {/each}
          </select>
        </label>
        {#if routeMode === "fallback_chain"}
          {#each [0, 1, 2] as idx}
            <label>
              Fallback {idx + 1}
              <select bind:value={fallbackModelIds[idx]}>
                <option value="">None</option>
                {#each filteredModels as model}
                  <option value={model.id}>
                    {model.name} · {model.provider} · {model.speedBadge} · {model.contextWindow ?? "—"} ctx
                  </option>
                {/each}
              </select>
            </label>
          {/each}
        {/if}
        <div class="preview">
          <p>Resolve preview</p>
          <pre>{resolvePreview()}</pre>
        </div>
      {:else if wizardStep === 3}
        <h3>Policy bindings</h3>
        <p class="muted">Inherited workspace/project policies are already active.</p>
        <ul class="policy-list">
          {#each data.policies as policy}
            <li>
              <label class:inherited={inheritedPolicy(policy.id)}>
                <input
                  type="checkbox"
                  disabled={inheritedPolicy(policy.id)}
                  checked={inheritedPolicy(policy.id) || selectedPolicyIds.includes(policy.id)}
                  on:change={() => togglePolicy(policy.id)}
                />
                <span>{policy.name}</span>
                <span class="policy-type">{policy.type}</span>
                {#if inheritedPolicy(policy.id)}
                  <span class="policy-inherited">Inherited — active</span>
                {/if}
              </label>
            </li>
          {/each}
        </ul>
        <a href="/keys/dashboard/policies" target="_blank" rel="noopener noreferrer">Create new policy →</a>
      {:else if wizardStep === 4 && createSuccess}
        <h3>Route created</h3>
        <p class="muted">Route <strong>{createSuccess.routeName}</strong> is ready.</p>
        <pre>{createSuccess.snippet}</pre>
        <div class="success-actions">
          <button type="button" class="btn" on:click={() => copyText(createSuccess!.snippet)}>Copy snippet</button>
          <a
            href={`/keys/dashboard/logs?projectId=${encodeURIComponent(createSuccess.projectId)}&routeId=${encodeURIComponent(createSuccess.routeId)}`}
            class="btn"
            >View in logs →</a
          >
          <button type="button" class="btn btn-primary" on:click={closeWizard}>Close</button>
        </div>
      {/if}

      {#if wizardStep < 4}
        <footer class="wizard-actions">
          <button type="button" class="btn" on:click={prevStep} disabled={wizardStep === 1}>Back</button>
          {#if wizardStep < 3}
            <button type="button" class="btn btn-primary" on:click={nextStep}>Next</button>
          {:else}
            <button type="button" class="btn btn-primary" disabled={creating} on:click={submitWizard}>
              {creating ? "Creating…" : "Create route"}
            </button>
          {/if}
        </footer>
      {/if}
    </div>
  </div>
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
    align-items: end;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
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
  .route-cards {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }
  .route-card {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
  }
  .route-card a {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    text-decoration: none;
  }
  .route-card h3 {
    margin: 0;
    color: var(--rm-text);
    font-size: var(--text-base);
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
  .env-dev {
    border-color: color-mix(in oklab, #5ea8ff 45%, var(--rm-border));
  }
  .env-prod {
    border-color: color-mix(in oklab, #44a676 45%, var(--rm-border));
  }
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: var(--z-modal);
    display: grid;
    place-items: center;
    padding: var(--space-4);
  }
  .wizard {
    width: min(42rem, 100%);
    max-height: calc(100vh - 2rem);
    overflow: auto;
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-4);
    position: relative;
    display: grid;
    gap: var(--space-3);
  }
  .close {
    position: absolute;
    top: var(--space-3);
    right: var(--space-3);
    border: 0;
    background: transparent;
    color: var(--rm-muted);
    cursor: pointer;
    font-size: 1.25rem;
  }
  .step-label {
    margin: -0.5rem 0 0;
    color: var(--rm-dim);
    font-size: var(--text-xs);
  }
  h3 {
    margin: 0;
    font-size: var(--text-base);
    color: var(--rm-text);
  }
  label,
  fieldset {
    display: grid;
    gap: var(--space-1);
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  input,
  select,
  textarea {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-bg);
    color: var(--rm-text);
    padding: var(--space-2);
    font-size: var(--text-sm);
  }
  fieldset {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-2) var(--space-3);
  }
  fieldset label {
    grid-template-columns: auto 1fr;
    align-items: center;
  }
  .preview {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
    padding: var(--space-3);
  }
  .preview p {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  pre {
    margin: 0;
    white-space: pre-wrap;
    font-size: var(--text-xs);
    color: var(--rm-text);
  }
  .policy-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }
  .policy-list label {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-2);
  }
  .policy-type {
    margin-left: auto;
    font-size: var(--text-xs);
    color: var(--rm-dim);
  }
  .policy-inherited {
    font-size: var(--text-xs);
    color: var(--rm-dim);
  }
  .inherited {
    opacity: 0.65;
  }
  .wizard-actions,
  .success-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
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
  .btn-primary {
    background: var(--rm-sage);
    border-color: var(--rm-sage);
    color: var(--rm-bg);
  }
  .error-msg {
    color: var(--coral-alert);
    font-size: var(--text-sm);
  }
</style>
