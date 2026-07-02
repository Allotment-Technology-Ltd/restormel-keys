<script lang="ts">
  import "$lib/components/connect/pipeline/connect-pipeline.css";
  import { HOME_HREF } from "$lib/nav-config";
  import { page } from "$app/stores";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

  // R4-S2(c): the "your graph store is set up automatically" promise is only true
  // when host-managed Postgres auto-provisioning is ON. With the flag OFF (MVP default)
  // the store is BYO — claiming it's automatic would be false. Gate the copy.
  $: hostManagedGraphStoreOn = ($page.data.moduleFlags ?? MVP_MODULE_DEFAULTS).connectHostManagedGraphStore;
  // RES-113 PR-5 (flag-ON only): the journey Build renders ONE state-derived panel
  // with its own copy-pack headline — the wizard-vocabulary lede ("Provider key,
  // sources, domain, and review & launch") would contradict it. Flag-OFF renders
  // the existing shell byte-for-byte unchanged.
  $: onboardingJourney = ($page.data.moduleFlags ?? MVP_MODULE_DEFAULTS).onboardingJourney;
</script>

<svelte:head>
  <title>{onboardingJourney ? "Build" : "Ingest"} – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="connect-pipeline">
  <section aria-labelledby="pipeline-heading">
    {#if onboardingJourney}
      <p class="pipeline-exit">
        <a href={HOME_HREF}>← Home</a>
      </p>
      <h1 id="pipeline-heading" class="h1">Build</h1>
      <slot />
    {:else}
      <p class="pipeline-exit">
        <a href={HOME_HREF}>← Home</a>
        <span class="pipeline-exit-note">Setup wizard — side tasks open in place with a return link.</span>
      </p>
      <h1 id="pipeline-heading" class="h1">Ingest your sources</h1>
      <p class="lede">Provider key, sources, domain, and review &amp; launch{#if hostManagedGraphStoreOn} — your graph store is set up automatically{:else} — connect a graph store on the review step{/if}. Wire agents from the Agents section afterwards.</p>
      <slot />
    {/if}
  </section>
</div>

<style>
  .pipeline-exit {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
  }
  .pipeline-exit a {
    font-weight: 700;
    color: var(--rm-text);
  }
  .pipeline-exit-note {
    color: var(--rm-muted);
    font-size: var(--text-xs);
  }
</style>
