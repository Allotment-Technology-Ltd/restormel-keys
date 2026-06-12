<script lang="ts">
  import { page } from "$app/stores";
  import { onDestroy } from "svelte";
  import { isDashboardHrefUiHidden } from "$lib/dashboard-ui-path-match";
  import { userMode } from "$lib/stores/user-mode";
  import type { UserMode } from "$lib/stores/user-mode";

  export let projects: { id: string; name: string }[] = [];

  const ACTIONS: Record<UserMode, { label: string; href: string }[]> = {
    new_project: [
      { label: "Create route", href: "/keys/dashboard/routes" },
      { label: "Add provider", href: "/keys/dashboard/integrations" },
      { label: "Open sandbox", href: "/keys/dashboard/sandbox" },
    ],
    existing_stack: [
      { label: "Add provider", href: "/keys/dashboard/integrations" },
      { label: "View logs", href: "/keys/dashboard/logs" },
      { label: "Open docs", href: "/keys/docs" },
    ],
    byok_saas: [
      { label: "Preview KeyManager", href: "/keys/dashboard/sandbox?tab=preview" },
      { label: "Create route", href: "/keys/dashboard/routes" },
      { label: "View policies", href: "/keys/dashboard/policies" },
    ],
    cli_agent: [
      { label: "Copy CI secrets", href: "/keys/dashboard/copy-for-ci" },
      { label: "Open dev tools", href: "/keys/dashboard/dev-tools" },
      { label: "View logs", href: "/keys/dashboard/logs" },
    ],
    ops: [
      { label: "View logs", href: "/keys/dashboard/logs" },
      { label: "Healthcheck", href: "/keys/dashboard/healthcheck" },
      { label: "Rotate key", href: "/keys/dashboard/access" },
    ],
  };

  let mode: UserMode | null = null;
  const unsubscribe = userMode.subscribe((value) => {
    mode = value;
  });

  $: uiHidden = $page.data.dashboardUiHidden ?? [];
  $: actions = (mode ? ACTIONS[mode] : ACTIONS.new_project).filter(
    (a) => !isDashboardHrefUiHidden(a.href, uiHidden)
  );

  onDestroy(() => {
    unsubscribe();
  });
</script>

<section class="quick-actions" aria-labelledby="quick-actions-heading">
  <h2 id="quick-actions-heading">Quick actions</h2>
  <div class="actions">
    {#each actions as action}
      <a href={action.href} class="action-btn">{action.label}</a>
    {/each}
  </div>

  <div class="projects">
    <h3>Projects</h3>
    {#if projects.length === 0}
      <p>No projects yet.</p>
    {:else}
      <ul>
        {#each projects as project}
          <li>
            {#if isDashboardHrefUiHidden("/keys/dashboard/projects/" + project.id, uiHidden)}
              <span>{project.name}</span>
            {:else}
              <a href={"/keys/dashboard/projects/" + project.id}>{project.name}</a>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>

<style>
  .quick-actions {
    border: var(--border-thin);
    background: var(--rm-surface-raised);
    border-radius: var(--rm-radius);
    padding: var(--space-4);
    display: grid;
    gap: var(--space-4);
  }
  .quick-actions h2 {
    margin: 0;
    font-size: var(--text-base);
    color: var(--rm-text);
  }
  .actions {
    display: grid;
    gap: var(--space-2);
  }
  .action-btn {
    border: var(--border-thin);
    background: var(--rm-surface);
    color: var(--rm-text);
    border-radius: var(--rm-radius);
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    text-decoration: none;
  }
  .action-btn:hover {
    color: var(--rm-sage);
    border-color: color-mix(in oklab, var(--rm-sage) 45%, var(--rm-border));
    text-decoration: none;
  }
  .projects h3 {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    color: var(--rm-text);
  }
  .projects p {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .projects ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-1);
  }
  .projects a {
    font-size: var(--text-sm);
    color: var(--rm-sage);
    text-decoration: none;
  }
  .projects a:hover {
    text-decoration: underline;
  }
  .projects li span {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
</style>
