<script lang="ts">
  export let variant: "primary" | "secondary" | "neon" | "blue" | "coral" | "canvas" = "primary";
  export let label: string;
</script>

<span
  class="brutal-badge"
  class:brutal-badge-primary={variant === "primary" || variant === "neon"}
  class:brutal-badge-secondary={variant === "secondary" || variant === "blue" || variant === "coral" || variant === "canvas"}
>
  {label}
</span>

<style>
  .brutal-badge {
    display: inline-block;
    padding: 3px 8px;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    border: var(--border-thin);
    border-radius: 0;
  }

  .brutal-badge-primary {
    background: var(--color-yellow);
    color: var(--color-ink);
  }

  .brutal-badge-secondary {
    background: transparent;
    color: var(--color-ink);
  }
</style>
