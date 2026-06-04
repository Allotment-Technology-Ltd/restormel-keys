<script lang="ts">
  import ConnectGraphExplorer from "$lib/components/connect/ConnectGraphExplorer.svelte";

  export let data: {
    graph: {
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
    } | null;
    revalidate: {
      enabled: boolean;
      routes: { id: string; name: string; isDefault: boolean }[];
      defaultRouteId: string | null;
    } | null;
  };
</script>

<svelte:head>
  <title>Knowledge graph – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if !data.graph}
  <p class="brut-muted" role="status">Sign in to view your graph.</p>
{:else}
  <ConnectGraphExplorer graph={data.graph} revalidate={data.revalidate} />
{/if}
