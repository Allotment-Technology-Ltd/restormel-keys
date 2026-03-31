<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { goto, invalidateAll } from "$app/navigation";

  export let data: {
    project: { id: string; name: string } | null;
    route: {
      id: string;
      name: string;
      description: string | null;
      status: string;
      defaultModelId: string | null;
      billingMode: string | null;
      routeMode: string | null;
    } | null;
    steps: {
      id: string;
      orderIndex: number;
      providerPreference: string | null;
      modelId: string | null;
      fallbackOn: string | null;
      timeoutMs: number | null;
      enabled: boolean;
    }[];
    availablePolicies: { id: string; name: string; type: string; status: string }[];
    routePolicyBindings: { id: string; policyId: string; policyName: string; policyType: string }[];
    modelOptions: string[];
    modelLifecycleWarnings: {
      id: string;
      canonicalName: string;
      lifecycleState: string | null;
      deprecationDate: number | null;
      retirementDate: number | null;
      replacementModelId: string | null;
    }[];
    error: string | null;
  };

  let saving = false;
  let saveError = "";
  let editName = data.route?.name ?? "";
  let editStatus = data.route?.status ?? "active";
  let editBillingMode = data.route?.billingMode ?? "";
  let editRouteMode = data.route?.routeMode ?? "";
  let creatingStep = false;
  let stepError = "";
  let stepProviderPreference = "openai";
  let stepModelId = "";
  let stepFallbackOn = "error";
  let stepTimeoutMs = "12000";
  let editingStepId: string | null = null;
  let editingProviderPreference = "openai";
  let editingModelId = "";
  let editingFallbackOn = "error";
  let editingTimeoutMs = "12000";
  let editingEnabled = true;
  let expandedStepId: string | null = null;
  let stepBusyId: string | null = null;
  let movingStepId: string | null = null;
  let selectedPolicyId = "";
  let bindingPolicy = false;
  let policyError = "";
  let creatingAndBindingPolicy = false;
  let createPolicyName = "";
  let createPolicyType = "model_allowlist";
  let unbindingId: string | null = null;
  let deletingThisRoute = false;

  $: if (data.route) {
    editName = data.route.name;
    editStatus = data.route.status;
    editBillingMode = data.route.billingMode ?? "";
    editRouteMode = data.route.routeMode ?? "";
  }
  $: if (expandedStepId && !data.steps.some((s) => s.id === expandedStepId)) {
    expandedStepId = null;
    editingStepId = null;
  }
  $: orderedSteps = [...data.steps].sort((a, b) => a.orderIndex - b.orderIndex);
  $: summarySteps = orderedSteps.length
    ? orderedSteps
        .map((step) => `${step.providerPreference ?? "provider"} ${step.modelId ?? "model"}`)
        .join(" → ")
    : "no providers configured yet";
  $: summaryTimeoutMs = orderedSteps.find((step) => step.timeoutMs != null)?.timeoutMs ?? 12000;

  async function saveRoute() {
    if (!data.project || !data.route) return;
    saving = true;
    saveError = "";
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${data.project.id}/routes/${data.route.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          status: editStatus,
          billingMode: editBillingMode || null,
          routeMode: editRouteMode || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        await invalidateAll();
      } else {
        saveError = (body as { error?: string }).error ?? `Request failed (${res.status})`;
      }
    } catch (e) {
      saveError = e instanceof Error ? e.message : "Request failed";
    } finally {
      saving = false;
    }
  }

  async function addStep() {
    if (!data.project || !data.route) return;
    creatingStep = true;
    stepError = "";
    try {
      const nextOrder = data.steps.length ? Math.max(...data.steps.map((s) => s.orderIndex)) + 1 : 0;
      const timeoutNum = parseInt(stepTimeoutMs, 10);
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${data.project.id}/routes/${data.route.id}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIndex: nextOrder,
          providerPreference: stepProviderPreference || null,
          modelId: stepModelId.trim() || null,
          fallbackOn: stepFallbackOn || "error",
          timeoutMs: Number.isFinite(timeoutNum) ? timeoutNum : 12000,
          enabled: true,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        stepModelId = "";
        await invalidateAll();
      } else {
        stepError =
          (body as { detail?: string; error?: string }).detail ??
          (body as { error?: string }).error ??
          `Request failed (${res.status})`;
      }
    } catch (e) {
      stepError = e instanceof Error ? e.message : "Request failed";
    } finally {
      creatingStep = false;
    }
  }

  async function removeStep(stepId: string) {
    if (!data.project || !data.route) return;
    if (!confirm("Remove this step from the route?")) return;
    stepBusyId = stepId;
    stepError = "";
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${data.project.id}/routes/${data.route.id}/steps/${stepId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (expandedStepId === stepId) {
          expandedStepId = null;
          editingStepId = null;
        }
        await invalidateAll();
      }
      else stepError = "Failed to remove step";
    } catch (e) {
      stepError = e instanceof Error ? e.message : "Failed to remove step";
    } finally {
      stepBusyId = null;
    }
  }

  function startEditStep(step: {
    id: string;
    providerPreference: string | null;
    modelId: string | null;
    fallbackOn: string | null;
    timeoutMs: number | null;
    enabled: boolean;
  }) {
    editingStepId = step.id;
    expandedStepId = step.id;
    editingProviderPreference = step.providerPreference ?? "openai";
    editingModelId = step.modelId ?? "";
    editingFallbackOn = step.fallbackOn ?? "error";
    editingTimeoutMs = String(step.timeoutMs ?? 12000);
    editingEnabled = step.enabled;
    stepError = "";
  }

  function cancelEditStep() {
    editingStepId = null;
    expandedStepId = null;
  }

  function toggleStepPanel(step: {
    id: string;
    providerPreference: string | null;
    modelId: string | null;
    fallbackOn: string | null;
    timeoutMs: number | null;
    enabled: boolean;
  }) {
    if (expandedStepId === step.id) {
      cancelEditStep();
      return;
    }
    startEditStep(step);
  }

  async function saveStepEdit() {
    if (!data.project || !data.route || !editingStepId) return;
    stepBusyId = editingStepId;
    stepError = "";
    try {
      const timeoutNum = parseInt(editingTimeoutMs, 10);
      const res = await fetch(
        `${DASHBOARD_BASE}/api/projects/${data.project.id}/routes/${data.route.id}/steps/${editingStepId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerPreference: editingProviderPreference || null,
            modelId: editingModelId.trim() || null,
            fallbackOn: editingFallbackOn || "error",
            timeoutMs: Number.isFinite(timeoutNum) ? timeoutNum : 12000,
            enabled: editingEnabled,
          }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        editingStepId = null;
        await invalidateAll();
      } else {
        stepError =
          (body as { detail?: string; error?: string }).detail ??
          (body as { error?: string }).error ??
          `Request failed (${res.status})`;
      }
    } catch (e) {
      stepError = e instanceof Error ? e.message : "Request failed";
    } finally {
      stepBusyId = null;
    }
  }

  async function toggleStepEnabled(stepId: string, enabled: boolean) {
    if (!data.project || !data.route) return;
    stepBusyId = stepId;
    stepError = "";
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${data.project.id}/routes/${data.route.id}/steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) await invalidateAll();
      else stepError = (body as { error?: string }).error ?? `Request failed (${res.status})`;
    } catch (e) {
      stepError = e instanceof Error ? e.message : "Request failed";
    } finally {
      stepBusyId = null;
    }
  }

  async function moveStep(stepId: string, direction: "up" | "down") {
    if (!data.project || !data.route) return;
    const ordered = [...data.steps].sort((a, b) => a.orderIndex - b.orderIndex);
    const index = ordered.findIndex((s) => s.id === stepId);
    if (index < 0) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ordered.length) return;
    const current = ordered[index];
    const target = ordered[targetIndex];
    movingStepId = stepId;
    stepError = "";
    try {
      const endpoint = `${DASHBOARD_BASE}/api/projects/${data.project.id}/routes/${data.route.id}/steps`;
      const swapA = await fetch(`${endpoint}/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIndex: target.orderIndex }),
      });
      if (!swapA.ok) {
        const body = await swapA.json().catch(() => ({}));
        stepError = (body as { error?: string }).error ?? `Request failed (${swapA.status})`;
        return;
      }
      const swapB = await fetch(`${endpoint}/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIndex: current.orderIndex }),
      });
      if (!swapB.ok) {
        const body = await swapB.json().catch(() => ({}));
        stepError = (body as { error?: string }).error ?? `Request failed (${swapB.status})`;
        return;
      }
      await invalidateAll();
    } catch (e) {
      stepError = e instanceof Error ? e.message : "Failed to reorder steps";
    } finally {
      movingStepId = null;
    }
  }

  async function bindPolicy(policyId: string) {
    if (!policyId || !data.route) return;
    bindingPolicy = true;
    policyError = "";
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/policies/${policyId}/bindings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "route", targetId: data.route.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        selectedPolicyId = "";
        await invalidateAll();
      } else {
        policyError = (body as { error?: string }).error ?? `Request failed (${res.status})`;
      }
    } catch (e) {
      policyError = e instanceof Error ? e.message : "Request failed";
    } finally {
      bindingPolicy = false;
    }
  }

  async function createAndBindPolicy() {
    if (!createPolicyName.trim() || !data.route) return;
    creatingAndBindingPolicy = true;
    policyError = "";
    try {
      const createRes = await fetch(`${DASHBOARD_BASE}/api/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createPolicyName.trim(), type: createPolicyType }),
      });
      const body = await createRes.json().catch(() => ({}));
      if (!createRes.ok || !body.data?.id) {
        policyError = (body as { error?: string }).error ?? `Request failed (${createRes.status})`;
        return;
      }
      await bindPolicy(body.data.id as string);
      createPolicyName = "";
    } catch (e) {
      policyError = e instanceof Error ? e.message : "Request failed";
    } finally {
      creatingAndBindingPolicy = false;
    }
  }

  async function deleteEntireRoute() {
    if (!data.project || !data.route) return;
    if (
      !confirm(
        `Delete rule "${data.route.name}" permanently? Matched traffic will return no_route until you add another rule. This cannot be undone.`
      )
    ) {
      return;
    }
    deletingThisRoute = true;
    saveError = "";
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${data.project.id}/routes/${data.route.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await goto(`${DASHBOARD_BASE}/routes`);
      } else {
        const body = await res.json().catch(() => ({}));
        saveError = (body as { error?: string }).error ?? `Delete failed (${res.status})`;
      }
    } catch (e) {
      saveError = e instanceof Error ? e.message : "Delete failed";
    } finally {
      deletingThisRoute = false;
    }
  }

  async function unbindPolicy(policyId: string, bindingId: string) {
    unbindingId = bindingId;
    policyError = "";
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/policies/${policyId}/bindings/${bindingId}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) await invalidateAll();
      else policyError = (body as { error?: string }).error ?? `Request failed (${res.status})`;
    } catch (e) {
      policyError = e instanceof Error ? e.message : "Request failed";
    } finally {
      unbindingId = null;
    }
  }
