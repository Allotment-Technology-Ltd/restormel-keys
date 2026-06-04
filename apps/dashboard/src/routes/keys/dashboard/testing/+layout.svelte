<script lang="ts">
  import ProductHubLayout from "$lib/components/dashboard/ProductHubLayout.svelte";
  import { TESTING_HUB_TABS } from "$lib/dashboard-hub-nav";
</script>

<ProductHubLayout ariaLabel="Restormel Testing sections" tabs={TESTING_HUB_TABS}>
  <slot />
</ProductHubLayout>
