<script lang="ts">
  import ConnectGraphLibrary from "$lib/components/connect/ConnectGraphLibrary.svelte";
  import SignInNotice from "$lib/components/connect/SignInNotice.svelte";
  import type { ConnectGraphTarget } from "@restormel/contracts/connect";

  export let data: {
    graphs: ConnectGraphTarget[];
    packs: { id: string; title: string; slug: string }[];
    signedIn: boolean;
  };
</script>

<svelte:head>
  <title>Graph Library – Restormel Connect</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section class="library-page" aria-labelledby="library-heading">
  <p class="eyebrow">Connect · Graph Library</p>
  <h1 id="library-heading">Switch between your graphs</h1>

  {#if !data.signedIn}
    <SignInNotice message="Sign in to manage your Graph Library." />
  {:else}
    <ConnectGraphLibrary initialGraphs={data.graphs} packs={data.packs} />
  {/if}
</section>

<style>
  .library-page {
    max-width: 52rem;
    padding: 0.5rem 0 2rem;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .eyebrow {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-ink-muted);
    margin: 0;
  }
  h1 {
    font-family: var(--font-display);
    font-size: var(--text-display-hero);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
    line-height: var(--text-display-line-height);
    margin: 0 0 var(--space-2);
    color: var(--color-ink);
  }
</style>
