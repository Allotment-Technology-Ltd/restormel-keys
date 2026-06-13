<script lang="ts">
  /**
   * Versioned-config intelligence (Stage W3.5) — human-readable diff renderer.
   *
   * Renders a `DiffModel` (built by `$lib/route-version-diff`) as field-level
   * added / removed / changed rows in the neo-brutalist idiom, with a raw-JSON
   * fallback for the operator who wants the full snapshots. Each changed field
   * exposes an "open in builder" affordance (rubric X4 — every diff row links to
   * the field it changed) via the optional `onOpenField` callback.
   *
   * State model (docs/design/ux-contracts.md §3): the parent owns loading / error and
   * passes them in; this component renders empty (no changes) + populated.
   */
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import BrutalLoadingState from "$lib/components/brutalist/BrutalLoadingState.svelte";
  import { summarizeDiff, type DiffModel } from "$lib/route-version-diff";

  /** The computed diff to render. */
  export let model: DiffModel | null = null;
  /** Loading flag (parent-owned — diff is being computed/fetched). */
  export let loading = false;
  /** Error message (parent-owned). Empty string = no error. */
  export let errorMessage = "";
  /** Recovery callback for the error state. */
  export let onRetry: (() => void) | undefined = undefined;
  /**
   * Optional deep-link callback. Receives the changed field's `fieldPath`
   * (e.g. `step.1.modelId`, `route.name`, `policy.ruleDefinition`) and, for
   * step rows, the snapshot step's stable `stepId` so the resolver can target
   * the step by id rather than the (drift-prone) orderIndex baked into the path.
   * When provided, each changed field renders an "Open in builder →" link.
   */
  export let onOpenField: ((fieldPath: string, stepId?: string) => void) | undefined = undefined;
  /** Raw snapshots for the raw-JSON fallback view; optional. */
  export let rawFrom: unknown = undefined;
  export let rawTo: unknown = undefined;

  let showRaw = false;

  const GLYPH: Record<string, string> = { added: "+", removed: "−", changed: "~" };
  const WORD: Record<string, string> = { added: "ADDED", removed: "REMOVED", changed: "CHANGED" };

  function rawJson(v: unknown): string {
    try {
      return JSON.stringify(v ?? null, null, 2);
    } catch {
      return String(v);
    }
  }

  $: summary = model ? summarizeDiff(model) : "";
</script>

