<script lang="ts">
  import type { Snippet } from "svelte";

  type Variant = "primary" | "outline" | "ghost" | "blue" | "coral" | "neon" | "canvas";

  export let variant: Variant = "primary";
  export let href: string | undefined = undefined;
  export let type: "button" | "submit" = "button";
  export let disabled = false;
  export let ariaLabel: string | undefined = undefined;
  export let children: Snippet;

  $: variantClass =
    variant === "ghost"
      ? "brutal-btn-ghost"
      : variant === "outline" || variant === "blue" || variant === "coral" || variant === "canvas"
        ? "brutal-btn-outline"
        : "brutal-btn-primary";
  $: fillClass =
    variant === "canvas"
      ? "brut-fill-canvas"
      : variant === "coral"
        ? "brut-fill-coral"
        : variant === "blue"
          ? "brut-fill-blue"
          : "";
</script>

{#if href}
  <a
    class="brutal-btn {variantClass} {fillClass} brut-focus"
    class:brut-pressable={variant !== "ghost"}
    {href}
    aria-label={ariaLabel}
  >
    {@render children()}
  </a>
{:else}
  <button
    class="brutal-btn {variantClass} {fillClass} brut-focus"
    class:brut-pressable={variant !== "ghost"}
    {type}
    {disabled}
    aria-label={ariaLabel}
  >
    {@render children()}
  </button>
{/if}

<style>
  .brutal-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 44px;
    padding: 8px 18px;
    font-family: var(--btn-font);
    font-size: var(--btn-size);
    font-weight: var(--btn-weight);
    letter-spacing: var(--btn-tracking);
    text-transform: var(--btn-transform);
    border: var(--btn-border);
    border-radius: var(--btn-radius);
    cursor: pointer;
  }

  .brutal-btn-primary {
    background: var(--color-yellow);
    color: var(--color-ink);
    box-shadow: var(--shadow-sm);
  }

  .brutal-btn-outline {
    background: var(--color-surface);
    color: var(--color-ink);
    box-shadow: var(--shadow-sm);
  }

  .brutal-btn-ghost {
    background: transparent;
    color: var(--color-ink);
    box-shadow: none;
  }

  .brutal-btn-ghost:hover {
    background: var(--color-bg-deep);
  }

  .brutal-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    pointer-events: none;
  }
</style>
