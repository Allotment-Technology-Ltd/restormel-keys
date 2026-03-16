<script lang="ts">
  import { base } from "$app/paths";
  import { invalidateAll } from "$app/navigation";
  import type { IntegrationDetail } from "./+page.server";

  export let data: {
    integration: IntegrationDetail | null;
    bindings: { id: string; projectId: string; environmentId: string | null; status: string }[];
    projects: { id: string; name: string }[];
    error: string | null;
  };

  let verifying = false;
  let verifyError = "";
  let addBindingProjectId = data.projects[0]?.id ?? "";
  let addingBinding = false;
  let addBindingError = "";
  let removingBindingId: string | null = null;
  let deletingIntegration = false;
  let deleteError = "";

  $: addBindingProjectId = data.projects.length && !addBindingProjectId
    ? data.projects[0].id
    : addBindingProjectId;

  function projectName(projectId: string): string {
    return data.projects.find((p) => p.id === projectId)?.name ?? projectId;
  }

  function formatLastVerified(ts: number | null): string {
    if (ts == null) return "Never";
    return new Date(ts).toLocaleString();
  }

  async function verify() {
    if (!data.integration) return;
    verifying = true;
    verifyError = "";
    try {
      const res = await fetch(`${base}/api/integrations/${data.integration.id}/verify`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        await invalidateAll();
      } else {
        verifyError = (body as { error?: string }).error ?? `Request failed (${res.status})`;
      }
    } catch (e) {
      verifyError = e instanceof Error ? e.message : "Request failed";
    } finally {
      verifying = false;
    }
  }

  async function addBinding() {
    if (!data.integration || !addBindingProjectId) return;
    addingBinding = true;
    addBindingError = "";
    try {
      const res = await fetch(`${base}/api/integrations/${data.integration.id}/bindings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: addBindingProjectId }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        await invalidateAll();
      } else {
        addBindingError = (body as { error?: string }).error ?? `Request failed (${res.status})`;
      }
    } catch (e) {
      addBindingError = e instanceof Error ? e.message : "Request failed";
    } finally {
      addingBinding = false;
    }
  }

  async function removeBinding(bindingId: string) {
    if (!data.integration || !confirm("Remove this binding? The project will no longer use this integration.")) return;
    removingBindingId = bindingId;
    try {
      const res = await fetch(
        `${base}/api/integrations/${data.integration.id}/bindings/${bindingId}`,
        { method: "DELETE" }
      );
      if (res.ok) await invalidateAll();
    } finally {
      removingBindingId = null;
    }
  }

  async function deleteIntegration() {
    if (!data.integration || !confirm("Delete this integration? All bindings will be removed. This cannot be undone.")) return;
    deletingIntegration = true;
    deleteError = "";
    try {
      const res = await fetch(`${base}/api/integrations/${data.integration.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        window.location.href = base + "/integrations";
      } else {
        const body = await res.json().catch(() => ({}));
        deleteError = (body as { error?: string }).error ?? `Request failed (${res.status})`;
      }
    } catch (e) {
      deleteError = e instanceof Error ? e.message : "Request failed";
    } finally {
      deletingIntegration = false;
    }
  }
</script>

{#if data.error || !data.integration}
  <p class="error-msg" role="alert">{data.error ?? "Integration not found."}</p>
  <p><a href={base + "/integrations"} class="back-link">← Back to Provider Integrations</a></p>
{:else}
  <p><a href={base + "/integrations"} class="back-link">← Back to Provider Integrations</a></p>
  <h1 class="page-title">{data.integration.displayName || data.integration.providerType}</h1>
  <p class="page-desc">
    {data.integration.providerType} integration. Credential is stored by reference only; no raw keys are shown or stored here.
  </p>

  <section class="section" aria-labelledby="status-heading">
    <h2 id="status-heading" class="section-title">Status & verification</h2>
    <p class="section-desc">
      Status: <strong>{data.integration.status}</strong>
      {#if data.integration.verificationStatus}
        · Verification: {data.integration.verificationStatus}
      {/if}
      {#if data.integration.hasCredential}
        · Credential reference is set
      {:else}
        · No credential reference
      {/if}
    </p>
    <p class="verified-row">
      Last verified: {formatLastVerified(data.integration.lastVerifiedAt)}
      <button type="button" class="btn btn-secondary" onclick={verify} disabled={verifying}>
        {verifying ? "Verifying…" : "Verify now"}
      </button>
    </p>
    {#if verifyError}
      <p class="error-msg" role="alert">{verifyError}</p>
    {/if}
  </section>

  <section class="section" aria-labelledby="bindings-heading">
    <h2 id="bindings-heading" class="section-title">Project bindings</h2>
    <p class="section-desc">
      Bind this integration to projects so routes can use it. Each binding links this provider to one project (and optionally an environment).
    </p>
    {#if addBindingError}
      <p class="error-msg" role="alert">{addBindingError}</p>
    {/if}
    {#if data.projects.length > 0}
      <form class="add-binding-form" onsubmit={(e) => { e.preventDefault(); addBinding(); }}>
        <label for="binding-project" class="sr-only">Project</label>
        <select id="binding-project" bind:value={addBindingProjectId} class="select">
          {#each data.projects as p}
            <option value={p.id}>{p.name}</option>
          {/each}
        </select>
        <button type="submit" class="btn btn-primary" disabled={addingBinding}>
          {addingBinding ? "Adding…" : "Add binding"}
        </button>
      </form>
    {:else}
      <p class="muted">Create a project first to add bindings.</p>
    {/if}
    {#if data.bindings.length === 0}
      <p class="empty-bindings">No bindings yet. Add one above to use this integration in a project.</p>
    {:else}
      <ul class="binding-list">
        {#each data.bindings as b}
          <li class="binding-row">
            <span class="binding-project">{projectName(b.projectId)}</span>
            {#if b.environmentId}
              <span class="binding-env">env: {b.environmentId}</span>
            {/if}
            <button
              type="button"
              class="btn btn-danger"
              onclick={() => removeBinding(b.id)}
              disabled={removingBindingId === b.id}
              aria-label="Remove binding for {projectName(b.projectId)}"
            >
              {removingBindingId === b.id ? "Removing…" : "Remove"}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="section" aria-labelledby="models-heading">
    <h2 id="models-heading" class="section-title">Model discovery</h2>
    <p class="section-desc">
      Discovered models for this integration will appear here. Full discovery is not yet wired.
    </p>
    <p class="placeholder-note">Model discovery summary coming soon.</p>
  </section>

  <section class="section danger-zone">
    <h2 class="section-title">Delete integration</h2>
    <p class="section-desc">
      Permanently delete this integration and all its bindings. This cannot be undone.
    </p>
    {#if deleteError}
      <p class="error-msg" role="alert">{deleteError}</p>
    {/if}
    <button
      type="button"
      class="btn btn-danger"
      onclick={deleteIntegration}
      disabled={deletingIntegration}
    >
      {deletingIntegration ? "Deleting…" : "Delete integration"}
    </button>
  </section>
{/if}

<style>
  .back-link {
    font-size: var(--text-sm);
    color: var(--rm-sage);
    margin-bottom: var(--space-4);
    display: inline-block;
  }
  .back-link:hover {
    text-decoration: underline;
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
  .verified-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .placeholder-note, .muted, .empty-bindings {
    font-size: var(--text-sm);
    color: var(--rm-dim);
    font-style: italic;
  }
  .add-binding-form {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }
  .select {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    border: 1px solid var(--rm-border);
    background: var(--rm-bg);
    color: var(--rm-text);
  }
  .binding-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .binding-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--rm-border);
  }
  .binding-project {
    font-size: var(--text-sm);
    color: var(--rm-text);
  }
  .binding-env {
    font-size: var(--text-xs);
    color: var(--rm-muted);
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
  .btn-secondary {
    background: var(--rm-surface);
    color: var(--rm-text);
    border: 1px solid var(--rm-border);
  }
  .btn-danger {
    background: transparent;
    color: var(--rm-muted);
    border: 1px solid var(--rm-border);
  }
  .btn-danger:hover:not(:disabled) {
    color: var(--coral-alert);
    border-color: var(--coral-alert);
  }
  .btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .error-msg {
    color: var(--coral-alert);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-2);
  }
  .danger-zone .section-desc {
    margin-bottom: var(--space-2);
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
</style>
