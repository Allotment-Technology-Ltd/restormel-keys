<script lang="ts">
  import { onDestroy, onMount } from "svelte";
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

  let open = false;
  let selected: ActiveProjectSelection | null = null;
  let rootEl: HTMLElement | null = null;

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
  $:
    selectedEnvironment =
      selectedProject?.environments.find((env) => env.id === selected?.environmentId) ?? null;
  $: selectionLabel =
    selectedProject && selectedEnvironment
      ? `${selectedProject.name} (${selectedEnvironment.type})`
      : "Select project context";

  function choose(projectId: string, environmentId: string) {
    setActiveProject({ projectId, environmentId });
    open = false;
  }
</script>

<div class="project-context" bind:this={rootEl}>
  <button
    type="button"
    class="switcher-trigger"
    aria-haspopup="menu"
    aria-expanded={open}
    on:click={() => (open = !open)}
  >
    <span>{selectionLabel}</span>
    <span aria-hidden="true">▾</span>
  </button>

  {#if open}
    <div class="switcher-menu" role="menu" aria-label="Project context">
      {#if projects.length === 0}
        <p class="switcher-empty">No projects yet</p>
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
                    class:menu-item-active={selected?.projectId === project.id && selected?.environmentId === env.id}
                    on:click={() => choose(project.id, env.id)}
                  >
                    {project.name} · {env.name}
                  </button>
                </li>
              {/each}
            </ul>
          </section>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .project-context {
    position: relative;
    padding: 0 var(--space-3) var(--space-2);
  }
  .switcher-trigger {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    border: 1px solid var(--rm-border);
    background: color-mix(in oklab, var(--rm-surface-raised) 60%, transparent);
    color: var(--rm-muted);
    border-radius: var(--rm-radius);
    padding: var(--space-2) var(--space-3);
    font-size: 0.68rem;
    cursor: pointer;
    text-align: left;
  }
  .switcher-menu {
    position: absolute;
    top: calc(100% + var(--space-1));
    left: var(--space-3);
    right: var(--space-3);
    max-height: 18rem;
    overflow: auto;
    border: 1px solid var(--rm-border);
    background: var(--rm-surface);
    border-radius: var(--rm-radius);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
    z-index: var(--z-dropdown, 40);
    padding: var(--space-2);
  }
  .project-group h3 {
    margin: var(--space-2) var(--space-1);
    font-size: 0.68rem;
    color: var(--rm-dim);
    font-weight: 600;
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
    font-size: 0.7rem;
    cursor: pointer;
  }
  .menu-item:hover {
    background: var(--rm-sage-bg);
    color: var(--rm-sage);
  }
  .menu-item-active {
    background: color-mix(in oklab, var(--rm-sage) 14%, transparent);
    color: var(--rm-sage);
    font-weight: 600;
  }
  .switcher-empty {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--rm-muted);
    padding: var(--space-2);
  }
</style>
