<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import ConnectGraphPageSkeleton from "$lib/components/connect/ConnectGraphPageSkeleton.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import SignInNotice from "$lib/components/connect/SignInNotice.svelte";

  export let data: {
    signedIn: boolean;
    graph: Promise<{
      store?: "postgres" | "surreal" | "none";
      storeLabel?: string;
      targetStatus?: "untested" | "error";
      domainPackId?: string | null;
      domainPackTitle?: string | null;
      reviewEnabled?: boolean;
      stats: {
        units: number;
        relations: number;
        groups: number;
        embedded: number;
        validation: { ok: number; weak: number; unsupported: number; unvalidated: number };
      } | null;
      groups: {
        id: string;
        name: string;
        summary: string | null;
        members: { text: string; role: string | null; validationStatus: string | null }[];
      }[];
      units: {
        id: string;
        text: string;
        unitType: string | null;
        domain: string | null;
        validationStatus: string | null;
        validationNote: string | null;
        sourceTitle: string | null;
        sourceUrl: string | null;
        sourceKind: string | null;
        author: string | null;
      }[];
      unitsPagination?: {
        offset: number;
        limit: number;
        loaded: number;
        total: number | null;
        hasMore: boolean;
      };
      sourceCatalogStatus?: {
        pipelineCatalogCount: number;
        sourcesInPipeline: boolean;
      };
    } | null>;
  };

  const explorerImport = () => import("$lib/components/connect/ConnectGraphExplorer.svelte");

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
  <title>Knowledge graph – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if !data.signedIn}
  <SignInNotice message="Sign in to view your graph." />
{:else}
  {#await data.graph}
    <ConnectGraphPageSkeleton />
  {:then graph}
    {#if !graph}
      <!-- graph view returned null — backend error on a signed-in load -->
      <BrutalErrorBanner
        title="Graph unavailable"
        message="Could not load your knowledge graph. Your data is unaffected — this is a load failure."
      >
        {#snippet actions()}
          <button type="button" class="btn btn-primary btn-sm" disabled={retrying} on:click={retry}>
            {retrying ? "Retrying…" : "Try again"}
          </button>
        {/snippet}
      </BrutalErrorBanner>
    {:else}
      {#await explorerImport()}
        <ConnectGraphPageSkeleton />
      {:then { default: ConnectGraphExplorer }}
        <ConnectGraphExplorer {graph} />
      {:catch}
        <BrutalErrorBanner
          title="Graph explorer unavailable"
          message="Could not load the graph explorer. Your data is unaffected — this is a load failure."
        >
          {#snippet actions()}
            <button type="button" class="btn btn-primary btn-sm" disabled={retrying} on:click={retry}>
              {retrying ? "Retrying…" : "Try again"}
            </button>
          {/snippet}
        </BrutalErrorBanner>
      {/await}
    {/if}
  {:catch}
    <BrutalErrorBanner
      title="Graph unavailable"
      message="Could not load your knowledge graph. Your data is unaffected — this is a load failure."
    >
      {#snippet actions()}
        <button type="button" class="btn btn-primary btn-sm" disabled={retrying} on:click={retry}>
          {retrying ? "Retrying…" : "Try again"}
        </button>
      {/snippet}
    </BrutalErrorBanner>
  {/await}
{/if}
