<script lang="ts">
  import ProductHubLayout from "$lib/components/dashboard/ProductHubLayout.svelte";
  import ConnectNavProgress from "$lib/components/connect/ConnectNavProgress.svelte";
  import { CONNECT_HUB_TABS } from "$lib/dashboard-hub-nav";
  import type { HubTab } from "$lib/dashboard-hub-nav";
  import { navigating, page } from "$app/stores";
  import { connectReviewCount } from "$lib/stores/connect-review-count";

  $: hideTabs = $page.url.pathname.includes("/connect/pipeline");

  function connectSkeletonVariant(pathname: string | undefined) {
    if (!pathname) return "default";
    if (pathname.endsWith("/connect") || pathname.endsWith("/connect/")) return "hub";
    if (pathname.includes("/connect/graph")) return "graph";
    if (pathname.includes("/connect/models")) return "models";
    if (pathname.includes("/connect/pipeline")) return "pipeline";
    if (pathname.includes("/connect/mcp")) return "mcp";
    if (pathname.includes("/connect/ingest")) return "ingest";
    if (pathname.includes("/connect/proof")) return "proof";
    return "default";
  }

  $: navTo = $navigating?.to?.url.pathname;
  $: isConnectNav = Boolean(navTo && navTo.includes("/connect"));
  $: skeletonVariant = connectSkeletonVariant(navTo);
  $: progressLabel = `Loading ${skeletonVariant === "default" ? "Connect" : skeletonVariant} screen`;

  /** Tabs with the live review-count badge stitched into the Graph entry. */
  $: badgedTabs = CONNECT_HUB_TABS.map((tab): HubTab => {
    if (tab.href.endsWith("/graph") && $connectReviewCount && $connectReviewCount > 0) {
      return { ...tab, badge: $connectReviewCount };
    }
    return tab;
  });
</script>

<ConnectNavProgress active={isConnectNav} label={progressLabel} />

<ProductHubLayout
  ariaLabel="Restormel Connect sections"
  tabs={badgedTabs}
  {hideTabs}
  prefetchTabs
  ariaBusy={isConnectNav}
>
  <div class="connect-slot" class:connect-slot-pending={isConnectNav}>
    <slot />
  </div>
</ProductHubLayout>

<style>
  .connect-slot-pending {
    opacity: 0.72;
    pointer-events: none;
    transition: opacity 0.15s ease;
  }
</style>
