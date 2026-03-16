<script lang="ts">
  import { base } from "$app/paths";
  import AppLogo from "$lib/components/AppLogo.svelte";

  // All GitHub sign-in is initiated on the server via /api/auth/initiate/github.
</script>

<div class="login-page">
  <div class="login-logo">
    <AppLogo href={base + "/"} height="36" />
  </div>
  <h1 class="login-title">Sign in</h1>
  <p class="login-desc">Use GitHub to sign in to the Keys dashboard.</p>
  <a href={base + "/api/auth/initiate/github"} class="btn btn-primary" rel="external">Sign in with GitHub</a>
  <a href={base + "/"} class="back-link">Back to overview</a>
</div>

<style>
  .login-page {
    max-width: 24rem;
    margin: 4rem auto;
    text-align: center;
  }
  .login-logo {
    display: block;
    margin-bottom: 2rem;
  }
  .login-title {
    font-family: var(--rm-font-display);
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 0.5rem;
  }
  .login-desc {
    color: var(--rm-muted);
    font-size: 0.875rem;
    margin: 0 0 1.5rem;
  }
  .login-error {
    color: #c95c5c;
    font-size: 0.875rem;
    margin: 0 0 1rem;
  }
  .btn {
    display: inline-block;
    padding: 0.5rem 1rem;
    border-radius: var(--rm-radius);
    font-size: 0.875rem;
    font-weight: 500;
    border: none;
    cursor: pointer;
  }
  .btn-primary {
    background: var(--rm-sage);
    color: var(--rm-bg);
  }
  .btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .back-link {
    display: block;
    margin-top: 1.5rem;
    font-size: 0.875rem;
    color: var(--rm-muted);
  }
</style>
