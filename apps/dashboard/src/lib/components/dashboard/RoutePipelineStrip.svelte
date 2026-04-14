<script lang="ts">
  /** Ordered steps for read-only pipeline visualization */
  export let steps: {
    id: string;
    orderIndex: number;
    providerPreference: string | null;
    modelId: string | null;
    enabled: boolean;
    label?: string | null;
    /** When true, step has a model pool configured (Phase F). */
    isPool?: boolean;
  }[];
</script>

{#if steps.length === 0}
  <p class="pipeline-empty">No steps yet — add a provider step below.</p>
{:else}
  <div class="pipeline-strip" role="list" aria-label="Route resolution order">
    {#each steps as step, i}
      <div class="pipeline-node" class:pipeline-node-off={!step.enabled} role="listitem">
        <span class="pipeline-idx">{i + 1}</span>
        <div class="pipeline-body">
          {#if step.isPool}
            <span class="pipeline-pool-badge" title="Model pool">Pool</span>
          {/if}
          <span class="pipeline-model">{step.modelId ?? "—"}</span>
          <span class="pipeline-meta">{step.providerPreference ?? "provider"}</span>
          {#if step.label}
            <span class="pipeline-label">{step.label}</span>
          {/if}
        </div>
      </div>
      {#if i < steps.length - 1}
        <span class="pipeline-arrow" aria-hidden="true">→</span>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .pipeline-empty {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .pipeline-strip {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: var(--space-2);
    margin: 0 0 var(--space-4);
  }
  .pipeline-node {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface);
    min-width: 8rem;
  }
  .pipeline-node-off {
    opacity: 0.55;
  }
  .pipeline-idx {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--rm-muted);
    min-width: 1.25rem;
  }
  .pipeline-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .pipeline-model {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--rm-text);
    word-break: break-word;
  }
  .pipeline-pool-badge {
    display: inline-block;
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--rm-sage);
    margin-bottom: 2px;
  }
  .pipeline-meta {
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  .pipeline-label {
    font-size: var(--text-xs);
    color: var(--rm-sage);
  }
  .pipeline-arrow {
    color: var(--rm-muted);
    font-size: var(--text-lg);
    padding: 0 var(--space-1);
  }
</style>
