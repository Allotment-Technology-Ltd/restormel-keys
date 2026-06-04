<script lang="ts">
  import { MONITOR_COMING_SOON_ITEMS, type MonitorInterestItem } from "$lib/dashboard-monitor-interest";
  import { trackDashboardFeatureInterest } from "$lib/posthog";
  import { openFeedbackWidget } from "$lib/stores/feedback-widget";

  function onItemClick(item: MonitorInterestItem) {
    trackDashboardFeatureInterest({
      feature: "monitor",
      action: "item_click",
      item,
    });
  }

  function onFeedbackClick() {
    trackDashboardFeatureInterest({
      feature: "monitor",
      action: "notify_feedback",
      item: null,
    });
    openFeedbackWidget();
  }
</script>

<div class="monitor-soon" role="region" aria-label="Monitor — coming soon">
  <p class="monitor-soon-lead">Coming soon</p>
  <p class="monitor-soon-copy">
    Usage dashboards, request logs, and health checks are in development. Tell us which you need first.
  </p>
  <ul class="monitor-soon-list">
    {#each MONITOR_COMING_SOON_ITEMS as entry (entry.id)}
      <li>
        <button type="button" class="monitor-soon-item" on:click={() => onItemClick(entry.id)}>
          {entry.label}
        </button>
      </li>
    {/each}
  </ul>
  <button type="button" class="monitor-soon-feedback" on:click={onFeedbackClick}>
    Share what you need
  </button>
</div>

<style>
  .monitor-soon {
    padding: var(--space-2) var(--space-4) var(--space-3);
    border-bottom: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-canvas);
  }
  .monitor-soon-lead {
    margin: 0 0 var(--space-1);
    font-size: 0.625rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--rm-dim);
  }
  .monitor-soon-copy {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    line-height: var(--leading-normal);
    color: var(--rm-muted);
  }
  .monitor-soon-list {
    margin: 0 0 var(--space-2);
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .monitor-soon-item {
    width: 100%;
    border: 0;
    border-bottom: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
    color: var(--brut-ink);
    text-align: left;
    padding: var(--space-2) var(--space-3);
    min-height: 44px;
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
  }
  .monitor-soon-item:hover {
    background: var(--brut-neon);
  }
  .monitor-soon-feedback {
    width: 100%;
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
    color: var(--brut-ink);
    font-size: var(--text-xs);
    font-weight: 700;
    padding: var(--space-2) var(--space-3);
    min-height: 44px;
    cursor: pointer;
    text-align: left;
  }
  .monitor-soon-feedback:hover {
    background: var(--color-yellow);
  }
</style>
