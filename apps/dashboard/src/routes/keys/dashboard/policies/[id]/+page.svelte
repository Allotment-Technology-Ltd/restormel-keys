<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { invalidateAll } from "$app/navigation";
  import VersionsPanel from "$lib/components/dashboard/VersionsPanel.svelte";

  export let data: {
    policy: {
      id: string;
      name: string;
      type: string;
      status: string;
      ruleDefinition: Record<string, unknown> | null;
    } | null;
    bindings: { id: string; targetType: string; targetId: string; label: string }[];
    projects: { id: string; name: string; userId: string; environments: { id: string; name: string }[]; routes: { id: string; name: string }[] }[];
    models: { id: string; canonicalName: string }[];
    workspaceId: string | null;
    workspaceName?: string;
    error: string | null;
  };

  let saving = false;
  let saveError = "";
  let editStatus = data.policy?.status ?? "active";

  let testModelInput = "";
  let testSpendInput = "";
  let testTokenInput = "";
  let policyTestResult: { heading: string; detail: string; state: "ok" | "warn" } | null = null;

  let addTargetType: "workspace" | "project" | "environment" | "route" = "project";
  let addBindingProjectId = "";
  let addTargetId = "";
  let addBindingLoading = false;
  let addBindingError = "";
  let removingBindingId: string | null = null;

  $: if (data.policy) editStatus = data.policy.status;

  $: addProjectForBinding = data.projects?.find((p) => p.id === addBindingProjectId) ?? null;
  $: addEnvOptions = addProjectForBinding?.environments ?? [];
  $: addRouteOptions = addProjectForBinding?.routes ?? [];
  $: if ((addTargetType === "environment" || addTargetType === "route") && addBindingProjectId && addProjectForBinding) {
    const valid = addTargetType === "environment"
      ? addEnvOptions.some((e) => e.id === addTargetId)
      : addRouteOptions.some((r) => r.id === addTargetId);
    if (addTargetId && !valid) addTargetId = "";
  }
  $: resolvedAddTargetId =
    addTargetType === "workspace" ? (data.workspaceId ?? "")
    : addTargetType === "project" ? addTargetId
    : addTargetType === "environment" || addTargetType === "route" ? addTargetId
    : "";
  $: canSubmitAddBinding =
    addTargetType === "workspace" ? !!data.workspaceId
    : addTargetType === "project" ? !!addTargetId
    : addTargetType === "environment" ? !!addBindingProjectId && !!addTargetId
    : addTargetType === "route" ? !!addBindingProjectId && !!addTargetId
    : false;

  function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string").map((item) => item.toLowerCase());
  }

  function runPolicyTest() {
    if (!data.policy) return;
    const rd = data.policy.ruleDefinition ?? {};
    const policyType = data.policy.type;
    const model = testModelInput.trim().toLowerCase();
    const spend = Number(testSpendInput);
    const tokens = Number(testTokenInput);

    if (policyType === "model_allowlist" || policyType === "model_denylist") {
      const items = [
        ...asStringArray(rd.modelIds),
        ...asStringArray(rd.models),
        ...asStringArray(rd.allowlist),
        ...asStringArray(rd.denylist),
      ];
      if (!model) {
        policyTestResult = { heading: "Enter a model name", detail: "Type a model to test this rule.", state: "warn" };
        return;
      }
      const hit = items.includes(model);
      if (policyType === "model_allowlist") {
        policyTestResult = hit
          ? { heading: "Allowed", detail: `${testModelInput} is in the allowlist.`, state: "ok" }
          : { heading: "Blocked", detail: `${testModelInput} is not in the allowlist.`, state: "warn" };
      } else {
        policyTestResult = hit
          ? { heading: "Blocked", detail: `${testModelInput} is in the denylist.`, state: "warn" }
          : { heading: "Allowed", detail: `${testModelInput} is not denied by this policy.`, state: "ok" };
      }
      return;
    }

    if (policyType === "budget_cap") {
      const cap = Number(rd.capUsd ?? rd.budgetCapUsd ?? rd.maxUsd ?? rd.limitUsd);
      if (!Number.isFinite(spend)) {
        policyTestResult = { heading: "Enter spend amount", detail: "Provide a USD value to test.", state: "warn" };
        return;
      }
      if (!Number.isFinite(cap)) {
        policyTestResult = { heading: "No cap configured", detail: "Rule definition has no budget cap value.", state: "warn" };
        return;
      }
      policyTestResult =
        spend <= cap
          ? { heading: "Within budget", detail: `$${spend.toFixed(2)} is within cap $${cap.toFixed(2)}.`, state: "ok" }
          : { heading: "Exceeds cap", detail: `$${spend.toFixed(2)} exceeds cap $${cap.toFixed(2)}.`, state: "warn" };
      return;
    }

    if (policyType === "token_cap") {
      const cap = Number(rd.capTokens ?? rd.tokenCap ?? rd.maxTokens ?? rd.limitTokens);
      if (!Number.isFinite(tokens)) {
        policyTestResult = { heading: "Enter token count", detail: "Provide a numeric token value to test.", state: "warn" };
        return;
      }
      if (!Number.isFinite(cap)) {
        policyTestResult = { heading: "No cap configured", detail: "Rule definition has no token cap value.", state: "warn" };
        return;
      }
      policyTestResult =
        tokens <= cap
          ? { heading: "Within limit", detail: `${tokens} tokens is within cap ${cap}.`, state: "ok" }
          : { heading: "Exceeds cap", detail: `${tokens} tokens exceeds cap ${cap}.`, state: "warn" };
      return;
    }

    if (policyType === "deprecated_model_block") {
      if (!model) {
        policyTestResult = { heading: "Enter a model name", detail: "Type a model to test this rule.", state: "warn" };
        return;
      }
      const deprecated = [
        ...asStringArray(rd.modelIds),
        ...asStringArray(rd.models),
        ...asStringArray(rd.deprecatedModels),
      ];
      const flagged = deprecated.includes(model) || model.includes("deprecated") || model.includes("legacy");
      policyTestResult = flagged
        ? { heading: "Blocked", detail: `${testModelInput} is flagged as deprecated.`, state: "warn" }
        : { heading: "Allowed", detail: `${testModelInput} is not flagged as deprecated.`, state: "ok" };
      return;
    }

    policyTestResult = {
      heading: "No tester available",
      detail: `Client-side tester is not defined for policy type "${policyType}".`,
      state: "warn",
    };
  }

  async function addBinding() {
    if (!data.policy) return;
    const targetId = resolvedAddTargetId.trim();
    if (!targetId) {
      addBindingError = "Select a target.";
      return;
    }
    addBindingLoading = true;
    addBindingError = "";
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/policies/${data.policy.id}/bindings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetType: addTargetType, targetId }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) await invalidateAll();
      else addBindingError = (body as { error?: string }).error ?? `Request failed (${res.status})`;
    } catch (e) {
      addBindingError = e instanceof Error ? e.message : "Request failed";
    } finally {
      addBindingLoading = false;
    }
  }

  async function removeBinding(bindingId: string) {
    if (!data.policy || !confirm("Remove this binding? The policy will no longer apply to this target.")) return;
    removingBindingId = bindingId;
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/policies/${data.policy.id}/bindings/${bindingId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) await invalidateAll();
    } finally {
      removingBindingId = null;
    }
  }

  async function saveStatus() {
    if (!data.policy) return;
    saving = true;
    saveError = "";
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/policies/${data.policy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: editStatus }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) await invalidateAll();
      else saveError = (body as { error?: string }).error ?? `Request failed (${res.status})`;
    } catch (e) {
      saveError = e instanceof Error ? e.message : "Request failed";
    } finally {
      saving = false;
    }
  }
