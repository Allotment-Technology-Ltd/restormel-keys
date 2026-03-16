<script lang="ts">
  import { base } from "$app/paths";

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

<h1 class="page-title">Audit log</h1>
<p class="page-desc">
  Recent key and configuration changes in your workspace. Use this to see who created or revoked Gateway keys and other events.
</p>

{#if data.error}
  <p class="error-msg" role="alert">{data.error}</p>
{:else if data.events.length === 0}
  <p class="empty-msg">No audit events yet. Key creation and revokes will appear here.</p>
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

<p><a href={base + "/access"} class="back-link">← Back to Access</a></p>

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
  .back-link {
    font-size: var(--text-sm);
    color: var(--rm-sage);
    margin-top: var(--space-4);
    display: inline-block;
  }
  .back-link:hover {
    text-decoration: underline;
  }
</style>
