<script lang="ts">
  /**
   * Marketing-only route map preview — avoids mounting full {@link RouteFlowCanvas}
   * (dashboard editor) on the suite landing, which crashed client hydration ~3.5s into the demo.
   */
  import { DEMO_ROUTE_STEPS, DEMO_ROUTE_STEP_LINKS } from "./product-demo-mock-data";

  const steps = DEMO_ROUTE_STEPS;
  const linkLabel = DEMO_ROUTE_STEP_LINKS[0]?.label ?? "next";
</script>

<div class="demo-route-preview" role="region" aria-label="Route flow map preview">
  <ol class="demo-route-chain">
    {#each steps as step, i (step.id)}
      <li class="demo-route-node-wrap">
        <div class="demo-route-node" class:demo-route-node--primary={i === 0}>
          <span class="demo-route-tag">{i === 0 ? "primary" : "fallback"}</span>
          <span class="demo-route-label">{step.label ?? `Step ${step.orderIndex + 1}`}</span>
          <span class="demo-route-model">{step.modelId}</span>
          <span class="demo-route-provider">{step.providerPreference}</span>
        </div>
        {#if i < steps.length - 1}
          <span class="demo-route-connector" aria-hidden="true">
            <span class="demo-route-arrow">▼</span>
            <span class="demo-route-edge">{linkLabel}</span>
          </span>
        {/if}
      </li>
    {/each}
  </ol>
</div>

<style>
  .demo-route-preview {
    width: 100%;
    min-width: 0;
  }
  .demo-route-chain {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }
  .demo-route-node-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 12rem;
  }
  .demo-route-node {
    width: 100%;
    padding: var(--space-2);
    border: var(--border-thin);
    background: var(--color-surface);
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: left;
    box-shadow: var(--shadow-sm, 2px 2px 0 var(--color-ink));
  }
  .demo-route-node--primary {
    background: color-mix(in oklab, var(--color-yellow, #ffde4d) 35%, var(--color-surface));
  }
  .demo-route-tag {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--rm-muted);
    font-family: var(--font-mono);
  }
  .demo-route-label {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--rm-text);
  }
  .demo-route-model {
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    color: var(--rm-text);
  }
  .demo-route-provider {
    font-size: 10px;
    color: var(--rm-muted);
    text-transform: capitalize;
  }
  .demo-route-connector {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: var(--space-1) 0;
    color: var(--rm-muted);
    font-size: 10px;
    font-family: var(--font-mono);
  }
  .demo-route-arrow {
    line-height: 1;
    font-size: 12px;
  }
  .demo-route-edge {
    font-weight: 600;
  }
</style>
