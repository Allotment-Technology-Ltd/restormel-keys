<script lang="ts">
  /** Suite product hub card — neo-brutalist v3. */
  export let title: string;
</script>

<article class="hub-card">
  <h2>{title}</h2>
  <div class="hub-card-body">
    <slot />
  </div>
</article>

<style>
  .hub-card {
    padding: var(--space-5);
    border-radius: 0;
    border: var(--border);
    background: var(--color-surface);
    box-shadow: var(--shadow-md);
  }
  .hub-card h2 {
    font-family: var(--font-display);
    font-size: var(--text-body-lg);
    font-weight: 900;
    text-transform: uppercase;
    margin: 0 0 var(--space-3);
    color: var(--color-ink);
  }
  .hub-card-body :global(p) {
    margin: 0 0 var(--space-2);
    font-size: var(--text-body-sm);
    line-height: var(--text-body-line-height);
    color: var(--color-ink-muted);
  }
  .hub-card-body :global(p:last-child) {
    margin-bottom: 0;
  }
  .hub-card-body :global(code) {
    font-family: var(--font-mono);
    color: var(--color-ink);
    background: var(--color-yellow);
    border: var(--border-thin);
    padding: 0.08rem 0.35rem;
  }
</style>
