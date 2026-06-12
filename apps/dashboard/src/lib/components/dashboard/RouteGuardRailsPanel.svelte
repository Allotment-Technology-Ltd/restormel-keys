<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import RouteGuardRailsCreateShortcut from "$lib/components/dashboard/RouteGuardRailsCreateShortcut.svelte";

  /** Disambiguate labels/ids when two instances mount (Flow + Configuration). */
  export let idPrefix: string;
  /** When true, tighter chrome for the Flow tab stack above the canvas. */
  export let compact = false;
  /** When false, hide “create new policy + attach” (e.g. shown in inspector footer instead). */
  export let showCreateShortcut = true;

  export let availablePolicies: { id: string; name: string; type: string; status: string }[];
  export let routePolicyBindings: { id: string; policyId: string; policyName: string; policyType: string }[];
  /** Policy ids that cannot attach to the whole route (already on route or any model on this route). */
  export let policyIdsUnavailableForRouteAttach: string[] = [];
  /** Policy ids that cannot attach to the inspected model (already on route or already on this model). */
  export let policyIdsUnavailableForStepAttach: string[] = [];

  export let policyError: string;
  export let selectedPolicyId: string;
  export let createPolicyName: string;
  export let createPolicyType: string;

  export let bindingPolicy: boolean;
  export let creatingAndBindingPolicy: boolean;
  export let unbindingId: string | null;

  export let onAttach: () => void | Promise<void>;
  /** `scope` is `route` or `step` when `bindGuardRailToStep`; flow inspector passes current apply target. */
  export let onCreateBind: (scope: "route" | "step") => void | Promise<void>;
  export let onUnbind: (policyId: string, bindingId: string) => void | Promise<void>;

  /** When true, show a second action using the same library picker to bind to the selected flow step. */
  export let bindGuardRailToStep = false;
  export let stepBindingBusy = false;
  export let onBindGuardRailToStep: (() => void | Promise<void>) | undefined = undefined;

  /** Short label for the inspected step (e.g. custom label or “Step 3”). Used only when `bindGuardRailToStep`. */
  export let selectedStepSummary = "";
  /** Inspected step id — when it changes, apply scope resets to entire route (label edits do not). */
  export let inspectorStepId: string | null = null;
  /** Step-only bindings for the inspected step; shown when `bindGuardRailToStep`. */
  export let stepBindings: { id: string; policyId: string; policyName: string; policyType: string }[] = [];
  /** Step-only bindings on other models in the same route (not `stepBindings`); explains empty picker vs “None yet.” */
  export let otherModelsStepGuardRails: {
    stepId: string;
    stepLabel: string;
    bindings: { id: string; policyId: string; policyName: string; policyType: string }[];
  }[] = [];
  export let stepInspectorError = "";
  export let stepUnbindBusyId: string | null = null;
  export let onUnbindStepBinding: ((policyId: string, bindingId: string) => void) | undefined = undefined;

  /** Flow inspector: pick scope then one Apply (vs two separate buttons). */
  let applyTarget: "route" | "step" = "route";

  $: headingId = `${idPrefix}-guard-rails-heading`;
  $: selId = `${idPrefix}-policy-select`;
  $: scopeGroupName = `${idPrefix}-apply-scope`;
  $: stepDisplayName = selectedStepSummary.trim() || "this step";
  $: applyBusy =
    (applyTarget === "route" && bindingPolicy) || (applyTarget === "step" && stepBindingBusy);

  function handleApplyGuardRail() {
    if (applyTarget === "route") void onAttach();
    else void onBindGuardRailToStep?.();
  }

  /** Switching the inspected step (by id) resets scope; renaming the step does not. */
  $: if (bindGuardRailToStep) {
    void inspectorStepId;
    applyTarget = "route";
  }

  $: createSubmitLabel =
    applyTarget === "route"
      ? "Create + attach to entire route"
      : `Create + attach to ${stepDisplayName} only`;
  $: createSummarySuffix = applyTarget === "route" ? "entire route" : `${stepDisplayName} only`;

  $: policiesPickableForRoute = availablePolicies.filter((p) => !policyIdsUnavailableForRouteAttach.includes(p.id));
  $: policiesPickableForStep = availablePolicies.filter((p) => !policyIdsUnavailableForStepAttach.includes(p.id));
  $: policiesPickableForPicker = bindGuardRailToStep
    ? applyTarget === "route"
      ? policiesPickableForRoute
      : policiesPickableForStep
    : policiesPickableForRoute;

  /** If the parent still holds a selection that is no longer valid (e.g. scope switch), clear it. */
  $: if (selectedPolicyId && !policiesPickableForPicker.some((p) => p.id === selectedPolicyId)) {
    selectedPolicyId = "";
  }
