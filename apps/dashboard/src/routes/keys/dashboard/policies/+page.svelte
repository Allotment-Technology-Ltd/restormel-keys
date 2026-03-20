<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { invalidateAll } from "$app/navigation";
  import EmptyState from "$lib/components/EmptyState.svelte";

  export let data: {
    policies: {
      id: string;
      name: string;
      type: string;
      status: string;
      ruleDefinition: Record<string, unknown> | null;
    }[];
    bindingsByPolicy: Record<
      string,
      { id: string; policyId: string; targetType: string; targetId: string }[]
    >;
    workspaceId: string | null;
    targets: {
      projects: { id: string; name: string }[];
      environments: {
        id: string;
        name: string;
        type: string;
        projectId: string;
        projectName: string;
      }[];
      routes: {
        id: string;
        name: string;
        projectId: string;
        projectName: string;
        environmentId: string;
      }[];
    };
    error: string | null;
  };

  const POLICY_TYPES = [
    "model_allowlist",
    "model_denylist",
    "provider_allowlist",
    "provider_denylist",
    "deprecated_model_block",
    "budget_cap",
    "token_cap",
  ];
  const POLICY_TYPE_HELP: Record<string, string> = {
    model_allowlist: "Allow only specific models for bound targets.",
    model_denylist: "Block specific models for bound targets.",
    provider_allowlist: "Allow only specific providers for bound targets.",
    provider_denylist: "Block specific providers for bound targets.",
    deprecated_model_block: "Automatically block models in deprecated lifecycle state.",
    budget_cap: "Block requests when estimated spend exceeds configured cap.",
    token_cap: "Block requests when input/output token usage exceeds configured cap.",
  };

  let creating = false;
  let createError = "";
  let createName = "";
  let createType = "model_allowlist";
  let createdPolicyId = "";
  let bindingSelection = new Set<string>();
  let saveBindingsLoading = false;
  let saveBindingsError = "";

  const TYPE_BADGE_CLASS: Record<string, string> = {
    model_allowlist: "badge-blue",
    model_denylist: "badge-red",
    provider_allowlist: "badge-blue",
    provider_denylist: "badge-red",
    deprecated_model_block: "badge-orange",
    budget_cap: "badge-amber",
    token_cap: "badge-amber",
  };

  type BindTarget = { id: string; targetType: "workspace" | "project" | "environment" | "route"; label: string };
  $: bindTargets = [
    ...(data.workspaceId
      ? [{ id: data.workspaceId, targetType: "workspace" as const, label: "Workspace level" }]
      : []),
    ...data.targets.projects.map((project) => ({
      id: project.id,
      targetType: "project" as const,
      label: `Project · ${project.name}`,
    })),
    ...data.targets.environments.map((env) => ({
      id: env.id,
      targetType: "environment" as const,
      label: `Environment · ${env.name} (${env.projectName})`,
    })),
    ...data.targets.routes.map((route) => ({
      id: route.id,
      targetType: "route" as const,
      label: `Route · ${route.name} (${route.projectName})`,
    })),
  ] satisfies BindTarget[];

  const routeToProject = new Map(data.targets.routes.map((route) => [route.id, route.projectId]));
  const envToProject = new Map(data.targets.environments.map((env) => [env.id, env.projectId]));

  function boundCount(policyId: string): number {
    return data.bindingsByPolicy[policyId]?.length ?? 0;
  }

  function coverageSummary() {
    const activePolicies = data.policies.filter((policy) => policy.status === "active").length;
    const routeIds = new Set<string>();
    const projectIds = new Set<string>();
    for (const bindings of Object.values(data.bindingsByPolicy)) {
      for (const binding of bindings) {
        if (binding.targetType === "route") {
          routeIds.add(binding.targetId);
          const pid = routeToProject.get(binding.targetId);
          if (pid) projectIds.add(pid);
        }
        if (binding.targetType === "project") projectIds.add(binding.targetId);
        if (binding.targetType === "environment") {
          const pid = envToProject.get(binding.targetId);
          if (pid) projectIds.add(pid);
        }
      }
    }
    return {
      activePolicies,
      coveredRoutes: routeIds.size,
      coveredProjects: projectIds.size,
    };
  }

  async function createPolicy() {
    if (!createName.trim()) {
      createError = "Name is required.";
      return;
    }
    creating = true;
    createError = "";
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName.trim(), type: createType }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.data?.id) {
        createdPolicyId = body.data.id as string;
        bindingSelection = new Set();
        saveBindingsError = "";
        await invalidateAll();
        createName = "";
      } else {
        createError = (body as { error?: string }).error ?? `Request failed (${res.status})`;
      }
    } catch (e) {
      createError = e instanceof Error ? e.message : "Request failed";
    } finally {
      creating = false;
    }
  }

  function toggleBindSelection(targetType: BindTarget["targetType"], targetId: string) {
    const key = `${targetType}:${targetId}`;
    const next = new Set(bindingSelection);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    bindingSelection = next;
  }

  function skipBindingStep() {
    createdPolicyId = "";
    bindingSelection = new Set();
    saveBindingsError = "";
  }

  async function saveBindings() {
    if (!createdPolicyId || bindingSelection.size === 0) {
      skipBindingStep();
      return;
    }
    saveBindingsLoading = true;
    saveBindingsError = "";
    try {
      for (const selection of bindingSelection) {
        const [targetType, targetId] = selection.split(":");
        const res = await fetch(`${DASHBOARD_BASE}/api/policies/${createdPolicyId}/bindings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetType, targetId }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error ?? `Binding save failed (${res.status})`);
        }
      }
      await invalidateAll();
      skipBindingStep();
    } catch (error) {
      saveBindingsError = error instanceof Error ? error.message : "Unable to save bindings";
    } finally {
      saveBindingsLoading = false;
    }
  }
</script>

<h1 class="page-title">Policies</h1>
<p class="page-desc">
  Policies control model and provider allowlists/denylists, deprecated-model blocks, and budget or token caps. Bind policies to workspace, project, environment, or route. Canonical nouns: policy, policy binding, rule definition.
</p>

{#if data.error}
  <p class="error-msg" role="alert">{data.error}</p>
{:else}
  {@const summary = coverageSummary()}
  <section class="section coverage" aria-label="Policy coverage">
    <p>
      {summary.activePolicies} policies active, covering {summary.coveredRoutes} routes across {summary.coveredProjects} projects.
    </p>
  </section>

  <section class="section" aria-labelledby="create-heading">
    <h2 id="create-heading" class="section-title">Create policy</h2>
    <p class="section-desc">Add a policy. Set the type (e.g. model_allowlist, deprecated_model_block); you can edit the rule definition on the policy detail page.</p>
    {#if createError}
      <p class="error-msg" role="alert">{createError}</p>
    {/if}
    <form class="create-form" onsubmit={(e) => { e.preventDefault(); createPolicy(); }}>
      <div class="form-row">
        <label for="name">Name</label>
        <input id="name" type="text" bind:value={createName} class="input" placeholder="e.g. Production allowlist" required />
      </div>
      <div class="form-row">
        <label for="type">Type</label>
        <select id="type" bind:value={createType} class="input">
          {#each POLICY_TYPES as t}
            <option value={t}>{t}</option>
          {/each}
        </select>
        <p class="type-help">{POLICY_TYPE_HELP[createType]}</p>
      </div>
      <button type="submit" class="btn btn-primary" disabled={creating}>
        {creating ? "Creating…" : "Create policy"}
      </button>
    </form>

    {#if createdPolicyId}
      <div class="bind-step">
        <h3>Bind this policy</h3>
        <p class="section-desc">Choose where this policy should apply.</p>
        <ul class="bind-target-list">
          {#each bindTargets as target}
            <li>
              <label>
                <input
                  type="checkbox"
                  checked={bindingSelection.has(`${target.targetType}:${target.id}`)}
                  onchange={() => toggleBindSelection(target.targetType, target.id)}
                />
                <span>{target.label}</span>
              </label>
            </li>
          {/each}
        </ul>
        {#if saveBindingsError}
          <p class="error-msg" role="alert">{saveBindingsError}</p>
        {/if}
        <div class="bind-actions">
          <button type="button" class="btn btn-primary" disabled={saveBindingsLoading} onclick={saveBindings}>
            {saveBindingsLoading ? "Saving…" : "Save bindings"}
          </button>
          <button type="button" class="btn btn-ghost" onclick={skipBindingStep}>Skip for now</button>
        </div>
      </div>
    {/if}
  </section>

  <section class="section" aria-labelledby="list-heading">
    <h2 id="list-heading" class="section-title">Policies ({data.policies.length})</h2>
    {#if data.policies.length === 0}
      <EmptyState
        title="No policies yet"
        description="Create a policy above. Then open it to set rule definition and bind it to targets (project, route, etc.)."
      >
        <a href="#create-heading" class="btn btn-primary">Create policy</a>
      </EmptyState>
    {:else}
      <ul class="policy-list">
        {#each data.policies as p}
          <li class="policy-row">
            <a href={DASHBOARD_BASE + "/policies/" + p.id} class="policy-link">
              <span class="policy-name">{p.name}</span>
              <span class="policy-meta-row">
                <span class={`type-badge ${TYPE_BADGE_CLASS[p.type] ?? "badge-default"}`}>{p.type}</span>
                <span class="policy-meta">{p.status}</span>
                <span class="policy-meta">Bound to {boundCount(p.id)} targets</span>
              </span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
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
  .coverage {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
    padding: var(--space-3) var(--space-4);
  }
  .coverage p {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-text);
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
    border: 1px solid var(--rm-border);
    font-size: var(--text-sm);
    background: var(--rm-bg);
    color: var(--rm-text);
  }
  .type-help {
    margin: var(--space-1) 0 0;
    font-size: var(--text-xs);
    color: var(--rm-dim);
    line-height: 1.4;
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
  .policy-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .policy-row {
    border-bottom: 1px solid var(--rm-border);
  }
  .policy-link {
    display: block;
    padding: var(--space-3) 0;
    text-decoration: none;
    color: inherit;
  }
  .policy-link:hover {
    background: var(--rm-surface-raised);
  }
  .policy-name {
    font-weight: 600;
    font-size: var(--text-sm);
    color: var(--rm-text);
    display: block;
  }
  .policy-meta-row {
    margin-top: var(--space-1);
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }
  .policy-meta {
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  .type-badge {
    font-size: var(--text-xs);
    border-radius: 999px;
    border: 1px solid var(--rm-border);
    padding: 0.15rem 0.5rem;
    line-height: 1.2;
  }
  .badge-blue {
    border-color: color-mix(in oklab, #5ea8ff 45%, var(--rm-border));
    color: #6cb0ff;
  }
  .badge-red {
    border-color: color-mix(in oklab, #d86e6e 45%, var(--rm-border));
    color: #d87a7a;
  }
  .badge-orange {
    border-color: color-mix(in oklab, #e1924d 45%, var(--rm-border));
    color: #e6a36a;
  }
  .badge-amber {
    border-color: color-mix(in oklab, #d4ad54 45%, var(--rm-border));
    color: #e0c173;
  }
  .badge-default {
    color: var(--rm-muted);
  }
  .bind-step {
    margin-top: var(--space-4);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
    padding: var(--space-3);
  }
  .bind-step h3 {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    color: var(--rm-text);
  }
  .bind-target-list {
    list-style: none;
    padding: 0;
    margin: 0 0 var(--space-3);
    display: grid;
    gap: var(--space-1);
    max-height: 14rem;
    overflow: auto;
  }
  .bind-target-list label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .bind-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .btn-ghost {
    border: 1px solid var(--rm-border);
    background: transparent;
    color: var(--rm-muted);
  }
  .error-msg {
    color: var(--coral-alert);
    font-size: var(--text-sm);
  }
</style>
