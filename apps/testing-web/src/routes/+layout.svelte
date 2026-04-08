<script lang="ts">
  import "../app.css";
  import SiteFooter from "$lib/components/site/SiteFooter.svelte";
  import SiteHeader from "$lib/components/site/SiteHeader.svelte";
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
