<script lang="ts">
  /**
   * Restormel app header lockup for dashboard sidebar and auth.
   * Uses restormel-app-header-lockup.svg from static/.
   */
  import { base } from '$app/paths';

  export let href: string = base + '/';
  export let height: string = '28px';
  export let compact: boolean = false;
  export let className: string = '';
</script>

<a {href} class="app-logo {className}" aria-label="Restormel dashboard home">
  <img
    src="{base}/restormel-app-header-lockup.svg"
    alt="Restormel"
    width={compact ? 120 : 160}
    height={compact ? 18 : 24}
    style="height: {height}; width: auto;"
  />
</a>

<style>
  .app-logo {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
    padding: 0 0.25rem;
    transition: opacity 0.15s ease;
  }
  .app-logo:hover {
    opacity: 0.9;
  }
  .app-logo:focus-visible {
    outline: 2px solid var(--focus-ring-color, #4c8dff);
    outline-offset: 2px;
    border-radius: 4px;
  }
  img {
    display: block;
    object-fit: contain;
  }
</style>
