<script lang="ts">
  import type { Snippet } from "svelte";

  type Fill = "canvas" | "white" | "blue" | "coral" | "neon";

  export let fill: Fill = "white";
  export let pressable = false;
  export let overlap = false;
  export let href: string | undefined = undefined;
  export let title: string | undefined = undefined;
  export let children: Snippet;

  $: fillClass =
    fill === "blue"
      ? "brut-fill-blue"
      : fill === "coral"
        ? "brut-fill-coral"
        : fill === "neon"
          ? "brut-fill-neon"
          : fill === "canvas"
            ? "brut-fill-canvas"
            : "brut-fill-white";

  $: isPressable = pressable || !!href;
  $: cardClass = `brutal-card ${fillClass}${isPressable ? " brut-pressable" : ""}${overlap ? " brut-overlap" : ""}${href ? " brut-focus" : ""}`;
</script>

{#if href}
  <a class={cardClass} {href}>
    {#if title}
      <h2 class="brutal-card-title">{title}</h2>
    {/if}
    <div class="brutal-card-body">
      {@render children()}
    </div>
  </a>
{:else}
  <div class={cardClass}>
    {#if title}
      <h2 class="brutal-card-title">{title}</h2>
    {/if}
    <div class="brutal-card-body">
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .brutal-card {
    border: var(--border);
    border-radius: 0;
    padding: 1rem;
    display: block;
    text-decoration: none;
    color: inherit;
    background: var(--color-surface);
    box-shadow: var(--shadow-md);
    transition: transform 0.08s ease, box-shadow 0.08s ease;
  }

  .brutal-card-title {
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
    line-height: 1.2;
    margin: 0 0 0.75rem;
  }

  .brutal-card-body {
    font-family: var(--font-body);
    font-size: var(--text-body-sm);
    line-height: var(--text-body-line-height);
  }
</style>
