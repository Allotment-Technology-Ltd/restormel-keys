<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { onMount } from "svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";

  export let setup: {
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
  } | null = null;

  const LOGS_VISITED_KEY = "restormel_logs_visited";
  const SETUP_DISMISSED_KEY = "restormel_setup_dismissed";

  let logsVisited = false;
  let setupDismissed = false;
  const dispatch = createEventDispatcher<{ dismissed: void }>();

  onMount(() => {
    logsVisited = localStorage.getItem(LOGS_VISITED_KEY) === "true";
    setupDismissed = localStorage.getItem(SETUP_DISMISSED_KEY) === "true";
  });

  function formatDate(ts: number | null): string | null {
    if (!ts) return null;
    return new Date(ts).toLocaleDateString(undefined, { dateStyle: "medium" });
  }

  $: steps = [
    {
      id: "workspace",
      label: "Workspace created",
      complete: Boolean(setup?.workspaceCreatedAt),
      href: null,
      completedAt: formatDate(setup?.workspaceCreatedAt ?? null),
    },
    {
      id: "project",
      label: "Project created",
      complete: (setup?.projectCount ?? 0) > 0,
      href: DASHBOARD_BASE + "/projects",
      completedAt: formatDate(setup?.projectCreatedAt ?? null),
    },
    {
      id: "provider",
      label: "Provider connected",
      complete: (setup?.integrationCount ?? 0) > 0,
      href: DASHBOARD_BASE + "/integrations",
      completedAt: formatDate(setup?.providerConnectedAt ?? null),
    },
    {
      id: "gateway-key",
      label: "Gateway Key created",
      complete: (setup?.gatewayKeyCount ?? 0) > 0,
      href: DASHBOARD_BASE + "/access",
      completedAt: null,
    },
    {
      id: "route",
      label: "Route created",
      complete: (setup?.routeCount ?? 0) > 0,
      href: DASHBOARD_BASE + "/routes",
      completedAt: formatDate(setup?.routeCreatedAt ?? null),
    },
    {
      id: "first-request",
      label: "First request received",
      complete: (setup?.requestCount ?? 0) > 0,
      href: DASHBOARD_BASE + "/logs",
      completedAt: formatDate(setup?.firstRequestAt ?? null),
    },
    {
      id: "logs-reviewed",
      label: "Logs reviewed",
      complete: logsVisited,
      href: DASHBOARD_BASE + "/logs",
      completedAt: null,
    },
  ];

  $: allComplete = steps.every((step) => step.complete);
  $: currentStepId = steps.find((step) => !step.complete)?.id ?? null;

  function dismissCompletedBanner() {
    setupDismissed = true;
    localStorage.setItem(SETUP_DISMISSED_KEY, "true");
    dispatch("dismissed");
  }
</script>

{#if setup}
  {#if allComplete && setupDismissed}
    <!-- fully hidden by user preference -->
  {:else if allComplete}
    <section class="setup-complete-banner" aria-label="Setup complete">
      <span>Setup complete · {formatDate(setup.firstRequestAt ?? setup.routeCreatedAt ?? Date.now())}</span>
      <button type="button" on:click={dismissCompletedBanner} aria-label="Dismiss setup banner">Dismiss</button>
    </section>
  {:else}
    <section class="setup-checklist" aria-labelledby="setup-checklist-heading">
      <h2 id="setup-checklist-heading">Setup progress</h2>
      <ol>
        {#each steps as step}
          <li>
            <span
              class="step-indicator"
              class:complete={step.complete}
              class:current={step.id === currentStepId}
              aria-hidden="true"
            >
              {#if step.complete}
                ✓
              {:else}
                ○
              {/if}
            </span>
            <span class="step-content">
              {#if !step.complete && step.href}
                <a href={step.href}>{step.label}</a>
              {:else}
                <span>{step.label}</span>
              {/if}
              {#if step.complete && step.completedAt}
                <small>{step.completedAt}</small>
              {/if}
            </span>
          </li>
        {/each}
      </ol>
    </section>
  {/if}
{/if}

<style>
  .setup-checklist,
  .setup-complete-banner {
    border: 1px solid var(--rm-border);
    background: var(--rm-surface-raised);
    border-radius: var(--rm-radius);
    padding: var(--space-4);
  }
  .setup-checklist h2 {
    margin: 0 0 var(--space-3);
    font-size: var(--text-base);
    color: var(--rm-text);
  }
  .setup-checklist ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }
  .setup-checklist li {
    display: flex;
    gap: var(--space-2);
    align-items: flex-start;
  }
  .step-indicator {
    width: 1.25rem;
    display: inline-flex;
    justify-content: center;
    color: var(--rm-dim);
    font-size: var(--text-sm);
    line-height: 1.4;
    margin-top: 0.05rem;
  }
  .step-indicator.complete {
    color: #2e8f57;
  }
  .step-indicator.current {
    color: var(--rm-sage);
    animation: pulse 1.1s ease-in-out infinite;
  }
  .step-content {
    display: grid;
    gap: 0.1rem;
  }
  .step-content a {
    color: var(--rm-sage);
    text-decoration: none;
    font-size: var(--text-sm);
  }
  .step-content a:hover {
    text-decoration: underline;
  }
  .step-content span {
    font-size: var(--text-sm);
    color: var(--rm-text);
  }
  .step-content small {
    font-size: var(--text-xs);
    color: var(--rm-dim);
  }
  .setup-complete-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--text-sm);
    color: var(--rm-text);
  }
  .setup-complete-banner button {
    border: 1px solid var(--rm-border);
    background: transparent;
    color: var(--rm-muted);
    border-radius: var(--rm-radius);
    font-size: var(--text-xs);
    padding: var(--space-1) var(--space-2);
    cursor: pointer;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
  }
</style>
