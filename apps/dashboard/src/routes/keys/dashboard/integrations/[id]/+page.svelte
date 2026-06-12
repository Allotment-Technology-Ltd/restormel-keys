<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
  import type { IntegrationDetail } from "./+page.server";

  export let data: {
    integration: IntegrationDetail | null;
    bindings: { id: string; projectId: string; environmentId: string | null; status: string }[];
    projects: { id: string; name: string }[];
    error: string | null;
  };

  let verifying = false;
  let verifyError = "";
  let verifyOkMsg = "";
  /** Indeterminate probe outcomes (network blip, rate limit): not an error, not a success. */
  let verifyWarnMsg = "";
  let addBindingProjectId = data.projects[0]?.id ?? "";
  let addingBinding = false;
  let addBindingError = "";
  let removingBindingId: string | null = null;
  let deletingIntegration = false;
  let deleteError = "";
  let importBusy = false;
  let importError = "";
  let importOk = "";
  let importFile: File | null = null;

  $: addBindingProjectId = data.projects.length && !addBindingProjectId
    ? data.projects[0].id
    : addBindingProjectId;
  $: gatewayProvidersOn = ($page.data.moduleFlags ?? MVP_MODULE_DEFAULTS).gatewayProviders;

  function projectName(projectId: string): string {
    return data.projects.find((p) => p.id === projectId)?.name ?? projectId;
  }

  function formatLastVerified(ts: number | null): string {
    if (ts == null) return "Never";
    return new Date(ts).toLocaleString();
  }

  function integrationTone(status: string): "success" | "warning" | "error" | "muted" {
    if (status === "active") return "success";
    if (status === "paused") return "warning";
    if (status === "revoked") return "error";
    return "muted";
  }

  function verificationTone(status: string): "success" | "warning" | "error" | "muted" {
    if (status === "verified") return "success";
    if (status === "failed") return "error";
    if (status === "pending") return "warning";
    return "muted";
  }

  function verificationLabel(status: string): string {
    if (status === "reference_only") return "reference only";
    return status;
  }

  async function verify() {
    if (!data.integration) return;
    verifying = true;
    verifyError = "";
    verifyOkMsg = "";
    verifyWarnMsg = "";
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/integrations/${data.integration.id}/verify`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        const payload = (body as { data?: { verificationDetail?: string; resultKind?: string } }).data;
        const detail = payload?.verificationDetail ?? "Verification updated.";
        const kind = payload?.resultKind ?? "";
        if (kind === "valid") {
          verifyOkMsg = detail;
        } else if (kind === "invalid_credentials" || kind === "no_credential") {
          verifyError = detail;
        } else {
          // network_error / credential_unavailable / reference_only / unsupported_provider:
          // indeterminate or informational — never styled as "your key is bad".
          verifyWarnMsg = detail;
        }
        await invalidateAll();
      } else if (res.status === 429) {
        verifyWarnMsg =
          (body as { message?: string }).message ?? "Verification was run too recently. Try again shortly.";
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
      const res = await fetch(`${DASHBOARD_BASE}/api/integrations/${data.integration.id}/bindings`, {
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
        `${DASHBOARD_BASE}/api/integrations/${data.integration.id}/bindings/${bindingId}`,
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
      const res = await fetch(`${DASHBOARD_BASE}/api/integrations/${data.integration.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        window.location.href = DASHBOARD_BASE + "/integrations";
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

  async function importOpenRouterActivity() {
    if (!data.integration) return;
    importBusy = true;
    importError = "";
    importOk = "";
    try {
      if (!importFile) {
        importError = "Choose a JSON export file first.";
        return;
      }
      const form = new FormData();
      form.set("file", importFile);
      const res = await fetch(`${DASHBOARD_BASE}/api/integrations/${data.integration.id}/import/openrouter-activity`, {
        method: "POST",
        body: form,
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        importOk = `Imported ${body?.data?.importedRows ?? 0} day rows into Usage aggregates.`;
        await invalidateAll();
      } else {
        importError = (body as { error?: string }).error ?? `Import failed (${res.status})`;
      }
    } catch (e) {
      importError = e instanceof Error ? e.message : "Import failed";
    } finally {
      importBusy = false;
    }
  }
</script>

{#if data.error || !data.integration}
  <p class="error-msg" role="alert">{data.error ?? "Integration not found."}</p>
  <p><a href={DASHBOARD_BASE + "/integrations"} class="back-link">← Back to Connections</a></p>
{:else}
  <p><a href={DASHBOARD_BASE + "/integrations"} class="back-link">← Back to Integrations</a></p>
  <h1 class="page-title">{data.integration.displayName || data.integration.providerType}</h1>
  <p class="page-desc">
    {data.integration.providerType} integration. Hosted keys are encrypted at rest; only masked labels are shown. Raw secrets are never displayed after save.
  </p>

  <section class="section" aria-labelledby="status-heading">
    <h2 id="status-heading" class="section-title">Status & verification</h2>
    <p class="section-desc">
      Status: <strong class={`status-${integrationTone(data.integration.status)}`}>{data.integration.status}</strong>
      {#if data.integration.verificationStatus}
        · Verification: <span class={`status-${verificationTone(data.integration.verificationStatus)}`}>{verificationLabel(data.integration.verificationStatus)}</span>
      {/if}
      {#if data.integration.referenceOnly}
        · <span class="reference-badge">reference only — cannot be verified or executed by Restormel</span>
      {:else if data.integration.credentialMasked}
        · {data.integration.credentialMasked}
      {:else if data.integration.hasCredential}
        · Credential reference or hosted key is set
      {:else}
        · No credential configured
      {/if}
    </p>
    <p class="verified-row">
      Last verified: {formatLastVerified(data.integration.lastVerifiedAt)}
      <button type="button" class="btn btn-secondary" onclick={verify} disabled={verifying}>
        {verifying ? "Verifying…" : "Verify now"}
      </button>
    </p>
    {#if !verifying && !verifyError && !verifyOkMsg && !verifyWarnMsg && data.integration.lastVerificationDetail}
      <p class="muted verify-ok">{data.integration.lastVerificationDetail}</p>
    {/if}
    {#if verifyError}
      <p class="error-msg" role="alert">{verifyError}</p>
    {/if}
    {#if verifyWarnMsg}
      <p class="warn-msg" role="status">{verifyWarnMsg}</p>
    {/if}
    {#if verifyOkMsg}
      <p class="ok-msg verify-ok" role="status">{verifyOkMsg}</p>
    {/if}
  </section>

  {#if data.integration.usageModelIds.length > 0}
    <section class="section" aria-labelledby="usage-models-heading">
      <h2 id="usage-models-heading" class="section-title">Models in usage aggregates</h2>
      <p class="section-desc muted">
        Model IDs recently recorded for this provider in workspace usage data (imported or logged traffic).
      </p>
      <ul class="model-chip-list">
        {#each data.integration.usageModelIds as mid}
          <li>
            <a href={DASHBOARD_BASE + "/models/" + encodeURIComponent(mid)} class="mix-link">{mid}</a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

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

  {#if gatewayProvidersOn}
  <section class="section" aria-labelledby="import-heading">
    <h2 id="import-heading" class="section-title">Import data</h2>
    <p class="section-desc">
      Bring gateway data into Restormel analytics without changing your execution path. Start with exports; add automated sync later.
    </p>

    <div class="import-card">
      <h3 class="import-title">OpenRouter — Activity export (JSON)</h3>
      <p class="import-desc">
        Imports daily usage aggregates (requests, tokens, spend) from OpenRouter’s activity data into Restormel’s <em>Usage aggregates</em>.
        This does not import request-level logs.
      </p>
      <p class="import-links">
        <a href="/keys/docs/guides/openrouter" target="_blank" rel="noopener noreferrer">Guide</a>
        <span class="dot">·</span>
        <a href="/keys/docs/guides/provider-access-modes" target="_blank" rel="noopener noreferrer">Provider access modes</a>
      </p>

      {#if importError}
        <p class="error-msg" role="alert">{importError}</p>
      {/if}
      {#if importOk}
        <p class="ok-msg" role="status">{importOk}</p>
      {/if}

      <div class="import-row">
        <input
          type="file"
          class="file"
          accept="application/json,.json"
          onchange={(e) => {
            const f = (e.currentTarget as HTMLInputElement).files?.[0] ?? null;
            importFile = f;
          }}
          aria-label="Choose OpenRouter activity JSON file"
          disabled={importBusy}
        />
        <button type="button" class="btn btn-secondary" onclick={importOpenRouterActivity} disabled={importBusy}>
          {importBusy ? "Importing…" : "Import OpenRouter activity"}
        </button>
      </div>
      <p class="import-note">Tip: if you don’t have an export file handy, you can fetch activity via OpenRouter’s API and save the JSON, then upload it here.</p>
    </div>
  </section>
  {/if}

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
  .model-chip-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .model-chip-list li {
    margin: 0;
  }
  .verify-ok {
    margin-top: var(--space-2);
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
  .ok-msg {
    color: var(--rm-sage);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-2);
  }
  .warn-msg {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: var(--space-2) 0 0;
  }
  .reference-badge {
    display: inline-block;
    font-size: var(--text-xs);
    color: var(--rm-muted);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: 0 var(--space-2);
    text-transform: uppercase;
    letter-spacing: 0.03em;
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

  .import-card {
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface);
    padding: var(--space-4);
    max-width: var(--rm-container-narrow, 36rem);
  }
  .import-title {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--rm-text);
  }
  .import-desc {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .import-links {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    color: var(--rm-dim);
  }
  .import-links a {
    color: var(--rm-sage);
    font-weight: 500;
    text-decoration: none;
  }
  .import-links a:hover {
    text-decoration: underline;
  }
  .dot {
    margin: 0 var(--space-2);
  }
  .import-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
    margin: 0 0 var(--space-2);
  }
  .file {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .import-note {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--rm-dim);
    font-style: italic;
  }
</style>
