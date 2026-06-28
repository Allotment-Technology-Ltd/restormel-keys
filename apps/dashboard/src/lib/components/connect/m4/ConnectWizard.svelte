<script lang="ts">
  /**
   * M4 first-connection wizard (RES-113 PR-E) — Type → Access → Name, with a live
   * preview that builds up as you go (03_SCREENS.md M4; designs/M4 Connect.html).
   *
   * Presentational shell: it emits `create` with the chosen {method, access, name};
   * the parent mints the real Gateway key (the key IS the connection). MCP + REST are
   * selectable; widget/SDK/GraphQL render as locked "coming soon" (REC-ADR-018 addendum).
   * Scope shown here is a MOCK — see connection-model.ts.
   */
  import { createEventDispatcher } from "svelte";
  import ConnectionTypeIcon from "./ConnectionTypeIcon.svelte";
  import {
    CONNECTION_METHODS,
    CONNECTION_ACCESS,
    getMethod,
    wizardStepsFor,
    nextWizardStep,
    prevWizardStep,
    buildWizardPreview,
    TWO_CONNECTIONS_NOTE,
    MOCK_SCOPE_NOTE,
    type ConnectionMethodId,
    type ConnectionAccessId,
    type WizardStepId,
  } from "./connection-model";

  /** Workspace Connect API base — drives the realistic mock endpoint preview. */
  export let connectApiBase = "";
  /** True while the parent's create-key request is in flight. */
  export let creating = false;
  /** Error surfaced from the parent's create attempt. */
  export let createError = "";

  const dispatch = createEventDispatcher<{
    create: { method: ConnectionMethodId; access: ConnectionAccessId; name: string };
    cancel: void;
  }>();

  let method: ConnectionMethodId | null = null;
  let access: ConnectionAccessId | null = null;
  let name = "";
  let step: WizardStepId = "type";

  $: steps = method ? wizardStepsFor(method) : (["type", "access", "name"] as WizardStepId[]);
  $: stepIndex = steps.indexOf(step);
  $: preview = buildWizardPreview({ method, access, name, connectApiBase });
  $: nameTrimmed = name.trim();
  $: canContinue =
    (step === "type" && Boolean(method)) ||
    (step === "access" && Boolean(access)) ||
    step === "name";
  $: isLastStep = method ? nextWizardStep(step, method) === null : false;

  function selectMethod(id: ConnectionMethodId) {
    const m = getMethod(id);
    if (!m.available) return; // coming-soon cards are inert
    method = id;
    // Read-only is the safe default once a method that supports access is chosen.
    if (m.needsAccess && !access) access = "read";
  }

  function selectAccess(id: ConnectionAccessId) {
    access = id;
  }

  function back() {
    if (!method) return;
    const prev = prevWizardStep(step, method);
    if (prev) step = prev;
    else dispatch("cancel");
  }

  function advance() {
    if (!method) return;
    const next = nextWizardStep(step, method);
    if (next) {
      // Seed a sensible default name when arriving at the Name step.
      if (next === "name" && !name) name = getMethod(method).namePlaceholder;
      step = next;
    }
  }

  function submit() {
    if (!method) return;
    const finalName = nameTrimmed || getMethod(method).namePlaceholder;
    const finalAccess: ConnectionAccessId = getMethod(method).needsAccess ? access ?? "read" : "read";
    dispatch("create", { method, access: finalAccess, name: finalName });
  }

  // Step labels for the indicator strip.
  const STEP_LABEL: Record<WizardStepId, string> = {
    type: "Type",
    access: "Access",
    name: "Name & create",
  };
</script>

