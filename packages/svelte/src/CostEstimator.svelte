<script lang="ts">
  import type { CostEstimateResult } from "@restormel/keys";

  interface Props {
    /** Cost estimate (e.g. from keys.estimateCost(modelId)). */
    cost: CostEstimateResult | null;
    /** Optional budget (e.g. USD) for comparison. */
    budget?: number;
    /** Optional estimated or actual cost to compare with budget. */
    estimatedCost?: number;
  }

  let { cost, budget, estimatedCost }: Props = $props();

  const hasBudget = $derived(budget != null && budget > 0);
  const comparison = $derived(
    hasBudget && estimatedCost != null
      ? (estimatedCost <= budget * 0.8
          ? "ok"
          : estimatedCost <= budget
            ? "warn"
            : "over")
      : null
  );

  function formatPrice(n: number | undefined): string {
    if (n == null) return "—";
    if (n >= 1) return `$${n.toFixed(2)}`;
    if (n >= 0.01) return `$${n.toFixed(4)}`;
    return `$${n.toFixed(6)}`;
  }
</script>

<div class="rk-cost-estimator rk-dark" role="region" aria-label="Cost estimate">
  {#if cost === null}
    <p class="rk-cost-empty">No cost data for this model.</p>
  {:else}
    <dl class="rk-cost-breakdown">
      <div class="rk-cost-row">
        <dt>Model</dt>
        <dd>{cost.modelId}</dd>
      </div>
      {#if cost.providerId}
        <div class="rk-cost-row">
          <dt>Provider</dt>
          <dd>{cost.providerId}</dd>
        </div>
      {/if}
      <div class="rk-cost-row">
        <dt>Input (per 1M tokens)</dt>
        <dd>{formatPrice(cost.inputPerMillion)} {cost.unit ?? "USD"}</dd>
      </div>
      <div class="rk-cost-row">
        <dt>Output (per 1M tokens)</dt>
        <dd>{formatPrice(cost.outputPerMillion)} {cost.unit ?? "USD"}</dd>
      </div>
    </dl>

    {#if hasBudget && estimatedCost != null}
      <div class="rk-cost-budget" data-comparison={comparison ?? undefined}>
        <span class="rk-cost-budget-label">Estimated cost</span>
        <span class="rk-cost-budget-value">{formatPrice(estimatedCost)}</span>
        <span class="rk-cost-budget-vs"> / budget {formatPrice(budget)}</span>
        {#if comparison === "ok"}
          <span class="rk-cost-badge rk-cost-ok" role="status">Within budget</span>
        {:else if comparison === "warn"}
          <span class="rk-cost-badge rk-cost-warn" role="status">Near budget</span>
        {:else if comparison === "over"}
          <span class="rk-cost-badge rk-cost-over" role="status">Over budget</span>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .rk-cost-estimator {
    font-family: var(--rk-font);
    background: var(--rk-bg);
    color: var(--rk-text);
    padding: 1rem;
    border-radius: var(--rk-radius);
    border: 1px solid var(--rk-border);
  }

  .rk-cost-empty {
    margin: 0;
    color: var(--rk-text-muted);
  }

  .rk-cost-breakdown {
    margin: 0 0 1rem;
    display: grid;
    gap: 0.25rem 1rem;
  }

  .rk-cost-row {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.5rem 1rem;
  }

  .rk-cost-row dt {
    margin: 0;
    color: var(--rk-text-muted);
    font-size: 0.875rem;
  }

  .rk-cost-row dd {
    margin: 0;
    font-size: 0.875rem;
  }

  .rk-cost-budget {
    padding-top: 0.75rem;
    border-top: 1px solid var(--rk-border);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.5rem;
  }

  .rk-cost-budget-label {
    font-size: 0.875rem;
    color: var(--rk-text-muted);
  }

  .rk-cost-budget-value {
    font-weight: 600;
  }

  .rk-cost-budget-vs {
    font-size: 0.875rem;
    color: var(--rk-text-muted);
  }

  .rk-cost-badge {
    font-size: 0.75rem;
    padding: 0.15rem 0.4rem;
    border-radius: var(--rk-radius);
    font-weight: 500;
  }

  .rk-cost-ok {
    background: var(--rk-success);
    color: var(--rk-bg);
  }

  .rk-cost-warn {
    background: var(--rk-amber);
    color: var(--rk-bg);
  }

  .rk-cost-over {
    background: var(--rk-danger);
    color: var(--rk-bg);
  }
</style>
