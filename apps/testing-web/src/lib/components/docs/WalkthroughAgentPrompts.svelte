<script lang="ts">
  import type { Snippet } from "svelte";

  /** Collapsed by default — same UX contract as Keys walkthrough phase pages. */
  let { children }: { children: Snippet } = $props();
</script>

<details class="agent-prompts">
  <summary class="agent-prompts__summary">Agent prompts</summary>
  <div class="agent-prompts__body">
    <p class="agent-prompts__note">
      Optional: use these with a coding agent to implement this phase in your repo in a safe, gated sequence. Expand only
      when you need them.
    </p>
    {@render children()}
  </div>
</details>

<style>
  .agent-prompts {
    margin-top: var(--space-8);
    padding: var(--space-4);
    background: var(--rm-surface);
    border: var(--border-1) solid var(--rm-border);
    border-radius: var(--rm-card-radius);
  }

  .agent-prompts__summary {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    cursor: pointer;
    list-style: none;
  }

  .agent-prompts__summary::-webkit-details-marker {
    display: none;
  }

  .agent-prompts__summary::before {
    content: "▸ ";
    color: var(--rm-sage);
  }

  .agent-prompts[open] .agent-prompts__summary::before {
    content: "▾ ";
  }

  .agent-prompts__summary:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }

  .agent-prompts__body {
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: var(--border-1) solid var(--rm-border);
  }

  .agent-prompts__note {
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    color: var(--rm-dim);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-4);
  }

  :global(.agent-prompts__body .doc-prose) {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
  }

  :global(.agent-prompts__body .doc-prose ol) {
    margin: 0;
    padding-left: var(--space-5);
  }

  :global(.agent-prompts__body .doc-prose li) {
    margin-bottom: var(--space-2);
  }

  :global(.agent-prompts__body .doc-prose code) {
    font-size: 0.9em;
    color: var(--rm-text);
  }
</style>
