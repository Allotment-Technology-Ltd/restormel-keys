<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { invalidateAll } from "$app/navigation";

  export let data: {
    projects: { id: string; name: string }[];
    initialUserCode: string;
  };

  let userCode = data.initialUserCode;
  let projectId = data.projects[0]?.id ?? "";
  let submitting = false;
  let message = "";
  let errorMsg = "";

  $: projectId =
    data.projects.length && !data.projects.some((p) => p.id === projectId)
      ? data.projects[0].id
      : projectId;

  async function authorize() {
    errorMsg = "";
    message = "";
    submitting = true;
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/cli/device/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userCode, projectId }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        message = "CLI authorized. You can close this tab and return to your terminal.";
        await invalidateAll();
      } else {
        errorMsg = (body as { error?: string }).error ?? `Failed (${res.status})`;
      }
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : "Request failed";
    } finally {
      submitting = false;
    }
  }
</script>

<h1 class="page-title">Connect CLI</h1>
<p class="page-desc">
  Approve a <strong>device login</strong> from the Restormel Keys CLI. This creates a new <strong>Gateway key</strong> for the project you select. The key is delivered once to your terminal — the same as creating a key in Access.
</p>

{#if data.projects.length === 0}
  <p class="muted"><a href={DASHBOARD_BASE + "/projects"}>Create a project</a> first.</p>
{:else}
  {#if message}
    <p class="success" role="status">{message}</p>
  {/if}
  {#if errorMsg}
    <p class="err" role="alert">{errorMsg}</p>
  {/if}

  <form
    class="form"
    onsubmit={(e) => {
      e.preventDefault();
      authorize();
    }}
  >
    <label for="user-code">User code (from terminal)</label>
    <input
      id="user-code"
      class="input"
      type="text"
      autocomplete="one-time-code"
      bind:value={userCode}
      placeholder="XXXX-XXXX"
      disabled={submitting}
    />

    <label for="project-select">Project</label>
    <select id="project-select" class="input" bind:value={projectId} disabled={submitting}>
      {#each data.projects as p}
        <option value={p.id}>{p.name}</option>
      {/each}
    </select>

    <button type="submit" class="btn" disabled={submitting || !userCode.trim()}>
      {submitting ? "Authorizing…" : "Authorize CLI"}
    </button>
  </form>
{/if}

<p class="muted small">
  <a href={DASHBOARD_BASE + "/access"}>Access &amp; keys</a>
  ·
  <a href={DASHBOARD_BASE + "/dev-tools/cli"}>CLI docs</a>
</p>

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
    max-width: 40rem;
    line-height: 1.5;
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-width: 22rem;
    margin-bottom: var(--space-4);
  }
  label {
    font-size: var(--text-xs);
    color: var(--rm-dim);
  }
  .input {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--rm-radius);
    border: var(--border-thin);
    background: var(--rm-bg);
    color: var(--rm-text);
    font-size: var(--text-sm);
  }
  .btn {
    margin-top: var(--space-2);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--rm-radius);
    border: none;
    background: var(--color-yellow);
    color: var(--color-ink);
    font-weight: 600;
    cursor: pointer;
    font-size: var(--text-sm);
  }
  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .success {
    color: var(--rm-sage);
    font-size: var(--text-sm);
  }
  .err {
    color: var(--coral-alert);
    font-size: var(--text-sm);
  }
  .muted {
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .muted.small {
    font-size: var(--text-xs);
  }
  .muted a {
    color: var(--rm-sage);
  }
</style>