</script>

<section
  class="route-guard-rails section"
  class:route-guard-rails--compact={compact}
  aria-labelledby={headingId}
>
  {#if bindGuardRailToStep}
    <h2 id={headingId} class="sr-only">Guard rails</h2>
    <p class="muted route-gr-compact-lede">
      <strong>Entire route</strong> applies to every model in the chain. <strong>{stepDisplayName}</strong> adds guard rails for
      this model only. Each saved guard rail can attach <strong>once</strong> per route (not both whole-route and a model, and not twice at the same scope).
    </p>
    <p class="route-guard-rails-library-row route-guard-rails-library-row--compact">
      <a
        class="btn btn-secondary btn-inline"
        href={`${DASHBOARD_BASE}/policies`}
        title="Opens in this tab; use the browser back button to return">Guard rails library</a>
    </p>
    {#if policyError}
      <p class="error-msg" role="alert">{policyError}</p>
    {/if}
    {#if stepInspectorError}
      <p class="error-msg" role="alert">{stepInspectorError}</p>
    {/if}

    <div class="route-gr-flow">
      <div class="form-row compact route-gr-flow-row">
        <label for={selId}>Guard rail</label>
        <select id={selId} bind:value={selectedPolicyId} class="input">
          <option value="">Select…</option>
          {#each policiesPickableForPicker as policy (policy.id)}
            <option value={policy.id}>{policy.name} ({policy.type})</option>
          {/each}
        </select>
      </div>
      {#if bindGuardRailToStep && availablePolicies.length > 0 && policiesPickableForPicker.length === 0}
        <p class="muted route-gr-picker-empty" role="status">
          {#if otherModelsStepGuardRails.length > 0}
            Every saved guard rail in this workspace is already in use on this route. At least one is
            <strong>step-only on another model</strong> (see below). Open that step in the flow map to remove it, or create a
            new definition in the library.
          {:else}
            Every saved guard rail in this workspace is already attached to this route or one of its models.
          {/if}
        </p>
      {/if}

      <fieldset class="route-gr-apply-fieldset">
        <legend class="route-gr-apply-legend">Apply to</legend>
        <div class="route-gr-scope-radios">
          <label class="route-gr-radio">
            <input type="radio" name={scopeGroupName} value="route" bind:group={applyTarget} />
            Entire route
          </label>
          <label class="route-gr-radio">
            <input type="radio" name={scopeGroupName} value="step" bind:group={applyTarget} />
            {stepDisplayName} only
          </label>
        </div>
        <button
          type="button"
          class="btn btn-primary route-gr-apply-btn"
          disabled={!selectedPolicyId || applyBusy}
          onclick={() => handleApplyGuardRail()}
        >
          {applyBusy ? "Applying…" : "Apply"}
        </button>
      </fieldset>
    </div>

    <h3 class="route-guard-rails-subheading route-guard-rails-subheading--tight">Entire route</h3>
    {#if routePolicyBindings.length === 0}
      <p class="muted route-gr-empty">
        {#if otherModelsStepGuardRails.length > 0}
          None at whole-route scope. Step-only guard rails are set on other models — see below.
        {:else}
          None yet.
        {/if}
      </p>
    {:else}
      <ul class="policy-list">
        {#each routePolicyBindings as binding}
          <li class="policy-row">
            <span>{binding.policyName} · {binding.policyType}</span>
            <button
              type="button"
              class="btn btn-danger btn-inline"
              disabled={unbindingId === binding.id}
              aria-label="Remove guard rail from entire route"
              onclick={() => void onUnbind(binding.policyId, binding.id)}
            >
              {unbindingId === binding.id ? "…" : "Remove"}
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    <h3 class="route-guard-rails-subheading route-guard-rails-subheading--tight">This step only</h3>
    {#if stepBindings.length === 0}
      <p class="muted route-gr-empty">None yet.</p>
    {:else}
      <ul class="policy-list">
        {#each stepBindings as binding}
          <li class="policy-row">
            <span>{binding.policyName} · {binding.policyType}</span>
            {#if onUnbindStepBinding}
              <button
                type="button"
                class="btn btn-danger btn-inline"
                disabled={stepUnbindBusyId === binding.id}
                aria-label={`Remove guard rail from ${stepDisplayName} only`}
                onclick={() => void onUnbindStepBinding(binding.policyId, binding.id)}
              >
                {stepUnbindBusyId === binding.id ? "…" : "Remove"}
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    {#if otherModelsStepGuardRails.length > 0}
      <h3 class="route-guard-rails-subheading route-guard-rails-subheading--tight">Other models (step-only)</h3>
      <p class="muted route-gr-other-models-lede">
        These apply only to the listed model, not to <strong>{stepDisplayName}</strong>. A guard rail cannot attach to the
        whole route while it is still bound to any model on the route.
      </p>
      <div class="route-gr-other-models">
        {#each otherModelsStepGuardRails as row (row.stepId)}
          <div class="route-gr-other-models-block">
            <p class="route-gr-other-models-step">{row.stepLabel}</p>
            <ul class="policy-list route-gr-other-models-list">
              {#each row.bindings as b (b.id)}
                <li class="policy-row route-gr-other-models-row">
                  <span>{b.policyName} · {b.policyType}</span>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
      <p class="muted route-gr-other-models-hint">
        Select that model on the flow map to remove a step-only guard rail, or use the library to create another definition.
      </p>
    {/if}

    {#if showCreateShortcut}
      <details class="inspector-disclosure route-guard-rails-create-details">
        <summary class="inspector-disclosure-summary">New guard rail → {createSummarySuffix}</summary>
        <div class="inspector-disclosure-body">
          <p class="muted route-gr-create-hint">Create + attach uses the <strong>Apply to</strong> choice above.</p>
          <RouteGuardRailsCreateShortcut
            idPrefix={`${idPrefix}-create`}
            bind:createPolicyName
            bind:createPolicyType
            creatingAndBindingPolicy={creatingAndBindingPolicy}
            submitButtonLabel={createSubmitLabel}
            showLede={false}
            onCreateBind={() => void onCreateBind(applyTarget)}
          />
        </div>
      </details>
    {/if}
  {:else}
    <h2 id={headingId} class="section-title route-guard-rails-title">Guard rails on this route</h2>
    <p class="section-desc route-guard-rails-desc">
      <strong>Here:</strong> choose which saved guard rails apply to this route (bindings only).
      <strong>Library:</strong> create, edit, and delete guard rail definitions — same catalogue for every route in the
      workspace.
    </p>
    <p class="route-guard-rails-library-row">
      <a class="btn btn-secondary" href={`${DASHBOARD_BASE}/policies`}>Open guard rails library</a>
      <span class="muted route-guard-rails-library-hint">Opens in this tab; use your browser back button to return.</span>
    </p>
    {#if policyError}
      <p class="error-msg" role="alert">{policyError}</p>
    {/if}
    <h3 class="route-guard-rails-subheading">Attach from library</h3>
    <p class="muted route-guard-rails-microcopy">Pick a saved guard rail, then attach it to this route.</p>
    <form
      class="inline-form"
      onsubmit={(e) => {
        e.preventDefault();
        void onAttach();
      }}
    >
      <div class="form-row compact">
        <label for={selId}>Guard rail</label>
        <select id={selId} bind:value={selectedPolicyId} class="input">
          <option value="">Select guard rail…</option>
          {#each policiesPickableForRoute as policy (policy.id)}
            <option value={policy.id}>{policy.name} ({policy.type})</option>
          {/each}
        </select>
      </div>
      <button type="submit" class="btn btn-secondary" disabled={!selectedPolicyId || bindingPolicy}>
        {bindingPolicy ? "Applying…" : "Attach to this route"}
      </button>
    </form>

    <h3 class="route-guard-rails-subheading">Attached to this route</h3>
    {#if routePolicyBindings.length === 0}
      <p class="muted">No guard rails attached yet. Attach one above, or create one in the library.</p>
    {:else}
      <ul class="policy-list">
        {#each routePolicyBindings as binding}
          <li class="policy-row">
            <span>{binding.policyName} · {binding.policyType}</span>
            <button
              type="button"
              class="btn btn-danger btn-inline"
              disabled={unbindingId === binding.id}
              onclick={() => void onUnbind(binding.policyId, binding.id)}
            >
              {unbindingId === binding.id ? "Removing…" : "Unbind"}
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    {#if showCreateShortcut}
      <details class="inspector-disclosure route-guard-rails-create-details">
        <summary class="inspector-disclosure-summary">Create new guard rail and attach here</summary>
        <div class="inspector-disclosure-body">
          <RouteGuardRailsCreateShortcut
            idPrefix={`${idPrefix}-create`}
            bind:createPolicyName
            bind:createPolicyType
            creatingAndBindingPolicy={creatingAndBindingPolicy}
            onCreateBind={() => void onCreateBind("route")}
          />
        </div>
      </details>
    {/if}
  {/if}
</section>

<style>
  .route-guard-rails {
    margin: 0;
    padding: 0;
    max-width: 52rem;
  }
  .route-guard-rails--compact {
    max-width: none;
  }
  .route-guard-rails--compact .route-guard-rails-title {
    font-size: var(--text-base);
  }
  .route-guard-rails--compact .route-guard-rails-desc {
    font-size: var(--text-sm);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .route-gr-compact-lede {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    line-height: 1.45;
  }
  .route-guard-rails-library-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    margin: 0 0 var(--space-4);
  }
  .route-guard-rails-library-row--compact {
    margin-bottom: var(--space-3);
  }
  .route-guard-rails-library-hint {
    font-size: var(--text-sm);
    line-height: 1.4;
    max-width: 28rem;
  }
  .route-guard-rails-subheading {
    margin: var(--space-4) 0 var(--space-2);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--rm-text);
    letter-spacing: 0.02em;
  }
  .route-guard-rails-microcopy {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    line-height: 1.45;
  }
  .route-guard-rails-create-details {
    margin-top: var(--space-4);
  }
  .route-gr-create-hint {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    line-height: 1.45;
  }
  .route-gr-flow {
    margin-bottom: var(--space-3);
  }
  .route-gr-flow-row {
    margin-bottom: var(--space-3);
  }
  /** Scoped form rows: label/control gap (parent page `.form-row label` does not reach this component). */
  .route-guard-rails :where(.form-row) label {
    display: block;
    margin-bottom: var(--space-3);
  }
  .route-gr-apply-fieldset {
    margin: 0;
    padding: var(--space-3);
    border: var(--border-thin);
    border-radius: var(--rm-radius);
    background: color-mix(in oklab, var(--rm-surface-raised) 88%, var(--rm-bg));
  }
  .route-gr-apply-legend {
    padding: 0;
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--rm-dim);
  }
  .route-gr-scope-radios {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3) var(--space-4);
    margin: var(--space-2) 0 var(--space-3);
  }
  .route-gr-radio {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--rm-text);
    cursor: pointer;
  }
  .route-gr-radio input {
    width: auto;
    margin: 0;
    accent-color: var(--rm-sage);
  }
  .route-gr-apply-btn {
    width: 100%;
  }
  .route-guard-rails-subheading--tight {
    margin-top: var(--space-3);
  }
  .route-gr-empty {
    margin: 0 0 var(--space-2);
  }
  .policy-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .policy-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: var(--border-thin);
    font-size: var(--text-sm);
    color: var(--rm-text);
  }
  .error-msg {
    color: var(--coral-alert, #b91c1c);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-2);
  }
  .muted {
    font-size: var(--text-sm);
    color: var(--rm-dim);
  }
  .route-gr-other-models-lede {
    margin: 0 0 var(--space-2);
    line-height: 1.45;
  }
  .route-gr-other-models {
    margin: 0 0 var(--space-2);
  }
  .route-gr-other-models-block {
    margin: 0 0 var(--space-3);
  }
  .route-gr-other-models-step {
    margin: 0 0 var(--space-1);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--rm-text);
  }
  .route-gr-other-models-list {
    margin: 0;
  }
  .route-gr-other-models-row {
    padding: var(--space-1) 0;
  }
  .route-gr-other-models-hint {
    margin: 0 0 var(--space-2);
    line-height: 1.45;
  }
</style>
