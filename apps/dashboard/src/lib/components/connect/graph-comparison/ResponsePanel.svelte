<script lang="ts">
  import type { RetrievalSummary } from "$lib/connect/graph-comparison-types";
  import ProvenanceDrawer from "./ProvenanceDrawer.svelte";

  export let variant: "raw" | "graph";
  export let status: "idle" | "retrieving" | "streaming" | "complete" | "error" = "idle";
  export let text = "";
  export let model: { provider: string; model: string } | null = null;
  export let retrieval: RetrievalSummary | null = null;
  export let error: string | null = null;
  export let onRetry: () => void;

  $: isGraph = variant === "graph";
  $: heading = isGraph ? "WITH YOUR KNOWLEDGE GRAPH" : "WITHOUT KNOWLEDGE GRAPH";
  $: claimCount = retrieval?.claims.length ?? 0;
  $: idlePlaceholder = isGraph
    ? "The knowledge graph response will appear here."
    : "The base model response will appear here.";

  $: subLabel = (() => {
    if (!model) return isGraph ? "model · provider + verified claims" : "model · provider";
    const base = `${model.model} · ${model.provider}`;
    return isGraph ? `${base} + ${claimCount} verified ${claimCount === 1 ? "claim" : "claims"}` : base;
  })();
</script>

<article class="panel" class:graph={isGraph}>
  <header class="panel-head" class:graph={isGraph}>
    <h3 class="panel-title">{heading}</h3>
    <p class="panel-sub">{subLabel}</p>
  </header>

  <div class="panel-body">
    {#if status === "idle"}
      <p class="panel-placeholder">{idlePlaceholder}</p>
    {:else if status === "retrieving"}
      <p class="panel-retrieving">Retrieving from knowledge graph…</p>
    {:else if status === "error"}
      <p class="panel-error">Response failed — {error ?? "unknown error"}.</p>
      <button type="button" class="panel-retry brut-focus" on:click={onRetry}>Try again</button>
    {:else}
      <p class="panel-text" class:streaming={status === "streaming"}>{text}</p>
    {/if}
  </div>

  {#if isGraph && status === "complete" && retrieval}
    <ProvenanceDrawer claims={retrieval.claims} trace={retrieval.trace} />
  {/if}
</article>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    border: var(--border);
    box-shadow: var(--shadow-md);
    background: var(--color-surface);
  }

  .panel-head {
    padding: var(--space-3) var(--space-4);
    background: var(--color-ink);
    color: var(--color-surface);
  }
  .panel-head.graph {
    background: var(--color-yellow);
    color: var(--color-ink);
  }

  .panel-title {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
  }

  .panel-sub {
    margin: var(--space-1) 0 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    letter-spacing: var(--text-mono-tracking);
    opacity: 0.8;
  }

  .panel-body {
    flex: 1;
    min-height: 200px;
    padding: var(--space-4);
    background: var(--color-surface);
  }

  .panel-placeholder,
  .panel-retrieving {
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 168px;
    text-align: center;
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-ink-faint);
  }

  .panel-retrieving {
    animation: pulse 1.4s ease-in-out infinite;
  }

  .panel-text {
    margin: 0;
    font-family: var(--font-body);
    font-size: 15px;
    line-height: 1.7;
    color: var(--color-ink);
    white-space: pre-wrap;
    word-break: break-word;
  }
  .panel-text.streaming::after {
    content: "▋";
    margin-left: 2px;
    animation: blink 1s step-end infinite;
  }

  .panel-error {
    margin: 0 0 var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    letter-spacing: var(--text-mono-tracking);
    color: var(--color-ink);
  }

  .panel-retry {
    background: transparent;
    border: 0;
    padding: 0;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-blue);
    text-decoration: underline;
  }

  @keyframes blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.45;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .panel-retrieving,
    .panel-text.streaming::after {
      animation: none;
    }
  }
</style>
