<script lang="ts">
  /**
   * M4 guided fork — the collapsed first-connection form (RES-113 PR-7;
   * REC-ADR-018 addendum 2026-07-01; copy pack §4.2, strings verbatim).
   *
   * The 3-step Type → Access → Name wizard, step strip, and live-preview aside
   * are DELETED (flag-ON path only — this component only mounts under the
   * `onboardingJourney` flag). What remains is one screen: two method cards
   * (MCP first, REST second), one prefilled non-blocking name field, silent
   * project resolution with a compact chip only when genuinely ambiguous, and
   * one yellow primary (Create connection). There is NO access step — access is
   * enforced server-side (addendum §2), stated by the muted access line.
   *
   * Reveal predicate for the project chip (ux-craft §2.1): 2+ projects AND no
   * default — `resolveConnectProject(...).ambiguous`.
   */
  import { createEventDispatcher, tick } from "svelte";
  import ConnectionTypeIcon from "./ConnectionTypeIcon.svelte";
  import {
    CONNECTION_METHODS,
    getMethod,
    type ConnectionMethodId,
    type ConnectionAccessId,
  } from "./connection-model";

  /** True while the parent's create-key request is in flight. */
  export let creating = false;
  /** Error surfaced from the parent's create attempt. */
  export let createError = "";
  /**
   * Access this form will mint. "read" everywhere except the S2 read+write
   * suggestion path (copy pack §4.4) — never a user-facing step (addendum §2).
   */
  export let access: ConnectionAccessId = "read";
  /** "first" (S1 — first connection) or "add" (S2 — adding another). Drives the access line copy. */
  export let variant: "first" | "add" = "first";
  /** Projects for the ambiguity chip; the chosen id is two-way bound. */
  export let projects: { id: string; name: string }[] = [];
  export let projectId: string | null = null;
  /** Copy pack §4.2: the chip renders ONLY when genuinely ambiguous (2+ projects, no default). */
  export let projectAmbiguous = false;

  const dispatch = createEventDispatcher<{
    create: { method: ConnectionMethodId; access: ConnectionAccessId; name: string };
  }>();

  let method: ConnectionMethodId | null = null;
  let name = "";
  let nameEdited = false;
  let changingProject = false;

  $: selectedProjectName =
    projects.find((p) => p.id === projectId)?.name ?? projects[0]?.name ?? "";

  // Copy pack §4.2 access lines (the "add" variants were registered in the pack
  // by this PR, per the pack's own change-the-document-first rule).
  $: accessLine =
    access === "read_write"
      ? "This connection is read + write — it can look things up and also add or update facts in your graph."
      : variant === "first"
        ? "Your first connection is read-only — it can look things up but can't add, change, or delete anything in your graph."
        : "New connections start read-only — they can look things up but can't add, change, or delete anything in your graph.";

  function selectMethod(id: ConnectionMethodId) {
    method = id;
    // Prefill tracks the chosen card until the user edits the field (§4.2:
    // "the suggestion works fine" — zero typing accepted).
    if (!nameEdited) name = getMethod(id).namePrefill;
  }

  function onNameInput() {
    nameEdited = true;
  }

  async function startChangeProject() {
    // The Change button is destroyed by the {#if} swap — relocate focus to the
    // select it reveals (a11y skill: never destroy the focused element without
    // explicitly relocating focus).
    changingProject = true;
    await tick();
    document.getElementById("m4-conn-project")?.focus();
  }

  function submit() {
    if (!method) return;
    const finalName = name.trim() || getMethod(method).namePrefill;
    dispatch("create", { method, access, name: finalName });
  }
</script>

