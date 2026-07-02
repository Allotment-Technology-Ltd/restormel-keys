<script lang="ts">
  /**
   * RES-113 · verification-engine plug-points — the ONE slot-row renderer (PR-2).
   *
   * One derivation, one renderer, two hosts (placement spec §3.4 decision C): this
   * component renders `resolveM1PipelineSlots` rows inside (a) the sources-page
   * "Advanced — full pipeline control" disclosure and (b) the `/routes/ingestion`
   * operator twin. Both hosts gate on the `m1PlugPoints` module flag AND their
   * disclosure being open — this component is never mounted otherwise, so the
   * reveal predicate is "disclosure open; otherwise zero pixels" (spec §3.1).
   *
   * Reconciliation with `ConnectGraphLibrary.svelte` (spec §3.1 dedup, PR #431):
   * the library is a graph-STORE picker (it writes only `default_domain_pack_id`
   * and connection details — no per-stage affordance), so these rows are the
   * disclosure's per-stage tenant beside it, not a duplicate editor. Store is
   * NEVER a slot row — the `?step=store` aside owns it.
   *
   * Copy: every user string is copy-pack §2.7 VERBATIM (row anatomy, outcome
   * lines, the single incompatibility reason line, the customisation summary,
   * and the PR-2-registered save states). BLOCKED/AMBIGUOUS component names can
   * never render — they are absent from the PR-1 catalog by construction, and
   * the test walks every emitted string (REC-GOV-022).
   *
   * A11y (restormel-accessibility): the Change secondary is ≥44px with an
   * accessible name naming its stage; opening the curated list moves focus to
   * the current choice; Escape closes and returns focus to the opener; selection
   * is glyph + word + `aria-pressed`, never colour alone (R3-A3); saves announce
   * on a persistent polite status region (never inside an `{#if}`).
   */
  import { tick } from "svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import {
    changedPipelineSlotCount,
    parsePipelineSlotAssignments,
    resolveM1PipelineSlots,
    type GraphTargetBundle,
    type PipelineSlotId,
    type PipelineSlotOption,
    type PipelineSlotRow,
  } from "$lib/connect/pipeline-config";

  /** The graph whose bundle these rows edit (the workspace's active graph). */
  export let graphTargetId: string;
  /** The graph's bundle (contracts `ConnectGraphTarget["bundle"]` is assignable). */
  export let bundle: GraphTargetBundle = undefined;
  /**
   * Test seam: injected pre-derived rows. The shipped CLEARED menus are
   * family-disjoint (extract × validate), so `blockedReason` cannot fire through
   * the real catalog today — this seam lets the registered §2.7 reason line's
   * rendering be genuinely covered, mirroring PR-1's exported-for-test
   * `offeredOptionsForFamilyConflict`. Hosts never set it.
   */
  export let rowsOverride: PipelineSlotRow[] | null = null;

  // Copy pack §2.7 (save states registered by PR-2) — VERBATIM.
  const SAVE_ERROR = "We couldn't save that choice — your pipeline is unchanged. Try again.";
  const SAVING_WORD = "saving…";

  $: rows = rowsOverride ?? resolveM1PipelineSlots(bundle);
  $: changedCount = rowsOverride
    ? rowsOverride.filter((r) => !r.isDefault).length
    : changedPipelineSlotCount(bundle);

  let rootEl: HTMLDivElement | undefined;
  let openSlot: PipelineSlotId | null = null;
  let savingSlot: PipelineSlotId | null = null;
  let savingOptionId: string | null = null;
  let errorSlot: PipelineSlotId | null = null;
  let announceText = "";

  async function toggleOpen(slot: PipelineSlotId) {
    errorSlot = null;
    if (openSlot === slot) {
      openSlot = null;
      return;
    }
    openSlot = slot;
    await tick();
    // Focus the current choice so keyboard users land on state, not chrome.
    const current = rootEl?.querySelector<HTMLButtonElement>(
      `#slot-options-${slot} button[aria-pressed="true"]`,
    );
    current?.focus();
  }

  function closeAndReturnFocus(slot: PipelineSlotId) {
    openSlot = null;
    rootEl?.querySelector<HTMLButtonElement>(`#slot-change-${slot}`)?.focus();
  }

  function onOptionKeydown(event: KeyboardEvent, slot: PipelineSlotId) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeAndReturnFocus(slot);
    }
  }

  function onChangeKeydown(event: KeyboardEvent, slot: PipelineSlotId) {
    if (event.key === "Escape" && openSlot === slot) {
      event.preventDefault();
      openSlot = null;
    }
  }

  function markFor(row: PipelineSlotRow, o: PipelineSlotOption): string {
    if (savingSlot === row.slot && savingOptionId === o.id) return SAVING_WORD;
    return o.isSelected ? "■ selected" : "□ select";
  }

  async function choose(row: PipelineSlotRow, o: PipelineSlotOption) {
    if (o.isSelected || savingSlot !== null) return;
    savingSlot = row.slot;
    savingOptionId = o.id;
    errorSlot = null;
    try {
      const res = await fetch(
        `${DASHBOARD_BASE}/api/connect/graph-library/${graphTargetId}/pipeline-slots`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slot: row.slot, option_id: o.id }),
        },
      );
      const d = (await res.json().catch(() => ({}))) as { pipeline_slots?: unknown };
      if (!res.ok) {
        errorSlot = row.slot;
        return;
      }
      // Server-authoritative slot map → local bundle → rows re-derive in place.
      bundle = { ...(bundle ?? {}), pipeline_slots: parsePipelineSlotAssignments(d.pipeline_slots) };
      announceText = `${row.stageName} now uses ${o.name}.`;
    } catch {
      errorSlot = row.slot;
    } finally {
      savingSlot = null;
      savingOptionId = null;
    }
  }
