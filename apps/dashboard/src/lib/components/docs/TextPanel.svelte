<script lang="ts">
  export let title: string | undefined = undefined;
  export let content: string | undefined = undefined;
  export let items: string[] | undefined = undefined;
  export let kind: "steps" | "diagram" | "output" | "note" = "diagram";
</script>

<div class="textpanel" data-kind={kind}>
  {#if title}
    <div class="textpanel-header">
      <span class="textpanel-title">{title}</span>
    </div>
  {/if}

  {#if Array.isArray(items) && items.length > 0}
    <ol class="textpanel-ol">
      {#each items as item, idx (idx)}
        <li class="textpanel-li">{item}</li>
      {/each}
    </ol>
  {:else if content}
    <pre class="textpanel-pre">{content}</pre>
  {:else}
    <div class="textpanel-empty" aria-hidden="true"></div>
  {/if}
</div>

<style>
  .textpanel {
    margin: 0 0 var(--space-4);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: color-mix(in oklab, var(--rm-surface) 88%, black 12%);
  }

  .textpanel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--rm-border);
    background: color-mix(in oklab, var(--rm-surface-raised, var(--rm-surface)) 78%, black 22%);
  }

  .textpanel-title {
    font-size: var(--text-xs);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--rm-muted);
  }

  .textpanel-pre {
    margin: 0;
    padding: var(--space-4);
    overflow-x: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New",
      monospace;
    font-size: var(--text-sm);
    line-height: 1.5;
    color: var(--rm-text);
    white-space: pre;
  }

  .textpanel-ol {
    margin: 0;
    padding: var(--space-4) var(--space-4) var(--space-4) calc(var(--space-4) + 1.25rem);
    color: var(--rm-text);
    line-height: var(--leading-relaxed);
  }

  .textpanel-li {
    color: var(--rm-muted);
    margin: 0 0 var(--space-2);
  }
  .textpanel-li:last-child {
    margin-bottom: 0;
  }

  .textpanel-empty {
    height: 1px;
  }
</style>

