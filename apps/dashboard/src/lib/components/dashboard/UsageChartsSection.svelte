<script lang="ts">
  /**
   * Usage visualisations: requests line chart, cost bar chart, provider health badges.
   * TODO(provider-health): Replace static badges with live integration / probe status from API.
   */
  export let dailyRequests: { label: string; count: number }[];
  export let requestsOverTimeSource: "database" | "mock";
  export let costByModel: { model: string; costUsd: number }[];
  export let costByModelSource: "database" | "mock";

  const W = 520;
  const H = 150;
  const padL = 40;
  const padR = 12;
  const padT = 14;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  $: maxReq = Math.max(1, ...dailyRequests.map((d) => d.count));
  $: linePoints = dailyRequests
    .map((d, i) => {
      const x = padL + (dailyRequests.length <= 1 ? plotW / 2 : (i / (dailyRequests.length - 1)) * plotW);
      const y = padT + plotH - (d.count / maxReq) * plotH;
      return `${x},${y}`;
    })
    .join(" ");

  $: requestDots = dailyRequests.map((d, i) => ({
    label: d.label,
    count: d.count,
    cx: padL + (dailyRequests.length <= 1 ? plotW / 2 : (i / (dailyRequests.length - 1)) * plotW),
    cy: padT + plotH - (d.count / maxReq) * plotH,
  }));

  $: maxCost = costByModel.length ? Math.max(0.01, ...costByModel.map((c) => c.costUsd)) : 0.01;
  $: barCount = costByModel.length;
  $: barSlotW = barCount > 0 ? plotW / barCount : plotW;
  $: barW = barCount > 0 ? Math.max(8, barSlotW * 0.55) : 0;
  $: costBars = costByModel.map((c, i) => {
    const h = (c.costUsd / maxCost) * (plotH - 4);
    const x = padL + i * barSlotW + (barSlotW - barW) / 2;
    const y = padT + plotH - h;
    return { ...c, x, y, h: Math.max(h, 2), labelShort: truncateModel(c.model) };
  });

  function truncateModel(s: string, max = 14): string {
    if (s.length <= max) return s;
    return s.slice(0, max - 1) + "…";
  }

  /** TODO(provider-health): Drive from workspace integrations + health endpoints. */
  const providerHealthStatic: { id: string; label: string; status: "ok" | "degraded" | "unknown" }[] = [
    { id: "openai", label: "OpenAI", status: "ok" },
    { id: "anthropic", label: "Anthropic", status: "ok" },
    { id: "openrouter", label: "OpenRouter", status: "degraded" },
    { id: "vercel", label: "Vercel AI", status: "unknown" },
  ];

  $: requestsSummary = (() => {
    const t = dailyRequests.reduce((s, d) => s + d.count, 0);
    const peak = dailyRequests.reduce((m, d) => Math.max(m, d.count), 0);
    return `Last 30 days: ${t.toLocaleString()} requests total, peak ${peak.toLocaleString()} in one day.`;
  })();

  $: costSummary = (() => {
    const t = costByModel.reduce((s, c) => s + c.costUsd, 0);
    return `Estimated spend by model: ${t.toLocaleString("en-US", { style: "currency", currency: "USD" })} total across ${costByModel.length} models shown.`;
  })();
</script>

