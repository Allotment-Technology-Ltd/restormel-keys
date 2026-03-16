<script lang="ts">
  import { base } from "$app/paths";
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

  let creating = false;
  let createError = "";
  let createName = "";
  let createType = "model_allowlist";

  async function createPolicy() {
    if (!createName.trim()) {
      createError = "Name is required.";
      return;
    }
    creating = true;
    createError = "";
    try {
      const res = await fetch(`${base}/api/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName.trim(), type: createType }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.data?.id) {
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
</script>

<h1 class="page-title">Policies</h1>
<p class="page-desc">
  Policies control model and provider allowlists/denylists, deprecated-model blocks, and budget or token caps. Bind policies to workspace, project, environment, or route. Canonical nouns: policy, policy binding, rule definition.
</p>

{#if data.error}
  <p class="error-msg" role="alert">{data.error}</p>
{:else}
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
      </div>
      <button type="submit" class="btn btn-primary" disabled={creating}>
        {creating ? "Creating…" : "Create policy"}
      </button>
    </form>
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
            <a href={base + "/policies/" + p.id} class="policy-link">
              <span class="policy-name">{p.name}</span>
              <span class="policy-meta">{p.type} · {p.status}</span>
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
  .policy-meta {
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  .error-msg {
    color: var(--coral-alert);
    font-size: var(--text-sm);
  }
</style>