<div class="diff-view">
  {#if loading}
    <BrutalLoadingState message="Computing diff…" rows={3} />
  {:else if errorMessage}
    <BrutalErrorBanner title="Could not compute the diff" message={errorMessage}>
      {#snippet actions()}
        {#if onRetry}
          <button type="button" class="diff-btn diff-btn--primary" onclick={() => onRetry?.()}>Try again</button>
        {/if}
      {/snippet}
    </BrutalErrorBanner>
  {:else if model}
    <div class="diff-head">
      <p class="diff-versions" role="status">
        Comparing
        <span class="diff-ver">v{model.fromVersion ?? "?"}</span>
        →
        <span class="diff-ver">v{model.toVersion ?? "?"}</span>
      </p>
      <p class="diff-summary">{summary}</p>
      {#if rawFrom !== undefined || rawTo !== undefined}
        <button
          type="button"
          class="diff-raw-toggle brut-focus"
          aria-pressed={showRaw}
          onclick={() => (showRaw = !showRaw)}
        >
          {showRaw ? "Hide raw JSON" : "Show raw JSON"}
        </button>
      {/if}
    </div>

    {#if showRaw}
      <div class="diff-raw" role="group" aria-label="Raw version snapshots">
        <div class="diff-raw-col">
          <h4 class="diff-raw-title">v{model.fromVersion ?? "?"} (from)</h4>
          <pre class="diff-raw-pre">{rawJson(rawFrom)}</pre>
        </div>
        <div class="diff-raw-col">
          <h4 class="diff-raw-title">v{model.toVersion ?? "?"} (to)</h4>
          <pre class="diff-raw-pre">{rawJson(rawTo)}</pre>
        </div>
      </div>
    {:else if model.empty}
      <div class="diff-empty">
        <p class="diff-empty-msg">No changes between the selected versions.</p>
        <p class="diff-empty-hint">
          These two versions are structurally identical. Pick a different version to compare.
        </p>
      </div>
    {:else}
      <ul class="diff-rows" aria-label="Changes between the selected versions">
        {#each model.rows as row, i (row.title + "-" + row.kind + "-" + i)}
          <li class="diff-row diff-row--{row.kind}">
            <div class="diff-row-head">
              <span class="diff-glyph diff-glyph--{row.kind}" aria-hidden="true">{GLYPH[row.kind]}</span>
              <span class="diff-kind">{WORD[row.kind]}</span>
              <span class="diff-row-title">{row.title}</span>
              {#if onOpenField && row.anchorPath}
                <button
                  type="button"
                  class="diff-open-link brut-focus"
                  onclick={() => onOpenField?.(row.anchorPath, row.stepId)}
                >
                  Open in builder →
                </button>
              {/if}
            </div>

            {#if row.changes.length > 0}
              <ul class="diff-fields">
                {#each row.changes as change (change.fieldPath)}
                  <li class="diff-field">
                    <span class="diff-field-label">{change.label}</span>
                    <span class="diff-field-values">
                      <span class="diff-from">{change.from ?? "—"}</span>
                      <span class="diff-arrow" aria-hidden="true">→</span>
                      <span class="diff-to">{change.to ?? "—"}</span>
                    </span>
                    {#if onOpenField}
                      <button
                        type="button"
                        class="diff-field-link brut-focus"
                        aria-label="Open {change.label} in the builder"
                        onclick={() => onOpenField?.(change.fieldPath, row.stepId)}
                      >
                        ↗
                      </button>
                    {/if}
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="diff-row-note">
                {row.kind === "added"
                  ? "This step is new in the later version."
                  : "This step was present in the earlier version and is gone in the later one."}
              </p>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<style>
  .diff-view {
    margin-top: var(--space-3);
  }

  .diff-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2) var(--space-3);
    margin-bottom: var(--space-3);
    padding-bottom: var(--space-2);
    border-bottom: var(--brut-border-width, 2px) solid var(--brut-ink);
  }

  .diff-versions {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm, var(--text-sm));
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--rm-text);
  }

  .diff-ver {
    font-weight: 800;
  }

  .diff-summary {
    margin: 0;
    font-weight: 600;
    font-size: var(--text-sm);
    color: var(--rm-text);
  }

  .diff-raw-toggle {
    margin-left: auto;
    background: transparent;
    border: var(--brut-border-width, 2px) solid var(--brut-ink);
    color: var(--brut-ink);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm, var(--text-xs));
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: var(--space-1) var(--space-2);
    cursor: pointer;
    border-radius: 0;
  }
  .diff-raw-toggle[aria-pressed="true"] {
    background: var(--brut-ink);
    color: var(--brut-white, #fff);
  }

  .diff-raw {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }
  @media (max-width: 640px) {
    .diff-raw {
      grid-template-columns: 1fr;
    }
  }
  .diff-raw-title {
    margin: 0 0 var(--space-1);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm, var(--text-xs));
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--rm-muted);
  }
  .diff-raw-pre {
    margin: 0;
    padding: var(--space-3);
    border: var(--brut-border-width, 2px) solid var(--brut-ink);
    background: var(--brut-canvas-deep, var(--rm-surface-raised));
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: 1.5;
    overflow-x: auto;
    white-space: pre;
  }

  .diff-empty {
    border: var(--brut-border-width, 2px) solid var(--brut-ink);
    background: var(--brut-canvas, var(--rm-surface-raised));
    padding: var(--space-4);
  }
  .diff-empty-msg {
    margin: 0 0 var(--space-1);
    font-weight: 700;
  }
  .diff-empty-hint {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }

  .diff-rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .diff-row {
    border: var(--brut-border-width, 2px) solid var(--brut-ink);
    background: var(--brut-white, #fff);
    box-shadow: var(--brut-shadow);
    padding: var(--space-3);
  }

  .diff-row-head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    min-height: 28px;
  }

  .diff-glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    font-family: var(--font-mono);
    font-weight: 900;
    border: var(--brut-border-width, 2px) solid var(--brut-ink);
  }
  .diff-glyph--added {
    background: var(--state-ok-bg);
    color: var(--state-ok-fg);
  }
  .diff-glyph--removed {
    background: var(--state-fail-bg);
    color: var(--state-fail-fg);
  }
  .diff-glyph--changed {
    background: var(--state-warn-bg);
    color: var(--state-warn-fg);
  }

  .diff-kind {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm, var(--text-xs));
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--rm-text);
  }

  .diff-row-title {
    font-weight: 700;
    font-size: var(--text-sm);
    color: var(--rm-text);
  }

  .diff-open-link {
    margin-left: auto;
    background: transparent;
    border: none;
    color: var(--brut-blue);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm, var(--text-xs));
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: pointer;
    padding: var(--space-1);
  }
  .diff-open-link:hover {
    text-decoration: underline;
  }

  .diff-fields {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .diff-field {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: var(--space-1) 0;
    border-top: var(--border-thin);
  }

  .diff-field-label {
    flex: 0 0 auto;
    min-width: 8rem;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--rm-muted);
  }

  .diff-field-values {
    flex: 1 1 auto;
    display: inline-flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .diff-from {
    color: var(--state-fail-fg, var(--rm-text));
    text-decoration: line-through;
    text-decoration-thickness: 1px;
  }
  .diff-arrow {
    color: var(--rm-muted);
  }
  .diff-to {
    color: var(--state-ok-fg, var(--rm-text));
    font-weight: 700;
  }

  .diff-field-link {
    flex: 0 0 auto;
    background: transparent;
    border: none;
    color: var(--brut-blue);
    font-weight: 800;
    font-size: var(--text-sm);
    cursor: pointer;
    padding: 0 var(--space-1);
    line-height: 1;
  }
  .diff-field-link:hover {
    text-decoration: underline;
  }

  .diff-row-note {
    margin: var(--space-2) 0 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }

  .diff-btn {
    padding: var(--space-2) var(--space-4);
    border-radius: 0;
    font-size: var(--text-sm);
    font-weight: 700;
    border: var(--brut-border-width, 2px) solid var(--brut-ink);
    cursor: pointer;
  }
  .diff-btn--primary {
    background: var(--brut-ink);
    color: var(--brut-white, #fff);
  }
</style>