</script>

{#if data.error || !data.policy}
  <p class="error-msg" role="alert">{data.error ?? "Policy not found."}</p>
  <p><a href={DASHBOARD_BASE + "/policies"} class="back-link">← Back to Guard Rails</a></p>
{:else}
  <p><a href={DASHBOARD_BASE + "/policies"} class="back-link">← Back to Guard Rails</a></p>
  <h1 class="page-title">{data.policy.name}</h1>
  <p class="page-desc">
    Type: <strong>{data.policy.type}</strong>. Rule definition and bindings determine where this policy applies.
  </p>

  {#if saveError}
    <p class="error-msg" role="alert">{saveError}</p>
  {/if}

  <section class="section">
    <h2 class="section-title">Status</h2>
    <form class="inline-form" onsubmit={(e) => { e.preventDefault(); saveStatus(); }}>
      <select bind:value={editStatus} class="input">
        <option value="active">active</option>
        <option value="paused">paused</option>
      </select>
      <button type="submit" class="btn btn-primary" disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  </section>

  <section class="section">
    <h2 class="section-title">Rule definition</h2>
    <p class="section-desc">
      Rule shape depends on policy type (e.g. modelIds for allowlist/denylist). Editing via API or future UI.
    </p>
    {#if data.policy.ruleDefinition && Object.keys(data.policy.ruleDefinition).length > 0}
      <pre class="rule-preview">{JSON.stringify(data.policy.ruleDefinition, null, 2)}</pre>
    {:else}
      <p class="muted">No rule definition set. Use PATCH /api/policies/{data.policy.id} to set ruleDefinition.</p>
    {/if}
  </section>

  <section class="section" aria-labelledby="test-heading">
    <h2 id="test-heading" class="section-title">Test policy</h2>
    <p class="section-desc">
      This panel evaluates this policy client-side against its current rule definition.
    </p>
    <form class="test-form" onsubmit={(e) => { e.preventDefault(); runPolicyTest(); }}>
      {#if data.policy.type === "model_allowlist" || data.policy.type === "model_denylist" || data.policy.type === "deprecated_model_block"}
        <div class="form-row">
          <label for="test-model">Model name</label>
          <input id="test-model" type="text" bind:value={testModelInput} class="input" placeholder="e.g. gpt-4o-mini" />
        </div>
      {:else if data.policy.type === "budget_cap"}
        <div class="form-row">
          <label for="test-spend">Spend amount (USD)</label>
          <input id="test-spend" type="number" min="0" step="0.01" bind:value={testSpendInput} class="input" placeholder="e.g. 12.50" />
        </div>
      {:else if data.policy.type === "token_cap"}
        <div class="form-row">
          <label for="test-token">Token count</label>
          <input id="test-token" type="number" min="0" step="1" bind:value={testTokenInput} class="input" placeholder="e.g. 12000" />
        </div>
      {:else}
        <p class="muted">No interactive tester for this policy type yet.</p>
      {/if}
      <button type="submit" class="btn btn-primary">Run test</button>
    </form>
    {#if policyTestResult}
      <div class="evaluate-result" role="status">
        <p class="evaluate-badge" class:allowed={policyTestResult.state === "ok"} class:blocked={policyTestResult.state !== "ok"}>
          {policyTestResult.heading}
        </p>
        <p class="muted">{policyTestResult.detail}</p>
      </div>
    {/if}
  </section>

  <section class="section" aria-labelledby="versions-heading">
    <h2 id="versions-heading" class="section-title">Versions</h2>
    <p class="section-desc">
      Publish this policy to make it live, or roll back to a prior version.
    </p>
    <VersionsPanel
      historyUrl={`${DASHBOARD_BASE}/api/policies/${data.policy.id}/history`}
      publishUrl={`${DASHBOARD_BASE}/api/policies/${data.policy.id}/publish`}
      rollbackUrl={`${DASHBOARD_BASE}/api/policies/${data.policy.id}/rollback`}
      diffMode="server"
      diffUrl={`${DASHBOARD_BASE}/api/policies/${data.policy.id}/diff`}
      entityNoun="policy"
      onMutated={invalidateAll}
    />
  </section>

  <section class="section">
    <h2 class="section-title">Bindings</h2>
    <p class="section-desc">
      Bindings attach this policy to a target (workspace, project, environment, route). Impacted objects depend on the target.
    </p>
    <div class="add-binding-form">
      <h3 class="subsection-title">Add binding</h3>
      <form onsubmit={(e) => { e.preventDefault(); addBinding(); }}>
        <div class="form-row">
          <label for="add-target-type">Target type</label>
          <select id="add-target-type" bind:value={addTargetType} class="input">
            <option value="workspace">Workspace</option>
            <option value="project">Project</option>
            <option value="environment">Environment</option>
            <option value="route">Route</option>
          </select>
        </div>
        {#if addTargetType === "workspace"}
          <p class="muted">Target: {data.workspaceName ?? "This workspace"} (<code>{data.workspaceId}</code>)</p>
        {:else if addTargetType === "project"}
          <div class="form-row">
            <label for="add-project">Project</label>
            <select id="add-project" bind:value={addTargetId} class="input">
              <option value="">Select project</option>
              {#each data.projects ?? [] as p}
                <option value={p.id}>{p.name}</option>
              {/each}
            </select>
          </div>
        {:else if addTargetType === "environment"}
          <div class="form-row">
            <label for="add-env-project">Project</label>
            <select id="add-env-project" bind:value={addBindingProjectId} class="input">
              <option value="">Select project</option>
              {#each data.projects ?? [] as p}
                <option value={p.id}>{p.name}</option>
              {/each}
            </select>
          </div>
          <div class="form-row">
            <label for="add-env">Environment</label>
            <select id="add-env" bind:value={addTargetId} class="input">
              <option value="">Select environment</option>
              {#each addEnvOptions as env}
                <option value={env.id}>{env.name}</option>
              {/each}
            </select>
          </div>
        {:else if addTargetType === "route"}
          <div class="form-row">
            <label for="add-route-project">Project</label>
            <select id="add-route-project" bind:value={addBindingProjectId} class="input">
              <option value="">Select project</option>
              {#each data.projects ?? [] as p}
                <option value={p.id}>{p.name}</option>
              {/each}
            </select>
          </div>
          <div class="form-row">
            <label for="add-route">Route</label>
            <select id="add-route" bind:value={addTargetId} class="input">
              <option value="">Select route</option>
              {#each addRouteOptions as r}
                <option value={r.id}>{r.name}</option>
              {/each}
            </select>
          </div>
        {/if}
        <button type="submit" class="btn btn-primary" disabled={addBindingLoading || !canSubmitAddBinding}>
          {addBindingLoading ? "Adding…" : "Add binding"}
        </button>
      </form>
      {#if addBindingError}
        <p class="error-msg" role="alert">{addBindingError}</p>
      {/if}
    </div>
    {#if data.bindings.length === 0}
      <p class="muted">No bindings yet. Add one above.</p>
    {:else}
      <ul class="binding-list">
        {#each data.bindings as b}
          <li class="binding-row">
            <span class="binding-label">{b.label}</span>
            <span class="binding-meta">{b.targetType} · <code>{b.targetId}</code></span>
            <button
              type="button"
              class="btn btn-remove"
              aria-label="Remove binding for {b.label}"
              disabled={removingBindingId === b.id}
              onclick={() => removeBinding(b.id)}
            >
              {removingBindingId === b.id ? "Removing…" : "Remove"}
            </button>
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
  .inline-form {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .input {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--rm-radius);
    border: 1px solid var(--rm-border);
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
  }
  .rule-preview {
    font-size: var(--text-xs);
    background: var(--rm-surface-raised);
    padding: var(--space-3);
    border-radius: var(--rm-radius);
    overflow: auto;
  }
  .binding-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .binding-row {
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--rm-border);
    font-size: var(--text-sm);
  }
  .muted {
    font-size: var(--text-sm);
    color: var(--rm-dim);
  }
  .error-msg {
    color: var(--coral-alert);
    font-size: var(--text-sm);
  }
  .test-form {
    max-width: 28rem;
    margin-bottom: var(--space-3);
  }
  .test-form .form-row {
    margin-bottom: var(--space-3);
  }
  .test-form label {
    display: block;
    font-size: var(--text-sm);
    font-weight: 500;
    margin-bottom: var(--space-1);
  }
  .evaluate-result {
    margin-top: var(--space-4);
    padding: var(--space-3);
    background: var(--rm-surface-raised);
    border-radius: var(--rm-radius);
  }
  .evaluate-badge {
    font-weight: 600;
    font-size: var(--text-base);
    margin: 0 0 var(--space-2);
  }
  .evaluate-badge.allowed { color: var(--rm-sage); }
  .evaluate-badge.blocked { color: var(--coral-alert); }
  .violations-list {
    list-style: none;
    padding: 0;
    margin: 0;
    font-size: var(--text-sm);
  }
  .violations-list li {
    padding: var(--space-1) 0;
    border-bottom: 1px solid var(--rm-border);
  }
  .subsection-title {
    font-size: var(--text-sm);
    font-weight: 600;
    margin: 0 0 var(--space-2);
  }
  .add-binding-form {
    margin-bottom: var(--space-4);
  }
  .add-binding-form .form-row {
    margin-bottom: var(--space-3);
  }
  .add-binding-form label {
    display: block;
    font-size: var(--text-sm);
    font-weight: 500;
    margin-bottom: var(--space-1);
  }
  .binding-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .binding-label {
    font-weight: 500;
  }
  .binding-meta {
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  .btn-remove {
    margin-left: auto;
    background: transparent;
    color: var(--coral-alert);
    border: 1px solid var(--rm-border);
  }
</style>