<section class="usage-section" aria-labelledby="usage-heading">
  <h2 id="usage-heading" class="usage-section-title">Usage</h2>

  <div class="usage-grid">
    <div class="chart-card">
      <div class="chart-card-head">
        <h3 class="chart-title">Requests over time</h3>
        {#if requestsOverTimeSource === "mock"}
          <!-- TODO: Remove when request_logs time-series query is always available in production. -->
          <span class="chart-badge">Sample data</span>
        {:else}
          <span class="chart-meta">Last 30 days (UTC)</span>
        {/if}
      </div>
      <!-- TODO(requests-over-time): Wire optional finer granularity (hourly) when product supports it. -->
      <svg
        class="chart-svg"
        viewBox="0 0 {W} {H}"
        width="100%"
        height="180"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={requestsSummary}
      >
        <title>{requestsSummary}</title>
        <rect x={padL} y={padT} width={plotW} height={plotH} fill="var(--rm-surface-2)" rx="4" />
        <text x={padL} y={padT - 4} class="axis-label" font-size="11">{maxReq.toLocaleString()}</text>
        <text x={padL} y={padT + plotH + 18} class="axis-label" font-size="10">{dailyRequests[0]?.label ?? ""}</text>
        <text
          x={padL + plotW}
          y={padT + plotH + 18}
          class="axis-label axis-label-end"
          font-size="10"
          text-anchor="end">{dailyRequests[dailyRequests.length - 1]?.label ?? ""}</text
        >
        <polyline
          fill="none"
          stroke="var(--rm-sage)"
          stroke-width="2.5"
          stroke-linejoin="round"
          stroke-linecap="round"
          points={linePoints}
        />
        {#each requestDots as d}
          <circle cx={d.cx} cy={d.cy} r="3" fill="var(--rm-sage)" class="chart-dot" tabindex="-1">
            <title>{d.label}: {d.count.toLocaleString()} requests</title>
          </circle>
        {/each}
      </svg>
    </div>

    <div class="chart-card">
      <div class="chart-card-head">
        <h3 class="chart-title">Cost by model</h3>
        {#if costByModelSource === "mock"}
          <!-- TODO: Remove mock when estimated_cost is populated on request_logs for all providers. -->
          <span class="chart-badge">Illustrative</span>
        {:else}
          <span class="chart-meta">Estimated USD (30d)</span>
        {/if}
      </div>
      <!-- TODO(cost-by-model): Join catalog display names; support multi-currency if MoR adds non-USD. -->
      <svg
        class="chart-svg"
        viewBox="0 0 {W} {H}"
        width="100%"
        height="180"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={costSummary}
      >
        <title>{costSummary}</title>
        <rect x={padL} y={padT} width={plotW} height={plotH} fill="var(--rm-surface-2)" rx="4" />
        {#if barCount === 0}
          <text x={padL + plotW / 2} y={padT + plotH / 2} class="axis-label" font-size="12" text-anchor="middle">
            No model cost data
          </text>
        {/if}
        {#each costBars as c}
          <rect
            x={c.x}
            y={c.y}
            width={barW}
            height={c.h}
            fill="color-mix(in oklab, var(--rm-sage) 75%, var(--rm-border))"
            rx="3"
          >
            <title>{c.model}: {c.costUsd.toFixed(2)} USD</title>
          </rect>
          <text x={c.x + barW / 2} y={padT + plotH + 14} class="bar-label" font-size="9" text-anchor="middle"
            >{c.labelShort}</text
          >
        {/each}
      </svg>
    </div>

    <div class="chart-card chart-card-health">
      <div class="chart-card-head">
        <h3 class="chart-title">Provider health</h3>
        <!-- TODO(provider-health): Wire to integration status + synthetic checks; remove static rows. -->
        <span class="chart-badge">Static preview</span>
      </div>
      <ul class="health-list" role="list">
        {#each providerHealthStatic as p}
          <li class="health-item">
            <span class="health-name">{p.label}</span>
            <span
              class="health-badge"
              class:health-ok={p.status === "ok"}
              class:health-degraded={p.status === "degraded"}
              class:health-unknown={p.status === "unknown"}
            >
              {p.status === "ok" ? "Healthy" : p.status === "degraded" ? "Degraded" : "Unknown"}
            </span>
          </li>
        {/each}
      </ul>
    </div>
  </div>
</section>

<style>
  .usage-section {
    margin-bottom: var(--space-8);
    padding-bottom: var(--space-6);
    border-bottom: var(--border-thin);
  }
  .usage-section-title {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-4);
  }
  .usage-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-5);
    align-items: stretch;
  }
  @media (min-width: 720px) {
    .usage-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
  .chart-card {
    background: var(--rm-surface-raised);
    border: var(--border-thin);
    border-radius: var(--rm-radius);
    padding: var(--space-4);
    min-width: 0;
  }
  .chart-card-health {
    grid-column: 1 / -1;
  }
  .chart-card-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }
  .chart-title {
    font-size: var(--text-sm);
    font-weight: 600;
    margin: 0;
    color: var(--rm-text);
  }
  .chart-meta {
    font-size: var(--text-xs);
    color: var(--rm-dim);
  }
  .chart-badge {
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--rm-sage);
    background: color-mix(in oklab, var(--rm-sage) 12%, transparent);
    border: 1px solid color-mix(in oklab, var(--rm-sage) 35%, var(--rm-border));
    padding: 0.12rem 0.45rem;
    border-radius: 999px;
  }
  .chart-svg {
    display: block;
    max-width: 100%;
    height: auto;
  }
  .axis-label {
    fill: var(--rm-dim);
  }
  .axis-label-end {
    text-anchor: end;
  }
  .bar-label {
    fill: var(--rm-muted);
  }
  .chart-dot:focus {
    outline: none;
  }
  .health-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  .health-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
  }
  .health-name {
    color: var(--rm-text);
    min-width: 5.5rem;
  }
  .health-badge {
    font-size: var(--text-xs);
    font-weight: 600;
    padding: 0.2rem 0.5rem;
    border-radius: var(--rm-radius);
    border: var(--border-thin);
  }
  .health-ok {
    color: var(--rm-sage);
    border-color: color-mix(in oklab, var(--rm-sage) 45%, var(--rm-border));
    background: color-mix(in oklab, var(--rm-sage) 10%, transparent);
  }
  .health-degraded {
    color: var(--coral-alert, #c45c4a);
    border-color: color-mix(in oklab, var(--coral-alert, #c45c4a) 40%, var(--rm-border));
    background: color-mix(in oklab, var(--coral-alert, #c45c4a) 8%, transparent);
  }
  .health-unknown {
    color: var(--rm-muted);
    background: var(--rm-surface-2);
  }
</style>
