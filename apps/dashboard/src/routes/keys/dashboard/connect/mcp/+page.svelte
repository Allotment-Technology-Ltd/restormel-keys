<script lang="ts">
  import ConnectAgentSetup from "$lib/components/connect/ConnectAgentSetup.svelte";
  import ConnectPageSkeleton from "$lib/components/connect/ConnectPageSkeleton.svelte";
  import type { ConnectAgentSetupData } from "$lib/connect/agent-setup-types";

  export let data: { agentSetup: Promise<ConnectAgentSetupData | null> };
</script>

<svelte:head>
  <title>MCP setup – Restormel Connect</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#await data.agentSetup}
  <ConnectPageSkeleton variant="mcp" />
{:then agentSetup}
  {#if !agentSetup}
    <p class="notice" role="status">Sign in to configure MCP agent access.</p>
  {:else}
    <ConnectAgentSetup setup={agentSetup} />
  {/if}
{:catch}
  <p class="notice" role="alert">Could not load agent setup. Refresh to try again.</p>
{/await}

<style>
  .notice {
    padding: var(--space-4);
    border: var(--border);
    color: var(--rm-muted);
  }
</style>
