<script lang="ts">
  /**
   * Download link for the provenance trace of the most recent graph-grounded query (Stage 4B).
   * Points at the public GET /connect/v1/traces/{traceId}/export endpoint (same-origin, session
   * cookie applies). Renders nothing until a trace exists.
   */
  export let href: string | null = null;
  export let label = "Export trace";
</script>

{#if href}
  <a class="export-trace brut-focus" {href} download data-testid="export-trace-link">
    <span class="export-trace-icon" aria-hidden="true">↓</span>
    <span class="export-trace-label">{label}</span>
    <span class="export-trace-meta">most recent query</span>
  </a>
{/if}

<style>
  .export-trace {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    align-self: flex-start;
    padding: var(--space-2) var(--space-3);
    border: var(--border);
    background: var(--color-surface);
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    text-decoration: none;
  }
  .export-trace:hover {
    background: var(--color-yellow);
  }
  .export-trace-icon {
    font-weight: 900;
  }
  .export-trace-meta {
    color: var(--color-ink-faint);
    font-weight: 400;
    text-transform: none;
  }
</style>
