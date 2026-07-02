<script lang="ts">
  /**
   * RES-113 · deployment preset — the ONE writable preset surface (PR-3).
   *
   * Placement spec §5 item 4 + decision A: `/routes/ingestion` extends the shipped
   * "Reset to recommended" bulk action into a four-way choice — one mechanism, not
   * two. This field ("Where your pipeline runs") replaces that button when the
   * m1PlugPoints flag is ON (the host suppresses the shipped reset then), so exactly
   * one writable preset surface exists. Choosing "Fully managed (recommended)" IS
   * the shipped reset — it clears the bundle to the recommended default.
   *
   * A preset rewrites the graph's bundle (`pipeline_slots` + `pipeline_preset`)
   * through the existing `updateConnectGraphTargetBundle` path; `invalidateAll`
   * re-derives the slot rows below, which then carry the "Part of {preset}."
   * annotation (copy pack §2.7). Every user string is copy-pack §2.7 VERBATIM (the
   * save-error line follows the registered §2.7 slot-save-error grammar — §6.2).
   *
   * A11y (restormel-accessibility): the four options are `aria-pressed` toggle
   * buttons with glyph + word selection marks (R3-A3, never colour alone); a switch
   * opens an `aria-modal="true" role="alertdialog"` confirm stating the blast radius
   * in numbers (ux-craft §3.5) — while it is open the background option list is
   * `disabled` (no tab escape behind the modal, honouring the alertdialog's modality
   * promise); Escape closes and returns focus to the opener; the applied
   * confirmation announces on a persistent polite status region (never inside
   * `{#if}`). No yellow primary is introduced on the page surface — the confirm's
   * "Switch setup" primary lives only inside the transient dialog, mirroring the
   * shipped reset confirm.
   */
  import { tick } from "svelte";
  import { invalidateAll } from "$app/navigation";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import {
    PIPELINE_PRESET_IDS,
    PIPELINE_PRESETS,
    appliedPresetName,
    presetSlotChangeCount,
    type GraphTargetBundle,
    type PipelinePresetId,
  } from "$lib/connect/pipeline-config";

  /** The graph whose bundle this control rewrites (the workspace's active graph). */
  export let graphTargetId: string;
  /** The graph's bundle (contracts `ConnectGraphTarget["bundle"]` is assignable). */
  export let bundle: GraphTargetBundle = undefined;

  // Copy pack §2.7 deployment-preset field — VERBATIM.
  const FIELD_LABEL = "Where your pipeline runs";
  const FIELD_HELPER =
    "One choice swaps the whole vetted setup. You can still adjust individual stages below.";
  const CONFIRM_BUTTON = "Switch setup";
  const CANCEL_BUTTON = "Keep it";
  // §6.2-grammar save error (registered per the copy pack's §2.6/§4.5 precedent —
  // implementation-shipped, mirrors the §2.7 slot-save-error line verbatim in shape).
  const SWITCH_ERROR = "We couldn't switch the setup — your pipeline is unchanged. Try again.";

  /** Copy pack §2.7 outcome line per preset option — VERBATIM. Order = field order. */
  const OUTCOMES: Record<PipelinePresetId, string> = {
    "fully-managed": "Hosted services do the work — nothing to run yourself. The recommended starting point.",
    "highest-accuracy":
      "The strongest reading, search, and checking available. Builds run slower, and your documents go to hosted providers.",
    "regional-residency": "Your documents are processed only inside your chosen region.",
    "self-host-air-gapped":
      "Everything runs on your own infrastructure — nothing ever leaves it. You provide the computing power.",
  };

  $: currentPresetName = appliedPresetName(bundle);

  let rootEl: HTMLDivElement | undefined;
  let confirmEl: HTMLDivElement | undefined;
  let pending: PipelinePresetId | null = null;
  let switching = false;
  let announceText = "";
  let errorAnnounce = "";
  let errorVisible = false;

  function isSelected(id: PipelinePresetId): boolean {
    return currentPresetName === PIPELINE_PRESETS[id].name;
  }

  function mark(id: PipelinePresetId): string {
    return isSelected(id) ? "■ selected" : "□ select";
  }

  /** Copy pack §2.7 confirm body — blast radius in numbers (ux-craft §3.5), with the §0 singular. */
  function confirmBody(id: PipelinePresetId): string {
    const n = presetSlotChangeCount(bundle, id);
    const name = PIPELINE_PRESETS[id].name;
    const stages = n === 1 ? "1 stage" : `${n} stages`;
    return `Switch to ${name}? This swaps ${stages} to that setup. Your graph and answers stay as they are — the new setup applies from your next build.`;
  }

  async function startSwitch(id: PipelinePresetId) {
    if (isSelected(id) || switching) return;
    errorVisible = false;
    pending = id;
    await tick();
    confirmEl?.focus();
  }

  async function cancelSwitch() {
    const returnTo = pending;
    pending = null;
    // Await the flush so the opener (disabled while the modal was up — see the
    // option button's `disabled`) is re-enabled before we focus it; .focus() is
    // a no-op on a still-disabled button.
    await tick();
    if (returnTo) {
      // Return focus to the opener (X10).
      rootEl?.querySelector<HTMLButtonElement>(`#preset-opt-${returnTo}`)?.focus();
    }
  }

  function onConfirmKeydown(event: KeyboardEvent) {
    if (pending == null) return;
    if (event.key === "Escape") {
      event.preventDefault();
      cancelSwitch();
    } else if (event.key === "Enter" && !switching) {
      event.preventDefault();
      void confirmSwitch();
    }
  }

  async function confirmSwitch() {
    if (pending == null) return;
    const id = pending;
    switching = true;
    errorVisible = false;
    errorAnnounce = "";
    try {
      const res = await fetch(
        `${DASHBOARD_BASE}/api/connect/graph-library/${graphTargetId}/pipeline-preset`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preset: id }),
        },
      );
      if (!res.ok) {
        errorVisible = true;
        errorAnnounce = SWITCH_ERROR;
        return;
      }
      pending = null;
      // Re-derive the slot rows (and this control's own bundle) from the server.
      await invalidateAll();
      announceText = `Setup switched to ${PIPELINE_PRESETS[id].name}.`;
    } catch {
      errorVisible = true;
      errorAnnounce = SWITCH_ERROR;
    } finally {
      switching = false;
    }
  }
