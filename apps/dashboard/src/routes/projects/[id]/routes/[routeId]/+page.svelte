<script lang="ts">
  import { base } from "$app/paths";
  import { invalidateAll } from "$app/navigation";

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

  $: if (data.route) {
    editName = data.route.name;
    editStatus = data.route.status;
    editBillingMode = data.route.billingMode ?? "";
    editRouteMode = data.route.routeMode ?? "";
  }

  async function saveRoute() {
    if (!data.project || !data.route) return;
    saving = true;
    saveError = "";
    try {
      const res = await fetch(`${base}/api/projects/${data.project.id}/routes/${data.route.id}`, {
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
</script>

{#if data.error || !data.route || !data.project}
  <p class="error-msg" role="alert">{data.error ?? "Route not found."}</p>
  <p><a href={base + "/routes"} class="back-link">← Back to Routes</a></p>
{:else}
  <p>
    <a href={base + "/projects/" + data.project.id + "/routes"} class="back-link">← Routes · {data.project.name}</a>
  </p>
  <h1 class="page-title">{data.route.name}</h1>
  <p class="page-desc">
    Route status, billing mode, and fallback behaviour. Steps define the resolution order and fallback chain.
  </p>

  {#if data.modelLifecycleWarnings?.length > 0}
    <div class="lifecycle-warning" role="alert">
      <strong>Models in this route are deprecated or retiring.</strong>
      <ul>
        {#each data.modelLifecycleWarnings as m}
          <li>
            <a href={base + "/models/" + m.id}>{m.canonicalName}</a>
            {#if m.lifecycleState}<span class="lifecycle-state">({m.lifecycleState})</span>{/if}
            {#if m.replacementModelId}
              — consider <a href={base + "/models/" + m.replacementModelId}>replacement model</a>
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
        <label for="billing">Billing mode</label>
        <select id="billing" bind:value={editBillingMode} class="input">
          <option value="">—</option>
          <option value="pass_through">Pass through</option>
          <option value="metered">Metered</option>
        </select>
      </div>
      <div class="form-row">
        <label for="routeMode">Route mode (fallback behaviour)</label>
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
    <h2 id="fallback-heading" class="section-title">Fallback / steps</h2>
    <p class="section-desc">
      Steps define the resolution order. If a step fails or times out, the next step is used (fallback). This is the simple fallback configuration; full step editing can be wired to the steps API.
    </p>
    {#if data.steps.length === 0}
      <p class="muted">No steps yet. Add steps via the API or a future step editor to define provider preference and fallback chain.</p>
    {:else}
      <ol class="steps-list">
        {#each data.steps as step}
          <li class="step-row">
            <span class="step-order">{step.orderIndex + 1}</span>
            <span class="step-detail">
              {#if step.modelId}{step.modelId}{/if}
              {#if step.providerPreference} · {step.providerPreference}{/if}
              {#if step.fallbackOn} · fallback: {step.fallbackOn}{/if}
              {#if step.timeoutMs != null} · timeout {step.timeoutMs}ms{/if}
              {#if !step.enabled} · disabled{/if}
            </span>
          </li>
        {/each}
      </ol>
    {/if}
  </section>

  <section class="section">
    <h2 class="section-title">Logs</h2>
    <p class="section-desc">Request and trace logs for this route.</p>
    <a href={base + "/logs"} class="btn btn-secondary">Open Logs & Traces</a>
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
  .config-form {
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
  .steps-list {
    list-style: none;
    padding: 0;
    margin: 0;
    counter-reset: step;
  }
  .step-row {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--rm-border);
    font-size: var(--text-sm);
  }
  .step-row::before {
    counter-increment: step;
    content: counter(step);
    font-weight: 600;
    color: var(--rm-muted);
    min-width: 1.5rem;
  }
  .step-detail {
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
