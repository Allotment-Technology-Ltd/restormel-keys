<script lang="ts">
  import "$lib/styles/marketing-shell.css";
  import SiteHeader from "$lib/components/site/SiteHeader.svelte";
  import SiteFooter from "$lib/components/site/SiteFooter.svelte";
  import { page } from "$app/stores";

  $: user = $page.data.user;
</script>

<a href="#main-content" class="skip-link">Skip to main content</a>

<div class="marketing-page">
  <SiteHeader {user} />
  <main id="main-content" class="marketing-main" tabindex="-1">
    <slot />
  </main>
  <SiteFooter />
</div>

<style>
  .skip-link {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .skip-link:focus {
    position: fixed;
    top: var(--space-4);
    left: var(--space-4);
    z-index: var(--z-toast);
    width: auto;
    height: auto;
    margin: 0;
    padding: var(--space-3) var(--space-4);
    clip: auto;
    overflow: visible;
    white-space: normal;
    background: var(--rm-surface-raised);
    color: var(--rm-text);
    border: var(--border-1) solid var(--rm-border);
    border-radius: var(--rm-radius);
    box-shadow: var(--rm-card-shadow);
    text-decoration: none;
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
  }
  .marketing-main {
    outline: none;
    padding: var(--space-8) var(--space-6);
  }
  @media (max-width: 760px) {
    .marketing-main {
      padding: var(--space-6) var(--space-4);
    }
  }
</style>
