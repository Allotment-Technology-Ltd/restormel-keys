<script lang="ts">
  /**
   * Restormel lockup for dashboard sidebar. Uses RestormelLogo — same mark everywhere.
   */
  import { DASHBOARD_BASE } from '$lib/dashboard-base';
  import RestormelLogo from '$lib/components/RestormelLogo.svelte';

  export let href: string = DASHBOARD_BASE + '/';
  /** CSS height, e.g. 28px nav / 36px login */
  export let height = 28;
  export let className: string = '';
</script>

<a {href} class="app-logo {className}" aria-label="Restormel dashboard home">
  <RestormelLogo variant="lockup" {height} decorative />
</a>

<style>
  .app-logo {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
    padding: 0 var(--space-1);
    transform: translate(0, 0);
    transition: transform 100ms ease-in-out;
  }
  .app-logo:hover {
    transform: translate(1px, 1px);
  }
  .app-logo:focus-visible {
    outline: var(--focus-ring-width, 2px) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset, 2px);
    border-radius: 0;
  }
</style>
