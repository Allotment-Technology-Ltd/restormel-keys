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

  const POLICY_TEMPLATES = [
    {
      id: "model_allowlist",
      icon: "🛡",
      title: "Restrict which models can be used",
      subtitle: "model_allowlist",
    },
    {
      id: "deprecated_model_block",
      icon: "🕒",
      title: "Block outdated models",
      subtitle: "deprecated_model_block",
    },
    {
      id: "budget_cap",
      icon: "$",
      title: "Set a cost or token limit",
      subtitle: "budget_cap",
    },
  ] as const;

  let creating = false;
  let createError = "";
  let createName = "";
  let createType = "model_allowlist";
  let createdPolicyId = "";
  let bindingSelection = new Set<string>();
  let saveBindingsLoading = false;
  let saveBindingsError = "";
  let deletingPolicyId: string | null = null;
  let deletePolicyError = "";

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

  function policyTone(status: string): "success" | "warning" | "error" | "muted" {
    if (status === "active") return "success";
    if (status === "paused") return "warning";
    if (status === "revoked") return "error";
    return "muted";
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

  async function deletePolicyRecord(policy: (typeof data.policies)[number]) {
    deletePolicyError = "";
    const bindings = boundCount(policy.id);
    const message =
      bindings > 0
        ? `Delete guard rail "${policy.name}"? It is applied to ${bindings} target(s). This cannot be undone.`
        : `Delete guard rail "${policy.name}"? This cannot be undone.`;
    if (!confirm(message)) return;
    deletingPolicyId = policy.id;
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/policies/${policy.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (res.ok) await invalidateAll();
      else deletePolicyError = (body as { error?: string }).error ?? `Delete failed (${res.status})`;
    } catch (e) {
      deletePolicyError = e instanceof Error ? e.message : "Delete failed";
    } finally {
      deletingPolicyId = null;
    }
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

<h1 class="page-title">Guard Rails</h1>
<p class="page-desc">
  Guard rails are limits and rules that control which AI models can be used and how much they can cost. Apply them to your projects or individual rules.
</p>

{#if data.error}
  <p class="error-msg" role="alert">{data.error}</p>
{:else}
  {#if deletePolicyError}
    <p class="error-msg" role="alert">{deletePolicyError}</p>
  {/if}
  {@const summary = coverageSummary()}
  <section class="section coverage" aria-label="Policy coverage">
    <p>
      {summary.activePolicies} policies active, covering {summary.coveredRoutes} routes across {summary.coveredProjects} projects.
    </p>
  </section>

  <section class="section" aria-labelledby="create-heading">
    <h2 id="create-heading" class="section-title">Create guard rail</h2>
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
        <p class="template-label">Template</p>
        <div class="template-grid">
          {#each POLICY_TEMPLATES as t}
            <button
              type="button"
              class="template-card"
              class:template-card-active={createType === t.id}
              onclick={() => (createType = t.id)}
            >
              <span class="template-icon" aria-hidden="true">{t.icon}</span>
              <span class="template-title">{t.title}</span>
              <span class="template-subtitle">{t.subtitle}</span>
            </button>
          {/each}
        </div>
      </div>
      <button type="submit" class="btn btn-primary" disabled={creating}>
        {creating ? "Creating…" : "Create guard rail"}
      </button>
    </form>

    {#if createdPolicyId}
      <div class="bind-step">
        <h3>Apply this guard rail</h3>
        <p class="section-desc">Choose where this guard rail should apply.</p>
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
    <h2 id="list-heading" class="section-title">Guard Rails ({data.policies.length})</h2>
    {#if data.policies.length === 0}
      <EmptyState
        title="No guard rails yet"
        description="Create a guard rail above. Then open it to set the rule definition and apply it to targets (project, rule, etc.)."
      >
        <a href="#create-heading" class="btn btn-primary">Create guard rail</a>
      </EmptyState>
    {:else}
      <ul class="policy-list">
        {#each data.policies as p}
          <li class="policy-row">
            <a href={DASHBOARD_BASE + "/policies/" + p.id} class="policy-link">
              <span class="policy-name">{p.name}</span>
              <span class="policy-meta-row">
                <span class={`type-badge ${TYPE_BADGE_CLASS[p.type] ?? "badge-default"}`}>{p.type}</span>
                <span class={`policy-meta status-${policyTone(p.status)}`}>{p.status}</span>
                {#if boundCount(p.id) === 0}
                  <span class="policy-meta policy-meta-amber">Not applied to any rules yet — apply it →</span>
                {:else}
                  <span class="policy-meta">Applied to {boundCount(p.id)} rule(s)</span>
                {/if}
              </span>
            </a>
            <button
              type="button"
              class="btn-delete-policy"
              disabled={deletingPolicyId === p.id}
              aria-label="Delete guard rail {p.name}"
              onclick={() => deletePolicyRecord(p)}
            >
              {deletingPolicyId === p.id ? "Deleting…" : "Delete"}
            </button>
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
  .template-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
  }
  .template-label {
    margin: 0 0 var(--space-1);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--rm-text);
  }
  .template-card {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
    color: var(--rm-muted);
    padding: var(--space-2);
    text-align: left;
    display: grid;
    gap: 0.2rem;
  }
  .template-card-active {
    border-color: var(--rm-sage);
    color: var(--rm-text);
  }
  .template-icon {
    font-size: var(--text-sm);
  }
  .template-title {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--rm-text);
  }
  .template-subtitle {
    font-size: var(--text-xs);
    color: var(--rm-dim);
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
    display: flex;
    align-items: center;
    gap: var(--space-2);
    border-bottom: 1px solid var(--rm-border);
  }
  .policy-link {
    flex: 1;
    min-width: 0;
    display: block;
    padding: var(--space-3) 0;
    text-decoration: none;
    color: inherit;
  }
  .policy-link:hover {
    background: var(--rm-surface-raised);
  }
  .btn-delete-policy {
    flex-shrink: 0;
    font-size: var(--text-xs);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--rm-radius);
    border: 1px solid var(--rm-border);
    background: var(--rm-surface);
    color: var(--coral-alert);
    cursor: pointer;
    margin: var(--space-2) 0;
  }
  .btn-delete-policy:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .btn-delete-policy:hover:not(:disabled) {
    border-color: color-mix(in oklab, var(--coral-alert) 40%, var(--rm-border));
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
  .policy-meta-amber {
    color: var(--amber-insight);
    text-decoration: none;
  }
  .policy-meta-amber:hover {
    text-decoration: underline;
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
