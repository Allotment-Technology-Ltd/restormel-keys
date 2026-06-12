<script lang="ts">
  /**
   * The Stamping Desk (W4.2) — a keyboard-first triage overlay for `/claims`.
   *
   * This component is a thin, DOM-owning shell. It NEVER fetches: every stamp,
   * advance, note and undo is delegated back to the explorer's existing
   * mutation path (`performReview` → PATCH /graph/units/{id}/validation) via the
   * callback props below, so the explorer's mutation-fetch pin (16) is untouched.
   * All decisions live in the pure module `claims-stamping-desk.ts`.
   *
   * Read-only modes: when `readonly` is true (mobile read-only tier OR as-of
   * history) the desk is still navigable/legible but stamps/note/undo are
   * disabled — the keymap drops them and the stamp bar shows the reason. The
   * EXPLORER decides not to even render the "Enter desk" button under those
   * modes; this prop is the belt to that braces.
   */
  import { tick } from "svelte";
  import type { KnownValidationStatus } from "$lib/connect/validation-status";
  import type { GraphReviewGuidance } from "$lib/connect/graph-review-guidance";
  import type { UnitEvidenceSummary } from "$lib/connect/evidence-dossier";
  import {
    dispatchDeskKey,
    deskStampOptions,
    describeUndo,
    formatTallyLine,
    type DeskTally,
    type DeskStampRecord,
    SESSION_TRUST_DELTA_DEFERRED,
  } from "$lib/connect/claims-stamping-desk";

  export let claim: {
    id: string;
    text: string;
    evidence?: UnitEvidenceSummary | null;
  } | null;
  /** AI verdict guidance for the current claim (verdictLabel/headline/detail). */
  export let guidance: GraphReviewGuidance | null = null;
  /** 1-based position + total of the current claim within the live queue. */
  export let position: number = 0;
  export let total: number = 0;
  export let tally: DeskTally;
  /** The last landed stamp this session — drives the honest undo affordance. */
  export let lastStamp: DeskStampRecord | null = null;
  /** True under the mobile read-only tier or an active as-of history view. */
  export let readonly: boolean = false;
  /** Honest reason shown when readonly (e.g. "Editing past state is not possible."). */
  export let readonlyReason: string = "";
  /** Bound to the note field so the explorer can read it on stamp. */
  export let note: string = "";

  // Callbacks into the explorer (the single owner of the mutation path).
  export let onStamp: (status: KnownValidationStatus) => void;
  export let onAdvance: () => void;
  export let onRetreat: () => void;
  export let onUndo: (toStatus: KnownValidationStatus) => void;
  export let onExit: () => void;
  /** Reveal the full evidence dossier (loads it if needed) — `E`. */
  export let onOpenEvidence: () => void;

  let legendOpen = false;
  let noteEl: HTMLTextAreaElement | null = null;
  /** Live-region message announced after each stamp/undo. */
  let announcement = "";
  /** The focusable claim card — receives focus on advance for SR + keyboard users. */
  let claimCardEl: HTMLElement | null = null;
  /** The 100ms mechanical press: which stamp is mid-flash (null = none). */
  let flashStatus: KnownValidationStatus | null = null;

  /** Fire the 100ms press. CSS guards the transition under prefers-reduced-motion. */
  function flashStamp(status: KnownValidationStatus) {
    flashStatus = status;
    setTimeout(() => {
      flashStatus = null;
    }, 100);
  }

  $: stampOptions = deskStampOptions(claim?.evidence ?? null);
  $: undoState = describeUndo(lastStamp);
  $: tallyLine = formatTallyLine(tally);

  /** Public: the explorer calls this after a stamp so the desk announces it. */
  export function announce(message: string) {
    announcement = message;
  }

  /** Public: move focus to the claim card (explorer calls after advancing). */
  export async function focusClaim() {
    await tick();
    claimCardEl?.focus();
  }

  function eventFromTextEntry(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return true;
    return target.isContentEditable;
  }

  function handleKeydown(event: KeyboardEvent) {
    // Modifier guard: never intercept Cmd/Ctrl/Alt chords. Without this, Cmd/Ctrl+S
    // would stamp "Supported" AND swallow the browser's Save (preventDefault), and
    // Ctrl+A would stamp instead of select-all. Let the browser own modified keys.
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const command = dispatchDeskKey(event.key, {
      fromTextEntry: eventFromTextEntry(event.target),
      readonly,
    });
    if (!command) return;

    switch (command.kind) {
      case "advance":
        event.preventDefault();
        onAdvance();
        break;
      case "retreat":
        event.preventDefault();
        onRetreat();
        break;
      case "stamp": {
        event.preventDefault();
        const opt = stampOptions.find((o) => o.status === command.status);
        if (opt && !opt.enabled) {
          // Surfaced accept-guard refusal — never a silent no-op.
          announcement = opt.reason ?? "That verdict is not available for this claim.";
          return;
        }
        flashStamp(command.status);
        onStamp(command.status);
        break;
      }
      case "evidence":
        event.preventDefault();
        onOpenEvidence();
        break;
      case "note":
        event.preventDefault();
        noteEl?.focus();
        break;
      case "undo":
        event.preventDefault();
        if (undoState.canUndo) {
          onUndo(undoState.toStatus);
        } else {
          announcement = undoState.reason;
        }
        break;
      case "legend":
        event.preventDefault();
        legendOpen = !legendOpen;
        break;
      case "blur":
        // Two-step escape: first Escape leaves the note field (focus back to the
        // claim card) WITHOUT exiting the desk. A second Escape (now outside the
        // field) exits via the "exit" branch.
        event.preventDefault();
        noteEl?.blur();
        void focusClaim();
        break;
      case "exit":
        event.preventDefault();
        onExit();
        break;
    }
  }

  function clickStamp(status: KnownValidationStatus, enabled: boolean, reason: string | null) {
    if (!enabled) {
      announcement = reason ?? "That verdict is not available for this claim.";
      return;
    }
    flashStamp(status);
    onStamp(status);
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<section
  class="stamping-desk brut-fill-canvas"
  class:desk-readonly={readonly}
  aria-label="Stamping desk — keyboard claim triage"
  data-desk-readonly={readonly ? "true" : null}
>
  <header class="desk-head">
    <div class="desk-head-titles">
      <span class="desk-kicker">STAMPING DESK</span>
      <h2 class="desk-title">Triage at speed</h2>
    </div>
    <div class="desk-head-controls">
      <button
        type="button"
        class="desk-legend-toggle brut-focus"
        aria-expanded={legendOpen}
        on:click={() => (legendOpen = !legendOpen)}
      >
        ? Shortcuts
      </button>
      <button type="button" class="brutal-btn brut-pressable brut-focus desk-exit" on:click={onExit}>
        Exit desk <span class="desk-key" aria-hidden="true">Esc</span>
      </button>
    </div>
  </header>

  {#if readonly}
    <p class="desk-readonly-note" role="status">
      Read-only — {readonlyReason || "stamping is disabled in this view."} You can still move
      through the queue and open evidence.
    </p>
  {/if}

  {#if legendOpen}
    <div class="desk-legend" role="region" aria-label="Keyboard shortcuts">
      <dl class="desk-legend-grid">
        <div class="desk-legend-row"><dt><kbd>J</kbd>/<kbd>K</kbd></dt><dd>Next / previous claim</dd></div>
        <div class="desk-legend-row"><dt><kbd>S</kbd></dt><dd>Stamp supported</dd></div>
        <div class="desk-legend-row"><dt><kbd>W</kbd></dt><dd>Mark weak</dd></div>
        <div class="desk-legend-row"><dt><kbd>X</kbd></dt><dd>Mark unsupported</dd></div>
        <div class="desk-legend-row"><dt><kbd>E</kbd></dt><dd>Open evidence</dd></div>
        <div class="desk-legend-row"><dt><kbd>N</kbd></dt><dd>Write a note</dd></div>
        <div class="desk-legend-row"><dt><kbd>Z</kbd></dt><dd>Undo last stamp</dd></div>
        <div class="desk-legend-row"><dt><kbd>?</kbd></dt><dd>Toggle this legend</dd></div>
        <div class="desk-legend-row"><dt><kbd>Esc</kbd></dt><dd>Exit the desk</dd></div>
      </dl>
    </div>
  {/if}

  {#if claim}
    <article
      class="desk-claim"
      bind:this={claimCardEl}
      tabindex="-1"
      aria-label="Current claim under review"
    >
      <div class="desk-claim-meta">
        <span class="desk-position" role="status">
          {#if total > 0}
            CLAIM {position} / {total}
          {:else}
            CLAIM
          {/if}
        </span>
        {#if guidance}
          <span class="desk-verdict desk-verdict--{guidance.verdictTone}">
            AI: {guidance.verdictLabel}
          </span>
        {/if}
      </div>

      <p class="desk-claim-text">{claim.text}</p>

      {#if guidance}
        <p class="desk-guidance brut-muted">{guidance.detail}</p>
      {/if}

      <button type="button" class="desk-evidence-link brut-focus" on:click={onOpenEvidence}>
        Open evidence <span class="desk-key" aria-hidden="true">E</span>
      </button>
    </article>

    {#if !readonly}
      <label class="desk-note-field" for="desk-note">
        <span class="desk-note-label">Note (optional) <span class="desk-key" aria-hidden="true">N</span></span>
        <textarea
          id="desk-note"
          class="desk-note-input brut-focus"
          rows="2"
          maxlength="500"
          placeholder="Why you agree or disagree…"
          bind:this={noteEl}
          bind:value={note}
        ></textarea>
      </label>

      <div class="desk-stamps" role="group" aria-label="Stamp a verdict">
        {#each stampOptions as opt (opt.status)}
          <button
            type="button"
            class="brutal-btn brut-pressable brut-focus desk-stamp desk-stamp--{opt.status}"
            class:desk-stamp-suggested={guidance?.suggestedAction === opt.status}
            class:desk-stamp-flash={flashStatus === opt.status}
            disabled={!opt.enabled}
            aria-disabled={!opt.enabled}
            title={opt.enabled ? `${opt.label} (${opt.key})` : (opt.reason ?? "")}
            on:click={() => clickStamp(opt.status, opt.enabled, opt.reason)}
          >
            <span class="desk-stamp-label">{opt.label}</span>
            <span class="desk-key" aria-hidden="true">{opt.key}</span>
          </button>
        {/each}
      </div>

      {#each stampOptions as opt (opt.status)}
        {#if !opt.enabled && opt.reason}
          <p class="desk-stamp-guard" role="note">
            <strong>{opt.label} unavailable:</strong> {opt.reason}
          </p>
        {/if}
      {/each}

      <div class="desk-undo-row">
        <button
          type="button"
          class="desk-undo brut-focus"
          disabled={!undoState.canUndo}
          title={undoState.canUndo ? "Re-stamp the last claim to its prior verdict" : undoState.reason}
          on:click={() => undoState.canUndo && onUndo(undoState.toStatus)}
        >
          Undo last stamp <span class="desk-key" aria-hidden="true">Z</span>
        </button>
        {#if !undoState.canUndo}
          <span class="desk-undo-reason brut-muted">{undoState.reason}</span>
        {/if}
      </div>
    {/if}
  {:else}
    <p class="desk-empty" role="status">
      The review queue is clear — no claims awaiting your verdict. Press <kbd>Esc</kbd> to leave the desk.
    </p>
  {/if}

  <!-- Session tally rail — resets per visit (it lives in desk component state). -->
  <footer class="desk-tally" aria-label="Session tally">
    <p class="desk-tally-line" role="status">{tallyLine}</p>
    <p class="desk-tally-trust brut-muted">{SESSION_TRUST_DELTA_DEFERRED}</p>
  </footer>

  <!-- Polite spoken announcements for stamp / undo / guard results (X10). -->
  <p class="visually-hidden" role="status" aria-live="polite">{announcement}</p>
</section>

<style>
  .stamping-desk {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    border: var(--brut-border-width) solid var(--brut-ink);
    border-radius: 0;
    box-shadow: var(--brut-shadow);
  }

  .desk-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .desk-kicker {
    display: block;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--color-ink-faint);
  }

  .desk-title {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: 900;
  }

  .desk-head-controls {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .desk-legend-toggle {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    background: transparent;
    border: var(--brut-border-width) solid var(--brut-ink);
    border-radius: 0;
    padding: var(--space-1) var(--space-2);
    cursor: pointer;
  }

  .desk-readonly-note {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border: var(--brut-border-width) solid var(--brut-ink);
    background: var(--color-bg);
    font-size: var(--text-sm);
  }

  .desk-legend {
    border: var(--brut-border-width) solid var(--brut-ink);
    padding: var(--space-3);
  }

  .desk-legend-grid {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--space-1) var(--space-3);
  }

  .desk-legend-row {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }

  .desk-legend-row dt {
    margin: 0;
    min-width: 4ch;
  }

  .desk-legend-row dd {
    margin: 0;
    font-size: var(--text-sm);
  }

  kbd,
  .desk-key {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.04em;
    border: 2px solid var(--brut-ink);
    border-radius: 0;
    padding: 0 var(--space-1);
    background: var(--color-bg);
  }

  .desk-claim {
    border: var(--brut-border-width) solid var(--brut-ink);
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .desk-claim:focus-visible {
    outline: 3px solid var(--color-yellow);
    outline-offset: 2px;
  }

  .desk-claim-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .desk-position {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--color-ink-faint);
  }

  .desk-verdict {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border: 2px solid var(--brut-ink);
    padding: 0 var(--space-1);
  }

  .desk-claim-text {
    margin: 0;
    font-size: var(--text-base);
    line-height: 1.5;
    font-weight: 600;
  }

  .desk-guidance {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
  }

  .desk-evidence-link {
    align-self: flex-start;
    background: transparent;
    border: none;
    border-bottom: 2px dotted var(--brut-ink);
    border-radius: 0;
    padding: 0;
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: 700;
  }

  .desk-note-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .desk-note-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .desk-note-input {
    border: var(--brut-border-width) solid var(--brut-ink);
    border-radius: 0;
    padding: var(--space-2);
    font: inherit;
    resize: vertical;
  }

  .desk-stamps {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .desk-stamp {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    /* The 100ms mechanical press — guarded under prefers-reduced-motion below. */
    transition:
      background-color 100ms steps(1, end),
      transform 100ms steps(1, end);
  }

  .desk-stamp-suggested {
    box-shadow: var(--brut-shadow);
  }

  .desk-stamp-flash {
    background: var(--color-yellow) !important;
    transform: translate(2px, 2px);
  }

  .desk-stamp:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .desk-stamp-guard {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    border-left: 3px solid var(--brut-ink);
    padding-left: var(--space-2);
  }

  .desk-undo-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .desk-undo {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    background: transparent;
    border: var(--brut-border-width) solid var(--brut-ink);
    border-radius: 0;
    padding: var(--space-1) var(--space-2);
    cursor: pointer;
    font-weight: 700;
    min-height: 44px;
  }

  .desk-undo:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .desk-undo-reason {
    font-size: var(--text-sm);
  }

  .desk-empty {
    margin: 0;
    padding: var(--space-3);
    border: var(--brut-border-width) dashed var(--brut-ink);
    font-size: var(--text-sm);
  }

  .desk-tally {
    border-top: var(--brut-border-width) solid var(--brut-ink);
    padding-top: var(--space-2);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .desk-tally-line {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 900;
    letter-spacing: 0.04em;
  }

  .desk-tally-trust {
    margin: 0;
    font-size: var(--text-xs);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .desk-stamp {
      transition: none;
    }
    .desk-stamp-flash {
      transform: none;
    }
  }
</style>
