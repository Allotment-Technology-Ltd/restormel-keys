<script lang="ts">
  import StatusBadge from "./StatusBadge.svelte";

  export let title: string;
  export let description: string;
  export let status: "available" | "early" | "advanced";
  export let cta: string;
  export let href: string;
</script>

<a class="card" {href}>
  <div class="card-header">
    <h3 class="card-title">{title}</h3>
    <StatusBadge {status} />
  </div>
  <p class="card-desc">{description}</p>
  <span class="card-cta">{cta} &rarr;</span>
</a>

<style>
  .card {
    display: flex;
    flex-direction: column;
    padding: var(--space-5);
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-2xl, 1rem);
    text-decoration: none;
    color: inherit;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .card:hover {
    border-color: var(--rm-sage);
    box-shadow: 0 0 16px color-mix(in oklab, var(--rm-sage) 14%, transparent);
  }
  .card:focus-visible {
    outline: 2px solid var(--rm-sage);
    outline-offset: 2px;
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
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--rm-text);
  }
  .card-desc {
    flex: 1;
    margin: 0 0 var(--space-4);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .card-cta {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--rm-sage);
    transition: color 0.15s ease;
  }
  .card:hover .card-cta {
    color: var(--rm-text);
  }
</style>
