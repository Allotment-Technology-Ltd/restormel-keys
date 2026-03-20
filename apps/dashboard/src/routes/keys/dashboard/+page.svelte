<script lang="ts">
  import FirstRunOnboarding from "$lib/components/dashboard/FirstRunOnboarding.svelte";
  import SetupChecklist from "$lib/components/dashboard/SetupChecklist.svelte";
  import LivePulse from "$lib/components/dashboard/LivePulse.svelte";
  import QuickActions from "$lib/components/dashboard/QuickActions.svelte";
  import { onMount } from "svelte";

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
  };

  const isFree = data.entitlements?.plan === "free";

  const LOGS_VISITED_KEY = "restormel_logs_visited";
  const SETUP_DISMISSED_KEY = "restormel_setup_dismissed";
  let hideSetupColumn = false;

  onMount(() => {
    const setupDismissed = localStorage.getItem(SETUP_DISMISSED_KEY) === "true";
    const logsVisited = localStorage.getItem(LOGS_VISITED_KEY) === "true";
    const setup = data.setup;
    if (!setup) {
      hideSetupColumn = true;
      return;
    }
    const allComplete =
      Boolean(setup.workspaceCreatedAt) &&
      setup.projectCount > 0 &&
      setup.integrationCount > 0 &&
      setup.gatewayKeyCount > 0 &&
      setup.routeCount > 0 &&
      setup.requestCount > 0 &&
      logsVisited;
    hideSetupColumn = allComplete && setupDismissed;
  });
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

<section class="overview-grid" class:overview-grid-collapsed={hideSetupColumn}>
  {#if !hideSetupColumn}
    <div class="overview-left">
      <SetupChecklist setup={data.setup} on:dismissed={() => (hideSetupColumn = true)} />
    </div>
  {/if}
  <div class="overview-center">
    <LivePulse pulse={data.livePulse} isFreeTier={isFree} />
  </div>
  <div class="overview-right">
    <QuickActions projects={data.projects} />
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
    .overview-grid.overview-grid-collapsed {
      grid-template-columns: minmax(26rem, 1fr) minmax(16rem, 20rem);
    }
    .overview-grid.overview-grid-collapsed .overview-center {
      grid-column: 1;
    }
    .overview-grid.overview-grid-collapsed .overview-right {
      grid-column: 2;
    }
  }
</style>