<section class="wizard" aria-labelledby="m4-wizard-heading">
  <header class="wiz-head">
    <p class="eyebrow">M4 · Ship it</p>
    <h2 id="m4-wizard-heading">Connect your app</h2>
    <p class="lead">
      Your graph is ready. Let your app, agent, or site ask it questions and answer from your own
      knowledge — with citations. Pick what it can do, then how it connects.
    </p>
  </header>

  <!-- step indicator -->
  <ol class="steps" aria-label="Connection steps">
    {#each steps as s, i (s)}
      <li
        class="step"
        class:done={i < stepIndex}
        class:now={s === step}
        aria-current={s === step ? "step" : undefined}
      >
        <span class="step-num">{i < stepIndex ? "✓" : i + 1}</span>
        <span class="step-label">{STEP_LABEL[s]}</span>
      </li>
    {/each}
  </ol>

  <div class="wiz-grid">
    <div class="wiz-main">
      {#if step === "type"}
        <h3 class="sec-h">How does it connect? <span class="hint">pick one — add more later</span></h3>
        <div class="m-grid">
          {#each CONNECTION_METHODS as m (m.id)}
            <button
              type="button"
              class="meth"
              class:sel={method === m.id}
              class:soon={!m.available}
              disabled={!m.available}
              aria-pressed={method === m.id}
              on:click={() => selectMethod(m.id)}
            >
              <span class="meth-top">
                <span class="meth-ic"><ConnectionTypeIcon method={m.icon} /></span>
                <span class="tag">{m.available ? m.tag : "Coming soon"}</span>
              </span>
              <span class="mn">{m.name}</span>
              <span class="md">{m.description}</span>
            </button>
          {/each}
        </div>
        <p class="foot-note">
          The MCP server and REST API are live today. The chat widget, SDK, and GraphQL are on the way.
        </p>
      {:else if step === "access"}
        <h3 class="sec-h">What can this connection do?</h3>
        <div class="acc-grid">
          {#each CONNECTION_ACCESS as a (a.id)}
            <button
              type="button"
              class="acc"
              class:on={access === a.id}
              aria-pressed={access === a.id}
              on:click={() => selectAccess(a.id)}
            >
              <span class="rd" aria-hidden="true"></span>
              <span class="acc-body">
                <span class="at">{a.verb}</span>
                <span class="ak">{a.name}</span>
                <span class="ad">{a.description}</span>
              </span>
            </button>
          {/each}
        </div>
        <p class="two-note">◆ {TWO_CONNECTIONS_NOTE}</p>
        <p class="mock-note" role="note">{MOCK_SCOPE_NOTE}</p>
      {:else if step === "name"}
        <h3 class="sec-h">Name this connection</h3>
        <label class="field-label" for="m4-conn-name">A recognisable label</label>
        <input
          id="m4-conn-name"
          class="input"
          bind:value={name}
          placeholder={method ? getMethod(method).namePlaceholder : "connection"}
          disabled={creating}
          autocomplete="off"
        />
        <p class="foot-note">Used to tell your connections apart — e.g. <code>agent-readonly</code>, <code>backend</code>.</p>
        {#if createError}
          <p class="create-error" role="alert">{createError}</p>
        {/if}
      {/if}
    </div>

    <!-- live preview -->
    <aside class="preview" aria-label="Your connection so far">
      <p class="pt">Your connection so far</p>
      {#each preview as row (row.key)}
        <div class="prow" class:pending={row.pending}>
          <span class="pk">{row.key}</span>
          <span class="pv">{row.value}</span>
        </div>
      {/each}
    </aside>
  </div>

  <footer class="wiz-foot">
    <button type="button" class="btn btn-secondary" on:click={back} disabled={creating}>
      {stepIndex === 0 ? "Cancel" : `← ${STEP_LABEL[steps[stepIndex - 1]]}`}
    </button>
    {#if isLastStep}
      <button type="button" class="btn btn-primary" on:click={submit} disabled={creating}>
        {creating ? "Creating…" : "Create connection →"}
      </button>
    {:else}
      <button type="button" class="btn btn-primary" on:click={advance} disabled={!canContinue || creating}>
        Continue →
      </button>
    {/if}
  </footer>
</section>

<style>
  .wizard {
    border: 2px solid var(--color-ink);
    background: var(--color-bg);
    box-shadow: var(--shadow-md);
    padding: var(--space-5);
  }
  .wiz-head h2 {
    font-family: var(--font-display);
    text-transform: uppercase;
    letter-spacing: -0.01em;
    line-height: 0.95;
    margin: 0 0 var(--space-2);
    font-size: 2rem;
  }
  .eyebrow {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--signal-teal);
    margin: 0 0 var(--space-2);
  }
  .lead {
    color: var(--color-ink-muted);
    line-height: 1.55;
    max-width: 52ch;
    margin: 0 0 var(--space-4);
  }

  .steps {
    display: flex;
    gap: 0;
    list-style: none;
    padding: 0;
    margin: 0 0 var(--space-5);
    border: 2px solid var(--color-ink);
  }
  .step {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-right: 2px solid var(--color-ink);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-ink-faint);
    background: var(--color-surface);
  }
  .step:last-child {
    border-right: none;
  }
  .step.now {
    color: var(--color-ink);
    background: color-mix(in srgb, var(--color-yellow) 22%, var(--color-surface));
  }
  .step.done {
    color: var(--color-ink);
  }
  .step-num {
    width: 18px;
    height: 18px;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    border: 1.5px solid var(--color-ink);
    font-size: 10px;
  }
  .step.done .step-num {
    background: var(--signal-teal);
  }
  .step.now .step-num {
    background: var(--color-yellow);
  }

  .sec-h {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-bottom: 2px solid var(--color-ink);
    padding-bottom: var(--space-2);
    margin: 0 0 var(--space-3);
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .sec-h .hint {
    font-weight: 400;
    font-size: var(--text-mono-sm);
    color: var(--color-ink-faint);
    text-transform: none;
    letter-spacing: 0;
  }

  .wiz-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-4);
  }
  @media (min-width: 720px) {
    .wiz-grid {
      grid-template-columns: 1fr minmax(200px, 240px);
    }
  }

  /* method cards */
  .m-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }
  @media (min-width: 520px) {
    .m-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
  .meth {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    text-align: left;
    border: 2px solid var(--color-ink);
    background: var(--color-surface);
    box-shadow: var(--shadow-sm);
    padding: var(--space-3);
    cursor: pointer;
    font: inherit;
    color: var(--color-ink);
  }
  .meth.sel {
    background: var(--color-yellow);
  }
  .meth.soon {
    cursor: not-allowed;
    opacity: 0.62;
    box-shadow: none;
    border-style: dashed;
  }
  .meth-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .meth-ic {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 1.5px solid var(--color-ink);
    background: var(--color-bg);
  }
  .meth.sel .meth-ic {
    background: var(--color-surface);
  }
  .tag {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border: 1.5px solid var(--color-ink);
    padding: 2px 6px;
    background: var(--color-bg);
    white-space: nowrap;
  }
  .mn {
    font-family: var(--font-display);
    font-weight: 900;
    font-size: 1.2rem;
    text-transform: uppercase;
    line-height: 1;
  }
  .md {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
    line-height: 1.5;
  }

  /* access cards */
  .acc-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  @media (min-width: 520px) {
    .acc-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
  .acc {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-3);
    text-align: left;
    border: 2px solid var(--color-ink);
    background: var(--color-bg);
    padding: var(--space-3);
    cursor: pointer;
    font: inherit;
    color: var(--color-ink);
  }
  .acc.on {
    background: color-mix(in srgb, var(--signal-teal) 12%, var(--color-surface));
    box-shadow: var(--shadow-sm);
  }
  .acc .rd {
    width: 18px;
    height: 18px;
    border-radius: 999px;
    border: 2px solid var(--color-ink);
    margin-top: 2px;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
  }
  .acc.on .rd {
    background: var(--signal-teal);
  }
  .acc.on .rd::after {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--color-ink);
  }
  .acc-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .at {
    font-family: var(--font-display);
    font-weight: 900;
    font-size: 1.1rem;
    text-transform: uppercase;
    line-height: 1;
  }
  .ak {
    align-self: flex-start;
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border: 1.5px solid var(--color-ink);
    padding: 2px 6px;
    margin-top: 4px;
  }
  .acc.on .ak {
    background: var(--signal-teal);
  }
  .ad {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
    line-height: 1.5;
    margin-top: var(--space-1);
  }
  .two-note {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    line-height: 1.5;
    border: 2px solid var(--color-ink);
    border-left: 8px solid var(--color-yellow);
    background: color-mix(in srgb, var(--color-yellow) 12%, var(--color-surface));
    padding: var(--space-3);
    margin: 0 0 var(--space-3);
  }
  .mock-note {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-faint);
    line-height: 1.5;
    margin: 0;
  }

  .field-label {
    display: block;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: var(--space-2);
    color: var(--color-ink-muted);
  }
  .foot-note {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-faint);
    line-height: 1.45;
    margin: var(--space-3) 0 0;
  }
  .create-error {
    color: var(--state-fail-fg, #b00);
    font-size: var(--text-sm);
    margin: var(--space-3) 0 0;
  }

  /* preview */
  .preview {
    border: 2px solid var(--color-ink);
    background: var(--color-surface);
    box-shadow: var(--shadow-sm);
    padding: var(--space-4);
    align-self: start;
  }
  .pt {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-ink-faint);
    border-bottom: 2px solid var(--color-ink);
    padding-bottom: var(--space-2);
    margin: 0 0 var(--space-1);
  }
  .prow {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    padding: var(--space-2) 0;
    border-bottom: 1.5px solid var(--color-ink-faint);
  }
  .prow:last-child {
    border-bottom: none;
  }
  .prow .pk {
    color: var(--color-ink-faint);
    text-transform: uppercase;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .prow .pv {
    font-weight: 700;
    color: var(--color-ink);
    text-align: right;
    word-break: break-all;
  }
  .prow.pending .pv {
    color: var(--color-ink-faint);
    font-weight: 400;
    font-style: italic;
  }

  .wiz-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    border-top: 2px solid var(--color-ink);
    padding-top: var(--space-4);
    margin-top: var(--space-5);
  }
</style>
