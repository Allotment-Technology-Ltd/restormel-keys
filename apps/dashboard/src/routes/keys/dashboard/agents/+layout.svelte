<script lang="ts">
  import ProductHubLayout from "$lib/components/dashboard/ProductHubLayout.svelte";
  import { AGENTS_HUB_TABS } from "$lib/dashboard-hub-nav";
</script>

<ProductHubLayout ariaLabel="Agents section tabs" tabs={AGENTS_HUB_TABS} prefetchTabs>
  <slot />
</ProductHubLayout>
