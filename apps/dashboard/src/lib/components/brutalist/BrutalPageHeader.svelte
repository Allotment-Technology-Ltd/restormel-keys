<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * Canonical dashboard/docs page header (docs/design/ux-contracts.md section pattern).
   * H1 + description + optional kicker and trailing action slot.
   */
  export let title: string;
  export let description: string | undefined = undefined;
  export let kicker: string | undefined = undefined;
  export let actions: Snippet | undefined = undefined;
</script>

<header class="brutal-page-header">
  <div class="brutal-page-header-text">
    {#if kicker}
      <p class="brut-kicker">{kicker}</p>
    {/if}
    <h1 class="brutal-page-title">{title}</h1>
    {#if description}
      <p class="brutal-page-desc brut-muted">{description}</p>
    {/if}
  </div>
  {#if actions}
    <div class="brutal-page-header-actions">
      {@render actions()}
    </div>
  {/if}
</header>

<style>
  .brutal-page-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
    margin: 0 0 var(--space-6);
    padding: 0 0 var(--space-4);
    border-bottom: var(--border);
  }

  .brutal-page-title {
    font-family: var(--font-display);
    font-size: var(--text-display-hero);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
    line-height: var(--text-display-line-height);
    margin: var(--space-2) 0 0;
    color: var(--color-ink);
  }

  .brutal-page-desc {
    margin: var(--space-2) 0 0;
    max-width: 48rem;
    font-family: var(--font-body);
    font-size: var(--text-body-md);
    line-height: var(--text-body-line-height);
  }

  .brutal-page-header-actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
</style>
