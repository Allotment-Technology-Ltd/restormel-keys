<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import type { ModuleFlags } from "$lib/module-flags-types";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
  import {
    activeProject,
    setActiveProject,
    syncActiveProjectFromSession,
    type ActiveProjectSelection,
  } from "$lib/stores/active-project";

  type ProjectContextOption = {
    id: string;
    name: string;
    environments: { id: string; name: string; type: string }[];
  };

  export let projects: ProjectContextOption[] = [];
  export let moduleFlags: ModuleFlags | null = null;
  /** ID of the sidebar section label (`nav-section-label`). */
  export let labelledBy: string | undefined = undefined;

  let open = false;
  let selected: ActiveProjectSelection | null = null;
  let rootEl: HTMLElement | null = null;

  $: flags = moduleFlags ?? MVP_MODULE_DEFAULTS;
  $: environmentsEnabled = flags.environments;

  const unsubscribe = activeProject.subscribe((value) => {
    selected = value;
  });

  onMount(() => {
    syncActiveProjectFromSession();
    ensureValidSelection();
    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown, true);
    };
  });

  onDestroy(() => {
    unsubscribe();
  });

  function onDocPointerDown(e: PointerEvent) {
    if (!open) return;
    const target = e.target as Node | null;
    if (target && rootEl?.contains(target)) return;
    open = false;
  }

  function ensureValidSelection() {
    if (projects.length === 0) return;

    if (!environmentsEnabled) {
      const selectedExists = selected ? projects.some((p) => p.id === selected?.projectId) : false;
      if (!selectedExists) {
        setActiveProject({ projectId: projects[0].id });
      }
      return;
    }

    const allPairs = projects.flatMap((project) =>
      project.environments.map((env) => ({ projectId: project.id, environmentId: env.id }))
    );
    const selectedExists = selected
      ? allPairs.some(
          (pair) =>
            pair.projectId === selected?.projectId && pair.environmentId === selected?.environmentId
        )
      : false;
    if (!selectedExists && allPairs[0]) {
      setActiveProject(allPairs[0]);
    }
  }

  $: ensureValidSelection();

  $: selectedProject = projects.find((project) => project.id === selected?.projectId) ?? null;
  $: selectedEnvironment =
    selectedProject?.environments.find((env) => env.id === selected?.environmentId) ?? null;
  $: hasSelection = environmentsEnabled
    ? Boolean(selectedProject && selectedEnvironment)
    : Boolean(selectedProject);
</script>

