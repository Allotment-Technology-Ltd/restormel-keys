<script lang="ts">
  /**
   * R5: Prove / Audit tab — moved from /access/audit (D5 approved).
   * Audit log is a proof artefact: key creation, revokes, and config changes
   * form part of the chain of custody an external auditor reviews.
   * /access/audit 308-redirects here. The /access page keeps its deep link.
   */
  export let data: {
    events: {
      id: string;
      eventType: string;
      targetType: string;
      targetId: string;
      summary?: string | null;
      createdAt: number;
      actorType: string;
    }[];
    error: string | null;
  };

  function formatDate(ts: number) {
    return new Date(ts).toLocaleString();
  }
</script>

<svelte:head>
  <title>Prove — Audit – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<h1 class="page-title">Audit log</h1>
<p class="page-desc">
  Key and configuration changes in your workspace — who created or revoked Gateway keys, project updates, and other
  control-plane events. This log is an evidentiary record: it shows what changed, when, and by whom.
</p>

{#if data.error}
  <p class="error-msg" role="alert">{data.error}</p>
{:else if data.events.length === 0}
  <p class="empty-msg">No audit events yet. Key creation, revokes, and configuration changes will appear here.</p>
{:else}
  <ul class="audit-list">
    {#each data.events as evt}
      <li class="audit-row">
        <span class="audit-time" title={formatDate(evt.createdAt)}>{formatDate(evt.createdAt)}</span>
        <span class="audit-summary">{evt.summary ?? `${evt.eventType} — ${evt.targetType}`}</span>
        <span class="audit-meta">{evt.actorType} · {evt.targetType}</span>
      </li>
    {/each}
  </ul>
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
    max-width: 46rem;
  }
  .error-msg {
    color: var(--coral-alert);
    font-size: var(--text-sm);
  }
  .empty-msg {
    color: var(--rm-dim);
    font-size: var(--text-sm);
  }
  .audit-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .audit-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--space-3);
    align-items: baseline;
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--rm-border);
    font-size: var(--text-sm);
  }
  .audit-time {
    color: var(--rm-dim);
    white-space: nowrap;
  }
  .audit-summary {
    color: var(--rm-text);
  }
  .audit-meta {
    color: var(--rm-muted);
    font-size: var(--text-xs);
  }
</style>
