<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { invalidateAll } from "$app/navigation";

  export let data: {
    policy: {
      id: string;
      name: string;
      type: string;
      status: string;
      ruleDefinition: Record<string, unknown> | null;
    } | null;
    bindings: { id: string; targetType: string; targetId: string }[];
    error: string | null;
  };

  let saving = false;
  let saveError = "";
  let editStatus = data.policy?.status ?? "active";

  $: if (data.policy) editStatus = data.policy.status;

  async function saveStatus() {
    if (!data.policy) return;
    saving = true;
    saveError = "";
    try {
      const res = await fetch(`${base}/api/policies/${data.policy.id}`, {
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
  <p><a href={DASHBOARD_BASE + "/policies"} class="back-link">← Back to Policies</a></p>
{:else}
  <p><a href={DASHBOARD_BASE + "/policies"} class="back-link">← Back to Policies</a></p>
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

  <section class="section">
    <h2 class="section-title">Bindings</h2>
    <p class="section-desc">
      Bindings attach this policy to a target (workspace, project, environment, route). Impacted objects depend on the target.
    </p>
    {#if data.bindings.length === 0}
      <p class="muted">No bindings. Use POST /api/policies/{data.policy.id}/bindings to add (targetType, targetId).</p>
    {:else}
      <ul class="binding-list">
        {#each data.bindings as b}
          <li class="binding-row">{b.targetType} → {b.targetId}</li>
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
  .btn-primary {
    background: var(--rm-sage);
    color: var(--rm-bg);
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
</style>
