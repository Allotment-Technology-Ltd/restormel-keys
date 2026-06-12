<script lang="ts">
  import { onDestroy } from "svelte";
  import { USER_MODE_OPTIONS, setUserMode, userMode, type UserMode } from "$lib/stores/user-mode";

  export let onSelect: ((mode: UserMode) => void) | undefined = undefined;
  export let onSkip: (() => void) | undefined = undefined;
  export let showSkip = false;

  let selectedMode: UserMode | null = null;

  const unsubscribe = userMode.subscribe((value) => {
    selectedMode = value;
  });

  onDestroy(() => {
    unsubscribe();
  });

  function selectMode(mode: UserMode) {
    setUserMode(mode);
    onSelect?.(mode);
  }
</script>

<section class="mode-selector" aria-labelledby="mode-selector-heading">
  <h2 id="mode-selector-heading" class="mode-selector-heading">What brings you here?</h2>
  <div class="mode-grid" role="list">
    {#each USER_MODE_OPTIONS as option}
      <button
        type="button"
        class="mode-tile"
        class:active={selectedMode === option.value}
        on:click={() => selectMode(option.value)}
        aria-pressed={selectedMode === option.value}
      >
        <span class="mode-icon" aria-hidden="true">{option.icon}</span>
        <span class="mode-label">{option.label}</span>
        <span class="mode-description">{option.description}</span>
      </button>
    {/each}
  </div>
  {#if showSkip}
    <button type="button" class="skip-link" on:click={() => onSkip?.()} aria-label="Skip onboarding">
      Skip for now
    </button>
  {/if}
</section>

<style>
  .mode-selector {
    display: grid;
    gap: var(--space-3);
  }

  .mode-selector-heading {
    margin: 0;
    font-size: var(--text-base);
    color: var(--rm-text);
  }

  .mode-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--space-2);
  }

  .mode-tile {
    display: grid;
    gap: var(--space-1);
    text-align: left;
    border: var(--border-thin);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
    color: var(--rm-text);
    padding: var(--space-3);
    cursor: pointer;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }

  .mode-tile:hover {
    border-color: color-mix(in oklab, var(--rm-sage) 55%, var(--rm-border));
    background: color-mix(in oklab, var(--rm-sage) 8%, var(--rm-surface-raised));
  }

  .mode-tile:focus-visible {
    outline: 2px solid var(--rm-sage);
    outline-offset: 2px;
  }

  .mode-tile.active {
    border-color: var(--rm-sage);
    background: color-mix(in oklab, var(--rm-sage) 14%, var(--rm-surface-raised));
  }

  .mode-icon {
    font-size: 1.25rem;
    line-height: 1;
  }

  .mode-label {
    font-size: var(--text-sm);
    font-weight: 600;
  }

  .mode-description {
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }

  .skip-link {
    justify-self: start;
    border: none;
    background: none;
    padding: 0;
    color: var(--rm-muted);
    font-size: var(--text-xs);
    text-decoration: underline;
    cursor: pointer;
  }

  .skip-link:hover {
    color: var(--rm-text);
  }
</style>
