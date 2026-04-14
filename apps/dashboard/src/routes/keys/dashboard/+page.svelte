<script lang="ts">
  import FirstRunOnboarding from "$lib/components/dashboard/FirstRunOnboarding.svelte";
  import StackSetupWizard from "$lib/components/dashboard/StackSetupWizard.svelte";
  import LivePulse from "$lib/components/dashboard/LivePulse.svelte";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { isDashboardHrefUiHidden } from "$lib/dashboard-ui-path-match";

  /** Public `openOnboarding()` from `<FirstRunOnboarding bind:this={…} />`. */
  let firstRunRef: { openOnboarding: () => void } | undefined;

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
  };

  const isFree = data.entitlements?.plan === "free";

  const LOGS_VISITED_KEY = "restormel_logs_visited";
  let logsVisited = false;
  /** Full checklist behind one click — next step + progress stay visible. */
  let setupExpanded = false;

  onMount(() => {
    logsVisited = localStorage.getItem(LOGS_VISITED_KEY) === "true";
  });

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
  /** Steps whose target screen is not hidden by RESTORMEL_DASHBOARD_UI_HIDDEN */
  $: setupStepsForUi = setupSteps.filter((step) => !step.href || !isDashboardHrefUiHidden(step.href, setupUiHidden));
  $: setupDoneCount = setupStepsForUi.filter((step) => step.done).length;
  $: setupTotalCount = setupStepsForUi.length;
  $: nextStep = setupStepsForUi.find((step) => !step.done) ?? null;
  $: allSetupDone = setupTotalCount > 0 && setupDoneCount === setupTotalCount;

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
</script>

<svelte:head>
  <title>Overview – Restormel Keys</title>
</svelte:head>

<header class="overview-header">
  <div class="overview-header-text">
    <h1 class="page-title">Overview</h1>
    <p class="page-desc overview-header-desc">Setup progress, traffic, and shortcuts for this workspace.</p>
  </div>
  <div class="overview-header-aside">
    <button
      type="button"
      class="overview-assistant-chip"
      id="overview-assistant-h"
      title="Optional walkthrough; closing only hides it for this browser tab"
      on:click={() => firstRunRef?.openOnboarding()}
    >
      Setup assistant
    </button>
  </div>
</header>

