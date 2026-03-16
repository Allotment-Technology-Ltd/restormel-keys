<script lang="ts">
  /**
   * Restormel lockup for dashboard sidebar. Same asset as site nav (restormel-lockup-nav.svg)
   * for one brand across site, docs, and dashboard. Height 28px matches marketing nav.
   */
  import { base } from '$app/paths';

  export let href: string = base + '/';
  export let height: string = '28px';
  export let compact: boolean = false;
  export let className: string = '';
</script>

<a {href} class="app-logo {className}" aria-label="Restormel dashboard home">
  <img
    src="{base}/restormel-lockup-nav.svg"
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
    padding: 0 var(--space-1);
    transition: opacity var(--duration-fast, 0.15s) var(--ease, ease);
  }
  .app-logo:hover {
    opacity: 0.9;
  }
  .app-logo:focus-visible {
    outline: var(--focus-ring-width, 2px) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset, 2px);
    border-radius: var(--rm-radius, var(--radius-base));
  }
  img {
    display: block;
    object-fit: contain;
  }
</style>
