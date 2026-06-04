<script lang="ts">
  import SuiteMarketingLayout from "$lib/components/suite/SuiteMarketingLayout.svelte";
  import { page } from "$app/stores";

  $: fullBleed = $page.url.pathname === "/";
</script>

<SuiteMarketingLayout>
  {#if fullBleed}
    <slot />
  {:else}
    <div class="marketing-page-pad module-landing marketing-sections">
      <slot />
    </div>
  {/if}
</SuiteMarketingLayout>
