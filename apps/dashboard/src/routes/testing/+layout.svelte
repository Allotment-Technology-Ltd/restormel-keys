<script lang="ts">
  import SuiteMarketingLayout from "$lib/components/suite/SuiteMarketingLayout.svelte";
  import { marketingShellPropsFromPage } from "$lib/marketing-shell-props";
  import { page } from "$app/stores";

  $: shell = marketingShellPropsFromPage($page);
</script>

<SuiteMarketingLayout {...shell}>
  <div class="marketing-page-pad module-landing marketing-sections">
    <slot />
  </div>
</SuiteMarketingLayout>
