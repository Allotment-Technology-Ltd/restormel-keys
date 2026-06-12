<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import ConnectPageSkeleton from "$lib/components/connect/ConnectPageSkeleton.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import SignInNotice from "$lib/components/connect/SignInNotice.svelte";
  import type { ChatRouteOption } from "$lib/connect/graph-comparison-types";

  export let data: {
    signedIn: boolean;
    loadError: boolean;
    workspaceId: string | null;
    graphNodeCount: number;
    hasGraph: boolean;
    routes: ChatRouteOption[];
    suggestCacheKey: string;
    proveBase: string;
  };

  const panelImport = () => import("$lib/components/connect/graph-comparison/GraphComparisonPanel.svelte");

  let retrying = false;
  async function retry() {
    retrying = true;
    try {
      await invalidateAll();
    } finally {
      retrying = false;
    }
  }
</script>

<svelte:head>
  <title>Prove – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if !data.signedIn}
  <SignInNotice message="Sign in to prove your knowledge graph." />
{:else if data.loadError}
  <BrutalErrorBanner
    title="Proof unavailable"
    message="Could not load the Proof panel. Your data is unaffected — this is a load failure."
  >
    {#snippet actions()}
      <button type="button" class="btn btn-primary btn-sm" disabled={retrying} on:click={retry}>
        {retrying ? "Retrying…" : "Try again"}
      </button>
    {/snippet}
  </BrutalErrorBanner>
{:else}
  {#await panelImport()}
    <ConnectPageSkeleton variant="proof" />
  {:then { default: GraphComparisonPanel }}
    <GraphComparisonPanel
      graphNodeCount={data.graphNodeCount}
      hasGraph={data.hasGraph}
      routes={data.routes}
      suggestCacheKey={data.suggestCacheKey}
      proveBase={data.proveBase}
    />
  {:catch}
    <BrutalErrorBanner
      title="Proof unavailable"
      message="Could not load the Proof panel. Your data is unaffected — this is a load failure."
    >
      {#snippet actions()}
        <button type="button" class="btn btn-primary btn-sm" disabled={retrying} on:click={retry}>
          {retrying ? "Retrying…" : "Try again"}
        </button>
      {/snippet}
    </BrutalErrorBanner>
  {/await}
{/if}
