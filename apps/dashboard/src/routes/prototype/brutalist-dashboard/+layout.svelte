<script lang="ts">
  import "$lib/styles/brutalist-tokens.css";
</script>

<svelte:head>
  <title>Brutalist dashboard prototype – Restormel</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="brutalist-root">
  <a href="#main-content" class="brutal-skip brut-focus">Skip to main content</a>
  <slot />
</div>

<style>
  :global(body) {
    margin: 0;
    background: #f0e6d2;
  }

  .brutal-skip {
    position: absolute;
    top: -100%;
    left: 1rem;
    padding: 0.5rem 0.75rem;
    background: #ffde4d;
    color: #000;
    font-weight: 800;
    text-decoration: none;
    border: 4px solid #000;
    z-index: 9999;
  }

  .brutal-skip:focus {
    top: 1rem;
  }
</style>
