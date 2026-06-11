<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { invalidateAll } from "$app/navigation";
  import ConnectPageSkeleton from "$lib/components/connect/ConnectPageSkeleton.svelte";
  import ConnectSetupLedger from "$lib/components/connect/ConnectSetupLedger.svelte";
  import ConnectGraphSwitcher from "$lib/components/connect/ConnectGraphSwitcher.svelte";
  import ConnectTrustScorecard from "$lib/components/connect/ConnectTrustScorecard.svelte";
  import ConnectQualityHistory from "$lib/components/connect/ConnectQualityHistory.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import SignInNotice from "$lib/components/connect/SignInNotice.svelte";
  import { isActiveIngestJobStatus } from "$lib/connect/connect-journey";
  import type { ConnectHubPayload, ConnectGraphPulse } from "$lib/server/connect/connect-hub-load";
  import type {
    ConnectTrustScorecard as ConnectTrustScorecardData,
    ConnectEvalVerdictEntry,
  } from "@restormel/contracts";
  import { page } from "$app/stores";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

  export let data: {
    signedIn: boolean;
    encryptionWarning: boolean;
    hub: Promise<ConnectHubPayload | null>;
    graphPulse: Promise<ConnectGraphPulse | null>;
    scorecard: Promise<ConnectTrustScorecardData | null>;
    qualityHistory: Promise<ConnectEvalVerdictEntry[]>;
  };
  const CONNECT_BASE = DASHBOARD_BASE + "/connect";
  $: neonGraphStoreOn = ($page.data.moduleFlags ?? MVP_MODULE_DEFAULTS).connectNeonGraphStore;

  let retryingHub = false;
  async function retryHub() {
    retryingHub = true;
    try {
      await invalidateAll();
    } finally {
      retryingHub = false;
    }
  }
</script>

<svelte:head>
  <title>Restormel Connect – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section class="hub" aria-labelledby="connect-hub-heading">
  <p class="hub-eyebrow">Connect · Your workspace home</p>
  <h1 id="connect-hub-heading">Build the brain your agents will query</h1>
  <p class="hub-lead">
    Everything in Restormel flows through Connect: add documents, configure Keys-backed AI routes, run ingest,
    and serve verified context to agents via REST or MCP — Testing and Graph plug in when you need them.
  </p>

  <ConnectGraphSwitcher />

