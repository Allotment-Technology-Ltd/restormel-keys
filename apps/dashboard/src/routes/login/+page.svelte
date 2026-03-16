<script lang="ts">
  import { base } from "$app/paths";
  import { authClient } from "$lib/auth-client";
  import AppLogo from "$lib/components/AppLogo.svelte";

  let loading = false;
  let error = "";

  async function handleLogin() {
    loading = true;
    error = "";
    try {
      const absoluteCallback =
        typeof window !== "undefined" ? window.location.origin + base + "/" : base + "/";
      await authClient.signIn.social({
        provider: "github",
        callbackURL: absoluteCallback,
        newUserCallbackURL: absoluteCallback,
        errorCallbackURL: absoluteCallback,
      });
      // Neon Auth redirects to GitHub; after callback it redirects to callbackURL
    } catch (e) {
      error = e instanceof Error ? e.message : "Sign in failed";
      loading = false;
    }
  }
</script>

<div class="login-page">
  <div class="login-logo">
    <AppLogo href={base + "/"} height="36" />
  </div>
  <h1 class="login-title">Sign in</h1>
  <p class="login-desc">Use GitHub to sign in to the Keys dashboard.</p>
  {#if error}
    <p class="login-error" role="alert">{error}</p>
  {/if}
  <button class="btn btn-primary" onclick={handleLogin} disabled={loading}>
    {loading ? "Signing in…" : "Sign in with GitHub"}
  </button>
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
