<script lang="ts">
  import ProductHubLayout from "$lib/components/dashboard/ProductHubLayout.svelte";
  import { ROUTES_HUB_TABS } from "$lib/dashboard-hub-nav";
</script>

<ProductHubLayout ariaLabel="Routes section tabs" tabs={ROUTES_HUB_TABS} prefetchTabs>
  <slot />
</ProductHubLayout>
