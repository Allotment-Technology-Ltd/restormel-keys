<script lang="ts">
  /**
   * W4.6a — auth-degraded state. Shown on a protected surface when Neon Auth
   * verification could NOT complete (infra blip), as opposed to a genuine
   * signed-out state. Honest copy + a retry, NEVER the "Sign in" CTA (the user
   * may well be signed in; we just couldn't confirm it this request).
   */
  import { invalidateAll } from "$app/navigation";

  /** Surface-specific context, e.g. "your graph". Optional. */
  export let surface: string | null = null;

  let retrying = false;
  async function retry() {
    if (retrying) return;
    retrying = true;
    try {
      await invalidateAll();
    } finally {
      retrying = false;
    }
  }
</script>

<div class="auth-degraded" role="alert">
  <p class="msg">
    We couldn't confirm your sign-in{surface ? ` for ${surface}` : ""} just now — this is usually a
    brief authentication hiccup, not a sign-out. Your session is likely still active.
  </p>
  <button class="btn btn-primary btn-sm" type="button" on:click={retry} disabled={retrying}>
    {retrying ? "Retrying…" : "Try again"}
  </button>
</div>

<style>
  .auth-degraded {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-4);
    border: var(--border);
    color: var(--color-ink-muted);
  }

  .msg {
    margin: 0;
  }
</style>
