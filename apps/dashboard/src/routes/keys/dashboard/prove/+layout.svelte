<script lang="ts">
  import ProductHubLayout from "$lib/components/dashboard/ProductHubLayout.svelte";
  import { PROVE_HUB_TABS } from "$lib/dashboard-hub-nav";
</script>

<ProductHubLayout ariaLabel="Prove section tabs" tabs={PROVE_HUB_TABS} prefetchTabs>
  <slot />
</ProductHubLayout>
