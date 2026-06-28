<script lang="ts" context="module">
  /**
   * The honest M0–M4 pipeline / claim states (REC-ADR-016: name the real state,
   * never fake progress). Each maps to an EXISTING design token — no new tokens.
   */
  export type StateChipState =
    | "idle" // queued / not started
    | "running" // in progress
    | "done" // complete / verified
    | "weak" // low-confidence / needs you
    | "unsupported" // no supporting evidence
    | "error"; // failed
</script>

<script lang="ts">
  import type { Snippet } from "svelte";

  /** Honest pipeline state — drives the filled colour + accessible state word. */
  export let state: StateChipState = "idle";
  /** Visible chip text. Falls back to the state word when no label/children given. */
  export let label: string | undefined = undefined;
  /** Show a leading status dot (pulses only while `running`, reduced-motion safe). */
  export let dot = true;
  /** Optional inline content; overrides `label`. */
  export let children: Snippet | undefined = undefined;

  const STATE_WORD: Record<StateChipState, string> = {
    idle: "Idle",
    running: "Running",
    done: "Done",
    weak: "Weak",
    unsupported: "Unsupported",
    error: "Error",
  };

  $: text = label ?? STATE_WORD[state];
</script>

<span
  class="state-chip state-{state}"
  data-testid="state-chip"
  data-state={state}
  role="status"
  aria-label={`${STATE_WORD[state]}${label ? `: ${label}` : ""}`}
>
  {#if dot}
    <span class="state-chip-dot" class:is-running={state === "running"} aria-hidden="true"></span>
  {/if}
  <span class="state-chip-text">
    {#if children}{@render children()}{:else}{text}{/if}
  </span>
</span>

<style>
  .state-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: 2px var(--space-2);
    min-height: 22px;
    border: var(--border-thin);
    border-radius: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    white-space: nowrap;
    /* Filled by the per-state rules below — defaults are the neutral idle look. */
    background: var(--color-surface);
    color: var(--color-ink-muted);
    border-color: var(--color-ink-faint);
  }

  /* Each variant maps to an EXISTING token (brutalist-rm.css). Zero new tokens. */
  .state-chip.state-idle {
    background: var(--color-surface);
    color: var(--color-ink-muted);
    border-color: var(--color-ink-faint);
  }
  .state-chip.state-running {
    background: var(--color-surface);
    color: var(--color-ink);
    border-color: var(--brut-amber);
  }
  .state-chip.state-done {
    background: var(--state-ok-bg);
    color: var(--state-ok-fg);
    border-color: var(--state-ok-fg);
  }
  .state-chip.state-weak {
    background: var(--state-warn-bg);
    color: var(--state-warn-fg);
    border-color: var(--state-warn-fg);
  }
  .state-chip.state-unsupported {
    background: var(--color-bg-deep);
    color: var(--color-ink-muted);
    border-color: var(--color-ink-muted);
  }
  .state-chip.state-error {
    background: var(--state-fail-bg);
    color: var(--state-fail-fg);
    border-color: var(--state-fail-fg);
  }

  .state-chip-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 999px;
    flex: 0 0 auto;
    background: currentColor;
  }
  .state-chip-dot.is-running {
    background: var(--brut-amber);
    animation: state-chip-pulse 1.4s ease-in-out infinite;
  }

  @keyframes state-chip-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.25;
    }
  }

  /* Colour + the state word always carry the meaning; hold the dot solid. */
  @media (prefers-reduced-motion: reduce) {
    .state-chip-dot.is-running {
      animation: none;
    }
  }
</style>
