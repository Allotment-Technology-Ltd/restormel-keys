<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * Error state with a clear message + recovery action slot (docs/design/ux-contracts.md).
   * Always render at least one recovery action via the `actions` slot.
   */
  export let title = "Something went wrong";
  export let message: string;
  export let actions: Snippet | undefined = undefined;
</script>

<div class="brutal-error" role="alert">
  <p class="brutal-error-title">
    <span aria-hidden="true">!</span>
    {title}
  </p>
  <p class="brutal-error-msg">{message}</p>
  {#if actions}
    <div class="brutal-error-actions">
      {@render actions()}
    </div>
  {/if}
</div>

<style>
  .brutal-error {
    border: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-coral);
    color: var(--brut-ink);
    padding: var(--space-4);
    box-shadow: var(--brut-shadow);
    margin: 0 0 var(--space-4);
  }

  .brutal-error-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0 0 var(--space-2);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .brutal-error-title span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    background: var(--brut-ink);
    color: var(--brut-coral);
    font-weight: 900;
  }

  .brutal-error-msg {
    margin: 0;
    font-weight: 600;
  }

  .brutal-error-actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-top: var(--space-3);
  }
</style>