{#if !data.signedIn}
  <SignInNotice message="Sign in to set up Restormel Connect." />
{:else}
  {#if data.encryptionWarning}
    <p class="warn-banner" role="alert">
      <strong>Dev setup needed:</strong> <code>RESTORMEL_CREDENTIALS_ENCRYPTION_KEY</code> is missing or invalid in
      <code>apps/dashboard/.env.local</code> — saving provider keys or Surreal graph store credentials is
      disabled until you set a valid 32-byte base64 key and restart the dev server.
      {#if neonGraphStoreOn}
        The one-click Neon store still works.
      {/if}
    </p>
  {/if}

  {#await data.hub}
    <ConnectPageSkeleton variant="hub" />
  {:then hub}
    {#if !hub?.journey}
      <!-- Backend returned null despite being signed in (schema-gate, store error, etc.) -->
      <BrutalErrorBanner
        title="Connect home unavailable"
        message="Could not load your Connect workspace. Your data is unaffected — this is a load failure."
      >
        {#snippet actions()}
          <button type="button" class="btn btn-primary btn-sm" disabled={retryingHub} on:click={retryHub}>
            {retryingHub ? "Retrying…" : "Try again"}
          </button>
          <a class="btn btn-outline btn-sm" href={CONNECT_BASE + "/pipeline?step=store"}>Check pipeline setup</a>
        {/snippet}
      </BrutalErrorBanner>
    {:else}
      {@const journey = hub.journey}
      {@const nextStep = journey.steps.find((s) => s.id === journey.nextStepId) ?? null}
      {@const requiredSteps = journey.steps.filter((s) => !s.optional)}
      {@const requiredDone = requiredSteps.filter((s) => s.status === "done").length}
      {@const requiredTotal = requiredSteps.length}
      {@const activeRun = Boolean(
        journey.latestJob && isActiveIngestJobStatus(journey.latestJob.status),
      )}
      {@const runStep = journey.steps.find((s) => s.id === "run")}

      {#if runStep?.status !== "done"}
        <ul class="hub-outcomes" aria-label="What you get when setup is complete">
          <li>
            <strong>A queryable graph</strong>
            <span>Ideas, relationships, groups, and embeddings — not just chunked PDFs.</span>
          </li>
          <li>
            <strong>Production APIs</strong>
            <span>Retrieve depth-controlled context; verify claims before answers reach users.</span>
          </li>
          <li>
            <strong>Agent hooks</strong>
            <span>MCP tools and REST endpoints agents can call without a bespoke RAG build-out.</span>
          </li>
        </ul>
      {/if}

      {#if hub.phase === "initial"}
        <p class="notice setup-hint" role="status">
          First-time setup — use the control panel below. Need a Surreal Cloud walkthrough?
          <a href="/keys/docs/guides/connect-first-graph-onboarding">Open the first-graph guide</a>.
        </p>
      {/if}

      {#if hub.setupHealth}
        <ConnectSetupLedger
          setupHealth={hub.setupHealth}
          phase={hub.phase}
          journeySteps={journey.steps}
          {nextStep}
          nextStepId={journey.nextStepId}
          operationalActions={hub.operationalActions}
          {requiredDone}
          {requiredTotal}
          stats={journey.stats}
          pulse={data.graphPulse}
          latestJob={journey.latestJob}
          {activeRun}
          graphHref="{CONNECT_BASE}/graph"
        />
      {/if}

      <ConnectTrustScorecard scorecard={data.scorecard} />

      <ConnectQualityHistory history={data.qualityHistory} />

      <p class="hub-links-row">
        <a href="/keys/docs/guides/connect-first-graph-onboarding">First graph guide</a>
        <span class="sep">·</span>
        <a href="/connect/docs">Connect docs</a>
        <span class="sep">·</span>
        <a href="/docs/operator-model">Suite map</a>
      </p>
    {/if}
  {:catch}
    <BrutalErrorBanner
      title="Connect home unavailable"
      message="Could not load your Connect workspace. Your data is unaffected — this is a load failure."
    >
      {#snippet actions()}
        <button type="button" class="btn btn-primary btn-sm" disabled={retryingHub} on:click={retryHub}>
          {retryingHub ? "Retrying…" : "Try again"}
        </button>
        <a class="btn btn-outline btn-sm" href={CONNECT_BASE + "/pipeline?step=store"}>Check pipeline setup</a>
      {/snippet}
    </BrutalErrorBanner>
  {/await}
{/if}
</section>

<style>
  .hub {
    max-width: 52rem;
    padding: 0.5rem 0 2rem;
  }
  /* Tier 2 — mono kicker */
  .hub-eyebrow {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-ink-muted);
    margin: 0 0 var(--space-3);
  }
  /* Tier 1 — page hero */
  .hub h1 {
    font-family: var(--font-display);
    font-size: var(--text-display-hero);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
    line-height: var(--text-display-line-height);
    margin: 0 0 var(--space-4);
    color: var(--color-ink);
  }
  /* Tier 3 — prose */
  .hub-lead {
    font-size: var(--text-body-md);
    line-height: var(--text-body-line-height);
    margin: 0 0 1.25rem;
    color: var(--rm-muted);
  }
  .hub-outcomes {
    list-style: none;
    margin: 0 0 1.5rem;
    padding: 0;
    display: grid;
    gap: var(--space-3);
  }
  @media (min-width: 640px) {
    .hub-outcomes {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  .hub-outcomes li {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    padding: var(--space-3) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .hub-outcomes strong {
    color: var(--rm-text);
    font-size: var(--text-sm);
  }
  .hub-outcomes span {
    color: var(--rm-muted);
    font-size: var(--text-xs);
    line-height: 1.45;
  }
  .notice,
  .warn-banner {
    border: 1px solid var(--rm-border);
    background: var(--rm-surface-raised);
    color: var(--rm-muted);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--rm-radius);
    margin: 0 0 var(--space-4);
  }
  .warn-banner {
    color: var(--amber-insight);
    border-color: color-mix(in oklab, var(--amber-insight) 40%, var(--rm-border));
  }
  .setup-hint {
    font-size: var(--text-sm);
  }
  .hub-links-row {
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .sep {
    margin: 0 var(--space-2);
    color: var(--rm-dim);
  }
</style>
