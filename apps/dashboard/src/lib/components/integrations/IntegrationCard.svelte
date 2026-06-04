<script lang="ts">
  import StatusBadge from "./StatusBadge.svelte";

  export let title: string;
  export let description: string;
  export let status: "available" | "early" | "advanced";
  export let cta: string;
  export let href: string;
</script>

<a class="integration-card" {href}>
  <div class="card-header">
    <h3 class="card-title">{title}</h3>
    <StatusBadge {status} />
  </div>
  <p class="card-desc">{description}</p>
  <span class="card-cta">{cta} →</span>
</a>

<style>
  .integration-card {
    display: flex;
    flex-direction: column;
    padding: var(--space-5);
    background: var(--color-surface);
    border: var(--border);
    border-radius: 0;
    box-shadow: var(--shadow-md);
    text-decoration: none;
    color: inherit;
    transition: transform 0.08s ease, box-shadow 0.08s ease;
  }
  .integration-card:hover {
    transform: translate(-2px, -2px);
    box-shadow: var(--shadow-lg);
    text-decoration: none;
  }
  .integration-card:active {
    transform: translate(2px, 2px);
    box-shadow: 1px 1px 0 var(--color-ink);
  }
  .integration-card:focus-visible {
    outline: 2px solid var(--color-yellow);
    outline-offset: 0;
  }
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }
  .card-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-body-lg);
    font-weight: 900;
    text-transform: uppercase;
    color: var(--color-ink);
  }
  .card-desc {
    flex: 1;
    margin: 0 0 var(--space-4);
    font-size: var(--text-body-sm);
    color: var(--color-ink-muted);
    line-height: var(--text-body-line-height);
  }
  .card-cta {
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-ink);
  }
  @media (prefers-reduced-motion: reduce) {
    .integration-card {
      transition: none;
    }
    .integration-card:hover,
    .integration-card:active {
      transform: none;
      box-shadow: var(--shadow-md);
    }
  }
</style>
