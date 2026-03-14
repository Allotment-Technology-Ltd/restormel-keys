<script lang="ts">
  import { goto } from "$app/navigation";
</script>

<main class="rm-landing">
  <h1 class="rm-title">Restormel Keys</h1>
  <p class="rm-lead">SvelteKit demo — BYOK key management and model selection.</p>
  <nav class="rm-nav">
    <a href="/settings" class="rm-link">Settings</a>
    <a href="/demo" class="rm-link">Demo chat</a>
  </nav>
</main>

<style>
  .rm-landing {
    max-width: 36rem;
    margin: 0 auto;
    padding: 3rem 1.5rem;
    text-align: center;
  }
  .rm-title {
    margin: 0 0 0.5rem;
    font-size: 2rem;
    color: var(--rm-text);
  }
  .rm-lead {
    margin: 0 0 2rem;
    color: var(--rm-text-muted);
  }
  .rm-nav {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }
  .rm-link {
    display: inline-block;
    padding: 0.6rem 1.2rem;
    background: var(--rm-bg-elevated);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    color: var(--rm-accent);
    text-decoration: none;
    font-weight: 500;
  }
  .rm-link:hover {
    background: var(--rm-border);
    color: var(--rm-accent-hover);
  }
</style>
