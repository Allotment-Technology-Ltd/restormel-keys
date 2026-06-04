<script lang="ts">
  import SuiteMarketingLayout from "$lib/components/suite/SuiteMarketingLayout.svelte";
  import { page } from "$app/stores";

  $: graphModulePreview = $page.data.graphModulePreview === true;
  $: previewNotice = graphModulePreview
    ? "<strong>Preview</strong> — Graph marketing and docs are visible; dashboard Graph features may be limited until the module is fully enabled."
    : null;
</script>

<SuiteMarketingLayout {previewNotice}>
  <div class="marketing-page-pad module-landing marketing-sections">
    <slot />
  </div>
</SuiteMarketingLayout>
