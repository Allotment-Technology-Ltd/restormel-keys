<script lang="ts">
  /** Single compact nav: Previous | Step N of M | Next. No duplicate "Next" copy. */
  export let prev: { href: string; label: string } | null = null;
  export let next: { href: string; label: string } | null = null;
  export let stepOf = "";
</script>

<nav class="walkthrough-phase-nav" aria-label="Walkthrough navigation">
  <span class="walkthrough-phase-nav-prev">
    {#if prev}
      <a href={prev.href}>← {prev.label}</a>
    {:else}
      <a href="/keys/docs/walkthrough">Walkthrough</a>
    {/if}
  </span>
  <span class="walkthrough-phase-nav-step">{stepOf}</span>
  <span class="walkthrough-phase-nav-next">
    {#if next}
      <a href={next.href}>{next.label} →</a>
    {:else}
      <span aria-hidden="true">—</span>
    {/if}
  </span>
</nav>

<style>
  .walkthrough-phase-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    margin-top: var(--space-8);
    padding-top: var(--space-4);
    border-top: 1px solid var(--rm-border);
    font-size: var(--text-sm);
  }
  .walkthrough-phase-nav-prev,
  .walkthrough-phase-nav-next {
    flex: 1;
  }
  .walkthrough-phase-nav-next {
    text-align: right;
  }
  .walkthrough-phase-nav-step {
    color: var(--rm-muted);
    flex-shrink: 0;
  }
  .walkthrough-phase-nav a {
    color: var(--rm-primary);
    font-weight: var(--font-medium);
  }
</style>
