<script lang="ts">
  import StackSetupWizard from "$lib/components/dashboard/StackSetupWizard.svelte";
  import LivePulse from "$lib/components/dashboard/LivePulse.svelte";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { isDashboardHrefUiHidden } from "$lib/dashboard-ui-path-match";
  import { SUITE_MODULES, type SuiteModule } from "$lib/suite/suite-modules";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
  import { integrationStackTemplatesForFlags } from "$lib/integration-catalog-for-flags";
  import type { ConnectCompletionSignals, ConnectReadinessSummary } from "./+page.server";
  import { readinessChipLabel } from "$lib/connect/verified-readiness";

  export let data: {
    workspaceId: string | null;
    projects: { id: string; name: string }[];
    projectsError?: string | null;
    entitlements:
      | {
          workspaceId: string;
          plan: "free" | "pro";
          projectLimit: number;
          monthlyRequestLimit: number;
          foundingProExpiresAt: number | null;
        }
      | null;
    usage:
      | {
          usedThisMonth: number | null;
          monthlyLimit: number;
          projectLimit: number;
          providersConnected: number;
        }
      | null;
    setup:
      | {
          workspaceCreatedAt: number;
          projectCount: number;
          projectCreatedAt: number | null;
          integrationCount: number;
          providerConnectedAt: number | null;
          gatewayKeyCount: number;
          routeCount: number;
          routeCreatedAt: number | null;
          requestCount: number;
          firstRequestAt: number | null;
        }
      | null;
    livePulse:
      | {
          requestCount24h: number;
          errorRate: number;
          p50LatencyMs: number | null;
          p95LatencyMs: number | null;
          avgLatencyMs: number | null;
          topRoute:
            | {
                routeId: string | null;
                routeName: string;
                requestCount: number;
              }
            | null;
          analyticsUnavailable: boolean;
        }
      | null;
    contextSignals: {
      noRouteCount24h: number;
      hasAnyRoutePolicyBinding: boolean;
    };
    connectCompletion: ConnectCompletionSignals;
    connectReadiness: Promise<ConnectReadinessSummary | null>;
    trustStrip: Promise<{
      trust_score: number;
      g2: { ok_pct: number };
      verification_states?: Record<string, number>;
      units: number;
      last_verified_at: string | null;
    } | null>;
  };

  const CONNECT_BASE = DASHBOARD_BASE + "/connect";

  const isFree = data.entitlements?.plan === "free";

  const LOGS_VISITED_KEY = "restormel_logs_visited";
  let logsVisited = false;
  /** Full checklist behind one click — next step + progress stay visible. */
  let setupExpanded = false;

  onMount(() => {
    logsVisited = localStorage.getItem(LOGS_VISITED_KEY) === "true";
  });

  // ── Routing (Keys) journey checklist ────────────────────────────────────
  $: setupSteps = [
    { id: "workspace", label: "Workspace is ready", done: Boolean(data.setup?.workspaceCreatedAt), href: null, cta: "" },
    { id: "projects", label: "Create your first project", done: (data.setup?.projectCount ?? 0) > 0, href: DASHBOARD_BASE + "/projects", cta: "Open Projects" },
    { id: "connections", label: "Add your first connection", done: (data.setup?.integrationCount ?? 0) > 0, href: DASHBOARD_BASE + "/integrations", cta: "Open Connections" },
    { id: "api-keys", label: "Create a Gateway key", done: (data.setup?.gatewayKeyCount ?? 0) > 0, href: DASHBOARD_BASE + "/access", cta: "Open Gateway keys" },
    { id: "rules", label: "Create a route", done: (data.setup?.routeCount ?? 0) > 0, href: DASHBOARD_BASE + "/routes", cta: "Open Routes" },
    { id: "first-request", label: "Run your first request", done: (data.setup?.requestCount ?? 0) > 0, href: DASHBOARD_BASE + "/sandbox", cta: "Try a test request" },
    { id: "logs", label: "Review logs once", done: logsVisited, href: DASHBOARD_BASE + "/logs", cta: "Open Logs" },
  ];
  $: setupUiHidden = $page.data.dashboardUiHidden ?? [];
  $: setupStepsForUi = setupSteps.filter((step) => !step.href || !isDashboardHrefUiHidden(step.href, setupUiHidden));
  $: setupDoneCount = setupStepsForUi.filter((step) => step.done).length;
  $: setupTotalCount = setupStepsForUi.length;
  $: nextStep = setupStepsForUi.find((step) => !step.done) ?? null;
  $: allSetupDone = setupTotalCount > 0 && setupDoneCount === setupTotalCount;
  $: suiteApps = ($page.data.suiteModulesForUi ?? SUITE_MODULES).filter((m: SuiteModule) => m.id !== "keys");

  // ── Verified context (Connect) journey steps ─────────────────────────────
  // Step completion is derived from connectCompletion signals — no extra queries.
  $: connectSteps = [
    {
      id: "store",
      label: "Connect a graph store",
      done: data.connectCompletion.storeConnected,
      href: CONNECT_BASE + "/pipeline?step=store",
      cta: data.connectCompletion.storeConnected ? "Review store" : "Connect store",
    },
    {
      id: "ingest",
      label: "Run first ingest — turn docs into verified context",
      done: data.connectCompletion.firstRunStarted,
      href: data.connectCompletion.firstRunStarted
        ? CONNECT_BASE + "/ingest"
        : CONNECT_BASE + "/pipeline?step=launch",
      cta: data.connectCompletion.firstRunStarted ? "View runs" : "Start ingest run",
    },
    {
      id: "review",
      label: "Review claims in the graph explorer",
      done: data.connectCompletion.firstRunCompleted,
      href: CONNECT_BASE + "/graph",
      cta: "Open graph explorer",
    },
    {
      id: "agent",
      label: "Wire an agent to your verified context",
      done: data.connectCompletion.agentReady,
      href: CONNECT_BASE + "/mcp",
      cta: "Agent setup",
    },
  ];
  $: connectDoneCount = connectSteps.filter((s) => s.done).length;
  $: connectTotalCount = connectSteps.length;
  $: connectNextStep = connectSteps.find((s) => !s.done) ?? null;
  $: allConnectDone = connectTotalCount > 0 && connectDoneCount === connectTotalCount;

  $: testingCiSteps = [
    {
      id: "t-conn",
      label: "Add a connection (hosted key or vault ref)",
      done: (data.setup?.integrationCount ?? 0) > 0,
      href: DASHBOARD_BASE + "/integrations",
      cta: "Open Connections",
    },
    {
      id: "t-gw",
      label: "Create a Gateway key for the Testing project",
      done: (data.setup?.gatewayKeyCount ?? 0) > 0,
      href: DASHBOARD_BASE + "/access",
      cta: "Open Gateway keys",
    },
    {
      id: "t-hub",
      label: "Copy RESTORMEL_* env from Restormel Testing hub",
      done:
        (data.setup?.integrationCount ?? 0) > 0 && (data.setup?.gatewayKeyCount ?? 0) > 0,
      href: DASHBOARD_BASE + "/testing",
      cta: "Open Restormel Testing",
    },
  ];
  $: testingCiDone = testingCiSteps.filter((s) => s.done).length;

  $: moduleFlags = $page.data.moduleFlags ?? MVP_MODULE_DEFAULTS;
  $: testingOn = moduleFlags.testing;
  $: guardrailsOn = moduleFlags.guardrails;
  $: showStackExport = Boolean(data.workspaceId) && integrationStackTemplatesForFlags(moduleFlags).length > 0;
  $: showTestingCi = testingOn;
  $: showMoreSetup = showStackExport || showTestingCi;

  /** Compact ISO date → "3 Jun 2026" — avoids importing a date library. */
  function fmtDate(iso: string | null): string {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "";
    }
  }

  /** Count unverified/review-state claims from scorecard.verification_states. */
  function reviewCount(states: Record<string, number> | undefined): number {
    if (!states) return 0;
    return (states.unverified ?? 0) + (states.contradicted ?? 0);
  }
