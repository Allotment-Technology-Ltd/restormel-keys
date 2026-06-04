<script lang="ts">
  import BrutalDashboardShell from "$lib/components/brutalist/BrutalDashboardShell.svelte";
  import BrutalCard from "$lib/components/brutalist/BrutalCard.svelte";
  import BrutalButton from "$lib/components/brutalist/BrutalButton.svelte";
  import BrutalBadge from "$lib/components/brutalist/BrutalBadge.svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";

  const setupSteps = [
    { id: "workspace", label: "Workspace is ready", done: true },
    { id: "projects", label: "Create your first project", done: true },
    { id: "connections", label: "Add your first connection", done: false, cta: "Open Connections", href: DASHBOARD_BASE + "/integrations" },
    { id: "api-keys", label: "Create a Gateway key", done: false, cta: "Open Gateway keys", href: DASHBOARD_BASE + "/access" },
    { id: "rules", label: "Create a route", done: false, cta: "Open Routes", href: DASHBOARD_BASE + "/routes" },
    { id: "first-request", label: "Run your first request", done: false, cta: "Try sandbox", href: DASHBOARD_BASE + "/sandbox" },
  ];

  $: doneCount = setupSteps.filter((s) => s.done).length;
  $: nextStep = setupSteps.find((s) => !s.done);

  const metrics = [
    { label: "Requests (24h)", value: "1,284" },
    { label: "Error rate", value: "0.4%" },
    { label: "p50 latency", value: "142 ms" },
    { label: "p95 latency", value: "389 ms" },
  ];

  const quickActions = [
    { label: "Create Gateway key", href: DASHBOARD_BASE + "/access", variant: "blue" as const },
    { label: "Add connection", href: DASHBOARD_BASE + "/integrations", variant: "neon" as const },
    { label: "Open sandbox", href: DASHBOARD_BASE + "/sandbox", variant: "coral" as const },
  ];
</script>