<FirstRunOnboarding bind:this={firstRunRef} />
{#if data.workspaceId}
  <StackSetupWizard workspaceId={data.workspaceId} />
{/if}

{#if data.projectsError}
  <p class="error-msg" role="alert">{data.projectsError}. Check Vercel logs for database errors.</p>
{/if}

<section class="overview-primary panel" aria-labelledby="overview-primary-h">
  <h2 id="overview-primary-h" class="overview-primary-heading">Setup</h2>
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

<details class="overview-disclosure panel overview-more-setup">
  <summary class="overview-disclosure-summary">More setup — stack export &amp; Testing in CI</summary>
  <div class="overview-disclosure-body overview-more-body" class:overview-more-body--split={Boolean(data.workspaceId)}>
    {#if data.workspaceId}
      <div class="overview-more-block">
        <header class="overview-more-block-head">
          <h3 class="overview-more-block-title">Stack templates &amp; AAIF export</h3>
          <p class="overview-more-block-subtitle">
            Preset → checklist → copy <code class="overview-inline-code">integrationStack</code> for agents.
          </p>
        </header>
        <div class="overview-more-block-body">
          <StackSetupWizard workspaceId={data.workspaceId} embedded />
        </div>
      </div>
    {/if}
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
  </div>
</details>

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
    <section class="panel overview-shortcuts-panel">
      <h2 class="panel-title">Shortcuts</h2>
      <ul class="overview-shortcut-list">
        <li><a href={DASHBOARD_BASE + "/cli/connect"}>Connect CLI</a></li>
        <li><a href={DASHBOARD_BASE + "/access"}>Gateway keys</a></li>
        <li><a href={DASHBOARD_BASE + "/testing"}>Restormel Testing</a></li>
      </ul>
      {#if data.contextSignals.noRouteCount24h > 0 || !data.contextSignals.hasAnyRoutePolicyBinding}
        <div class="overview-signals" role="region" aria-label="Heads-up">
          {#if data.contextSignals.noRouteCount24h > 0}
            <p class="signal signal-compact">
              <span class="signal-icon" aria-hidden="true">!</span>
              {data.contextSignals.noRouteCount24h} unmatched requests —
              <a href={DASHBOARD_BASE + "/logs"}>Logs</a>
            </p>
          {/if}
          {#if !data.contextSignals.hasAnyRoutePolicyBinding}
            <p class="signal signal-compact">
              <span class="signal-icon" aria-hidden="true">!</span>
              No guard rails —
              <a href={DASHBOARD_BASE + "/policies"}>Guard Rails</a>
            </p>
          {/if}
        </div>
      {/if}
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
        <p class="projects-empty muted">No projects yet.</p>
      {/if}
    </section>
  </div>
</section>

<style>
  .page-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-1);
  }
  .page-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0;
    max-width: 36rem;
    line-height: 1.5;
  }
  .overview-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3) var(--space-4);
    margin-bottom: var(--space-5);
    padding-bottom: var(--space-4);
    border-bottom: 1px solid var(--rm-border);
  }
  .overview-header-text {
    flex: 1 1 14rem;
    min-width: 0;
  }
  .overview-header-desc {
    margin-top: var(--space-1);
  }
  .overview-header-aside {
    flex-shrink: 0;
    align-self: center;
  }
  .overview-assistant-chip {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    color: var(--rm-text);
    font-size: var(--text-xs);
    font-weight: 600;
    cursor: pointer;
    touch-action: manipulation;
    transition:
      background-color 0.12s ease,
      border-color 0.12s ease,
      color 0.12s ease;
  }
  .overview-assistant-chip:hover {
    background: var(--rm-surface-raised);
    border-color: color-mix(in oklab, var(--rm-sage) 35%, var(--rm-border));
    color: var(--rm-sage);
  }
  .overview-assistant-chip:focus-visible {
    outline: 2px solid var(--rm-sage);
    outline-offset: 2px;
  }
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
    margin-bottom: var(--space-4);
  }
  .overview-primary-heading {
    margin: 0 0 var(--space-3);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--rm-dim);
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
  .error-msg {
    color: var(--coral-alert);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-4);
  }
  .panel {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
    padding: var(--space-4);
  }
  .panel-title {
    margin: 0 0 var(--space-2);
    font-size: var(--text-base);
    color: var(--rm-text);
  }
  .panel h3.panel-title {
    font-size: var(--text-base);
  }
  .next-step-card {
    border: 1px solid color-mix(in oklab, var(--rm-sage) 22%, var(--rm-border));
    border-radius: var(--rm-radius);
    background: color-mix(in oklab, var(--rm-sage) 6%, var(--rm-surface));
    padding: var(--space-4);
    margin-bottom: var(--space-3);
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
  .btn {
    display: inline-block;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--rm-radius);
    text-decoration: none;
    font-size: var(--text-sm);
  }
  .btn-primary {
    background: var(--rm-sage);
    color: var(--rm-bg);
    border: none;
    cursor: pointer;
    touch-action: manipulation;
    transition: filter 0.12s ease, transform 0.06s ease;
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
  .overview-shortcut-list {
    list-style: none;
    margin: 0 0 var(--space-3);
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .overview-shortcut-list a {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--rm-sage);
    text-decoration: none;
  }
  .overview-shortcut-list a:hover {
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .overview-signals {
    margin-bottom: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid var(--rm-border);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
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
    border-radius: 999px;
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
  .overview-shortcuts-panel .projects {
    margin-top: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid var(--rm-border);
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
    border-radius: 999px;
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
  .testing-ci-picto {
    font-size: 1.1rem;
    line-height: 1;
    opacity: 0.92;
  }
  .testing-ci-status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 999px;
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
</style>