</script>

{#if data.error || !data.route || !data.project}
  <p class="error-msg" role="alert">{data.error ?? "Route not found."}</p>
  <p><a href={DASHBOARD_BASE + "/routes"} class="back-link">← Back to Rules</a></p>
{:else}
  <p>
    <a href={DASHBOARD_BASE + "/projects/" + data.project.id + "/routes"} class="back-link">← Rules · {data.project.name}</a>
  </p>
  <h1 class="page-title">{data.route.name}</h1>
  <p class="page-desc">
    Rule status, billing mode, and fallback behaviour. Steps define the resolution order and fallback chain.
  </p>
  <p class="plain-summary">This rule sends requests to {summarySteps}, with a {summaryTimeoutMs}ms timeout.</p>

  {#if data.modelLifecycleWarnings?.length > 0}
    <div class="lifecycle-warning" role="alert">
      <strong>Models in this route are deprecated or retiring.</strong>
      <ul>
        {#each data.modelLifecycleWarnings as m}
          <li>
            <a href={DASHBOARD_BASE + "/models/" + m.id}>{m.canonicalName}</a>
            {#if m.lifecycleState}<span class="lifecycle-state">({m.lifecycleState})</span>{/if}
            {#if m.replacementModelId}
              — consider <a href={DASHBOARD_BASE + "/models/" + m.replacementModelId}>replacement model</a>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if saveError}
    <p class="error-msg" role="alert">{saveError}</p>
  {/if}

  <section class="section" aria-labelledby="config-heading">
    <h2 id="config-heading" class="section-title">Configuration</h2>
    <form class="config-form" onsubmit={(e) => { e.preventDefault(); saveRoute(); }}>
      <div class="form-row">
        <label for="name">Name</label>
        <input id="name" type="text" bind:value={editName} class="input" />
      </div>
      <div class="form-row">
        <label for="status">Status</label>
        <select id="status" bind:value={editStatus} class="input">
          <option value="active">active</option>
          <option value="paused">paused</option>
        </select>
      </div>
      <div class="form-row">
        <label for="billing">Who pays for this route?</label>
        <select id="billing" bind:value={editBillingMode} class="input">
          <option value="">—</option>
          <option value="pass_through">Pass through</option>
          <option value="metered">Metered</option>
        </select>
      </div>
      <div class="form-row">
        <label for="routeMode">What happens if this fails?</label>
        <select id="routeMode" bind:value={editRouteMode} class="input">
          <option value="">—</option>
          <option value="single">Single</option>
          <option value="fallback_chain">Fallback chain</option>
        </select>
      </div>
      <button type="submit" class="btn btn-primary" disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
    {#if data.route.description}
      <p class="muted">Description: {data.route.description}</p>
    {/if}
    {#if data.route.defaultModelId}
      <p class="muted">Default model: {data.route.defaultModelId}</p>
    {/if}
  </section>

  <section class="section" aria-labelledby="fallback-heading">
    <h2 id="fallback-heading" class="section-title">Provider steps & fallback order</h2>
    <p class="section-desc">
      Steps define the resolution order. If a step fails or times out, the next step is used (fallback).
    </p>
    <form class="inline-form" onsubmit={(e) => { e.preventDefault(); addStep(); }}>
      <div class="form-row compact">
        <label for="step-provider">Provider</label>
        <select id="step-provider" bind:value={stepProviderPreference} class="input">
          <option value="openai">openai</option>
          <option value="anthropic">anthropic</option>
          <option value="google">google</option>
          <option value="openrouter">openrouter</option>
          <option value="vercel">vercel</option>
          <option value="portkey">portkey</option>
          <option value="voyage">voyage</option>
        </select>
      </div>
      <div class="form-row compact">
        <label for="step-model">Model</label>
        <input
          id="step-model"
          class="input"
          bind:value={stepModelId}
          list="model-options"
          placeholder="e.g. gpt-4o-mini"
        />
        <datalist id="model-options">
          {#each data.modelOptions as model}
            <option value={model}></option>
          {/each}
        </datalist>
      </div>
      <div class="form-row compact">
        <label for="step-fallback">Trigger fallback when:</label>
        <select id="step-fallback" bind:value={stepFallbackOn} class="input">
          <option value="error">error</option>
          <option value="rate_limit">rate_limit</option>
          <option value="no_key">no_key</option>
          <option value="policy_block">policy_block</option>
          <option value="any">any</option>
        </select>
      </div>
      <div class="form-row compact">
        <label for="step-timeout">Give up after (ms)</label>
        <input id="step-timeout" class="input" bind:value={stepTimeoutMs} />
      </div>
      <button type="submit" class="btn btn-secondary" disabled={creatingStep}>
        {creatingStep ? "Adding…" : "Add step"}
      </button>
    </form>
    {#if stepError}
      <p class="error-msg" role="alert">{stepError}</p>
    {/if}
    {#if data.steps.length === 0}
      <p class="muted">No steps yet. Add your first step above.</p>
    {:else}
      <ol class="steps-list">
        {#each [...data.steps].sort((a, b) => a.orderIndex - b.orderIndex) as step, i}
          <li class="step-item" data-open={expandedStepId === step.id ? "true" : "false"}>
            <button
              type="button"
              class="step-summary-btn"
              onclick={() => toggleStepPanel(step)}
              aria-expanded={expandedStepId === step.id}
              aria-controls={`step-panel-${step.id}`}
            >
              <span class="step-summary-main">
                <span class="step-index">Step {i + 1}</span>
                <span class="step-model">{step.modelId ?? "No model selected"}</span>
                <span class="step-meta-row">
                  <span>{step.providerPreference ?? "no provider"}</span>
                  <span>fallback: {step.fallbackOn ?? "error"}</span>
                  <span>timeout: {step.timeoutMs ?? 12000}ms</span>
                </span>
              </span>
              <span class="step-summary-right">
                <span class:badge-live={step.enabled} class:badge-paused={!step.enabled} class="step-badge">
                  {step.enabled ? "Enabled" : "Disabled"}
                </span>
                <span class="step-chevron" aria-hidden="true">{expandedStepId === step.id ? "▾" : "▸"}</span>
              </span>
            </button>
            {#if expandedStepId === step.id && editingStepId === step.id}
              <div id={`step-panel-${step.id}`} class="step-panel">
                <div class="step-panel-actions">
                  <button
                    type="button"
                    class="btn btn-secondary btn-inline"
                    onclick={() => moveStep(step.id, "up")}
                    disabled={i === 0 || movingStepId === step.id}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    class="btn btn-secondary btn-inline"
                    onclick={() => moveStep(step.id, "down")}
                    disabled={i === data.steps.length - 1 || movingStepId === step.id}
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    class="btn btn-secondary btn-inline"
                    onclick={() => toggleStepEnabled(step.id, !step.enabled)}
                    disabled={stepBusyId === step.id}
                  >
                    {step.enabled ? "Disable step" : "Enable step"}
                  </button>
                  <button
                    type="button"
                    class="btn btn-danger btn-inline"
                    onclick={() => removeStep(step.id)}
                    disabled={stepBusyId === step.id}
                  >
                    {stepBusyId === step.id ? "Removing…" : "Remove step"}
                  </button>
                </div>

                <form class="inline-form step-edit-form" onsubmit={(e) => { e.preventDefault(); saveStepEdit(); }}>
                  <div class="form-row compact">
                    <label for="edit-step-provider">Provider</label>
                    <select id="edit-step-provider" bind:value={editingProviderPreference} class="input">
                      <option value="openai">openai</option>
                      <option value="anthropic">anthropic</option>
                      <option value="google">google</option>
                      <option value="openrouter">openrouter</option>
                      <option value="vercel">vercel</option>
                      <option value="portkey">portkey</option>
                      <option value="voyage">voyage</option>
                    </select>
                  </div>
                  <div class="form-row compact">
                    <label for="edit-step-model">Model</label>
                    <input
                      id="edit-step-model"
                      class="input"
                      bind:value={editingModelId}
                      list="model-options"
                      placeholder="e.g. gpt-4o-mini"
                    />
                  </div>
                  <div class="form-row compact">
                    <label for="edit-step-fallback">Trigger fallback when:</label>
                    <select id="edit-step-fallback" bind:value={editingFallbackOn} class="input">
                      <option value="error">error</option>
                      <option value="rate_limit">rate_limit</option>
                      <option value="no_key">no_key</option>
                      <option value="policy_block">policy_block</option>
                      <option value="any">any</option>
                    </select>
                  </div>
                  <div class="form-row compact">
                    <label for="edit-step-timeout">Give up after (ms)</label>
                    <input id="edit-step-timeout" class="input" bind:value={editingTimeoutMs} />
                  </div>
                  <label class="checkbox-field">
                    <input type="checkbox" bind:checked={editingEnabled} />
                    Enabled
                  </label>
                  <div class="step-edit-actions">
                    <button type="submit" class="btn btn-primary btn-inline" disabled={stepBusyId === step.id}>
                      {stepBusyId === step.id ? "Saving…" : "Save step"}
                    </button>
                    <button type="button" class="btn btn-secondary btn-inline" onclick={cancelEditStep}>
                      Collapse
                    </button>
                  </div>
                </form>
              </div>
            {/if}
          </li>
        {/each}
      </ol>
    {/if}
  </section>

  <section class="section" aria-labelledby="policies-heading">
    <h2 id="policies-heading" class="section-title">Guard Rails for this rule</h2>
    <p class="section-desc">Apply existing guard rails or create and apply one without leaving this page.</p>
    {#if policyError}
      <p class="error-msg" role="alert">{policyError}</p>
    {/if}
    <form class="inline-form" onsubmit={(e) => { e.preventDefault(); bindPolicy(selectedPolicyId); }}>
      <div class="form-row compact">
        <label for="policy-select">Existing policy</label>
        <select id="policy-select" bind:value={selectedPolicyId} class="input">
          <option value="">Select policy…</option>
          {#each data.availablePolicies as policy}
            <option value={policy.id}>{policy.name} ({policy.type})</option>
          {/each}
        </select>
      </div>
      <button type="submit" class="btn btn-secondary" disabled={!selectedPolicyId || bindingPolicy}>
        {bindingPolicy ? "Applying…" : "Apply guard rail"}
      </button>
    </form>

    <form class="inline-form" onsubmit={(e) => { e.preventDefault(); createAndBindPolicy(); }}>
      <div class="form-row compact">
        <label for="policy-name">New policy name</label>
        <input id="policy-name" class="input" bind:value={createPolicyName} placeholder="e.g. Route budget cap" />
      </div>
      <div class="form-row compact">
        <label for="policy-type">Policy type</label>
        <select id="policy-type" bind:value={createPolicyType} class="input">
          <option value="model_allowlist">model_allowlist</option>
          <option value="model_denylist">model_denylist</option>
          <option value="provider_allowlist">provider_allowlist</option>
          <option value="provider_denylist">provider_denylist</option>
          <option value="deprecated_model_block">deprecated_model_block</option>
          <option value="budget_cap">budget_cap</option>
          <option value="token_cap">token_cap</option>
        </select>
      </div>
      <button type="submit" class="btn btn-secondary" disabled={!createPolicyName.trim() || creatingAndBindingPolicy}>
        {creatingAndBindingPolicy ? "Creating…" : "Create + bind"}
      </button>
    </form>

    {#if data.routePolicyBindings.length === 0}
      <p class="muted">No policies are currently bound to this route.</p>
    {:else}
      <ul class="policy-list">
        {#each data.routePolicyBindings as binding}
          <li class="policy-row">
            <span>{binding.policyName} · {binding.policyType}</span>
            <button
              type="button"
              class="btn btn-danger btn-inline"
              disabled={unbindingId === binding.id}
              onclick={() => unbindPolicy(binding.policyId, binding.id)}
            >
              {unbindingId === binding.id ? "Removing…" : "Unbind"}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="section danger-zone" aria-labelledby="delete-rule-heading">
    <h2 id="delete-rule-heading" class="section-title">Delete rule</h2>
    <p class="section-desc">
      Remove this rule from the project. API keys and other rules are unchanged.
    </p>
    <button type="button" class="btn btn-danger" disabled={deletingThisRoute} onclick={() => deleteEntireRoute()}>
      {deletingThisRoute ? "Deleting…" : "Delete this rule"}
    </button>
  </section>

  <section class="section">
    <h2 class="section-title">Logs</h2>
    <p class="section-desc">Request and trace logs for this route.</p>
    <a href={DASHBOARD_BASE + "/logs"} class="btn btn-secondary">Open Logs & Traces</a>
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
  .plain-summary {
    margin: 0 0 var(--space-4);
    font-size: var(--text-sm);
    color: var(--rm-dim);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
    padding: var(--space-2) var(--space-3);
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
  .danger-zone {
    border: 1px solid color-mix(in oklab, var(--coral-alert) 35%, var(--rm-border));
    border-radius: var(--rm-radius);
    padding: var(--space-4);
    background: color-mix(in oklab, var(--coral-alert) 6%, var(--rm-surface));
  }
  .config-form {
    max-width: 28rem;
  }
  .form-row {
    margin-bottom: var(--space-3);
  }
  .form-row.compact {
    margin-bottom: 0;
    min-width: 12rem;
    flex: 1 1 12rem;
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
  .btn-danger {
    background: transparent;
    color: var(--coral-alert);
    border: 1px solid var(--coral-alert);
  }
  .btn-inline {
    padding: 4px 10px;
    font-size: var(--text-xs);
  }
  .inline-form {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .steps-list {
    list-style: none;
    padding: 0;
    margin: 0;
    counter-reset: step;
  }
  .step-item {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    margin-bottom: var(--space-2);
    background: var(--rm-surface);
    overflow: hidden;
  }
  .step-summary-btn {
    width: 100%;
    border: none;
    background: transparent;
    color: inherit;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-3);
    text-align: left;
    cursor: pointer;
  }
  .step-summary-main {
    min-width: 0;
    display: grid;
    gap: 0.2rem;
  }
  .step-index {
    font-size: var(--text-xs);
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--rm-muted);
    font-weight: 600;
  }
  .step-model {
    color: var(--rm-text);
    font-size: var(--text-sm);
    font-weight: 600;
  }
  .step-meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  .step-summary-right {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }
  .step-badge {
    font-size: var(--text-xs);
    border-radius: 999px;
    border: 1px solid var(--rm-border);
    padding: 2px 8px;
    font-weight: 500;
  }
  .badge-live {
    border-color: color-mix(in oklab, var(--rm-sage) 65%, var(--rm-border));
    color: var(--rm-sage);
  }
  .badge-paused {
    border-color: var(--rm-border);
    color: var(--rm-muted);
  }
  .step-chevron {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    line-height: 1;
  }
  .step-panel {
    border-top: 1px solid var(--rm-border);
    padding: var(--space-3);
    background: color-mix(in oklab, var(--rm-surface-raised) 72%, transparent);
  }
  .step-panel-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    margin-bottom: var(--space-2);
  }
  .step-edit-form {
    margin-bottom: 0;
  }
  .checkbox-field {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-sm);
    color: var(--rm-text);
    min-height: 2.4rem;
  }
  .step-edit-actions {
    display: flex;
    gap: var(--space-1);
    align-items: center;
  }
  .policy-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .policy-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--rm-border);
    font-size: var(--text-sm);
    color: var(--rm-text);
  }
  .muted {
    font-size: var(--text-sm);
    color: var(--rm-dim);
    margin-top: var(--space-2);
  }
  .error-msg {
    color: var(--coral-alert);
    font-size: var(--text-sm);
  }
  .lifecycle-warning {
    background: var(--rm-surface-raised);
    border: 1px solid var(--coral-alert);
    border-radius: var(--rm-radius);
    padding: var(--space-3);
    margin-bottom: var(--space-4);
    font-size: var(--text-sm);
  }
  .lifecycle-warning ul {
    margin: var(--space-2) 0 0;
    padding-left: var(--space-5);
  }
  .lifecycle-warning li {
    margin-bottom: var(--space-1);
  }
  .lifecycle-state {
    color: var(--rm-muted);
  }
</style>
