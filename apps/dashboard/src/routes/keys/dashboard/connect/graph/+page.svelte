<script lang="ts">
  import ConnectGraphPageSkeleton from "$lib/components/connect/ConnectGraphPageSkeleton.svelte";

  export let data: {
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
</script>

<svelte:head>
  <title>Knowledge graph – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#await data.graph}
  <ConnectGraphPageSkeleton />
{:then graph}
  {#if !graph}
    <p class="brut-muted" role="status">Sign in to view your graph.</p>
  {:else}
    {#await explorerImport()}
      <ConnectGraphPageSkeleton />
    {:then { default: ConnectGraphExplorer }}
      <ConnectGraphExplorer {graph} />
    {:catch}
      <p class="brut-muted" role="alert">Could not load the graph explorer. Refresh the page to try again.</p>
    {/await}
  {/if}
{:catch}
  <p class="brut-muted" role="alert">Could not load your graph. Refresh the page to try again.</p>
{/await}
