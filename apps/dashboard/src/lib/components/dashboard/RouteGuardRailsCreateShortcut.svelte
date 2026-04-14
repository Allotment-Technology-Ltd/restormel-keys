<script lang="ts">
  /** Unique prefix for form control ids (e.g. flow-inspector-adv). */
  export let idPrefix: string;

  export let createPolicyName: string;
  export let createPolicyType: string;
  export let creatingAndBindingPolicy: boolean;

  export let onCreateBind: () => void | Promise<void>;

  /** Submit button label (e.g. “entire route” when the flow inspector distinguishes scopes). */
  export let submitButtonLabel = "Create + attach to this route";

  /** When false, hides the intro paragraph (dense inspector layouts). */
  export let showLede = true;

  $: nameId = `${idPrefix}-policy-name`;
  $: typeId = `${idPrefix}-policy-type`;
</script>

<div class="route-gr-create">
  {#if showLede}
    <p class="muted route-gr-create-lede">
      Shortcut when you already know the type. For templates, validation, and where else a guard rail is used, prefer the
      library.
    </p>
  {/if}
  <form
    class="inline-form"
    onsubmit={(e) => {
      e.preventDefault();
      void onCreateBind();
    }}
  >
    <div class="form-row compact">
      <label for={nameId}>New guard rail name</label>
      <input id={nameId} class="input" bind:value={createPolicyName} placeholder="e.g. Route budget cap" />
    </div>
    <div class="form-row compact">
      <label for={typeId}>Guard rail type</label>
      <select id={typeId} bind:value={createPolicyType} class="input">
        <option value="model_allowlist">model_allowlist</option>
        <option value="model_denylist">model_denylist</option>
        <option value="provider_allowlist">provider_allowlist</option>
        <option value="provider_denylist">provider_denylist</option>
        <option value="deprecated_model_block">deprecated_model_block</option>
        <option value="budget_cap">budget_cap</option>
        <option value="token_cap">token_cap</option>
      </select>
    </div>
    <button type="submit" class="btn btn-secondary" disabled={!createPolicyName.trim() || creatingAndBindingPolicy}>
      {creatingAndBindingPolicy ? "Creating…" : submitButtonLabel}
    </button>
  </form>
</div>

<style>
  .route-gr-create-lede {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    line-height: 1.45;
  }
  .route-gr-create :where(.form-row) label {
    display: block;
    margin-bottom: var(--space-3);
  }
  .muted {
    color: var(--rm-dim);
  }
</style>
