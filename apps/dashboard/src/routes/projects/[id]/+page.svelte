<script lang="ts">
  import { base } from "$app/paths";
  import { invalidateAll } from "$app/navigation";
  import EmptyState from "$lib/components/EmptyState.svelte";

  export let data: {
    project: { id: string; name: string } | null;
    keys: { id: string; keyPrefix: string }[];
    error?: string | null;
  };

  let generating = false;
  let newKeyRaw: string | null = null;
  let copied = false;

  async function generateKey() {
    if (!data.project) return;
    generating = true;
    newKeyRaw = null;
    try {
      const res = await fetch(`${base}/api/projects/${data.project.id}/keys`, { method: "POST" });
      if (res.ok) {
        const { data: out } = await res.json();
        newKeyRaw = out.rawKey;
        await invalidateAll();
      }
    } finally {
      generating = false;
    }
  }

  function copyKey() {
    if (!newKeyRaw) return;
    navigator.clipboard.writeText(newKeyRaw);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  async function revokeKey(keyId: string) {
    if (!data.project || !confirm("Revoke this API key? It will stop working immediately.")) return;
    await fetch(`${base}/api/projects/${data.project.id}/keys`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyId }),
    });
    await invalidateAll();
  }
</script>

{#if data.error}
  <p class="error" role="alert">{data.error}</p>
{:else if !data.project}
  <p class="error">Project not found.</p>
{:else}
  <h1 class="page-title">{data.project.name}</h1>
  <p class="page-desc">Project detail. API keys are scoped to this project.</p>

  <section class="section">
    <h2 class="section-title">API keys</h2>
    <p class="section-desc">Generate an API key to use the Cloud API. Copy the key when created; we won’t show it again.</p>

    {#if newKeyRaw}
      <div class="new-key-box">
        <p class="new-key-label">New key (copy now):</p>
        <code class="new-key-value">{newKeyRaw}</code>
        <button class="btn btn-secondary" onclick={copyKey}>{copied ? "Copied" : "Copy"}</button>
      </div>
    {/if}

    {#if data.keys.length === 0 && !newKeyRaw}
      <EmptyState
        title="No API keys yet"
        description="Generate an API key to use the Cloud API. Copy it when created; we won’t show it again."
      >
        <button class="btn btn-primary" onclick={generateKey} disabled={generating}>
          {generating ? "Generating…" : "Generate API key"}
        </button>
      </EmptyState>
    {:else}
      <button class="btn btn-primary" onclick={generateKey} disabled={generating}>
        {generating ? "Generating…" : "Generate API key"}
      </button>

      {#if data.keys.length > 0}
        <ul class="key-list">
          {#each data.keys as k}
            <li class="key-row">
              <code class="key-prefix">{k.keyPrefix}</code>
              <button type="button" class="btn btn-danger" onclick={() => revokeKey(k.id)}>Revoke</button>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </section>

  <p><a href={base + "/projects/" + data.project.id + "/usage"}>Usage (placeholder)</a></p>
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
  .new-key-box {
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-4);
    margin-bottom: var(--space-3);
  }
  .new-key-label {
    font-size: var(--text-xs);
    color: var(--rm-dim);
    margin: 0 0 var(--space-1);
  }
  .new-key-value {
    font-size: var(--text-sm);
    word-break: break-all;
    display: block;
    margin-bottom: var(--space-2);
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
  .btn-danger:hover {
    color: var(--coral-alert);
    border-color: var(--coral-alert);
  }
  .key-list {
    list-style: none;
    padding: 0;
    margin: var(--space-4) 0 0;
  }
  .key-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--rm-border);
  }
  .key-prefix {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .error {
    color: var(--coral-alert);
    font-size: var(--text-sm);
  }
</style>
