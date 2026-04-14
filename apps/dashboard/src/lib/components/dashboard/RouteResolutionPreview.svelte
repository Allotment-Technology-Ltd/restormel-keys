<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";

  export let projectId: string;
  export let routeId: string;
  export let environmentId: string;

  let explainLoading = false;
  let explainError = "";
  let explainJson: string | null = null;
  let simulateLoading = false;
  let simulateError = "";
  let simulateJson: string | null = null;
  let expanded = false;

  async function loadExplainChain() {
    explainLoading = true;
    explainError = "";
    explainJson = null;
    try {
      const res = await fetch(
        `${DASHBOARD_BASE}/api/projects/${projectId}/routes/${routeId}/explain-chain`,
        { credentials: "include" }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        explainError = (body as { error?: string }).error ?? `Request failed (${res.status})`;
        return;
      }
      explainJson = JSON.stringify(body, null, 2);
    } catch (e) {
      explainError = e instanceof Error ? e.message : "Request failed";
    } finally {
      explainLoading = false;
    }
  }

  async function runSimulate() {
    simulateLoading = true;
    simulateError = "";
    simulateJson = null;
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${projectId}/routes/${routeId}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          environmentId,
          includeStepDiagnostics: true,
          includeRoutingAttempts: true,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        simulateError =
          (body as { error?: string; detail?: string }).detail ??
          (body as { error?: string }).error ??
          `Request failed (${res.status})`;
        return;
      }
      simulateJson = JSON.stringify(body, null, 2);
    } catch (e) {
      simulateError = e instanceof Error ? e.message : "Request failed";
    } finally {
      simulateLoading = false;
    }
  }
</script>

<section class="preview-section" aria-labelledby="preview-heading">
  <div class="preview-head">
    <h2 id="preview-heading" class="preview-title">Resolution preview</h2>
    <button
      type="button"
      class="preview-toggle"
      aria-expanded={expanded}
      onclick={() => (expanded = !expanded)}
    >
      {expanded ? "Hide" : "Show"} dry-run tools
    </button>
  </div>
  <p class="preview-desc">
    Read-only views of the same control-plane data your workers use — no LLM calls. Uses environment
    <code class="inline-code">{environmentId}</code>.
  </p>
  {#if expanded}
    <div class="preview-actions">
      <button type="button" class="btn btn-secondary" disabled={explainLoading} onclick={loadExplainChain}>
        {explainLoading ? "Loading…" : "Load explain-chain"}
      </button>
      <button type="button" class="btn btn-secondary" disabled={simulateLoading} onclick={runSimulate}>
        {simulateLoading ? "Running…" : "Run simulate"}
      </button>
    </div>
    {#if explainError}
      <p class="error-msg" role="alert">{explainError}</p>
    {/if}
    {#if explainJson}
      <details class="preview-details">
        <summary>Explain-chain JSON</summary>
        <pre class="preview-pre">{explainJson}</pre>
      </details>
    {/if}
    {#if simulateError}
      <p class="error-msg" role="alert">{simulateError}</p>
    {/if}
    {#if simulateJson}
      <details class="preview-details">
        <summary>Simulate JSON</summary>
        <pre class="preview-pre">{simulateJson}</pre>
      </details>
    {/if}
  {/if}
</section>

<style>
  .preview-section {
    margin-bottom: var(--space-6);
    padding: var(--space-4);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface-elevated, var(--rm-surface));
  }
  .preview-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }
  .preview-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-lg);
    margin: 0;
    font-weight: 600;
  }
  .preview-toggle {
    font-size: var(--text-sm);
    color: var(--rm-sage);
    background: none;
    border: none;
    cursor: pointer;
    text-decoration: underline;
  }
  .preview-desc {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-3);
  }
  .inline-code {
    font-family: var(--rm-font-ui);
    font-size: 0.9em;
  }
  .preview-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }
  .preview-details {
    margin-top: var(--space-2);
    font-size: var(--text-sm);
  }
  .preview-pre {
    margin: var(--space-2) 0 0;
    padding: var(--space-3);
    max-height: 20rem;
    overflow: auto;
    font-size: var(--text-xs);
    background: var(--rm-bg);
    border-radius: var(--radius-sm);
    border: 1px solid var(--rm-border);
  }
  .error-msg {
    color: var(--coral-alert, #c45c4a);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-2);
  }
</style>