</script>

<div class="slot-rows" bind:this={rootEl}>
  {#if changedCount > 0}
    <!-- Copy pack §2.7 customisation summary — predicate: bundle ≠ default. -->
    <p class="slot-summary">
      {changedCount === 1
        ? "1 stage changed from the recommended default."
        : `${changedCount} stages changed from the recommended default.`}
    </p>
  {/if}
  <ul class="slot-list">
    {#each rows as row (row.slot)}
      <li class="slot-row">
        <div class="slot-head">
          <span class="slot-stage">{row.stageName}</span>
          <span class="slot-current">{row.currentName}</span>
          <button
            type="button"
            id={"slot-change-" + row.slot}
            class="btn btn-outline btn-sm slot-change"
            aria-expanded={openSlot === row.slot}
            aria-controls={"slot-options-" + row.slot}
            aria-label={"Change the model for " + row.stageName}
            on:click={() => toggleOpen(row.slot)}
            on:keydown={(e) => onChangeKeydown(e, row.slot)}
          >
            Change
          </button>
        </div>
        {#if openSlot === row.slot}
          <ul class="slot-options" id={"slot-options-" + row.slot} aria-busy={savingSlot === row.slot}>
            {#each row.options as o (o.id)}
              <li>
                <button
                  type="button"
                  class="slot-option"
                  class:sel={o.isSelected}
                  aria-pressed={o.isSelected}
                  disabled={savingSlot !== null}
                  on:click={() => choose(row, o)}
                  on:keydown={(e) => onOptionKeydown(e, row.slot)}
                >
                  <!-- Glyph + word in BOTH states (copy pack §4.5 mark, reused by §2.7). -->
                  <span class="slot-mark" aria-hidden="true">{markFor(row, o)}</span>
                  <span class="slot-option-main">
                    <span class="slot-option-name">
                      {o.name}
                      {#if o.isRecommended}
                        <span class="slot-rec">
                          <span aria-hidden="true">RECOMMENDED</span>
                          <span class="sr-only">the recommended default</span>
                        </span>
                      {/if}
                    </span>
                    <span class="slot-outcome">{o.outcome}</span>
                  </span>
                </button>
              </li>
            {/each}
          </ul>
          {#if row.blockedReason}
            <!-- §2.7 single reason line (decisions B + D): incompatible options are
                 ABSENT above; this muted line renders once when any were excluded. -->
            <p class="slot-reason">{row.blockedReason}</p>
          {/if}
        {/if}
        {#if errorSlot === row.slot}
          <p class="slot-error" role="alert">{SAVE_ERROR}</p>
        {/if}
      </li>
    {/each}
  </ul>
  <!-- Persistent polite region (never inside an {#if}) — announces saved choices. -->
  <span class="sr-only" role="status" aria-live="polite">{announceText}</span>
</div>

<style>
  .slot-rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 100%;
  }
  .slot-summary {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
  }
  .slot-list {
    list-style: none;
    margin: 0;
    padding: 0;
    border: var(--border);
    background: var(--color-surface);
  }
  .slot-row {
    padding: var(--space-2) var(--space-3);
    border-bottom: var(--border-thin);
  }
  .slot-row:last-child {
    border-bottom: none;
  }
  .slot-head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .slot-stage {
    flex: 1 1 12rem;
    font-weight: 700;
    color: var(--color-ink);
  }
  .slot-current {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
  }
  .slot-change {
    /* 04_TOKENS floor: ≥44px hit target on the per-row secondary. */
    min-height: 44px;
    min-width: 44px;
  }
  .slot-options {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .slot-option {
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
  .slot-option:disabled {
    cursor: default;
  }
  .slot-option.sel {
    border: var(--border);
  }
  .slot-option:focus-visible {
    outline: 2px solid var(--color-yellow);
    outline-offset: 2px;
  }
  .slot-mark {
    flex: 0 0 auto;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink);
    white-space: nowrap;
  }
  .slot-option-main {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .slot-option-name {
    font-weight: 700;
  }
  .slot-rec {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    border: var(--border-thin);
    padding: 0 var(--space-1);
    margin-left: var(--space-1);
    color: var(--color-ink);
    white-space: nowrap;
  }
  .slot-outcome {
    font-size: var(--text-sm);
    color: var(--color-ink-muted);
    max-width: 40rem;
  }
  .slot-reason,
  .slot-error {
    margin: var(--space-2) 0 0;
    font-size: var(--text-sm);
    color: var(--color-ink-muted);
    max-width: 40rem;
  }
  .slot-error {
    color: var(--coral-alert, #b00);
  }
</style>
