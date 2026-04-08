<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";

  export let data: {
    testingProject: { id: string; name: string; workspaceId: string | null; isRestormelTesting?: boolean } | null;
    environments: Array<{ id: string; name: string; type: string }>;
    gatewayKeys: Array<{ id: string; keyPrefix: string }>;
    controlPlaneHint: string;
    loadError?: string;
  };

  $: envSnippet =
    data.testingProject != null
      ? `RESTORMEL_KEYS_API_BASE_URL=https://your-site.example
RESTORMEL_KEYS_API_TOKEN=rk_…your_gateway_key
RESTORMEL_PROJECT_ID=${data.testingProject.id}`
      : "";
</script>

<svelte:head>
  <title>Restormel Testing – Restormel Keys</title>
</svelte:head>

<div class="testing-hub">
  <h1 class="h1">Restormel Testing</h1>
  <p class="lede">
    This workspace includes a <strong>Restormel Testing</strong> project with Development and Production environments. Add provider API keys under
    <a href={DASHBOARD_BASE + "/integrations"}>Connections</a> — they are encrypted at rest — then use a
    <a href={DASHBOARD_BASE + "/access"}>Gateway key</a> with the Testing CLI so <code>judge_rubric</code> and resolve can use your models.
  </p>

  {#if data.loadError}
    <p class="err" role="alert">{data.loadError}</p>
  {/if}

  {#if data.testingProject}
    <section class="card" aria-labelledby="proj-heading">
      <h2 id="proj-heading" class="h2">Project</h2>
      <dl class="kv">
        <dt>Project ID</dt>
        <dd><code class="mono">{data.testingProject.id}</code></dd>
        <dt>Environments</dt>
        <dd>
          <ul class="env-list">
            {#each data.environments as e}
              <li><code class="mono">{e.id}</code> — {e.name} ({e.type})</li>
            {/each}
          </ul>
        </dd>
      </dl>
    </section>

    <section class="card" aria-labelledby="env-heading">
      <h2 id="env-heading" class="h2">Environment variables (CI / local)</h2>
      <p class="hint">{data.controlPlaneHint}</p>
      <pre class="snippet" role="region" aria-label="Example environment block">{envSnippet}</pre>
      <p class="muted">
        Resolve URL for the Testing runner: <code class="mono">…/v1/testing/resolve-model</code> on the same origin as <code class="mono">RESTORMEL_KEYS_API_BASE_URL</code>.
      </p>
    </section>

    <section class="card" aria-labelledby="keys-heading">
      <h2 id="keys-heading" class="h2">Gateway keys for this project</h2>
      {#if data.gatewayKeys.length === 0}
        <p>Create a Gateway key under <a href={DASHBOARD_BASE + "/access"}>Gateway keys</a>.</p>
      {:else}
        <ul class="key-list">
          {#each data.gatewayKeys as k}
            <li><code class="mono">{k.keyPrefix}…</code></li>
          {/each}
        </ul>
      {/if}
    </section>
  {:else if !data.loadError}
    <p class="muted">Sign in with a session to view your Testing project.</p>
  {/if}
</div>

<style>
  .testing-hub {
    max-width: 44rem;
    padding: var(--space-6);
  }
  .h1 {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    margin: 0 0 var(--space-4);
  }
  .h2 {
    font-size: var(--text-lg);
    margin: 0 0 var(--space-3);
  }
  .lede {
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-6);
  }
  .lede a {
    color: var(--rm-sage);
  }
  .card {
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    margin-bottom: var(--space-4);
  }
  .kv {
    display: grid;
    grid-template-columns: 8rem 1fr;
    gap: var(--space-2) var(--space-4);
    margin: 0;
  }
  .kv dt {
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .kv dd {
    margin: 0;
  }
  .mono {
    font-family: var(--rm-font-mono);
    font-size: 0.9em;
    word-break: break-all;
  }
  .snippet {
    background: var(--rm-surface-2);
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    overflow-x: auto;
    white-space: pre-wrap;
  }
  .hint,
  .muted {
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .err {
    color: var(--coral-alert);
    margin-bottom: var(--space-4);
  }
  .env-list,
  .key-list {
    margin: 0;
    padding-left: var(--space-5);
  }
</style>