<div class="project-context" bind:this={rootEl}>
  <button
    type="button"
    class="switcher-trigger"
    aria-haspopup="menu"
    aria-expanded={open}
    aria-labelledby={labelledBy}
    on:click={() => (open = !open)}
  >
    {#if hasSelection}
      <span class="switcher-text">
        <span class="switcher-project">{selectedProject?.name}</span>
        {#if environmentsEnabled && selectedEnvironment}
          <span class="switcher-env">{selectedEnvironment.name} · {selectedEnvironment.type}</span>
        {/if}
      </span>
    {:else}
      <span class="switcher-text">
        <span class="switcher-project">No project yet</span>
        <span class="switcher-env">Create one to scope routes &amp; keys</span>
      </span>
    {/if}
    <span class="switcher-chevron" aria-hidden="true">▾</span>
  </button>

  {#if open}
    <div class="switcher-menu" role="menu" aria-label={environmentsEnabled ? "Project and environment" : "Project"}>
      {#if projects.length === 0}
        <p class="switcher-empty">No projects yet.</p>
        <a class="switcher-manage" href={DASHBOARD_BASE + "/projects"}>Create a project</a>
      {:else if !environmentsEnabled}
        <ul class="project-only-list">
          {#each projects as project}
            <li>
              <button
                type="button"
                class="menu-item menu-item-project-only"
                role="menuitem"
                class:menu-item-active={selected?.projectId === project.id}
                on:click={() => {
                  setActiveProject({ projectId: project.id });
                  open = false;
                }}
              >
                <span class="menu-item-env">{project.name}</span>
              </button>
            </li>
          {/each}
        </ul>
        <a class="switcher-manage" href={DASHBOARD_BASE + "/projects"}>Manage projects</a>
      {:else}
        {#each projects as project}
          <section class="project-group">
            <h3>{project.name}</h3>
            <ul>
              {#each project.environments as env}
                <li>
                  <button
                    type="button"
                    class="menu-item"
                    role="menuitem"
                    class:menu-item-active={selected?.projectId === project.id && selected?.environmentId === env.id}
                    on:click={() => {
                      setActiveProject({ projectId: project.id, environmentId: env.id });
                      open = false;
                    }}
                  >
                    <span class="menu-item-env">{env.name}</span>
                    <span class="menu-item-type">{env.type}</span>
                  </button>
                </li>
              {/each}
            </ul>
          </section>
        {/each}
        <a class="switcher-manage" href={DASHBOARD_BASE + "/projects"}>Manage projects</a>
      {/if}
    </div>
  {/if}
</div>

<style>
  .project-context {
    position: relative;
    padding: 0 var(--space-3);
  }
  .switcher-trigger {
    width: 100%;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-2);
    border: var(--border-thin);
    background: color-mix(in oklab, var(--rm-surface-raised) 60%, transparent);
    color: var(--rm-text);
    border-radius: var(--rm-radius);
    padding: var(--space-2) var(--space-3);
    min-height: 44px;
    cursor: pointer;
    text-align: left;
  }
  .switcher-trigger:hover {
    border-color: var(--rm-sage);
    background: color-mix(in oklab, var(--rm-sage) 8%, transparent);
  }
  .switcher-text {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }
  .switcher-project {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--rm-text);
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .switcher-env {
    font-size: 0.68rem;
    color: var(--rm-muted);
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .switcher-chevron {
    flex-shrink: 0;
    color: var(--rm-dim);
    font-size: 0.75rem;
    margin-top: 0.15rem;
  }
  .switcher-menu {
    position: absolute;
    top: calc(100% + var(--space-1));
    left: var(--space-3);
    right: var(--space-3);
    max-height: 18rem;
    overflow: auto;
    border: var(--border-thin);
    background: var(--rm-surface);
    border-radius: var(--rm-radius);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
    z-index: var(--z-dropdown, 40);
    padding: var(--space-2);
  }
  .project-only-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.15rem;
  }
  .project-group h3 {
    margin: var(--space-2) var(--space-1) var(--space-1);
    font-size: 0.68rem;
    color: var(--rm-dim);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .project-group ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.15rem;
  }
  .menu-item {
    width: 100%;
    text-align: left;
    border: none;
    background: transparent;
    color: var(--rm-muted);
    border-radius: var(--rm-radius);
    padding: var(--space-2);
    min-height: 44px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
  .menu-item-project-only {
    flex-direction: row;
    align-items: center;
  }
  .menu-item-env {
    font-size: var(--text-sm);
    color: var(--rm-text);
  }
  .menu-item-type {
    font-size: 0.68rem;
    color: var(--rm-dim);
    text-transform: capitalize;
  }
  .menu-item:hover {
    background: var(--rm-sage-bg);
  }
  .menu-item:hover .menu-item-env {
    color: var(--rm-sage);
  }
  .menu-item-active {
    background: color-mix(in oklab, var(--rm-sage) 14%, transparent);
  }
  .menu-item-active .menu-item-env {
    color: var(--rm-sage);
    font-weight: 600;
  }
  .switcher-empty {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    color: var(--rm-muted);
    padding: var(--space-2);
  }
  .switcher-manage {
    display: block;
    margin-top: var(--space-2);
    padding: var(--space-2);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--rm-sage);
    text-align: center;
    border-top: var(--border-thin);
  }
  .switcher-manage:hover {
    text-decoration: underline;
  }
</style>
