<script lang="ts">
  /**
   * R5: Prove / Proof tab — moved from /prove root (was /connect/proof).
   * The Answer Console: ask your sources, get a verified answer, ship the same query
   * into your app. The dashboard's home surface (Phase 3) for the solo builder.
   */
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
    isDemo: boolean;
    demoQuestions: { type: "answerable" | "abstention"; question: string }[];
    projectId: string | null;
    keyPrefixHint: string | null;
    connectApiBase: string;
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
  <title>Answer Console – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if !data.signedIn}
  <SignInNotice message="Sign in to ask your sources a question and get an answer you can trust." />
{:else if data.loadError}
  <BrutalErrorBanner
    title="Answer Console unavailable"
    message="Couldn't load the Answer Console just now. Your sources and data are untouched — this is only a load failure."
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
      workspaceId={data.workspaceId}
      isDemo={data.isDemo}
      demoQuestions={data.demoQuestions}
      projectId={data.projectId}
      keyPrefixHint={data.keyPrefixHint}
      connectApiBase={data.connectApiBase}
    />
  {:catch}
    <BrutalErrorBanner
      title="Answer Console unavailable"
      message="Couldn't load the Answer Console just now. Your sources and data are untouched — this is only a load failure."
    >
      {#snippet actions()}
        <button type="button" class="btn btn-primary btn-sm" disabled={retrying} on:click={retry}>
          {retrying ? "Retrying…" : "Try again"}
        </button>
      {/snippet}
    </BrutalErrorBanner>
  {/await}
{/if}
