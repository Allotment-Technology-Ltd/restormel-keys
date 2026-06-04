<script lang="ts">
  import ProductHubLayout from "$lib/components/dashboard/ProductHubLayout.svelte";
  import { CONNECT_HUB_TABS } from "$lib/dashboard-hub-nav";
</script>

<ProductHubLayout ariaLabel="Restormel Connect sections" tabs={CONNECT_HUB_TABS}>
  <slot />
</ProductHubLayout>
