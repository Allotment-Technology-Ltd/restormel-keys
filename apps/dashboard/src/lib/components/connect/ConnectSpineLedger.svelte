<script lang="ts">
  /**
   * Connect pipeline SPINE ledger (review §4 / Phase 2 keystone).
   *
   * The single persistent "where am I / what's next" component, mounted on every
   * Connect surface. Five hard-bordered stage tiles, the current stage
   * highlighted, exactly ONE primary CTA per stage. State is always visible;
   * every CTA is honest — disabled WITH a visible reason when it cannot act.
   *
   * State is DERIVED (connect-spine.ts) from signals each surface already loads —
   * no new backend. Pass `spine={null}` when the deriving signals were
   * unavailable (e.g. a load failed): the panel renders a quiet notice with a
   * recovery link instead of a fabricated status.
   */
  import {
    spineNumeral,
    type ConnectSpine,
    type ConnectSpineStage,
    type ConnectSpineStageId,
    type ConnectSpineStageState,
  } from "$lib/connect/connect-spine";
  import { HOME_HREF } from "$lib/nav-config";
  import { track } from "$lib/analytics/track";

  export let spine: ConnectSpine | null;
  /** Which surface is mounting this — used only to mark the active surface, never to change state. */
  export let activeStageId: ConnectSpineStage["id"] | null = null;

  /**
   * Decision 4 — the measured sources→answers funnel. Map the internal spine
   * stage id onto the stable, PII-free funnel stage name shipped in the analytics
   * taxonomy (events.ts). Keep these names STABLE — renaming breaks historical
   * funnel analysis in PostHog.
   */
  const FUNNEL_STAGE: Record<ConnectSpineStageId, string> = {
    connect: "bind",
    ingest: "ingest",
    make_ready: "make_ready",
    review: "make_ready",
    go_live: "go_live",
  };

  /**
   * A user acted on a spine stage's primary CTA. This is the journey's measured
   * forward motion:
   *  - The current-stage CTA is the single "Set up / do this next" door — emit
   *    `connect_door_choice {door:"setup"}` (the Quick-run door is Phase 3).
   *  - When the click moves to a DIFFERENT stage than the surface we're on, emit
   *    `connect_stage_advance {from,to}` so drop-off per stage is derivable.
   * No-ops in SSR (track() is browser-guarded) and never throws.
   */
  function onStageCta(stage: ConnectSpineStage): void {
    if (stage.isCurrent) {
      track("connect_door_choice", { door: "setup" });
    }
    const to = FUNNEL_STAGE[stage.id];
    const from = activeStageId ? FUNNEL_STAGE[activeStageId] : "hub";
    if (from !== to) {
      track("connect_stage_advance", { from, to });
    }
  }

  function glyph(state: ConnectSpineStageState): string {
    switch (state) {
      case "done":
        return "■";
      case "current":
        return "▸";
      case "blocked":
        return "□";
      case "todo":
        return "□";
      default:
        return "·";
    }
  }

  function stateWord(state: ConnectSpineStageState): string {
    switch (state) {
      case "done":
        return "done";
      case "current":
        return "do this";
      case "blocked":
        return "blocked";
      case "todo":
        return "next";
      default:
        return "—";
    }
  }
</script>

