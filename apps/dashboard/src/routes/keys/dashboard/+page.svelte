<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import EmptyState from "$lib/components/EmptyState.svelte";

  export let data: {
    projects: { id: string; name: string }[];
    projectsError?: string | null;
    onboarding: { hasProjects: boolean; hasKeys: boolean; hasIntegrations: boolean } | null;
  };

  const o = data.onboarding;
  const showOnboarding = o && (!o.hasProjects || !o.hasKeys || !o.hasIntegrations);
</script>

<h1 class="page-title">Overview</h1>
<p class="page-desc">Your projects and quick stats.</p>

{#if data.projectsError}
  <p class="error-msg" role="alert">{data.projectsError}. Check Vercel logs for database errors.</p>
{/if}

{#if showOnboarding}
  <section class="onboarding-section" aria-labelledby="onboarding-heading">
    <h2 id="onboarding-heading" class="onboarding-title">Get started</h2>
    <p class="onboarding-desc">Follow these steps in order: workspace and project, then Gateway Key and provider, then routes and your first request.</p>
    <ol class="onboarding-steps" aria-label="Onboarding steps">
      <li class="step" class:step-done={true}><span class="step-label">Workspace</span> — Created when you signed in.</li>
      <li class="step" class:step-done={o?.hasProjects}>
        {#if o?.hasProjects}
          <span class="step-label">Project</span> — Done.
        {:else}
          <a href={DASHBOARD_BASE + "/projects"} class="step-action">Create a project</a>
        {/if}
      </li>
      <li class="step step-info"><span class="step-label">Key model</span> — Gateway Key = app auth to Restormel. Provider credential = your OpenAI/Anthropic/etc. key; Restormel uses it to route. You can use one or both.</li>
      <li class="step step-info"><span class="step-label">Billing mode</span> — Set per route: bring your own keys or Restormel-managed. <a href={DASHBOARD_BASE + "/billing"} class="step-action">Billing</a></li>
      <li class="step" class:step-done={o?.hasKeys}>
        {#if o?.hasKeys}
          <span class="step-label">Gateway Key</span> — Done.
        {:else}
          <a href={DASHBOARD_BASE + "/access"} class="step-action">Create a Gateway Key</a> (Access)
        {/if}
      </li>
      <li class="step" class:step-done={o?.hasIntegrations}>
        {#if o?.hasIntegrations}
          <span class="step-label">Provider connection</span> — Done.
        {:else}
          <a href={DASHBOARD_BASE + "/integrations"} class="step-action">Connect a provider</a> (Integrations)
        {/if}
      </li>
      <li class="step">
        <a href={DASHBOARD_BASE + "/routes"} class="step-action">Create a route</a> — Choose models and fallbacks.
      </li>
      <li class="step">
        <a href="/keys/docs/" class="step-action" target="_blank" rel="noopener noreferrer">First request</a> — Then check <a href={DASHBOARD_BASE + "/logs"}>Logs</a>.
      </li>
      <li class="step">
        <a href={DASHBOARD_BASE + "/analytics"} class="step-action">Analytics</a> — Request count, latency, usage by provider and route.
      </li>
    </ol>
    {#if o && !o.hasProjects}
      <p class="onboarding-cta">
        <a href={DASHBOARD_BASE + "/projects"} class="btn btn-primary">Create your first project</a>
      </p>
    {/if}
  </section>
{/if}

{#if data.projects.length === 0}
  {#if !showOnboarding}
    <EmptyState
      title="No projects yet"
      description="Create a project to get Gateway keys and use the Cloud API."
    >
      <a href={DASHBOARD_BASE + "/projects"} class="btn btn-primary">Create a project</a>
    </EmptyState>
  {/if}
{:else}
  <ul class="project-list">
    {#each data.projects as p}
      <li>
        <a href={DASHBOARD_BASE + "/projects/" + p.id}>{p.name}</a>
      </li>
    {/each}
  </ul>
  <p><a href={DASHBOARD_BASE + "/projects"} class="btn-link">All projects →</a></p>
{/if}

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
  .empty {
    color: var(--rm-muted);
    margin: 0 0 var(--space-4);
  }
  .project-list {
    list-style: none;
    padding: 0;
    margin: 0 0 var(--space-4);
  }
  .project-list li {
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--rm-border);
  }
  .btn-link {
    font-size: var(--text-sm);
  }
  .onboarding-section {
    margin-bottom: var(--space-6);
    max-width: var(--rm-container-narrow, 36rem);
  }
  .onboarding-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .onboarding-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-4);
  }
  .onboarding-cta {
    margin: var(--space-4) 0 0;
  }
  .onboarding-cta .btn {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    font-weight: 500;
    text-decoration: none;
    display: inline-block;
    border: none;
    cursor: pointer;
    background: var(--rm-sage);
    color: var(--rm-bg);
  }
  .onboarding-steps {
    list-style: none;
    padding: 0;
    margin: 0;
    counter-reset: step;
  }
  .onboarding-steps .step {
    counter-increment: step;
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--rm-border);
    font-size: var(--text-sm);
    color: var(--rm-text);
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }
  .onboarding-steps .step::before {
    content: counter(step);
    font-weight: 600;
    color: var(--rm-muted);
    min-width: 1.25rem;
  }
  .onboarding-steps .step-done {
    color: var(--rm-muted);
  }
  .onboarding-steps .step-done .step-label {
    color: var(--rm-muted);
  }
  .onboarding-steps .step-info {
    color: var(--rm-muted);
  }
  .step-label {
    font-weight: 500;
  }
  .step-action {
    color: var(--rm-sage);
    font-weight: 500;
  }
  .step-action:hover {
    text-decoration: underline;
  }
</style>
