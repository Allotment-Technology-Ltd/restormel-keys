<script lang="ts">
  import ConnectPageSkeleton from "$lib/components/connect/ConnectPageSkeleton.svelte";
  import type { ChatRouteOption } from "$lib/connect/graph-comparison-types";

  export let data: {
    workspaceId: string | null;
    graphNodeCount: number;
    hasGraph: boolean;
    routes: ChatRouteOption[];
    suggestCacheKey: string;
    connectBase: string;
  };

  const panelImport = () => import("$lib/components/connect/graph-comparison/GraphComparisonPanel.svelte");
</script>

<svelte:head>
  <title>Proof — Restormel Connect</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if !data.workspaceId}
  <p class="brut-muted" role="status">Sign in to prove your knowledge graph.</p>
{:else}
  {#await panelImport()}
    <ConnectPageSkeleton variant="proof" />
  {:then { default: GraphComparisonPanel }}
    <GraphComparisonPanel
      graphNodeCount={data.graphNodeCount}
      hasGraph={data.hasGraph}
      routes={data.routes}
      suggestCacheKey={data.suggestCacheKey}
      connectBase={data.connectBase}
    />
  {:catch}
    <p class="brut-muted" role="alert">Could not load Proof. Refresh the page to try again.</p>
  {/await}
{/if}