<section class="spine" aria-label="Connect pipeline — where you are and what's next">
  <div class="spine-head">
    <h2 class="spine-heading">Build your verified graph</h2>
    {#if spine}
      <span class="spine-chip" aria-label="{spine.done} of {spine.total} stages done">
        {spine.done}/{spine.total} done
      </span>
    {/if}
  </div>

  {#if !spine}
    <div class="spine-fallback" role="status">
      <p class="spine-fallback-text">
        Pipeline status couldn't be read on this screen. Your setup is unaffected.
      </p>
      <a class="spine-fallback-link brut-focus" href={HOME_HREF}>Open the Connect hub →</a>
    </div>
  {:else}
    <ol class="spine-rail">
      {#each spine.stages as stage (stage.id)}
        <li
          class="spine-stage spine-stage--{stage.state}"
          class:spine-stage--current={stage.isCurrent}
          class:spine-stage--here={activeStageId === stage.id}
          aria-current={activeStageId === stage.id ? "step" : undefined}
        >
          <div class="spine-stage-top">
            <span class="spine-numeral" aria-hidden="true">{spineNumeral(stage.index)}</span>
            <span class="spine-glyph spine-glyph--{stage.state}" aria-hidden="true">
              {glyph(stage.state)}
            </span>
            <span class="spine-state spine-state--{stage.state}">{stateWord(stage.state)}</span>
          </div>

          <div class="spine-stage-main">
            <span class="spine-label">{stage.label}</span>
            <span class="spine-blurb">{stage.blurb}</span>
            <span class="spine-summary">{stage.summary}</span>
          </div>

          <div class="spine-cta-wrap">
            {#if stage.cta.disabled}
              <button
                type="button"
                class="spine-cta spine-cta--disabled"
                disabled
                title={stage.cta.disabledReason ?? undefined}
              >
                {stage.cta.label}
              </button>
              {#if stage.cta.disabledReason}
                <span class="spine-cta-reason">{stage.cta.disabledReason}</span>
              {/if}
            {:else}
              <a
                class="spine-cta brut-focus brut-pressable"
                class:spine-cta--primary={stage.isCurrent}
                href={stage.cta.href}
                on:click={() => onStageCta(stage)}
              >
                {stage.cta.label} →
              </a>
            {/if}
          </div>
        </li>
      {/each}
    </ol>
  {/if}
</section>

<style>
  .spine {
    margin: 0 0 var(--space-5);
  }

  .spine-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-3);
    margin: 0 0 var(--space-3);
  }

  .spine-heading {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
    margin: 0;
  }

  .spine-chip {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    border: var(--border);
    padding: 1px var(--space-2);
    background: var(--color-surface);
    color: var(--color-ink);
  }

  .spine-fallback {
    border: var(--border);
    background: var(--color-surface);
    padding: var(--space-3);
    box-shadow: var(--shadow-sm);
  }

  .spine-fallback-text {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-ink-muted);
  }

  .spine-fallback-link {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    color: var(--color-ink);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  /* The rail: five hard-bordered tiles in a row (stacks on narrow screens). */
  .spine-rail {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0;
    border: var(--border);
    background: var(--color-ink);
    box-shadow: var(--shadow-md);
  }

  .spine-stage {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--color-surface);
    border-right: var(--border-thin);
    min-height: 44px;
  }

  .spine-stage:last-child {
    border-right: none;
  }

  /* State fills — flat, no blur. Current stage gets the yellow accent band. */
  .spine-stage--done {
    background: color-mix(in oklab, var(--state-ok-bg) 45%, var(--color-surface));
  }

  .spine-stage--blocked,
  .spine-stage--todo {
    background: var(--color-surface);
  }

  .spine-stage--current {
    background: color-mix(in oklab, var(--color-yellow) 22%, var(--color-surface));
  }

  /* The surface you're on: a thick top accent so "you are here" reads instantly. */
  .spine-stage--here {
    box-shadow: inset 0 4px 0 var(--color-blue);
  }

  .spine-stage--current.spine-stage--here {
    box-shadow: inset 0 4px 0 var(--color-ink);
  }

  .spine-stage-top {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .spine-numeral {
    font-size: var(--text-mono-lg);
    line-height: 1;
    color: var(--color-ink);
    font-weight: 700;
  }

  .spine-glyph {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    line-height: 1;
  }

  .spine-glyph--done {
    color: var(--color-ink);
  }

  .spine-glyph--current {
    color: var(--color-ink);
  }

  .spine-glyph--blocked {
    color: var(--state-fail-fg, var(--color-ink-muted));
  }

  .spine-glyph--todo {
    color: var(--color-ink-muted);
  }

  .spine-state {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border: var(--border-thin);
    padding: 1px var(--space-2);
    white-space: nowrap;
  }

  .spine-state--done {
    background: var(--state-ok-bg);
    color: var(--state-ok-fg);
  }

  .spine-state--current {
    background: var(--color-yellow);
    color: var(--color-ink);
  }

  .spine-state--blocked {
    background: var(--state-fail-bg);
    color: var(--state-fail-fg);
  }

  .spine-state--todo {
    background: var(--color-surface);
    color: var(--color-ink-muted);
  }

  .spine-state--unknown {
    background: var(--color-surface);
    color: var(--color-ink-muted);
  }

  .spine-stage-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .spine-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-ink);
  }

  .spine-blurb {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
    line-height: 1.35;
  }

  .spine-summary {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    color: var(--color-ink);
    line-height: 1.35;
  }

  .spine-cta-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: auto;
  }

  .spine-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    min-height: 44px;
    padding: 6px var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border: var(--border);
    background: var(--color-surface);
    color: var(--color-ink);
    box-shadow: var(--shadow-sm);
    text-decoration: none;
  }

  /* Single yellow primary CTA — only on the current stage. */
  .spine-cta--primary {
    background: var(--color-yellow);
    color: var(--color-ink);
  }

  .spine-cta--disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
    background: var(--color-surface);
  }

  .spine-cta-reason {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
    line-height: 1.3;
  }

  @media (max-width: 900px) {
    .spine-rail {
      grid-template-columns: 1fr;
    }
    .spine-stage {
      border-right: none;
      border-bottom: var(--border-thin);
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
    }
    .spine-stage:last-child {
      border-bottom: none;
    }
    .spine-stage--here {
      box-shadow: inset 4px 0 0 var(--color-blue);
    }
    .spine-stage--current.spine-stage--here {
      box-shadow: inset 4px 0 0 var(--color-ink);
    }
    .spine-stage-main {
      flex: 1 1 240px;
    }
    .spine-cta-wrap {
      margin-top: 0;
      flex: 1 1 160px;
    }
  }
</style>
