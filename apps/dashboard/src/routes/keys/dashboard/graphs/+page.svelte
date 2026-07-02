<script lang="ts">
  import ConnectGraphLibrary from "$lib/components/connect/ConnectGraphLibrary.svelte";
  import SignInNotice from "$lib/components/connect/SignInNotice.svelte";
  import BrutalPageHeader from "$lib/components/brutalist/BrutalPageHeader.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import BrutalLoadingState from "$lib/components/brutalist/BrutalLoadingState.svelte";
  import { invalidateAll } from "$app/navigation";
  import type { ConnectGraphTarget } from "@restormel/contracts/connect";

  // The standing graph home (spec §2/§6). Renders the full ConnectGraphLibrary —
  // connect / switch / edit / delete — as its own surface, out from under the
  // Sources "Advanced" disclosure. The library is mounted in EVERY signed-in state
  // (empty, loaded, loadFailed) so the graph capability cannot be lost.
  export let data: {
    signedIn: boolean;
    panels: Promise<{
      graphs: ConnectGraphTarget[];
      packs: { id: string; title: string; slug: string }[];
      loadFailed: boolean;
    }>;
  };
</script>

<svelte:head>
  <title>Your graphs – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="graphs-page">
  <BrutalPageHeader
    kicker="Graph & data store"
    title="Your graphs"
    description="Choose where your documents live, or connect a store you run yourself — your graph can move without losing your answers."
  />

  {#if !data.signedIn}
    <SignInNotice message="Sign in to connect or switch a graph." />
  {:else}
    {#await data.panels}
      <BrutalLoadingState message="Loading your graphs…" rows={2} />
    {:then panels}
      {#if panels.loadFailed}
        <BrutalErrorBanner
          title="Couldn't load your graphs"
          message="We couldn't reach your graph stores just now. Your graphs are unchanged — try again."
        >
          {#snippet actions()}
            <button type="button" class="btn btn-primary btn-sm" on:click={() => invalidateAll()}>
              Try again
            </button>
          {/snippet}
        </BrutalErrorBanner>
      {:else}
        <!-- Full connect / switch / edit / delete CRUD. Standing membership — never
             flag- or m1PlugPoints-gated. -->
        <ConnectGraphLibrary initialGraphs={panels.graphs} packs={panels.packs} />
      {/if}
    {:catch}
      <BrutalErrorBanner
        title="Couldn't load your graphs"
        message="We couldn't reach your graph stores just now. Your graphs are unchanged — try again."
      >
        {#snippet actions()}
          <button type="button" class="btn btn-primary btn-sm" on:click={() => invalidateAll()}>
            Try again
          </button>
        {/snippet}
      </BrutalErrorBanner>
    {/await}
  {/if}
</div>

<style>
  .graphs-page {
    max-width: 64rem;
    padding: 0.5rem 0 2rem;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }
</style>
