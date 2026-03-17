<script context="module" lang="ts">
  export type AgentPromptCard = {
    id: string;
    title: string;
    intent?: string;
    contextDocs: string[];
    prompt: string;
    gate: string;
  };
</script>

<script lang="ts">
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";
  import { areDocsAgentPromptsEnabled } from "$lib/docs-agent-prompts";

  export let heading = "Prompts for this phase";
  export let intro =
    "If you're implementing this phase with a coding agent, run these prompts in order. Stop if a gate fails.";
  export let prompts: import("./AgentPromptsSection.svelte").AgentPromptCard[] = [];

  export let defaultOpen = false;

  const enabled = areDocsAgentPromptsEnabled();
  let open = defaultOpen;

  function toggle() {
    open = !open;
  }
</script>

{#if enabled && prompts.length > 0}
  <section class="agent-prompts" aria-label="Agent prompts">
    <div class="agent-prompts-header">
      <span class="agent-badge" aria-hidden="true">Agent</span>
      <div class="agent-prompts-heading-row">
        <h2 class="agent-prompts-heading">{heading}</h2>
        <button
          type="button"
          class="agent-prompts-toggle"
          aria-expanded={open}
          on:click={toggle}
        >
          <span class="agent-prompts-toggle-label">{open ? "Hide" : "Show"}</span>
          <span class="agent-prompts-toggle-icon" aria-hidden="true">{open ? "▾" : "▸"}</span>
        </button>
      </div>
    </div>

    <div class="agent-prompts-body">
      <p class="agent-prompts-intro">{intro}</p>

      {#if open}
      <ol class="agent-prompts-list">
        {#each prompts as p}
          <li class="agent-prompt-card" data-prompt-id={p.id}>
            <div class="agent-prompt-card-header">
              <h3 class="agent-prompt-title">{p.title}</h3>
              {#if p.intent}
                <p class="agent-prompt-intent">{p.intent}</p>
              {/if}
            </div>

            <div class="agent-prompt-meta">
              <div class="agent-prompt-meta-block">
                <p class="agent-prompt-meta-title">Context docs</p>
                <ul class="agent-prompt-meta-list">
                  {#each p.contextDocs as d}
                    <li><code>{d}</code></li>
                  {/each}
                </ul>
              </div>
            </div>

            <p class="agent-prompt-meta-title">Prompt</p>
            <CodeBlock language="text" code={p.prompt} />

            <p class="agent-prompt-gate">
              <strong>Gate:</strong> {p.gate}
            </p>
          </li>
        {/each}
      </ol>
      {/if}
    </div>
  </section>
{/if}

<style>
  .agent-prompts {
    margin: var(--space-8) 0;
    padding: var(--space-4);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: color-mix(in oklab, var(--rm-surface-raised) 55%, var(--rm-surface));
    overflow: hidden;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0 var(--space-3);
    align-items: start;
  }

  .agent-prompts-header {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: subgrid;
    align-items: start;
    gap: var(--space-2) var(--space-3);
    margin: 0 0 var(--space-2);
  }

  .agent-prompts-heading-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    min-width: 0;
  }

  .agent-prompts-heading {
    margin: 0;
    font-size: var(--text-lg);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .agent-badge {
    font-size: var(--text-xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    border: 1px solid color-mix(in oklab, var(--rm-primary) 35%, var(--rm-border));
    background: color-mix(in oklab, var(--rm-primary) 12%, var(--rm-surface));
    color: var(--rm-primary);
    font-weight: var(--font-medium);
    line-height: 1.2;
    user-select: none;
  }

  .agent-prompts-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid var(--rm-border);
    background: var(--rm-bg);
    color: var(--rm-muted);
    padding: 0.4rem 0.6rem;
    border-radius: var(--radius);
    cursor: pointer;
    font-size: var(--text-sm);
    line-height: 1;
    user-select: none;
    flex: 0 0 auto;
  }

  .agent-prompts-toggle:hover {
    background: var(--rm-surface);
  }

  .agent-prompts-toggle-icon {
    font-size: 0.95rem;
    color: var(--rm-primary);
  }

  .agent-prompts-body {
    grid-column: 2;
    margin: 0;
    padding: 0;
    min-width: 0;
  }

  .agent-prompts-intro {
    margin: 0 0 var(--space-4);
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }

  .agent-prompts-list {
    list-style: decimal;
    padding-left: 1.25rem;
    margin: 0;
    display: grid;
    gap: var(--space-4);
    list-style-position: outside;
  }

  .agent-prompt-card {
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface);
    padding: var(--space-4);
    overflow: hidden;
  }

  .agent-prompt-card-header {
    margin: 0 0 var(--space-3);
  }

  .agent-prompt-title {
    margin: 0 0 var(--space-1);
    font-size: var(--text-base);
  }

  .agent-prompt-intent {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }

  .agent-prompt-meta-title {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--rm-text, currentColor);
  }

  .agent-prompt-meta {
    margin: 0 0 var(--space-3);
    display: grid;
    gap: var(--space-3);
  }

  .agent-prompt-meta-list {
    margin: 0;
    padding-left: 1.15rem;
    color: var(--rm-muted);
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .agent-prompt-meta-list code {
    white-space: normal;
  }

  .agent-prompt-gate {
    margin: var(--space-3) 0 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }

  .agent-prompt-gate strong {
    color: var(--rm-text, currentColor);
  }

  @media (max-width: 40rem) {
    .agent-prompts {
      padding: var(--space-3);
    }
    .agent-prompts-heading {
      font-size: var(--text-base);
    }
    .agent-prompts-toggle {
      padding: 0.35rem 0.55rem;
      font-size: var(--text-xs);
    }
    .agent-prompt-card {
      padding: var(--space-3);
    }
  }
</style>

