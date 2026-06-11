<script lang="ts">
  import { page } from "$app/stores";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";

  /** Surface-specific prompt, e.g. "Sign in to view your graph." */
  export let message: string = "Sign in to continue.";

  $: loginHref = DASHBOARD_BASE + "/login?return_to=" + encodeURIComponent($page.url.pathname + $page.url.search);
</script>

<div class="sign-in-notice" role="status">
  <p class="notice-msg">{message}</p>
  <a class="btn btn-primary btn-sm" href={loginHref}>Sign in</a>
</div>

<style>
  .sign-in-notice {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-4);
    border: var(--border);
    color: var(--color-ink-muted);
  }

  .notice-msg {
    margin: 0;
  }
</style>
