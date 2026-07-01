<script lang="ts">
  /**
   * R5: Agents / Wiring tab.
   * MCP agent setup — moved from /agents (was /connect/mcp).
   * Connects Restormel to agent workflows via the Model Context Protocol.
   */
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import ConnectAgentSetup from "$lib/components/connect/ConnectAgentSetup.svelte";
  import ConnectionsManager from "$lib/components/connect/m4/ConnectionsManager.svelte";
  import ConnectPageSkeleton from "$lib/components/connect/ConnectPageSkeleton.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import SignInNotice from "$lib/components/connect/SignInNotice.svelte";
  import type { ConnectAgentSetupData } from "$lib/connect/agent-setup-types";

  export let data: { signedIn: boolean; agentSetup: Promise<ConnectAgentSetupData | null> };

  /**
   * RES-113 PR-E: the M4 Connect wizard + manager reskin is gated behind the
   * `onboardingJourney` module flag (default OFF). Flag OFF ⇒ the existing
   * ConnectAgentSetup renders unchanged (byte-for-byte). Flag ON ⇒ the new
   * presentational shell (additive — same key CRUD + MCP snippet under the hood).
   */
  $: onboardingJourney = $page.data.moduleFlags?.onboardingJourney ?? false;

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
  <title>Agents — Wiring – Restormel Dashboard</title>
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
    {:else if onboardingJourney}
      <ConnectionsManager setup={agentSetup} enforceScope={onboardingJourney} />
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
