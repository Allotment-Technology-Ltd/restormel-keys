<script lang="ts">
  import FirstRunOnboarding from "$lib/components/dashboard/FirstRunOnboarding.svelte";
  import LivePulse from "$lib/components/dashboard/LivePulse.svelte";
  import { onMount } from "svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";

  export let data: {
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
  let setupExpanded = false;

  onMount(() => {
    logsVisited = localStorage.getItem(LOGS_VISITED_KEY) === "true";
  });

  $: setupSteps = [
    { id: "workspace", label: "Workspace is ready", done: Boolean(data.setup?.workspaceCreatedAt), href: null, cta: "" },
    { id: "projects", label: "Create your first project", done: (data.setup?.projectCount ?? 0) > 0, href: DASHBOARD_BASE + "/projects", cta: "Open Projects" },
    { id: "connections", label: "Add your first connection", done: (data.setup?.integrationCount ?? 0) > 0, href: DASHBOARD_BASE + "/integrations", cta: "Open Connections" },
    { id: "api-keys", label: "Create an API key", done: (data.setup?.gatewayKeyCount ?? 0) > 0, href: DASHBOARD_BASE + "/access", cta: "Open API Keys" },
    { id: "rules", label: "Create a rule", done: (data.setup?.routeCount ?? 0) > 0, href: DASHBOARD_BASE + "/routes", cta: "Open Rules" },
    { id: "first-request", label: "Run your first request", done: (data.setup?.requestCount ?? 0) > 0, href: DASHBOARD_BASE + "/sandbox", cta: "Try a test request" },
    { id: "logs", label: "Review logs once", done: logsVisited, href: DASHBOARD_BASE + "/logs", cta: "Open Logs" },
  ];
  $: setupDoneCount = setupSteps.filter((step) => step.done).length;
  $: setupTotalCount = setupSteps.length;
  $: nextStep = setupSteps.find((step) => !step.done) ?? null;
  $: allSetupDone = setupDoneCount === setupTotalCount;
</script>

<svelte:head>
  <title>Overview – Restormel Keys</title>
</svelte:head>

<h1 class="page-title">Overview</h1>
<p class="page-desc">Command center for setup progress, live request pulse, and next actions.</p>
<FirstRunOnboarding />

{#if data.projectsError}
  <p class="error-msg" role="alert">{data.projectsError}. Check Vercel logs for database errors.</p>
{/if}

<section class="overview-grid">
  <div class="overview-left">
    <section class="panel">
      <h2 class="panel-title">What to do next</h2>
      {#if allSetupDone}
        <div class="next-step-card">
          <p class="next-step-kicker">You're all set</p>
          <p class="next-step-title">You're all set 🎉</p>
          <p class="next-step-desc">Everything in the setup flow is complete. You can monitor requests in Logs.</p>
          <a class="btn btn-primary" href={DASHBOARD_BASE + "/logs"}>Open Logs</a>
        </div>
      {:else if nextStep}
        <div class="next-step-card">
          <p class="next-step-kicker">Next step</p>
          <p class="next-step-title">{setupDoneCount + 1} of {setupTotalCount} · {nextStep.label}</p>
          <p class="next-step-desc">Complete this step to move setup forward.</p>
          {#if nextStep.href}
            <a class="btn btn-primary" href={nextStep.href}>{nextStep.cta}</a>
          {/if}
        </div>
      {/if}
      <div class="setup-progress-wrap">
        <div class="setup-progress-label">{setupDoneCount} of {setupTotalCount} complete</div>
        <div class="setup-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax={setupTotalCount} aria-valuenow={setupDoneCount}>
          <span class="setup-progress-fill" style={`width:${(setupDoneCount / setupTotalCount) * 100}%`}></span>
        </div>
      </div>
      <button type="button" class="expand-btn" on:click={() => (setupExpanded = !setupExpanded)}>
        {setupExpanded ? "Hide setup list" : "Show setup list"}
      </button>
      {#if setupExpanded}
        <ul class="setup-list">
          {#each setupSteps as step}
            <li>
              <span class={step.done ? "step-done" : "step-open"}>{step.done ? "✓" : "○"}</span>
              <span>{step.label}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </div>
  <div class="overview-center">
    <section class="panel">
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
  <div class="overview-right">
    <section class="panel">
      <h2 class="panel-title">Quick actions</h2>
      {#if data.contextSignals.noRouteCount24h > 0}
        <div class="signal signal-warn">
          ⚠ {data.contextSignals.noRouteCount24h} requests failed to match a rule — <a href={DASHBOARD_BASE + "/logs"}>fix routing</a>
        </div>
      {/if}
      {#if !data.contextSignals.hasAnyRoutePolicyBinding}
        <div class="signal signal-warn">
          No guard rails applied yet — <a href={DASHBOARD_BASE + "/policies"}>add limits to your rules</a>
        </div>
      {/if}
      <div class="projects">
        <h3>Projects</h3>
        {#if data.projects.length === 0}
          <p>No projects yet.</p>
        {:else}
          <ul>
            {#each data.projects as project}
              <li><a href={DASHBOARD_BASE + "/projects/" + project.id}>{project.name}</a></li>
            {/each}
          </ul>
        {/if}
      </div>
    </section>
  </div>
</section>

<style>
  .page-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .page-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-4);
  }
  .error-msg {
    color: var(--coral-alert);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-4);
  }
  .overview-grid {
    display: grid;
    gap: var(--space-4);
    grid-template-columns: 1fr;
  }
  .overview-left,
  .overview-center,
  .overview-right {
    min-width: 0;
  }
  @media (min-width: 1024px) {
    .overview-grid {
      grid-template-columns: minmax(16rem, 20rem) minmax(26rem, 1fr) minmax(16rem, 20rem);
      align-items: start;
    }
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
  .next-step-card {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    padding: var(--space-3);
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
    margin: var(--space-1) 0;
    color: var(--rm-text);
    font-size: var(--text-sm);
    font-weight: 600;
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
  .signal {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    padding: var(--space-2);
    margin-bottom: var(--space-2);
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .signal a {
    color: var(--rm-sage);
  }
  .projects h3 {
    margin: var(--space-3) 0 var(--space-2);
    font-size: var(--text-sm);
  }
  .projects p,
  .projects ul {
    margin: 0;
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .projects ul {
    list-style: none;
    padding: 0;
    display: grid;
    gap: var(--space-1);
  }
  .projects a {
    color: var(--rm-sage);
    text-decoration: none;
  }
</style>
