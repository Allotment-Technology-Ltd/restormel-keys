<script lang="ts">
  import "../app.css";
</script>

<svelte:head>
  <title>__MODULE_TITLE__</title>
</svelte:head>

<main class="shell">
  <slot />
</main>

<style>
  .shell {
    max-width: var(--rm-container-max, 72rem);
    margin: 0 auto;
    padding: 1.5rem;
  }
</style>
