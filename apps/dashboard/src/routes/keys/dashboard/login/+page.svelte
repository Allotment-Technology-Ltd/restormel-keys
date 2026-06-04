<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import AppLogo from "$lib/components/AppLogo.svelte";

  // All GitHub sign-in is initiated on the server via /api/auth/initiate/github.
</script>

<div class="login-page">
  <div class="login-panel">
    <div class="login-logo">
      <AppLogo href="/" height={36} />
    </div>
    <h1 class="login-title">Sign in</h1>
    <p class="login-desc">
      Dashboard access is invite-only during early access. If you haven’t received a link yet,
      <a href="/founders">request access</a> first.
    </p>
    <p class="login-desc login-desc-secondary">
      Already applied? Sign in with GitHub — if your cohort is not approved yet, you will land on a pending page.
    </p>
    <form action={DASHBOARD_BASE + "/api/auth/initiate/github"} method="get" class="login-form">
      <button type="submit" class="btn btn-primary login-btn">Sign in with GitHub</button>
    </form>
    <a href="/" class="back-link">← Back to Restormel</a>
  </div>
</div>

<style>
  .login-page {
    max-width: 26rem;
    margin: 4rem auto;
    padding: 0 var(--space-4);
  }
  .login-panel {
    text-align: center;
    background: var(--brut-white);
    border: var(--brut-border-width) solid var(--brut-ink);
    box-shadow: var(--brut-shadow);
    padding: var(--space-8) var(--space-6);
  }
  .login-logo {
    display: block;
    margin-bottom: var(--space-6);
  }
  .login-title {
    font-family: var(--brut-font);
    font-size: var(--text-2xl);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: -0.01em;
    color: var(--brut-ink);
    margin: 0 0 var(--space-2);
  }
  .login-desc {
    color: var(--brut-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-4);
    line-height: 1.5;
  }
  .login-desc a {
    color: var(--brut-blue);
    font-weight: 700;
  }
  .login-desc-secondary {
    margin-bottom: var(--space-6);
  }
  .login-form {
    margin: 0 0 var(--space-4);
  }
  .login-btn {
    width: 100%;
  }
  .back-link {
    display: block;
    margin-top: var(--space-4);
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--brut-ink);
  }
</style>
