<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import ConnectAgentSetup from "$lib/components/connect/ConnectAgentSetup.svelte";
  import ConnectPageSkeleton from "$lib/components/connect/ConnectPageSkeleton.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import SignInNotice from "$lib/components/connect/SignInNotice.svelte";
  import type { ConnectAgentSetupData } from "$lib/connect/agent-setup-types";

  export let data: { signedIn: boolean; agentSetup: Promise<ConnectAgentSetupData | null> };

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
  <title>Agents – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if !data.signedIn}
  <SignInNotice message="Sign in to configure MCP agent access." />
{:else}
  {#await data.agentSetup}
    <ConnectPageSkeleton variant="mcp" />
  {:then agentSetup}
    {#if !agentSetup}
      <BrutalErrorBanner
        title="Agent setup unavailable"
        message="Could not load the MCP agent setup. Your configuration is unaffected — this is a load failure."
      >
        {#snippet actions()}
          <button type="button" class="btn btn-primary btn-sm" disabled={retrying} on:click={retry}>
            {retrying ? "Retrying…" : "Try again"}
          </button>
        {/snippet}
      </BrutalErrorBanner>
    {:else}
      <ConnectAgentSetup setup={agentSetup} />
    {/if}
  {:catch}
    <BrutalErrorBanner
      title="Agent setup unavailable"
      message="Could not load the MCP agent setup. Your configuration is unaffected — this is a load failure."
    >
      {#snippet actions()}
        <button type="button" class="btn btn-primary btn-sm" disabled={retrying} on:click={retry}>
          {retrying ? "Retrying…" : "Try again"}
        </button>
      {/snippet}
    </BrutalErrorBanner>
  {/await}
{/if}