<section class="fork" aria-labelledby="m4-fork-heading">
  <h2 id="m4-fork-heading" tabindex="-1">What do you want to connect?</h2>
  <p class="lead">Both get a secure key that can read your answers. You can add more connections later.</p>

  <div class="cards" role="group" aria-label="What do you want to connect?">
    {#each CONNECTION_METHODS as m (m.id)}
      <button
        type="button"
        class="card"
        class:sel={method === m.id}
        aria-pressed={method === m.id}
        disabled={creating}
        on:click={() => selectMethod(m.id)}
      >
        <span class="card-top">
          <span class="card-ic"><ConnectionTypeIcon method={m.icon} /></span>
          <span class="chip">{m.chip}</span>
        </span>
        <span class="card-title">{m.title}</span>
        <span class="card-desc">{m.description}</span>
        <!-- Glyph + word in BOTH states (copy pack §4.5): a lone □ reads as debris. -->
        <span class="card-mark" aria-hidden="true">{method === m.id ? "■ selected" : "□ select"}</span>
      </button>
    {/each}
  </div>

  <div class="name-block">
    <label class="field-label" for="m4-conn-name">Connection name</label>
    <input
      id="m4-conn-name"
      class="input"
      bind:value={name}
      on:input={onNameInput}
      disabled={creating}
      autocomplete="off"
    />
    <p class="helper">Anything that helps you recognise it later — the suggestion works fine.</p>
  </div>

  <p class="access-line">{accessLine}</p>

  {#if projectAmbiguous && projects.length >= 2}
    <!-- Compact inline chip, only when genuinely ambiguous (addendum §3) — never a blocking step. -->
    <div class="proj-chip">
      <span class="proj-label">PROJECT</span>
      {#if changingProject}
        <label class="sr-only" for="m4-conn-project">Project for this connection</label>
        <select
          id="m4-conn-project"
          class="proj-select"
          bind:value={projectId}
          disabled={creating}
        >
          {#each projects as p (p.id)}
            <option value={p.id}>{p.name}</option>
          {/each}
        </select>
      {:else}
        <span class="proj-name">{selectedProjectName}</span>
        <span class="proj-dot" aria-hidden="true">·</span>
        <button type="button" class="proj-change" on:click={startChangeProject}>
          Change
        </button>
      {/if}
    </div>
  {/if}

  <!-- Persistent alert region — rendered empty at boot, NEVER inside {#if}
       (a11y skill: live regions created on demand don't announce). -->
  <p class="create-error" role="alert">{createError}</p>

  <div class="fork-foot">
    <button type="button" class="btn btn-primary" on:click={submit} disabled={!method || creating}>
      {creating ? "Creating…" : "Create connection →"}
    </button>
    {#if !method}
      <p class="cta-hint">Choose one to continue.</p>
    {/if}
  </div>
</section>

<style>
  .fork {
    border: 2px solid var(--color-ink);
    background: var(--color-bg);
    box-shadow: var(--shadow-md);
    padding: var(--space-5);
  }
  .fork h2 {
    font-family: var(--font-display);
    text-transform: uppercase;
    letter-spacing: -0.01em;
    line-height: 0.95;
    margin: 0 0 var(--space-2);
    font-size: 2rem;
  }
  .fork h2:focus {
    /* Programmatic-only focus target (panel-swap relocation) — no visible ring. */
    outline: none;
  }
  .lead {
    color: var(--color-ink-muted);
    line-height: 1.55;
    max-width: 52ch;
    margin: 0 0 var(--space-4);
  }

  .cards {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  @media (min-width: 520px) {
    .cards {
      grid-template-columns: 1fr 1fr;
    }
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    text-align: left;
    border: 2px solid var(--color-ink);
    background: var(--color-surface);
    box-shadow: var(--shadow-sm);
    padding: var(--space-3);
    min-height: 44px;
    cursor: pointer;
    font: inherit;
    color: var(--color-ink);
  }
  .card.sel {
    background: var(--color-yellow);
  }
  .card:focus-visible {
    /* Ink-paired focus (a11y skill §Focus / WCAG 1.4.11): yellow ring + ink band
       so the focus boundary meets 3:1 even on the yellow-filled selected card. */
    outline: 2px solid var(--color-yellow);
    outline-offset: 0;
    box-shadow: 0 0 0 4px var(--color-ink);
  }
  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .card-ic {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 1.5px solid var(--color-ink);
    background: var(--color-bg);
  }
  .card.sel .card-ic {
    background: var(--color-surface);
  }
  .chip {
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
  .card-title {
    font-family: var(--font-display);
    font-weight: 900;
    font-size: 1.2rem;
    text-transform: uppercase;
    line-height: 1;
  }
  .card-desc {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
    line-height: 1.5;
  }
  .card-mark {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-ink);
  }

  .name-block {
    margin-bottom: var(--space-3);
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
  .helper {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-faint);
    line-height: 1.45;
    margin: var(--space-2) 0 0;
  }
  .access-line {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
    line-height: 1.5;
    margin: 0 0 var(--space-3);
    max-width: 62ch;
  }

  .proj-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    border: 1.5px solid var(--color-ink);
    background: var(--color-surface);
    padding: var(--space-1) var(--space-2);
    margin-bottom: var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
  }
  .proj-label {
    font-weight: 700;
    font-size: 9px;
    letter-spacing: 0.06em;
    color: var(--color-ink-faint);
  }
  .proj-name {
    font-weight: 700;
  }
  .proj-dot {
    color: var(--color-ink-faint);
  }
  .proj-change {
    border: none;
    background: none;
    font: inherit;
    color: var(--color-ink);
    text-decoration: underline;
    cursor: pointer;
    padding: var(--space-2);
    margin: calc(-1 * var(--space-2)) 0;
    min-height: 44px;
  }
  .proj-change:focus-visible,
  .proj-select:focus-visible {
    /* Ink-paired focus (a11y skill §Focus / WCAG 1.4.11) — text link / thin-border
       control on cream needs the ink band, not a bare yellow ring. */
    outline: 2px solid var(--color-yellow);
    outline-offset: 0;
    box-shadow: 0 0 0 4px var(--color-ink);
  }
  .proj-select {
    font: inherit;
    border: 1.5px solid var(--color-ink);
    background: var(--color-bg);
    padding: var(--space-1) var(--space-2);
    min-height: 44px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  .create-error {
    color: var(--state-fail-fg, #b00);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-3);
  }
  .create-error:empty {
    /* The region persists empty at boot (live-region contract) — no ghost gap. */
    margin: 0;
  }

  .fork-foot {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    border-top: 2px solid var(--color-ink);
    padding-top: var(--space-4);
    margin-top: var(--space-2);
  }
  .cta-hint {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-faint);
    margin: 0;
  }
</style>