</script>

<div class="preset" bind:this={rootEl}>
  <p class="preset-label" id="preset-label">{FIELD_LABEL}</p>
  <p class="preset-helper" id="preset-helper">{FIELD_HELPER}</p>
  <ul class="preset-options" aria-labelledby="preset-label" aria-describedby="preset-helper">
    {#each PIPELINE_PRESET_IDS as id (id)}
      <li>
        <button
          type="button"
          id={"preset-opt-" + id}
          class="preset-option"
          class:sel={isSelected(id)}
          aria-pressed={isSelected(id)}
          disabled={switching || pending !== null}
          on:click={() => startSwitch(id)}
        >
          <span class="preset-mark" aria-hidden="true">{mark(id)}</span>
          <span class="preset-option-main">
            <span class="preset-option-name">{PIPELINE_PRESETS[id].name}</span>
            <span class="preset-outcome">{OUTCOMES[id]}</span>
          </span>
        </button>
      </li>
    {/each}
  </ul>

  {#if pending}
    <div
      bind:this={confirmEl}
      class="preset-confirm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="preset-confirm-title"
      tabindex="-1"
      on:keydown={onConfirmKeydown}
    >
      <p id="preset-confirm-title">{confirmBody(pending)}</p>
      <div class="preset-confirm-actions">
        <button type="button" class="btn btn-ghost" disabled={switching} on:click={cancelSwitch}>
          {CANCEL_BUTTON}
        </button>
        <button type="button" class="btn btn-primary" disabled={switching} on:click={confirmSwitch}>
          {switching ? "Switching…" : CONFIRM_BUTTON}
        </button>
      </div>
    </div>
  {/if}

  {#if errorVisible}
    <!-- Visible-only error (NOT a live region — announcement comes from the
         persistent assertive region below, never born inside {#if}). -->
    <p class="preset-error">{SWITCH_ERROR}</p>
  {/if}

  <!-- Persistent live regions (never inside an {#if}). -->
  <span class="sr-only" role="status" aria-live="polite">{announceText}</span>
  <span class="sr-only" role="alert" aria-live="assertive">{errorAnnounce}</span>
</div>

<style>
  .preset {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 100%;
  }
  .preset-label {
    margin: 0;
    font-weight: 700;
    color: var(--color-ink);
  }
  .preset-helper {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-ink-muted);
    max-width: 40rem;
  }
  .preset-options {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .preset-option {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    width: 100%;
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    border: var(--border-thin);
    background: var(--color-surface);
    text-align: left;
    cursor: pointer;
    color: var(--color-ink);
  }
  .preset-option:disabled {
    cursor: default;
  }
  .preset-option.sel {
    border: var(--border);
  }
  .preset-option:focus-visible {
    /* Yellow ring against the option's hard ink border (13.85:1) — offset:0 so it
       never floats in a cream gap (restormel-accessibility focus table, WCAG 1.4.11). */
    outline: 2px solid var(--color-yellow);
    outline-offset: 0;
  }
  .preset-mark {
    flex: 0 0 auto;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink);
    white-space: nowrap;
  }
  .preset-option-main {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .preset-option-name {
    font-weight: 700;
  }
  .preset-outcome {
    font-size: var(--text-sm);
    color: var(--color-ink-muted);
    max-width: 40rem;
  }
  .preset-confirm {
    max-width: 32rem;
    padding: var(--space-3);
    background: var(--color-surface);
    border: var(--border);
    border-left: 4px solid var(--color-yellow);
    box-shadow: var(--shadow-sm);
  }
  .preset-confirm p {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    color: var(--color-ink);
    line-height: 1.5;
  }
  .preset-confirm-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    justify-content: flex-end;
  }
  .preset-error {
    margin: 0;
    font-size: var(--text-sm);
    /* Ink text (AAA on surface), not coral text; coral carried as a danger border
       (restormel-accessibility §Colour — coral-on-surface body text fails 4.5:1). */
    color: var(--color-ink);
    border-left: 3px solid var(--coral-alert);
    padding-left: var(--space-2);
    max-width: 40rem;
  }
</style>