</script>

<svelte:head>
  <title>Overview – Restormel Dashboard</title>
</svelte:head>

<header class="overview-header">
  <div class="overview-header-text">
    <h1 class="page-title">Workspace overview</h1>
    <p class="page-desc overview-header-desc">
      Verified context status, setup checklists, and live traffic for your workspace.
      The <a href={CONNECT_BASE}>Connect hub</a> is your workspace for ingesting and reviewing graph data.
    </p>
  </div>
</header>

{#if data.projectsError}
  <p class="error-msg" role="alert">
    Could not load your projects. Reload the page to try again, or contact support if the problem continues.
  </p>
{/if}

<!-- ── Trust strip ─────────────────────────────────────────────────────── -->
<!-- Quotes the scorecard service — never recomputes. Streams in after shell. -->
<!-- Claims-ledger: row 2 (supported = verbatim quote), row 1 (validated against source). -->
{#await data.trustStrip}
  <div class="trust-strip trust-strip--loading" aria-label="Loading verified context status" aria-busy="true">
    <span class="trust-strip-skel trust-strip-skel--wide"></span>
    <span class="trust-strip-skel"></span>
    <span class="trust-strip-skel"></span>
  </div>
{:then scorecard}
  {#if scorecard}
    {@const supported = scorecard.verification_states?.supported ?? 0}
    {@const totalUnits = scorecard.units}
    {@const supportedPct = totalUnits > 0 ? Math.round((supported / totalUnits) * 100) : 0}
    {@const needsReview = reviewCount(scorecard.verification_states)}
    <div class="trust-strip panel" aria-label="Verified context status">
      <div class="trust-strip-inner">
        <div class="trust-strip-score">
          <span class="trust-score-num">{scorecard.trust_score}</span>
          <span class="trust-score-label">Trust score</span>
        </div>
        <div class="trust-strip-divider" aria-hidden="true"></div>
        <div class="trust-strip-stat">
          <span class="trust-stat-num">{supportedPct}%</span>
          <span class="trust-stat-label">Supported claims</span>
        </div>
        {#if needsReview > 0}
          <div class="trust-strip-divider" aria-hidden="true"></div>
          <div class="trust-strip-stat trust-strip-stat--review">
            <span class="trust-stat-num trust-stat-num--review">{needsReview}</span>
            <span class="trust-stat-label">Need review</span>
          </div>
        {/if}
        {#if scorecard.last_verified_at}
          <div class="trust-strip-divider trust-strip-divider--hide-sm" aria-hidden="true"></div>
          <div class="trust-strip-stat trust-strip-stat--verified trust-strip-stat--hide-sm">
            <span class="trust-stat-label">Last verified</span>
            <span class="trust-stat-sub">{fmtDate(scorecard.last_verified_at)}</span>
          </div>
        {/if}
      </div>
      <div class="trust-strip-ctas">
        <a class="trust-cta" href={CONNECT_BASE + "#trust-ledger"}>View trust ledger</a>
        {#if needsReview > 0}
          <a class="trust-cta trust-cta--review" href={CONNECT_BASE + "/graph?filter=review"}>
            Review {needsReview} {needsReview === 1 ? "claim" : "claims"}
          </a>
        {/if}
      </div>
    </div>
  {:else}
    <!-- No graph yet — show an invitation into the Connect journey. -->
    <div class="trust-strip trust-strip--empty panel" aria-label="No verified context yet">
      <div class="trust-strip-inner">
        <p class="trust-empty-msg">
          No verified context yet.
          <a href={CONNECT_BASE + "/pipeline?step=store"}>Start your first ingest run</a>
          to build a graph your agents can trust.
        </p>
      </div>
    </div>
  {/if}
{:catch}
  <!-- Trust strip error — silent; the checklist below still works. -->
{/await}

<!-- ── Verified context journey ──────────────────────────────────────────── -->
<section class="overview-journey panel" aria-labelledby="connect-journey-h">
  <div class="overview-section-head">
    <h2 id="connect-journey-h" class="overview-section-title">Verified context journey</h2>
    <!-- K4: summary chip QUOTES the shared readiness ledger — links to the hub panel -->
    {#await data.connectReadiness then connectReadiness}
      {#if connectReadiness}
        <a
          class="connect-readiness-chip connect-readiness-chip--{connectReadiness.status}"
          href={CONNECT_BASE + "#readiness"}
          aria-label="{readinessChipLabel(connectReadiness)} — open the Connect readiness ledger"
        >
          {readinessChipLabel(connectReadiness)} →
        </a>
      {/if}
    {/await}
  </div>
  <p class="overview-section-desc">
    Connect a graph store, ingest your documents, review claims with the AI, then wire
    an agent. Each step is independently verifiable.
  </p>
  {#if allConnectDone}
    <div class="next-step-card next-step-card--done">
      <p class="next-step-kicker">Complete</p>
      <p class="next-step-title">Verified context is live</p>
      <p class="next-step-desc">
        Your graph is ingested, reviewed, and wired to an agent.
        <a href={CONNECT_BASE + "/graph"}>Explore the graph</a>
        or
        <a href={CONNECT_BASE + "/ingest"}>start a new run</a>.
      </p>
    </div>
  {:else if connectNextStep}
    <div class="next-step-card">
      <p class="next-step-kicker">Next — {connectDoneCount + 1} of {connectTotalCount}</p>
      <p class="next-step-title">{connectNextStep.label}</p>
      <a class="btn btn-primary" href={connectNextStep.href}>{connectNextStep.cta}</a>
    </div>
  {/if}
  <div class="setup-progress-wrap">
    <div class="setup-progress-label">{connectDoneCount} of {connectTotalCount} complete</div>
    <div
      class="setup-progress-track"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax={connectTotalCount}
      aria-valuenow={connectDoneCount}
      aria-label="Verified context journey progress"
    >
      <span class="setup-progress-fill" style={`width:${(connectDoneCount / connectTotalCount) * 100}%`}></span>
    </div>
  </div>
  <ul class="setup-list connect-list">
    {#each connectSteps as step}
      <li class="connect-step">
        <span class={step.done ? "step-done" : "step-open"} aria-hidden="true">
          {step.done ? "✓" : "○"}
        </span>
        <span class="connect-step-label">{step.label}</span>
        {#if !step.done && step.href}
          <a class="connect-step-cta" href={step.href}>{step.cta}</a>
        {/if}
      </li>
    {/each}
  </ul>
</section>

<!-- ── Routing (Keys) journey ────────────────────────────────────────────── -->
<section class="overview-primary panel" aria-labelledby="overview-primary-h">
  <h2 id="overview-primary-h" class="overview-section-title">Gateway routing setup</h2>
  <p class="overview-section-desc">
    Projects, connections, gateway keys, routes, and your first request.
  </p>
  {#if allSetupDone}
    <div class="next-step-card">
      <p class="next-step-kicker">Setup complete</p>
      <p class="next-step-title">You're all set</p>
      <p class="next-step-desc">Checklist complete. Open Logs when you want to dig into traffic.</p>
      <a class="btn btn-primary" href={DASHBOARD_BASE + "/logs"}>Open Logs</a>
    </div>
  {:else if nextStep}
    <div class="next-step-card">
      <p class="next-step-kicker">Next</p>
      <p class="next-step-title">{setupDoneCount + 1} of {setupTotalCount} — {nextStep.label}</p>
      {#if nextStep.href}
        <a class="btn btn-primary" href={nextStep.href}>{nextStep.cta}</a>
      {/if}
      {#if nextStep.id === "api-keys"}
        <p class="next-step-alt">
          Or: <code class="next-step-code">npx @restormel/keys-cli login</code>
          · <a href={DASHBOARD_BASE + "/cli/connect"}>Connect CLI</a>
        </p>
      {/if}
    </div>
  {/if}
  <div class="setup-progress-wrap">
    <div class="setup-progress-label">{setupDoneCount} of {setupTotalCount} complete</div>
    <div
      class="setup-progress-track"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax={setupTotalCount}
      aria-valuenow={setupDoneCount}
      aria-label="Gateway routing setup progress"
    >
      <span class="setup-progress-fill" style={`width:${(setupDoneCount / setupTotalCount) * 100}%`}></span>
    </div>
  </div>
  <button type="button" class="expand-btn" on:click={() => (setupExpanded = !setupExpanded)}>
    {setupExpanded ? "Hide full checklist" : "Show full checklist"}
  </button>
  {#if setupExpanded}
    <ul class="setup-list">
      {#each setupStepsForUi as step}
        <li>
          <span class={step.done ? "step-done" : "step-open"}>{step.done ? "✓" : "○"}</span>
          <span>{step.label}</span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<section class="suite-apps" aria-label="Suite apps">
  <p class="suite-apps-kicker">Also in Restormel</p>
  <div class="suite-apps-row">
    {#each suiteApps as mod}
      <a class="suite-app" href={mod.runHref} style="--chip-accent: var({mod.colorVar})">
        <span class="suite-app-verb">{mod.capability}</span>
        <span class="suite-app-name">{mod.product.replace("Restormel ", "")}</span>
      </a>
    {/each}
  </div>
</section>

{#if showMoreSetup}
<details class="overview-disclosure panel overview-more-setup">
  <summary class="overview-disclosure-summary">
    {#if showStackExport && showTestingCi}
      More setup — stack export &amp; Testing in CI
    {:else if showStackExport}
      More setup — stack export
    {:else}
      More setup — Testing in CI
    {/if}
  </summary>
  <div class="overview-disclosure-body overview-more-body" class:overview-more-body--split={showStackExport && showTestingCi}>
    {#if showStackExport}
      <div class="overview-more-block">
        <header class="overview-more-block-head">
          <h3 class="overview-more-block-title">Stack templates &amp; AAIF export</h3>
          <p class="overview-more-block-subtitle">
            Preset → checklist → copy <code class="overview-inline-code">integrationStack</code> for agents.
          </p>
        </header>
        <div class="overview-more-block-body">
          <StackSetupWizard workspaceId={data.workspaceId!} embedded />
        </div>
      </div>
    {/if}
    {#if showTestingCi}
    <div class="overview-more-block">
      <header class="overview-more-block-head">
        <h3 class="overview-more-block-title">Restormel Testing in CI</h3>
        <p class="overview-more-block-subtitle">Connections, gateway key, env — then validate in CI.</p>
      </header>
      <div class="overview-more-block-body">
        <div class="testing-ci-flow" aria-label="Suggested flow">
          <div class="testing-ci-flow-node">
            <span class="testing-ci-flow-glyph" aria-hidden="true">1</span>
            <span class="testing-ci-flow-text"><code class="testing-ci-code">testing-cli</code></span>
          </div>
          <span class="testing-ci-flow-join" aria-hidden="true"></span>
          <div class="testing-ci-flow-node">
            <span class="testing-ci-flow-glyph" aria-hidden="true">2</span>
            <span class="testing-ci-flow-text"><code class="testing-ci-code">doctor</code></span>
          </div>
          <span class="testing-ci-flow-join" aria-hidden="true"></span>
          <a class="testing-ci-flow-node testing-ci-flow-link" href="/keys/docs/guides/keys-testing-onboarding">
            <span class="testing-ci-flow-glyph" aria-hidden="true">3</span>
            <span class="testing-ci-flow-text">Guide</span>
          </a>
        </div>
        <ul class="testing-ci-list">
          {#each testingCiSteps as step}
            <li class="testing-ci-item">
              <span class="testing-ci-picto" aria-hidden="true"
                >{#if step.id === "t-conn"}🔗{:else if step.id === "t-gw"}🔑{:else}📋{/if}</span
              >
              <span class={step.done ? "step-done testing-ci-status" : "step-open testing-ci-status"}
                >{step.done ? "✓" : ""}</span
              >
              <span class="testing-ci-label">{step.label}</span>
              {#if step.href}
                <a class="testing-ci-cta" href={step.href}>{step.cta}</a>
              {/if}
            </li>
          {/each}
        </ul>
        <p class="testing-ci-foot">
          {testingCiDone} of {testingCiSteps.length} · <code class="testing-ci-code">RESTORMEL_KEYS_BASE</code>,
          <code class="testing-ci-code">RESTORMEL_GATEWAY_KEY</code>, <code class="testing-ci-code">RESTORMEL_PROJECT_ID</code>
        </p>
      </div>
    </div>
    {/if}
  </div>
</details>
{/if}

<section class="overview-main-grid" aria-label="Activity and shortcuts">
  <div class="overview-main-primary">
    <section class="panel overview-activity-panel">
      <h2 class="panel-title">Recent activity</h2>
      {#if isFree && (!data.livePulse || data.livePulse.requestCount24h === 0)}
        <p class="empty-msg">No requests yet. Make your first test request to see activity here.</p>
        <a class="btn btn-primary" href={DASHBOARD_BASE + "/sandbox"}>Try a test request →</a>
        <p class="secondary-link"><a href="/keys/pricing">Upgrade to Pro for deeper history →</a></p>
      {:else}
        <LivePulse pulse={data.livePulse} isFreeTier={isFree} />
      {/if}
    </section>
  </div>
  <div class="overview-main-aside">
    {#if data.contextSignals.noRouteCount24h > 0 || !data.contextSignals.hasAnyRoutePolicyBinding}
      <section class="panel overview-signals-panel">
        <h2 class="panel-title">Heads-up</h2>
        {#if data.contextSignals.noRouteCount24h > 0}
          <p class="signal signal-compact">
            <span class="signal-icon" aria-hidden="true">!</span>
            {data.contextSignals.noRouteCount24h} unmatched requests —
            <a href={DASHBOARD_BASE + "/logs"}>Logs</a>
          </p>
        {/if}
        {#if guardrailsOn && !data.contextSignals.hasAnyRoutePolicyBinding}
          <p class="signal signal-compact">
            <span class="signal-icon" aria-hidden="true">!</span>
            No guard rails —
            <a href={DASHBOARD_BASE + "/policies"}>Guard rails</a>
          </p>
        {/if}
      </section>
    {/if}
    <section class="panel overview-projects-panel">
      <h2 class="panel-title">Project</h2>
      {#if data.projects.length > 0}
        <div class="projects">
          {#if data.projects.length === 1}
            <p class="projects-single">
              <span class="projects-label">Project</span>
              <a href={DASHBOARD_BASE + "/projects/" + data.projects[0].id}>{data.projects[0].name}</a>
            </p>
          {:else}
            <h3 class="projects-heading">Projects</h3>
            <ul>
              {#each data.projects as project}
                <li><a href={DASHBOARD_BASE + "/projects/" + project.id}>{project.name}</a></li>
              {/each}
            </ul>
          {/if}
        </div>
      {:else}
        <p class="projects-empty muted">Create a project from the checklist above.</p>
      {/if}
    </section>
  </div>
</section>

<style>
  .page-title {
    font-family: var(--brut-font);
    font-size: var(--text-3xl);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: -0.02em;
    color: var(--brut-ink);
    margin: 0 0 var(--space-1);
  }
  .page-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0;
    max-width: 36rem;
    line-height: 1.5;
  }
  .suite-apps {
    margin-bottom: var(--space-5);
  }
  .suite-apps-kicker {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--rm-muted);
  }
  .suite-apps-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .suite-app {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-2) var(--space-3);
    border: var(--brut-border-micro) solid var(--brut-ink);
    border-left: 4px solid var(--chip-accent, var(--brut-blue));
    border-radius: 0;
    text-decoration: none;
    min-height: 44px;
    justify-content: center;
    background: color-mix(in srgb, var(--chip-accent, var(--brut-blue)) 16%, var(--brut-white));
    box-shadow: var(--brut-shadow-hover);
  }
  .suite-app:hover {
    transform: translate(2px, 2px);
    box-shadow: none;
  }
  .suite-app-verb {
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--rm-text);
  }
  .suite-app-name {
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  .overview-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3) var(--space-4);
    margin-bottom: var(--space-5);
    padding-bottom: var(--space-4);
    border-bottom: var(--brut-border-width) solid var(--brut-ink);
  }
  .overview-header-text {
    flex: 1 1 14rem;
    min-width: 0;
  }
  .overview-header-desc {
    margin-top: var(--space-1);
  }
  /* ── Trust strip ─────────────────────────────────────────────────────── */
  .trust-strip {
    margin-bottom: var(--space-5);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3) var(--space-4);
  }
  .trust-strip--loading {
    min-height: 3.5rem;
    background: var(--brut-white);
    border: var(--brut-border-width) solid var(--brut-ink);
    box-shadow: var(--brut-shadow);
  }
  .trust-strip--empty {
    background: var(--brut-white);
  }
  .trust-strip-inner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3) var(--space-4);
  }
  .trust-strip-score {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 3.5rem;
  }
  .trust-score-num {
    font-family: var(--brut-font);
    font-size: var(--text-3xl);
    font-weight: 900;
    line-height: 1;
    color: var(--brut-ink);
  }
  .trust-score-label {
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--rm-muted);
    margin-top: 2px;
  }
  .trust-strip-divider {
    width: 1px;
    height: 2.5rem;
    background: var(--rm-border);
    flex-shrink: 0;
  }
  .trust-strip-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .trust-stat-num {
    font-family: var(--brut-font);
    font-size: var(--text-xl);
    font-weight: 900;
    color: var(--brut-ink);
    line-height: 1;
  }
  .trust-stat-num--review {
    color: var(--coral-alert, #e05533);
  }
  .trust-stat-label {
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--rm-muted);
    margin-top: 2px;
  }
  .trust-stat-sub {
    font-size: var(--text-xs);
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    color: var(--rm-muted);
    margin-top: 2px;
  }
  @media (max-width: 640px) {
    .trust-strip-divider--hide-sm,
    .trust-strip-stat--hide-sm {
      display: none;
    }
  }
  .trust-strip-ctas {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }
  .trust-cta {
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--rm-border);
    background: var(--brut-white);
    color: var(--rm-sage);
    font-size: var(--text-xs);
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
    border-radius: 0;
    box-shadow: 2px 2px 0 var(--brut-ink);
    transition: transform 0.06s ease, box-shadow 0.06s ease;
  }
  .trust-cta:hover {
    transform: translate(2px, 2px);
    box-shadow: none;
  }
  .trust-cta--review {
    background: color-mix(in srgb, var(--coral-alert, #e05533) 10%, var(--brut-white));
    border-color: color-mix(in srgb, var(--coral-alert, #e05533) 45%, var(--rm-border));
    color: var(--coral-alert, #e05533);
  }
  .trust-strip-skel {
    display: block;
    height: 1.25rem;
    width: 5rem;
    background: color-mix(in srgb, var(--rm-border) 60%, transparent);
    animation: skel-pulse 1.4s ease-in-out infinite;
    border-radius: 0;
  }
  .trust-strip-skel--wide {
    width: 7rem;
  }
  @keyframes skel-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.45; }
  }
  .trust-empty-msg {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: 1.5;
  }
  .trust-empty-msg a {
    color: var(--rm-sage);
    font-weight: 500;
  }
  /* ── Shared section header ────────────────────────────────────────────── */
  .overview-section-title {
    margin: 0 0 var(--space-1);
    font-family: var(--brut-font);
    font-size: var(--text-base);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: var(--brut-ink);
  }
  .overview-section-desc {
    margin: 0 0 var(--space-3);
    font-size: var(--text-xs);
    color: var(--rm-muted);
    line-height: 1.55;
    max-width: 36rem;
  }
  /* ── Verified context journey section ───────────────────────────────── */
  .overview-journey {
    margin-bottom: var(--space-5);
  }
  .overview-section-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2) var(--space-3);
  }
  /* K4: Connect readiness summary chip — quotes the hub ledger, links to it */
  .connect-readiness-chip {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border: 1px solid var(--rm-border);
    padding: 2px var(--space-2);
    text-decoration: none;
    color: var(--brut-ink, var(--rm-text));
    white-space: nowrap;
  }
  .connect-readiness-chip:hover,
  .connect-readiness-chip:focus-visible {
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .connect-readiness-chip--ok {
    background: var(--state-ok-bg);
    color: var(--state-ok-fg);
    border-color: var(--state-ok-fg);
  }
  .connect-readiness-chip--warn {
    background: var(--state-warn-bg);
    color: var(--state-warn-fg);
    border-color: var(--state-warn-fg);
  }
  .connect-readiness-chip--fail {
    background: var(--state-fail-bg);
    color: var(--state-fail-fg);
    border-color: var(--state-fail-fg);
  }
  .connect-list {
    list-style: none;
    margin: var(--space-3) 0 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }
  .connect-step {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rm-border);
    background: var(--rm-surface);
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .connect-step-label {
    min-width: 0;
    line-height: 1.35;
    color: var(--rm-text);
  }
  .connect-step-cta {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--rm-sage);
    text-decoration: none;
    white-space: nowrap;
    padding: var(--space-1) var(--space-2);
    border: 1px solid color-mix(in oklab, var(--rm-sage) 35%, var(--rm-border));
    background: color-mix(in oklab, var(--rm-sage) 8%, var(--rm-surface));
    border-radius: 0;
    transition: background-color 0.12s ease, border-color 0.12s ease;
  }
  .connect-step-cta:hover {
    background: color-mix(in oklab, var(--rm-sage) 14%, var(--rm-surface));
    border-color: var(--rm-sage);
  }
  /* ── Routing setup section ───────────────────────────────────────────── */
  .overview-inline-code {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: 0.85em;
    font-weight: 500;
  }
  .overview-disclosure.panel {
    padding: 0;
  }
  .overview-disclosure-summary {
    padding: var(--space-3) var(--space-4);
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--rm-text);
    list-style: none;
  }
  .overview-disclosure-summary::-webkit-details-marker {
    display: none;
  }
  .overview-disclosure-body {
    padding: 0 var(--space-4) var(--space-4);
    border-top: 1px solid var(--rm-border);
  }
  .muted {
    color: var(--rm-dim);
    font-size: var(--text-xs);
    line-height: 1.45;
  }
  .overview-primary {
    max-width: min(40rem, 100%);
    margin-bottom: var(--space-5);
  }
  .overview-more-setup {
    margin-bottom: var(--space-5);
  }
  .overview-more-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  @media (min-width: 900px) {
    .overview-more-body--split {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-5) var(--space-6);
      align-items: start;
    }
  }
  .overview-more-block-head {
    margin-bottom: var(--space-5);
    padding-bottom: var(--space-4);
    border-bottom: 1px solid color-mix(in oklab, var(--rm-border) 85%, transparent);
  }
  .overview-more-block-title {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--rm-text);
    line-height: 1.35;
  }
  .overview-more-block-subtitle {
    margin: 0;
    max-width: 36rem;
    font-size: var(--text-xs);
    color: var(--rm-muted);
    line-height: 1.55;
  }
  .overview-more-block-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .overview-more-block + .overview-more-block {
    padding-top: var(--space-4);
    border-top: 1px solid var(--rm-border);
  }
  @media (min-width: 900px) {
    .overview-more-body--split .overview-more-block + .overview-more-block {
      padding-top: 0;
      border-top: none;
      padding-left: var(--space-5);
      border-left: 1px solid var(--rm-border);
    }
  }
  .overview-main-grid {
    display: grid;
    gap: var(--space-4);
    grid-template-columns: 1fr;
  }
  .overview-main-primary,
  .overview-main-aside {
    min-width: 0;
  }
  @media (min-width: 900px) {
    .overview-main-grid {
      grid-template-columns: minmax(0, 1.4fr) minmax(14rem, 1fr);
      align-items: start;
    }
  }
  .error-banner {
    border: var(--brut-border-width) solid var(--coral-alert, #e05533);
    background: color-mix(in srgb, var(--coral-alert, #e05533) 8%, var(--brut-white));
    padding: var(--space-3) var(--space-4);
    margin-bottom: var(--space-4);
    box-shadow: var(--brut-shadow);
  }
  .error-banner-msg {
    margin: 0;
    color: var(--coral-alert, #e05533);
    font-size: var(--text-sm);
  }
  .panel {
    border: var(--brut-border-width) solid var(--brut-ink);
    border-radius: 0;
    box-shadow: var(--brut-shadow);
    background: var(--brut-white);
    padding: var(--space-4);
  }
  .panel-title {
    margin: 0 0 var(--space-2);
    font-size: var(--text-base);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: var(--brut-ink);
  }
  .next-step-card {
    border: var(--brut-border-width) solid var(--brut-ink);
    border-radius: 0;
    box-shadow: var(--brut-shadow);
    background: var(--color-yellow);
    padding: var(--space-4);
    margin-bottom: var(--space-3);
  }
  .next-step-card--done {
    background: color-mix(in srgb, var(--signal-teal, #00b4a6) 12%, var(--brut-white));
  }
  .next-step-kicker {
    margin: 0;
    color: var(--rm-dim);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .next-step-title {
    margin: var(--space-1) 0 var(--space-3);
    color: var(--rm-text);
    font-size: var(--text-base);
    font-weight: 600;
    line-height: 1.35;
  }
  .next-step-desc {
    margin: 0 0 var(--space-2);
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .next-step-desc a {
    color: var(--rm-sage);
    font-weight: 500;
  }
  .btn {
    display: inline-block;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--rm-radius);
    text-decoration: none;
    font-size: var(--text-sm);
  }
  .btn-primary:hover:not(:disabled) {
    filter: brightness(1.08);
  }
  .btn-primary:active:not(:disabled) {
    transform: translateY(1px);
    filter: brightness(0.94);
  }
  .btn-primary:focus-visible {
    outline: 2px solid color-mix(in oklab, var(--rm-bg) 65%, var(--rm-sage));
    outline-offset: 2px;
  }
  .next-step-alt {
    margin: var(--space-2) 0 0;
    font-size: var(--text-xs);
    color: var(--rm-muted);
    line-height: 1.45;
  }
  .next-step-alt a {
    color: var(--rm-sage);
    font-weight: 500;
  }
  .next-step-code {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: 0.85em;
  }
  .signal-compact {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--rm-muted);
    line-height: 1.45;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-1);
  }
  .signal-compact a {
    color: var(--rm-sage);
    font-weight: 500;
  }
  .signal-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 2px;
    background: color-mix(in oklab, var(--amber-insight) 22%, var(--rm-surface));
    color: var(--rm-text);
    font-size: 0.65rem;
    font-weight: 700;
    flex-shrink: 0;
  }
  .setup-progress-label {
    color: var(--rm-muted);
    font-size: var(--text-xs);
    margin-bottom: var(--space-1);
  }
  .setup-progress-track {
    width: 100%;
    height: 0.45rem;
    border-radius: 0;
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
    overflow: hidden;
    margin-bottom: var(--space-2);
  }
  .setup-progress-fill {
    display: block;
    height: 100%;
    background: var(--rm-sage);
  }
  .expand-btn {
    border: 1px solid var(--rm-border);
    background: var(--rm-surface);
    color: var(--rm-muted);
    border-radius: var(--rm-radius);
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-xs);
    cursor: pointer;
    touch-action: manipulation;
    transition:
      background-color 0.12s ease,
      border-color 0.12s ease,
      color 0.12s ease,
      transform 0.06s ease;
  }
  .expand-btn:hover:not(:disabled) {
    background: var(--rm-surface-raised);
    border-color: color-mix(in oklab, var(--rm-text) 14%, var(--rm-border));
    color: var(--rm-text);
  }
  .expand-btn:active:not(:disabled) {
    transform: translateY(1px);
  }
  .expand-btn:focus-visible {
    outline: 2px solid var(--rm-sage);
    outline-offset: 2px;
  }
  .setup-list {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: 0;
    display: grid;
    gap: var(--space-1);
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .setup-list li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .step-done {
    color: var(--signal-teal);
  }
  .step-open {
    color: var(--rm-dim);
  }
  .secondary-link {
    margin: var(--space-2) 0 0;
    font-size: var(--text-sm);
  }
  .secondary-link a {
    color: var(--rm-muted);
  }
  .overview-shortcuts-panel,
  .overview-activity-panel {
    min-height: 0;
  }
  .testing-ci-code {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: 0.85em;
  }
  .testing-ci-flow {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: 0;
    border-radius: var(--rm-radius);
    border: 1px solid var(--rm-border);
    background: color-mix(in oklab, var(--rm-sage) 6%, var(--rm-surface));
    overflow: hidden;
  }
  .testing-ci-flow-node {
    flex: 1 1 5.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    padding: var(--space-3) var(--space-2);
    text-align: center;
    color: var(--rm-muted);
    font-size: var(--text-xs);
    min-height: 3.75rem;
  }
  .testing-ci-flow-link {
    text-decoration: none;
    color: var(--rm-sage);
    font-weight: 600;
    transition: background-color 0.12s ease;
  }
  .testing-ci-flow-link:hover {
    background: color-mix(in oklab, var(--rm-sage) 10%, transparent);
  }
  .testing-ci-flow-glyph {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 0;
    border: 1px solid var(--rm-border);
    background: var(--rm-surface-raised);
    color: var(--rm-text);
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .testing-ci-flow-link .testing-ci-flow-glyph {
    border-color: color-mix(in oklab, var(--rm-sage) 45%, var(--rm-border));
    color: var(--rm-sage);
  }
  .testing-ci-flow-text {
    line-height: 1.3;
  }
  .testing-ci-flow-join {
    width: 1px;
    flex: 0 0 auto;
    align-self: stretch;
    background: var(--rm-border);
  }
  .testing-ci-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
    font-size: var(--text-sm);
  }
  .testing-ci-item {
    display: grid;
    grid-template-columns: auto auto 1fr auto;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--rm-radius);
    border: 1px solid var(--rm-border);
    background: var(--rm-surface);
    color: var(--rm-muted);
  }
  .testing-ci-status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 0;
    border: 1px solid var(--rm-border);
    font-size: 0.65rem;
    font-weight: 700;
  }
  .testing-ci-status.step-done {
    border-color: color-mix(in oklab, var(--rm-sage) 55%, var(--rm-border));
    background: color-mix(in oklab, var(--rm-sage) 14%, var(--rm-surface));
    color: var(--rm-sage);
  }
  .testing-ci-status.step-open {
    border-style: dashed;
    color: transparent;
  }
  .testing-ci-label {
    min-width: 0;
    line-height: 1.35;
  }
  .testing-ci-cta {
    color: var(--rm-sage);
    font-size: var(--text-xs);
    font-weight: 600;
    white-space: nowrap;
    text-decoration: none;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--rm-radius);
    border: 1px solid color-mix(in oklab, var(--rm-sage) 35%, var(--rm-border));
    background: color-mix(in oklab, var(--rm-sage) 8%, var(--rm-surface));
    transition:
      background-color 0.12s ease,
      border-color 0.12s ease;
  }
  .testing-ci-cta:hover {
    background: color-mix(in oklab, var(--rm-sage) 14%, var(--rm-surface));
    border-color: var(--rm-sage);
  }
  .testing-ci-foot {
    margin: var(--space-1) 0 0;
    font-size: var(--text-xs);
    color: var(--rm-dim);
    line-height: 1.45;
  }
  .projects-heading {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--rm-dim);
  }
  .projects ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-1);
    font-size: var(--text-sm);
  }
  .projects a {
    color: var(--rm-sage);
    text-decoration: none;
    font-weight: 500;
  }
  .projects a:hover {
    text-decoration: underline;
  }
  .projects-single {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--text-sm);
  }
  .projects-label {
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--rm-dim);
  }
  .projects-single a {
    color: var(--rm-sage);
    font-weight: 500;
    text-decoration: none;
  }
  .projects-single a:hover {
    text-decoration: underline;
  }
  .projects-empty {
    margin: var(--space-2) 0 0;
  }
  .empty-msg {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
</style>
