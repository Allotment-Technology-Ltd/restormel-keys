<script lang="ts">
  export let status: "available" | "early" | "advanced";

  const labels: Record<typeof status, string> = {
    available: "Available",
    early: "Early",
    advanced: "Advanced",
  };
</script>

<span class="status-badge status-badge-{status}" aria-label="Status: {labels[status]}">
  {labels[status]}
</span>

<style>
  .status-badge {
    display: inline-block;
    font-size: var(--text-xs);
    font-weight: 500;
    line-height: 1;
    padding: 0.15rem 0.5rem;
    border-radius: 9999px;
    letter-spacing: 0.02em;
    text-transform: capitalize;
  }
  .status-badge-available {
    background: color-mix(in oklab, #22c55e 18%, transparent);
    color: #4ade80;
    border: 1px solid color-mix(in oklab, #22c55e 30%, transparent);
  }
  .status-badge-early {
    background: color-mix(in oklab, #eab308 18%, transparent);
    color: #facc15;
    border: 1px solid color-mix(in oklab, #eab308 30%, transparent);
  }
  .status-badge-advanced {
    background: color-mix(in oklab, #a855f7 18%, transparent);
    color: #c084fc;
    border: 1px solid color-mix(in oklab, #a855f7 30%, transparent);
  }
</style>
