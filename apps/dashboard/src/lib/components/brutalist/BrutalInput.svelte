<script lang="ts">
  export let label: string;
  export let id: string;
  export let value = "";
  export let type = "text";
  export let placeholder = "";
  export let required = false;
  export let hint: string | undefined = undefined;
</script>

<div class="brutal-field">
  <label class="brutal-label" for={id}>
    {label}{#if required}<span class="brutal-required" aria-hidden="true"> *</span>{/if}
  </label>
  <input
    {id}
    {type}
    {placeholder}
    {required}
    bind:value
    class="brutal-input brut-focus"
    aria-describedby={hint ? `${id}-hint` : undefined}
  />
  {#if hint}
    <p class="brutal-hint brut-muted" id="{id}-hint">{hint}</p>
  {/if}
</div>

<style>
  .brutal-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .brutal-label {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: var(--text-mono-sm);
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
  }

  .brutal-required {
    color: var(--brut-coral);
  }

  .brutal-input {
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-body);
    font-size: var(--text-body-sm);
    border: var(--border);
    border-radius: 0;
    background: var(--color-surface);
    color: var(--color-ink);
  }

  .brutal-input:focus-visible {
    outline: 2px solid var(--color-yellow);
    outline-offset: 0;
  }

  .brutal-hint {
    margin: 0;
    font-size: var(--text-mono-sm);
  }
</style>
