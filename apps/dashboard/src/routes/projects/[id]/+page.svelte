<script lang="ts">
  import { base } from "$app/paths";
  import { invalidateAll } from "$app/navigation";

  export let data: {
    project: { id: string; name: string } | null;
    keys: { id: string; keyPrefix: string }[];
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

{#if !data.project}
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
  </section>

  <p><a href={base + "/projects/" + data.project.id + "/usage"}>Usage (placeholder)</a></p>
{/if}

<style>
  .page-title {
    font-family: var(--rm-font-display);
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 0.5rem;
  }
  .page-desc {
    color: var(--rm-muted);
    font-size: 0.875rem;
    margin: 0 0 1rem;
  }
  .section {
    margin-bottom: 1.5rem;
  }
  .section-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 0.25rem;
  }
  .section-desc {
    color: var(--rm-muted);
    font-size: 0.8125rem;
    margin: 0 0 0.75rem;
  }
  .new-key-box {
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: 1rem;
    margin-bottom: 0.75rem;
  }
  .new-key-label {
    font-size: 0.75rem;
    color: var(--rm-dim);
    margin: 0 0 0.25rem;
  }
  .new-key-value {
    font-size: 0.8125rem;
    word-break: break-all;
    display: block;
    margin-bottom: 0.5rem;
  }
  .btn {
    padding: 0.5rem 1rem;
    border-radius: var(--rm-radius);
    font-size: 0.875rem;
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
    color: #c95c5c;
    border-color: #c95c5c;
  }
  .key-list {
    list-style: none;
    padding: 0;
    margin: 1rem 0 0;
  }
  .key-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--rm-border);
  }
  .key-prefix {
    font-size: 0.8125rem;
    color: var(--rm-muted);
  }
  .error {
    color: #c95c5c;
  }
</style>
