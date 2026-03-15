<script lang="ts">
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { signInWithGitHub, getIdToken } from "$lib/firebase-client";
  import AppLogo from "$lib/components/AppLogo.svelte";

  let loading = false;
  let error = "";

  async function handleLogin() {
    loading = true;
    error = "";
    try {
      await signInWithGitHub();
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No token");
      const res = await fetch(`${base}/api/auth/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Session failed");
      }
      await goto(base + "/", { replaceState: true });
    } catch (e) {
      error = e instanceof Error ? e.message : "Sign in failed";
    } finally {
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
