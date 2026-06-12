<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { goto, invalidateAll } from "$app/navigation";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import RouteCoverageIndicator from "$lib/components/dashboard/RouteCoverageIndicator.svelte";

  export let data: {
    project: { id: string; name: string } | null;
    environments: { id: string; name: string; type: string }[];
    routes: {
      id: string;
      environmentId: string;
      name: string;
      description: string | null;
      status: string;
      billingMode: string | null;
      routeMode: string | null;
    }[];
    error: string | null;
  };

  let creating = false;
  let createError = "";
  let createEnvId = data.environments[0]?.id ?? "";
  let createName = "";
  let createDescription = "";
  let createBillingMode = "";
  let createRouteMode = "";

  $: createEnvId = data.environments.length && !createEnvId ? data.environments[0].id : createEnvId;

  function envName(envId: string): string {
    return data.environments.find((e) => e.id === envId)?.name ?? envId;
  }

  async function createRoute() {
    if (!data.project || !createEnvId || !createName.trim()) {
      createError = "Environment and name are required.";
      return;
    }
    creating = true;
    createError = "";
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${data.project.id}/routes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environmentId: createEnvId,
          name: createName.trim(),
          description: createDescription.trim() || undefined,
          billingMode: createBillingMode.trim() || null,
          routeMode: createRouteMode.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.data?.id) {
        await invalidateAll();
        await goto(`${DASHBOARD_BASE}/projects/${data.project.id}/routes/${body.data.id as string}?flow=visual`);
      } else {
        createError = (body as { error?: string }).error ?? `Request failed (${res.status})`;
      }
    } catch (e) {
      createError = e instanceof Error ? e.message : "Request failed";
    } finally {
      creating = false;
    }
  }
</script>

{#if data.error || !data.project}
  <p class="error-msg" role="alert">{data.error ?? "Project not found."}</p>
  <p><a href={DASHBOARD_BASE + "/routes"} class="back-link">← Back to Routes</a></p>
{:else}
  <p><a href={DASHBOARD_BASE + "/routes"} class="back-link">← Back to Routes</a></p>
  <h1 class="page-title">Routes · {data.project.name}</h1>
  <p class="page-desc">
    Routes define how requests are handled in this project: primary model, fallback behaviour, and billing. Each route belongs to one environment.
  </p>

  <section class="section" aria-labelledby="create-heading">
    <h2 id="create-heading" class="section-title">Create route</h2>
    <p class="section-desc">Add a route for an environment. You can set billing mode and route mode after creation.</p>
    {#if createError}
      <p class="error-msg" role="alert">{createError}</p>
    {/if}
    {#if data.environments.length === 0}
      <p class="muted">No environments in this project. Add an environment first (project settings or API).</p>
    {:else}
      <form class="create-form" onsubmit={(e) => { e.preventDefault(); createRoute(); }}>
        <div class="form-row">
          <label for="env">Environment</label>
          <select id="env" bind:value={createEnvId} class="input">
            {#each data.environments as env}
              <option value={env.id}>{env.name} ({env.type})</option>
            {/each}
          </select>
        </div>
        <div class="form-row">
          <label for="name">Name</label>
          <input id="name" type="text" bind:value={createName} class="input" placeholder="e.g. Chat API" required />
        </div>
        <div class="form-row">
          <label for="desc">Description (optional)</label>
          <input id="desc" type="text" bind:value={createDescription} class="input" placeholder="Plain English description" />
        </div>
        <div class="form-row">
          <label for="billing">Billing mode (optional)</label>
          <select id="billing" bind:value={createBillingMode} class="input">
            <option value="">—</option>
            <option value="pass_through">Pass through</option>
            <option value="metered">Metered</option>
          </select>
        </div>
        <div class="form-row">
          <label for="routeMode">Route mode (optional)</label>
          <select id="routeMode" bind:value={createRouteMode} class="input">
            <option value="">—</option>
            <option value="single">Single</option>
            <option value="fallback_chain">Fallback chain</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary" disabled={creating}>
          {creating ? "Creating…" : "Create route"}
        </button>
      </form>
    {/if}
  </section>

  <section class="section" aria-labelledby="list-heading">
    <h2 id="list-heading" class="section-title">Routes ({data.routes.length})</h2>
    <RouteCoverageIndicator
      coverageUrl={`${DASHBOARD_BASE}/api/projects/${data.project.id}/route-coverage`}
      routesHref="#list-heading"
      environmentName={envName}
    />
    {#if data.routes.length === 0}
      <EmptyState
        title="No routes yet"
        description="Create a route above. Fallback and steps can be configured on the route detail page."
      >
        <a href="#create-heading" class="btn btn-primary">Create route</a>
      </EmptyState>
    {:else}
      <ul class="route-list">
        {#each data.routes as r}
          <li class="route-row">
            <a
              href={DASHBOARD_BASE + "/projects/" + data.project.id + "/routes/" + r.id + "?flow=visual"}
              class="route-link"
            >
              <span class="route-name">{r.name}</span>
              <span class="route-meta">{envName(r.environmentId)} · {r.status}{#if r.billingMode} · {r.billingMode}{/if}</span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}

<style>
  .back-link {
    font-size: var(--text-sm);
    color: var(--rm-sage);
    margin-bottom: var(--space-4);
    display: inline-block;
  }
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
  .section-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-3);
  }
  .create-form {
    max-width: 28rem;
  }
  .form-row {
    margin-bottom: var(--space-3);
  }
  .form-row label {
    display: block;
    font-size: var(--text-sm);
    font-weight: 500;
    margin-bottom: var(--space-1);
  }
  .input {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--rm-radius);
    border: var(--border-thin);
    font-size: var(--text-sm);
    background: var(--rm-bg);
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
  .route-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .route-row {
    border-bottom: var(--border-thin);
  }
  .route-link {
    display: block;
    padding: var(--space-3) 0;
    text-decoration: none;
    color: inherit;
  }
  .route-link:hover {
    background: var(--rm-surface-raised);
  }
  .route-name {
    font-weight: 600;
    font-size: var(--text-sm);
    color: var(--rm-text);
    display: block;
  }
  .route-meta {
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  .error-msg, .muted {
    font-size: var(--text-sm);
  }
  .error-msg {
    color: var(--coral-alert);
  }
  .muted {
    color: var(--rm-dim);
  }
</style>
