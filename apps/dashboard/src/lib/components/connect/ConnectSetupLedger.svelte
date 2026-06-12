<script lang="ts">
  import BrutalBadge from "$lib/components/brutalist/BrutalBadge.svelte";
  import { INGEST_ROUTES_HREF, RUNS_HREF } from "$lib/nav-config";
  import BrutalButton from "$lib/components/brutalist/BrutalButton.svelte";
  import {
    resolveConnectHubPrimaryAction,
    resolveConnectHubSecondaryActions,
    type ConnectOperationalAction,
    type ConnectSetupStep,
    type ConnectSetupStepId,
  } from "$lib/connect/connect-journey";
  import { trustScoreDescriptor } from "$lib/connect/ingest-quality-display";
  import { pipelineWizardHref } from "$lib/connect/pipeline-config";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import type { ConnectGraphPulse, ConnectHubPayload } from "$lib/server/connect/connect-hub-load";


  type SetupStep = ConnectHubPayload["journey"]["steps"][number];
  type GraphStats = NonNullable<ConnectHubPayload["journey"]["stats"]>;
  type GraphHealth = NonNullable<ConnectHubPayload["setupHealth"]>["graphHealth"];
  type LatestJob = NonNullable<ConnectHubPayload["journey"]["latestJob"]>;

  export let setupHealth: NonNullable<ConnectHubPayload["setupHealth"]>;
  export let phase: ConnectHubPayload["phase"];
  export let journeySteps: SetupStep[] = [];
  export let nextStep: ConnectSetupStep | null = null;
  export let nextStepId: ConnectSetupStepId | null = null;
  export let operationalActions: ConnectOperationalAction[] | null = null;
  export let requiredDone = 0;
  export let requiredTotal = 0;
  export let stats: GraphStats | null = null;
  /** Streamed authoritative graph counts; updates only the pulse band when it resolves. */
  export let pulse: Promise<ConnectGraphPulse | null> | null = null;
  export let latestJob: LatestJob | null = null;
  export let activeRun = false;
  export let graphHref: string;

  // The pulse band shows cached values immediately, then swaps to the streamed
  // authoritative counts when they arrive — so the rest of the page stays usable.
  let freshPulse: ConnectGraphPulse | null = null;
  let pulseLoading = false;
  let subscribedPulse: Promise<ConnectGraphPulse | null> | null = null;
  $: if (pulse && pulse !== subscribedPulse) {
    subscribedPulse = pulse;
    freshPulse = null;
    pulseLoading = true;
    pulse
      .then((p) => {
        freshPulse = p;
      })
      .finally(() => {
        pulseLoading = false;
      });
  }
  $: effectiveStats = (freshPulse ? freshPulse.stats : stats) as GraphStats | null;
  $: effectiveGraphHealth = (freshPulse
    ? freshPulse.graphHealth
    : setupHealth.graphHealth) as GraphHealth;
  // True while we have no numbers yet and the authoritative load is still running.
  $: pulsePending = pulseLoading && !effectiveStats;

  const RAILS: {
    key: keyof Omit<ConnectHubPayload["setupHealth"], "graphHealth">;
    label: string;
    short: string;
    href: string;
  }[] = [
    { key: "graphStore", label: "Graph store", short: "Store", href: pipelineWizardHref("store") },
    {
      key: "routesReady",
      label: "Ingest routes",
      short: "Routes",
      href: INGEST_ROUTES_HREF,
    },
    { key: "documentsReady", label: "Documents", short: "Docs", href: pipelineWizardHref("sources") },
    {
      key: "encryptionReady",
      label: "Encryption",
      short: "Keys",
      href: `${DASHBOARD_BASE}/integrations`,
    },
    { key: "productionPresetDefault", label: "Quality preset", short: "Preset", href: pipelineWizardHref("domain") },
  ];

  let checklistExpanded = phase === "initial";

  function formatRelativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 1) return "less than 1 hour ago";
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  /** Exact value (for title / aria) — full grouped digits. */
  function exactCount(n: number): string {
    return n.toLocaleString();
  }

  /**
   * Consistent compact display for every metric cell: plain integer under 1,000,
   * otherwise one-decimal compact (3.4K, 22.5K, 34.0K, 1.2M). Always short enough
   * to fit the cell at the display font — never truncated with an ellipsis.
   */
  function formatPulseCount(n: number): string {
    if (!Number.isFinite(n)) return "0";
    if (Math.abs(n) < 1000) return String(Math.round(n));
    return new Intl.NumberFormat("en", {
      notation: "compact",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(n);
  }

  $: railsLive = RAILS.filter((r) => setupHealth[r.key]).length;
  $: railsTotal = RAILS.length;
  $: allRailsLive = railsLive === railsTotal;
  $: journeyDone = journeySteps.filter((s) => s.status === "done").length;
  $: journeyTotal = journeySteps.length;
  $: graphHealth = effectiveGraphHealth;
  $: hasGraph = Boolean(effectiveStats && effectiveStats.units > 0);
  $: ledgerShowsGraphCta = Boolean(graphHealth);
  $: ledgerShowsLatestRun = Boolean(latestJob);
  $: primaryAction = resolveConnectHubPrimaryAction({ phase, nextStep, operationalActions });
  $: secondaryActions = resolveConnectHubSecondaryActions({
    phase,
    operationalActions,
    ledgerShowsGraphCta,
    ledgerShowsLatestRun,
  });
  $: allJourneyComplete = journeyTotal > 0 && journeyDone === journeyTotal;
  $: pct = requiredTotal > 0 ? Math.round((requiredDone / requiredTotal) * 100) : 0;
  $: latestRunHref = latestJob ? `${RUNS_HREF}/${latestJob.id}?from=hub` : null;
  $: hasAuditIssues = Boolean(graphHealth && graphHealth.total_issues > 0);
  // W2.3: ONE trust number — quote the scorecard service's value (single source of truth).
  // The scorecard service computes the same kg-audit formula; by quoting its result, the
  // pulse band and the scorecard panel always show the same number.
  $: displayTrustScore = freshPulse?.scorecardTrustScore ?? graphHealth?.trust_score ?? null;
  $: displayTrustFormula = freshPulse?.trustFormula ?? graphHealth?.formula ?? null;
  $: trustLabel = displayTrustScore != null ? trustScoreDescriptor(displayTrustScore).label : "";
</script>

<section class="setup-ledger" aria-label="Connect control panel">
  <header class="ledger-cap brut-fill-neon">
    <div class="ledger-cap-main">
      <p class="ledger-kicker">Connect · workspace pulse</p>
      <h2 class="ledger-headline">
        {#if phase === "operational" && allRailsLive}
          All systems go
        {:else if allRailsLive}
          Infrastructure ready
        {:else}
          Finish the rails
        {/if}
      </h2>
    </div>
    <div class="ledger-cap-side">
      <div class="ledger-cap-badges" aria-label="Setup counters">
        <BrutalBadge variant="secondary" label="{railsLive}/{railsTotal} rails" />
        {#if phase === "initial"}
          <BrutalBadge variant="secondary" label="{requiredDone}/{requiredTotal} req" />
        {:else if journeyTotal > 0}
          <BrutalBadge variant="secondary" label="{journeyDone}/{journeyTotal} steps" />
        {/if}
      </div>
      <BrutalButton variant="primary" href={primaryAction.href}>
        {primaryAction.cta}{phase === "operational" ? " →" : ""}
      </BrutalButton>
    </div>
  </header>

  <div class="ledger-body brut-fill-white">
    {#if phase === "initial"}
      <div
        class="ledger-progress"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Required setup progress"
      >
        <div class="ledger-progress-fill" style:width="{pct}%"></div>
      </div>
    {/if}

    <!-- Graph pulse hero — full width, asymmetric bento -->
    <section class="pulse-band" aria-labelledby="pulse-heading">
      <h3 id="pulse-heading" class="ledger-section-title">Graph pulse</h3>
      <div class="pulse-grid">
        <article class="pulse-trust" class:pulse-trust-empty={!graphHealth}>
          {#if graphHealth && displayTrustScore != null}
            {#if hasAuditIssues}
              <p class="pulse-issues-lead" aria-label="{graphHealth.total_issues} graph audit issues">
                {graphHealth.total_issues} audit issue{graphHealth.total_issues === 1 ? "" : "s"}
              </p>
              <p class="pulse-issues-kicker">Corpus checks — not individual ideas</p>
              <p class="pulse-trust-score" aria-label="Graph trust score {displayTrustScore}, {trustLabel}">
                <span class="pulse-trust-score-num">{displayTrustScore}</span>
                <span class="pulse-trust-score-label">Trust</span>
              </p>
            {:else}
              <p class="pulse-trust-kicker">Trust score</p>
              <p class="pulse-trust-score" aria-label="Graph trust score {displayTrustScore}">
                <span class="pulse-trust-score-num">{displayTrustScore}</span>
              </p>
              <p class="pulse-trust-descriptor">{trustScoreDescriptor(displayTrustScore).full}</p>
              <p class="pulse-trust-meta">
                <strong>{graphHealth.ok_pct}%</strong> supported
              </p>
              {#if latestJob && "updatedAt" in latestJob && latestJob.updatedAt}
                <p class="pulse-updated">Last updated {formatRelativeTime(latestJob.updatedAt)}</p>
              {/if}
            {/if}
            {#if displayTrustFormula}
              <p class="pulse-trust-formula" title={displayTrustFormula}>{displayTrustFormula}</p>
            {/if}
          {:else if graphHealth}
            <p class="pulse-trust-kicker">Trust score</p>
            <p class="pulse-trust-score" aria-label="Graph trust score loading">
              <span class="pulse-trust-score-num">…</span>
            </p>
            <p class="pulse-trust-meta">
              <strong>{graphHealth.ok_pct}%</strong> supported
            </p>
          {:else}
            <p class="pulse-trust-kicker">Trust</p>
            <p class="pulse-empty">Run ingest first</p>
          {/if}
        </article>

        {#if hasGraph && effectiveStats}
          {#each [
            { label: "Ideas", value: effectiveStats.units },
            { label: "Links", value: effectiveStats.relations },
            { label: "Groups", value: effectiveStats.groups },
            { label: "Embed", value: effectiveStats.embedded },
          ] as metric (metric.label)}
            <article class="pulse-stat">
              <span
                class="pulse-stat-num"
                title="{exactCount(metric.value)} {metric.label.toLowerCase()}"
                aria-label="{exactCount(metric.value)} {metric.label.toLowerCase()}"
              >{formatPulseCount(metric.value)}</span>
              <span class="pulse-stat-label">{metric.label}</span>
            </article>
          {/each}
        {:else}
          {#each ["Ideas", "Links", "Groups", "Embed"] as label (label)}
            <article class="pulse-stat pulse-stat-dim" class:pulse-stat-loading={pulsePending} aria-busy={pulsePending}>
              <span class="pulse-stat-num">—</span>
              <span class="pulse-stat-label">{label}</span>
            </article>
          {/each}
        {/if}

        <div class="pulse-footer">
          {#if hasGraph && effectiveStats && effectiveStats.validation.ok + effectiveStats.validation.weak + effectiveStats.validation.unsupported > 0}
            <div class="validation-chips" aria-label="Validation mix">
              <span class="validation-pill validation-pill-ok">{effectiveStats.validation.ok} ok</span>
              {#if effectiveStats.validation.weak > 0}
                <span class="validation-pill validation-pill-weak">{effectiveStats.validation.weak} weak</span>
              {/if}
              {#if effectiveStats.validation.unsupported > 0}
                <span class="validation-pill validation-pill-bad">{effectiveStats.validation.unsupported} bad</span>
              {/if}
              {#if effectiveStats.validation.unvalidated > 0}
                <!-- F-P2-1: the unvalidated state is UNKNOWN, not success — neutral
                     styling, not the -ok pill it borrowed before (W4.5 a11y sweep). -->
                <span class="validation-pill validation-pill-unknown">{effectiveStats.validation.unvalidated} ?</span>
              {/if}
            </div>
          {/if}

          {#if latestJob && latestRunHref}
            <a
              class="run-chip brut-pressable brut-focus"
              class:run-chip-active={activeRun}
              href={latestRunHref}
            >
              <span class="run-chip-kicker">{activeRun ? "Live run" : "Last run"}</span>
              <span class="run-chip-label">{latestJob.label ?? "Ingest job"}</span>
              <BrutalBadge variant="secondary" label={latestJob.status} />
            </a>
          {/if}

          <div class="pulse-footer-actions" aria-label="Resolve graph issues">
            {#if graphHealth?.issues?.length}
              {#each graphHealth.issues as issue, index (issue.kind)}
                <BrutalButton variant="blue" href={issue.actionHref}>
                  {issue.actionLabel} →
                </BrutalButton>
              {/each}
              <!-- D2 (UXC §2 [R1] Claims): the explorer section is "Claims", not "graph". -->
              <BrutalButton variant="outline" href={graphHref}>Open Claims</BrutalButton>
            {:else}
              <BrutalButton variant="blue" href={graphHref}>
                {ledgerShowsGraphCta ? "Review claims" : "Open Claims"}
              </BrutalButton>
            {/if}
          </div>
        </div>

        {#if graphHealth && graphHealth.issues.length > 0}
          <div class="pulse-issues-band" role="region" aria-labelledby="pulse-issues-heading">
            <div class="pulse-issues-band-head">
              <h4 id="pulse-issues-heading" class="pulse-issues-heading">
                What these issues mean
              </h4>
              {#if latestRunHref}
                <a class="pulse-issues-run-link brut-focus" href={latestRunHref}>
                  View last run report →
                </a>
              {/if}
            </div>
            <ul class="pulse-issues-list">
              {#each graphHealth.issues as issue (issue.kind)}
                <li class="pulse-issue">
                  <span
                    class="pulse-issue-severity"
                    class:pulse-issue-severity-high={issue.severity === "high"}
                    aria-label="{issue.severity} severity"
                  >
                    {issue.severity === "high" ? "High" : "Med"}
                  </span>
                  <div class="pulse-issue-body">
                    <p class="pulse-issue-title">{issue.title}</p>
                    <p class="pulse-issue-detail">{issue.detail}</p>
                  </div>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    </section>

    <!-- Infrastructure status strip -->
    <section class="rails-band" aria-labelledby="rails-heading">
      <h3 id="rails-heading" class="ledger-section-title">Infrastructure rails</h3>
      <ul class="rails-strip">
        {#each RAILS as rail, i (rail.key)}
          {@const ok = setupHealth[rail.key]}
          <li class="rail-seg" class:rail-seg-ok={ok} class:rail-seg-first={i === 0} class:rail-seg-last={i === RAILS.length - 1}>
            <a class="rail-seg-link brut-focus brut-pressable" href={rail.href}>
              <span class="rail-seg-glyph" class:rail-glyph-live={ok} class:rail-glyph-wait={!ok} aria-hidden="true">
                {ok ? "■" : "□"}
              </span>
              <span class="rail-seg-short">{rail.short}</span>
              <span class="rail-seg-state">{ok ? "live" : "wait"}</span>
              <span class="rail-seg-arrow" aria-hidden="true">→</span>
              <span class="visually-hidden">{rail.label} — {ok ? "live" : "pending"}</span>
            </a>
          </li>
        {/each}
      </ul>
    </section>

    <!-- Compact secondary actions -->
    {#if secondaryActions.length > 0}
      <section class="actions-band" aria-labelledby="actions-heading">
        <h3 id="actions-heading" class="ledger-section-title">More actions</h3>
        <div class="action-chips">
          {#each secondaryActions as action (action.id)}
            <a class="action-chip brut-pressable brut-focus" href={action.href} title={action.description}>
              <span class="action-chip-label">{action.cta}</span>
              <span class="action-chip-hint">{action.title}</span>
            </a>
          {/each}
        </div>
      </section>
    {:else if phase === "initial"}
      <p class="action-hint brut-muted">
        Expand the journey checklist for every setup step. Primary action is in the yellow cap.
      </p>
    {/if}

    {#if journeySteps.length > 0}
      <div class="ledger-steps-wrap">
        <details class="ledger-steps" bind:open={checklistExpanded}>
          <summary class="ledger-steps-summary brut-focus">
            <span>Journey checklist</span>
            <span class="ledger-steps-count">{journeyDone}/{journeyTotal}</span>
          </summary>
          {#if allJourneyComplete && checklistExpanded}
            <button
              type="button"
              class="ledger-steps-reveal brut-focus"
              on:click={() => (checklistExpanded = false)}
            >
              Hide completed steps ↑
            </button>
          {/if}
          <ol class="ledger-steps-list">
            {#each journeySteps as step (step.id)}
              <li
                class="ledger-step"
                class:ledger-step-done={step.status === "done"}
                class:ledger-step-next={step.id === nextStepId}
              >
                <span class="rail-glyph" class:rail-glyph-done={step.status === "done"} aria-hidden="true">
                  {step.status === "done" ? "■" : "□"}
                </span>
                <div class="ledger-step-main">
                  <span class="ledger-step-title">{step.title}</span>
                  {#if step.detail}
                    <span class="ledger-step-detail brut-muted">{step.detail}</span>
                  {/if}
                </div>
                {#if step.status === "done"}
                  <span class="ledger-step-done-label">Done ✓</span>
                {:else}
                  <BrutalButton variant={step.id === nextStepId ? "outline" : "canvas"} href={step.href}>
                    {step.id === nextStepId && phase === "initial" ? "Continue setup →" : step.cta}
                  </BrutalButton>
                {/if}
              </li>
            {/each}
          </ol>
        </details>
        {#if allJourneyComplete && !checklistExpanded}
          <button
            type="button"
            class="ledger-steps-reveal brut-focus"
            on:click={() => (checklistExpanded = true)}
          >
            Show completed steps ↓
          </button>
        {/if}
      </div>
    {/if}
  </div>
</section>

<style>
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

  .setup-ledger {
    margin: 0 0 var(--space-5);
    position: relative;
  }

  .ledger-cap {
    border: var(--border);
    border-radius: 0;
    box-shadow: var(--shadow-lg);
    padding: var(--space-8) var(--space-5);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    position: relative;
    z-index: 2;
  }

  .ledger-cap-side {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-3);
  }

  /* Button inside yellow banner must be inverted to remain visible */
  .ledger-cap :global(.brutal-btn-primary) {
    background: var(--color-ink);
    color: var(--color-surface);
  }

  .ledger-kicker {
    margin: 0 0 var(--space-1);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-ink);
  }

  .ledger-headline {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-display-metric);
    font-weight: 900;
    line-height: var(--text-display-line-height);
    color: var(--color-ink);
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
  }

  .ledger-cap-badges {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .ledger-body {
    margin-top: -4px;
    margin-left: 4px;
    border: var(--border);
    border-radius: 0;
    box-shadow: 8px 8px 0 0 var(--color-ink);
    padding: var(--space-4) var(--space-5) var(--space-5);
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .ledger-progress {
    height: 12px;
    border: var(--border);
    border-radius: 0;
    background: var(--color-bg);
    overflow: hidden;
    box-shadow: 2px 2px 0 0 var(--color-ink);
  }

  .ledger-progress-fill {
    height: 100%;
    background: var(--color-ink);
    transition: width 0.25s ease;
  }

  .ledger-section-title {
    margin: 0 0 var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-ink);
  }

  /* Graph pulse bento */
  .pulse-grid {
    display: grid;
    gap: 0;
    border: var(--border);
    background: var(--color-ink);
    grid-template-columns: minmax(6.5rem, 1.15fr) repeat(4, minmax(0, 1fr));
    grid-template-rows: auto auto;
  }

  @media (max-width: 720px) {
    .pulse-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .pulse-trust {
      grid-column: 1 / -1;
    }
    .pulse-footer {
      grid-column: 1 / -1;
    }
  }

  .pulse-trust {
    grid-row: 1 / span 2;
    background: var(--color-blue);
    color: var(--color-surface);
    --pulse-trust-ink: var(--color-surface);
    --pulse-trust-muted: var(--color-bg);
    --pulse-trust-faint: color-mix(in oklab, var(--color-bg) 92%, var(--color-surface));
    --pulse-trust-accent: var(--color-yellow);
    padding: var(--space-6);
    border-right: var(--border);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-2);
    min-height: 10rem;
  }

  .pulse-trust-empty {
    background: var(--color-bg);
    color: var(--color-ink);
    --pulse-trust-ink: var(--color-ink);
    --pulse-trust-muted: var(--color-ink-muted);
    --pulse-trust-faint: var(--color-ink-faint);
    --pulse-trust-accent: var(--color-ink);
  }

  .pulse-trust-kicker {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--pulse-trust-muted);
  }

  .pulse-trust-score {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    line-height: 1;
  }

  .pulse-trust-score-num {
    font-family: var(--font-display);
    font-size: var(--text-display-metric);
    font-weight: 900;
    line-height: var(--text-display-line-height);
    letter-spacing: var(--text-display-tracking);
    color: var(--pulse-trust-ink);
  }

  .pulse-trust-score-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--pulse-trust-muted);
  }

  .pulse-trust-meta {
    margin: 0;
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    line-height: 1.4;
    color: var(--pulse-trust-ink);
  }

  .pulse-trust-meta strong {
    font-weight: 800;
  }

  .pulse-empty {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .pulse-stat {
    background: var(--color-surface);
    color: var(--color-ink);
    padding: var(--space-4);
    border-right: var(--border);
    border-bottom: var(--border);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-1);
    min-height: 7rem;
    min-width: 0;
  }

  .pulse-stat-dim {
    background: var(--color-bg);
    color: var(--color-ink-muted);
  }

  .pulse-stat-loading {
    animation: pulse-stat-shimmer 1.2s ease-in-out infinite;
  }
  @keyframes pulse-stat-shimmer {
    0%,
    100% {
      opacity: 0.45;
    }
    50% {
      opacity: 0.85;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pulse-stat-loading {
      animation: none;
    }
  }

  .pulse-stat-num {
    font-size: var(--text-display-metric);
    font-weight: 900;
    font-family: var(--font-display);
    line-height: var(--text-display-line-height);
    letter-spacing: var(--text-display-tracking);
    color: var(--color-ink);
    white-space: nowrap;
  }

  .pulse-stat-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-ink);
  }

  .pulse-footer-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin-left: auto;
  }

  @media (max-width: 720px) {
    .pulse-footer-actions {
      margin-left: 0;
      width: 100%;
    }
  }

  .pulse-footer {
    grid-column: 2 / -1;
    background: var(--color-surface);
    padding: var(--space-3);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    border-top: var(--border-thin);
  }

  @media (max-width: 720px) {
    .pulse-footer {
      grid-column: 1 / -1;
    }
  }

  .validation-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    flex: 1;
    min-width: min(100%, 12rem);
  }

  .validation-pill {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: lowercase;
    border-radius: 0;
    white-space: nowrap;
  }

  .validation-pill-ok {
    border: var(--border-thin);
    background: transparent;
    color: var(--color-ink);
  }

  .validation-pill-weak {
    border: var(--border);
    background: transparent;
    color: var(--color-ink);
    box-shadow: none;
  }

  .validation-pill-bad {
    border: var(--border);
    background: var(--color-ink);
    color: var(--color-yellow);
  }

  /* F-P2-1: unvalidated = unknown, not success. Dashed muted border + muted text
     reads as "not yet known" rather than borrowing the -ok (success) treatment. */
  .validation-pill-unknown {
    border: var(--border-thin);
    border-style: dashed;
    background: transparent;
    color: var(--color-ink-muted);
  }

  .run-chip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: var(--border-thin);
    background: var(--color-bg);
    text-decoration: none;
    color: inherit;
    min-height: 44px;
    max-width: 100%;
  }

  .run-chip-active {
    background: var(--color-surface);
    border: var(--border);
    box-shadow: var(--shadow-md);
  }

  .run-chip-kicker {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-ink-muted);
  }

  .run-chip-label {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--color-ink);
    max-width: 14rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Rails strip */
  .rails-strip {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    border: var(--border);
    box-shadow: var(--shadow-md);
    overflow-x: auto;
  }

  .rail-seg {
    flex: 1 1 0;
    min-width: 4.5rem;
    padding: 0;
    background: var(--color-bg);
    border-right: var(--border-thin);
    display: flex;
    flex-direction: column;
    align-items: stretch;
    text-align: center;
    transition: background 0.15s ease, box-shadow 0.15s ease;
  }

  .rail-seg:hover,
  .rail-seg:focus-within {
    background: var(--color-bg-deep);
    box-shadow: var(--shadow-sm);
  }

  .rail-seg-ok:hover,
  .rail-seg-ok:focus-within {
    background: var(--color-bg-deep);
  }

  .rail-seg-last {
    border-right: none;
  }

  .rail-seg-ok {
    background: var(--color-surface);
  }

  .rail-seg-glyph {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    line-height: 1;
    color: var(--color-ink-muted);
  }

  .rail-seg-ok .rail-seg-glyph {
    color: var(--color-ink);
  }

  .rail-seg-short {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .rail-seg-state {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-ink-muted);
  }

  .rail-seg-ok .rail-seg-state {
    color: var(--color-ink);
  }

  /* Action chips */
  .action-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .action-chip {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-2) var(--space-4);
    border: var(--border);
    background: var(--color-surface);
    text-decoration: none;
    color: inherit;
    min-height: 44px;
    min-width: 8rem;
  }

  .action-chip-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-ink);
  }

  .action-chip-hint {
    font-size: var(--text-xs);
    color: var(--color-ink-muted);
    line-height: 1.3;
  }

  .action-hint {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.5;
    padding: var(--space-3);
    border: var(--border-thin);
    background: var(--color-bg);
  }

  .pulse-issues-lead {
    margin: 0 0 var(--space-1);
    font-family: var(--font-display);
    font-size: var(--text-display-metric-sm);
    font-weight: 900;
    color: var(--pulse-trust-accent);
    line-height: var(--text-display-line-height);
    letter-spacing: var(--text-display-tracking);
  }

  .pulse-issues-kicker {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 600;
    color: var(--pulse-trust-muted);
    line-height: 1.4;
  }

  .pulse-issues-band {
    grid-column: 1 / -1;
    background: var(--color-bg);
    border-top: var(--border);
    padding: var(--space-3) var(--space-4);
  }

  .pulse-issues-band-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2) var(--space-4);
    margin-bottom: var(--space-3);
  }

  .pulse-issues-heading {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-ink);
  }

  .pulse-issues-run-link {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    color: var(--color-blue);
    text-decoration: none;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }

  .pulse-issues-run-link:hover,
  .pulse-issues-run-link:focus-visible {
    text-decoration: underline;
  }

  .pulse-issues-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: var(--space-2);
  }

  .pulse-issue {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-3);
    align-items: start;
    padding: var(--space-3);
    border: var(--border-thin);
    background: var(--color-surface);
  }

  .pulse-issue-severity {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: var(--space-1) var(--space-2);
    border: var(--border-thin);
    background: transparent;
    color: var(--color-ink);
    white-space: nowrap;
  }

  .pulse-issue-severity-high {
    background: var(--color-ink);
    color: var(--color-yellow);
  }

  .pulse-issue-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  .pulse-issue-title {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-ink);
    line-height: 1.3;
  }

  .pulse-issue-detail {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--color-ink-muted);
  }

  .pulse-trust-descriptor {
    margin: 0 0 var(--space-1);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--pulse-trust-muted);
  }

  .pulse-updated {
    margin: var(--space-1) 0 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 600;
    color: var(--pulse-trust-muted);
  }

  /* W2.3: formula footnote — single-source attribution so users know WHICH formula. */
  .pulse-trust-formula {
    margin: var(--space-2) 0 0;
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--pulse-trust-faint);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    cursor: default;
  }

  .rail-seg-link {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    text-decoration: none;
    color: inherit;
    width: 100%;
    padding: var(--space-2) var(--space-2);
    min-height: 40px;
    cursor: pointer;
  }

  .rail-seg-arrow {
    position: absolute;
    right: var(--space-2);
    bottom: var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    color: var(--color-ink-faint);
    opacity: 0;
    transition: opacity 0.15s ease;
    pointer-events: none;
  }

  .rail-seg:hover .rail-seg-arrow,
  .rail-seg:focus-within .rail-seg-arrow {
    opacity: 1;
  }

  .rail-glyph-live {
    color: var(--color-yellow);
    text-shadow: 0 0 0 var(--color-ink);
  }

  .rail-glyph-wait {
    color: var(--color-ink);
    border: 2px dashed var(--color-ink-faint);
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    line-height: 0;
    font-size: 0;
  }

  .rail-glyph {
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    line-height: 1;
    color: var(--color-ink-muted);
  }

  .rail-glyph-done {
    color: var(--color-yellow);
  }

  .ledger-step-done-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-faint);
    white-space: nowrap;
  }

  .ledger-steps-wrap {
    border-top: var(--border);
    padding-top: var(--space-4);
  }

  .ledger-steps {
    border-top: none;
    padding-top: 0;
  }

  .ledger-steps-reveal {
    display: block;
    margin: var(--space-1) 0 0;
    padding: var(--space-1) 0;
    border: none;
    background: none;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-faint);
    text-align: left;
    min-height: 44px;
  }

  .ledger-steps-reveal:hover,
  .ledger-steps-reveal:focus-visible {
    color: var(--color-ink-muted);
    text-decoration: underline;
  }

  .ledger-steps-summary {
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-ink);
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    list-style: none;
    padding: var(--space-2) 0;
  }

  .ledger-steps-summary::-webkit-details-marker {
    display: none;
  }

  .ledger-steps-count {
    padding: 2px 8px;
    border: var(--border-thin);
    background: transparent;
    font-size: var(--text-mono-sm);
    color: var(--color-ink);
  }

  .ledger-steps-list {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .ledger-step {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: var(--border-thin);
    border-radius: 0;
    background: var(--color-bg);
    min-height: 44px;
  }

  .ledger-step-next {
    border: var(--border);
    box-shadow: var(--shadow-md);
    background: var(--color-surface);
  }

  .ledger-step-done {
    opacity: 0.92;
  }

  .ledger-step-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .ledger-step-title {
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-ink);
  }

  .ledger-step-detail {
    font-size: var(--text-xs);
    line-height: 1.35;
  }
</style>
