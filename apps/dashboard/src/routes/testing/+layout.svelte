<script lang="ts">
  import "./testing-shell.css";
  import SiteFooter from "$lib/testing/components/site/SiteFooter.svelte";
  import SiteHeader from "$lib/testing/components/site/SiteHeader.svelte";
</script>

<div class="marketing-page">
  <SiteHeader />
  <main id="main-content" class="marketing-main" tabindex="-1">
    <slot />
  </main>
  <SiteFooter />
</div>

<style>
  .marketing-main {
    outline: none;
  }
</style>