<BrutalDashboardShell title="Overview">
  <div class="overview">
    <header class="overview-header">
      <p class="brut-kicker">Control plane</p>
      <h2 class="overview-title">Overview</h2>
      <p class="overview-desc brut-muted">
        Govern keys, routes, and provider connections from one signed-in shell. Sample data — layout prototype only.
      </p>
    </header>

    <div class="bento-grid" role="list">
      <!-- Setup checklist — spans 2 cols -->
      <section class="bento-cell bento-span-2" aria-labelledby="setup-heading">
        <BrutalCard fill="white" title="Setup checklist">
          <div class="setup-meta">
            <BrutalBadge variant="blue" label="{doneCount}/{setupSteps.length} complete" />
            {#if nextStep}
              <span class="brut-muted">Next: {nextStep.label}</span>
            {/if}
          </div>
          <ol class="setup-list" id="setup-heading">
            {#each setupSteps as step}
              <li class="setup-item" class:setup-item-done={step.done}>
                <span class="setup-check" aria-hidden="true">{step.done ? "■" : "□"}</span>
                <span>{step.label}</span>
                {#if !step.done && step.href && step.cta}
                  <a href={step.href} class="setup-cta brut-focus">{step.cta} →</a>
                {/if}
              </li>
            {/each}
          </ol>
          <div class="setup-actions">
            <BrutalButton variant="blue" href={DASHBOARD_BASE + "/integrations"}>Continue setup</BrutalButton>
            <BrutalButton variant="canvas">Open setup assistant</BrutalButton>
          </div>
        </BrutalCard>
      </section>

      <!-- Live pulse metrics -->
      <section class="bento-cell" aria-labelledby="pulse-heading">
        <BrutalCard fill="blue" title="Live pulse" overlap>
          <p id="pulse-heading" class="visually-hidden">Live pulse metrics</p>
          <div class="metric-grid">
            {#each metrics as m}
              <article class="metric-block">
                <span class="metric-value">{m.value}</span>
                <span class="metric-label">{m.label}</span>
              </article>
            {/each}
          </div>
          <p class="metric-footnote">
            Top route: <strong>default-chat</strong> · 892 req
          </p>
        </BrutalCard>
      </section>

      <!-- Quick actions -->
      <section class="bento-cell" aria-labelledby="actions-heading">
        <BrutalCard fill="neon" title="Quick actions">
          <p id="actions-heading" class="visually-hidden">Quick actions</p>
          <div class="action-stack">
            {#each quickActions as action}
              <BrutalButton variant={action.variant} href={action.href}>{action.label}</BrutalButton>
            {/each}
          </div>
        </BrutalCard>
      </section>

      <!-- Suite products bento row -->
      <section class="bento-cell bento-span-full" aria-labelledby="suite-heading">
        <h3 id="suite-heading" class="bento-row-label">Suite products</h3>
        <div class="suite-row">
          <BrutalCard fill="white" pressable href={DASHBOARD_BASE + "/"} overlap>
            <BrutalBadge variant="neon" label="Active" />
            <p><strong>Keys</strong> — Route &amp; govern</p>
          </BrutalCard>
          <BrutalCard fill="white" pressable href={DASHBOARD_BASE + "/testing"}>
            <BrutalBadge variant="blue" label="CI" />
            <p><strong>Testing</strong> — Verify in pipeline</p>
          </BrutalCard>
          <BrutalCard fill="white" pressable href={DASHBOARD_BASE + "/connect"}>
            <BrutalBadge variant="coral" label="Preview" />
            <p><strong>Knowledge</strong> — Ingest &amp; retrieve</p>
          </BrutalCard>
          <BrutalCard fill="white" pressable href={DASHBOARD_BASE + "/graph"}>
            <BrutalBadge variant="canvas" label="Preview" />
            <p><strong>Graph</strong> — Visualise outputs</p>
          </BrutalCard>
        </div>
      </section>

      <!-- Usage block -->
      <section class="bento-cell bento-span-2">
        <BrutalCard fill="coral" title="Usage this month">
          <div class="usage-bar-wrap">
            <div class="usage-bar" role="progressbar" aria-valuenow={42} aria-valuemin={0} aria-valuemax={100} aria-label="42 percent of monthly request limit used">
              <div class="usage-bar-fill" style="width: 42%"></div>
            </div>
            <p><strong>4,200</strong> / 10,000 requests · Free plan</p>
          </div>
          <BrutalButton variant="canvas" href="/keys/pricing">View pricing</BrutalButton>
        </BrutalCard>
      </section>

      <!-- Flow diagram block -->
      <section class="bento-cell">
        <BrutalCard fill="white" title="Suite flow">
          <figure class="flow-figure" aria-label="Restormel suite flow diagram">
            <svg viewBox="0 0 320 72" width="100%" height="auto" class="flow-svg">
              <rect x="4" y="8" width="68" height="56" fill="#4D96FF" stroke="#000" stroke-width="4" />
              <text x="38" y="32" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9" font-weight="800">KEYS</text>
              <text x="38" y="48" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="7">GOVERN</text>
              <line x1="72" y1="36" x2="88" y2="36" stroke="#000" stroke-width="4" />
              <polygon points="88,36 96,32 96,40" fill="#000" />
              <rect x="96" y="8" width="68" height="56" fill="#FFDE4D" stroke="#000" stroke-width="4" />
              <text x="130" y="32" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9" font-weight="800">TEST</text>
              <text x="130" y="48" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="7">VERIFY</text>
              <line x1="164" y1="36" x2="180" y2="36" stroke="#000" stroke-width="4" />
              <polygon points="180,36 188,32 188,40" fill="#000" />
              <rect x="188" y="8" width="68" height="56" fill="#FF6B6B" stroke="#000" stroke-width="4" />
              <text x="222" y="32" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9" font-weight="800">GRAPH</text>
              <text x="222" y="48" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="7">VISUAL</text>
              <line x1="256" y1="36" x2="272" y2="36" stroke="#000" stroke-width="4" />
              <polygon points="272,36 280,32 280,40" fill="#000" />
              <rect x="280" y="8" width="36" height="56" fill="#F0E6D2" stroke="#000" stroke-width="4" />
              <text x="298" y="38" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8" font-weight="800">K</text>
            </svg>
          </figure>
        </BrutalCard>
      </section>
    </div>
  </div>
</BrutalDashboardShell>

<style>
  .overview-header {
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: var(--brut-border-width) solid var(--brut-ink);
  }

  .overview-title {
    font-size: 1.75rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: -0.02em;
    margin: 0.5rem 0;
  }

  .overview-desc {
    margin: 0;
    max-width: 42rem;
  }

  .bento-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
    border: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-ink);
  }

  .bento-cell {
    background: var(--brut-canvas);
    padding: 0.75rem;
    border: var(--brut-border-micro) solid var(--brut-ink);
  }

  .bento-span-2 {
    grid-column: span 2;
  }

  .bento-span-full {
    grid-column: 1 / -1;
  }

  .bento-row-label {
    margin: 0 0 0.75rem;
    font-size: 0.75rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .setup-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
  }

  .setup-list {
    list-style: none;
    margin: 0 0 1rem;
    padding: 0;
  }

  .setup-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding: 0.375rem 0;
    border-bottom: var(--brut-border-micro) solid var(--brut-ink);
    font-weight: 600;
  }

  .setup-item-done {
    opacity: 0.55;
    text-decoration: line-through;
  }

  .setup-check {
    font-weight: 900;
    width: 1rem;
  }

  .setup-cta {
    margin-left: auto;
    font-weight: 800;
    font-size: 0.6875rem;
    text-transform: uppercase;
    color: var(--brut-ink);
  }

  .setup-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .metric-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0;
    border: var(--brut-border-micro) solid var(--brut-ink);
    margin-bottom: 0.75rem;
  }

  .metric-block {
    padding: 0.5rem;
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
  }

  .metric-value {
    display: block;
    font-size: 1.125rem;
    font-weight: 900;
  }

  .metric-label {
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .metric-footnote {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .action-stack {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .action-stack :global(.brutal-btn) {
    width: 100%;
  }

  .suite-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
  }

  .suite-row :global(.brutal-card-body p) {
    margin: 0.5rem 0 0;
    font-size: 0.75rem;
  }

  .usage-bar-wrap {
    margin-bottom: 1rem;
  }

  .usage-bar {
    height: 1.25rem;
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
    margin-bottom: 0.5rem;
  }

  .usage-bar-fill {
    height: 100%;
    background: var(--brut-ink);
  }

  .flow-figure {
    margin: 0;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 900px) {
    .bento-grid {
      grid-template-columns: 1fr;
    }

    .bento-span-2,
    .bento-span-full {
      grid-column: 1;
    }

    .suite-row {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 520px) {
    .suite-row {
      grid-template-columns: 1fr;
    }
  }
</style>
