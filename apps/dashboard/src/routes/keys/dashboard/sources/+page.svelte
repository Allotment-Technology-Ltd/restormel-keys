<script lang="ts">
  import ConnectPipelineSlotRows from "$lib/components/connect/pipeline/ConnectPipelineSlotRows.svelte";
  import SignInNotice from "$lib/components/connect/SignInNotice.svelte";
  import SourceHealthCards from "$lib/components/connect/sources/SourceHealthCards.svelte";
  import SourceExceptionsQueue from "$lib/components/connect/sources/SourceExceptionsQueue.svelte";
  import BrutalPageHeader from "$lib/components/brutalist/BrutalPageHeader.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import BrutalLoadingState from "$lib/components/brutalist/BrutalLoadingState.svelte";
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
  import { INGEST_FLOW_HREF, RUNS_HREF, GRAPHS_HREF } from "$lib/nav-config";
  import { pipelineWizardHref } from "$lib/connect/pipeline-config";
  import { formatSourceKind, pipelineStatusClass } from "$lib/connect/pipeline-utils";
  import type { ConnectGraphTarget } from "@restormel/contracts/connect";
  import type { SourceHealthSummary } from "$lib/connect/source-health-types";
  import type { SourcesDocumentRow } from "./+page.server";

  export let data: {
    signedIn: boolean;
    panels: Promise<{
      graphs: ConnectGraphTarget[];
      packs: { id: string; title: string; slug: string }[];
      documents: SourcesDocumentRow[];
      health: SourceHealthSummary;
      selectedPackId: string | null;
      loadFailed: boolean;
    }>;
  };

  // "Connect a source" is the front door. The full wizard stays reachable as the
  // first step of the guided flow; advanced control is collapsed (founder decision).
  const CONNECT_SOURCE_HREF = `${INGEST_FLOW_HREF}?step=sources`;

  // Advanced disclosure — collapsed by default. The full guided flow (extract / link /
  // embed / validate / remediate / store + chunk/embed knobs) lives behind this.
  let advancedOpen = false;

  // RES-113 PR-5 (flag-ON only; flag-OFF renders byte-for-byte unchanged): the
  // Domain step is off the Build spine — a built-in pack applies silently — so
  // pack/schema design is reached from HERE, under this existing Advanced
  // disclosure (plan §3.2 point 3). Reveal predicate: static Advanced disclosure,
  // licensed by the founder's "keep full control, collapsed" decision above.
  $: onboardingJourney = ($page.data.moduleFlags ?? MVP_MODULE_DEFAULTS).onboardingJourney;
  // RES-113 PR-2 (placement spec §5 item 3): plug-point slot rows render inside
  // THIS disclosure when the m1PlugPoints flag is ON and an active graph exists.
  // Reveal predicate: disclosure open — otherwise zero pixels (test-pinned).
  // Flag OFF (default): byte-identical, including the disclosure's content.
  $: m1PlugPoints = ($page.data.moduleFlags ?? MVP_MODULE_DEFAULTS).m1PlugPoints;
  const DOMAIN_PACK_DESIGN_HREF = pipelineWizardHref("domain");
</script>

<svelte:head>
  <title>Sources – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="sources-page">
  <BrutalPageHeader
    kicker="Sources"
    title="Your sources"
    description="Connect a source and Restormel ingests and verifies it in the background, ready for the Answer Console to query. You only step in when something needs a look."
  >
    {#snippet actions()}
      <a class="btn btn-primary" href={CONNECT_SOURCE_HREF}>Connect a source →</a>
    {/snippet}
  </BrutalPageHeader>

  {#if !data.signedIn}
    <SignInNotice message="Sign in to manage your sources." />
  {:else}
    {#await data.panels}
      <!-- Health loading skeleton -->
      <section class="sources-section" aria-labelledby="health-heading-loading">
        <div class="section-head">
          <h2 id="health-heading-loading" class="section-title">Health</h2>
        </div>
        <BrutalLoadingState message="Checking your sources…" rows={2} />
      </section>
    {:then panels}
      {@const parsedCount = panels.documents.filter((d) => d.status === "parsed").length}
      {@const selectedPack = panels.packs.find((p) => p.id === panels.selectedPackId) ?? null}
      {@const health = panels.health}

      {#if panels.loadFailed}
        <!-- R4-S3/X7: a load failure is distinct from a genuinely empty workspace. -->
        <BrutalErrorBanner
          title="Couldn't load your sources"
          message="We couldn't reach your sources just now. Your documents are unchanged — try again."
        >
          {#snippet actions()}
            <button type="button" class="btn btn-primary btn-sm" on:click={() => invalidateAll()}>
              Try again
            </button>
            <a class="btn btn-outline btn-sm" href={CONNECT_SOURCE_HREF}>Connect a source →</a>
          {/snippet}
        </BrutalErrorBanner>
      {:else if panels.documents.length === 0}
        <!-- Zero-source first run: the watched model framed as an invitation, not a wizard. -->
        <div class="first-run">
          <p class="first-run-title">Connect your first source</p>
          <p class="first-run-sub">
            A URL, an upload, or a connector — whatever your knowledge lives in. Restormel ingests and
            verifies it in the background, then the Answer Console can give you cited answers from it.
            Nothing to configure first.
          </p>
          <a class="btn btn-primary" href={CONNECT_SOURCE_HREF}>Connect a source →</a>
        </div>
      {:else}
        <!-- Watched-source health: docs indexed · failed · last-synced · status per kind. -->
        <section class="sources-section" aria-labelledby="health-heading">
          <div class="section-head">
            <h2 id="health-heading" class="section-title">Health</h2>
            <span class="section-meta">
              {health.totals.indexed} indexed · {health.totals.failed} failed
            </span>
          </div>
          <SourceHealthCards cards={health.cards} />
        </section>

        <!-- Exceptions queue: only what needs a human. -->
        <SourceExceptionsQueue
          exceptions={health.exceptions}
          total={health.totals.exceptions}
          onResolved={() => invalidateAll()}
        />

        <!-- Documents (the full, parsed inventory). -->
        <section class="sources-section" aria-labelledby="docs-heading">
          <div class="section-head">
            <h2 id="docs-heading" class="section-title">Documents</h2>
            <a class="section-link" href={CONNECT_SOURCE_HREF}>Manage sources →</a>
          </div>
          <p class="docs-summary">
            {panels.documents.length} document{panels.documents.length === 1 ? "" : "s"} ·
            {parsedCount} ready · <a class="inline-link" href={RUNS_HREF}>see runs →</a>
          </p>
          <ul class="doc-list">
            {#each panels.documents as doc (doc.id)}
              <li class="doc-row">
                <span class="doc-name">{doc.name}</span>
                <span class="doc-kind">{formatSourceKind(doc.source_kind, doc.name)}</span>
                <span class="doc-status {pipelineStatusClass(doc.status)}">{doc.status}</span>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      <!-- Advanced (collapsed by default): full guided flow + packs/graphs. Founder
           decision — keep full control, collapsed. The wizard is no longer the
           required front door, but every stage and knob stays one click away. -->
      <section class="sources-section advanced" aria-labelledby="advanced-heading">
        <button
          type="button"
          class="advanced-toggle"
          aria-expanded={advancedOpen}
          on:click={() => (advancedOpen = !advancedOpen)}
        >
          <span class="advanced-caret" aria-hidden="true">{advancedOpen ? "▾" : "▸"}</span>
          {#if onboardingJourney}
            <!-- Copy pack §2.3: the disclosure label on this page. -->
            <span id="advanced-heading" class="section-title">Advanced — full pipeline control</span>
            <span class="section-meta">Packs &amp; graphs · per-stage settings</span>
          {:else}
            <span id="advanced-heading" class="section-title">Advanced</span>
            <span class="section-meta">Full pipeline control · packs &amp; graphs · per-stage settings</span>
          {/if}
        </button>
        {#if advancedOpen}
          {@const activeGraph = m1PlugPoints ? (panels.graphs.find((g) => g.is_active) ?? null) : null}
          <div class="advanced-body">
            <p class="advanced-note">
              The guided flow gives you the full pipeline — extract, link, embed, validate,
              remediate, store — plus chunk and embedding knobs. Most sources never need it;
              it's here when you do.
            </p>
            {#if activeGraph}
              <!-- RES-113 PR-2: per-stage plug-point rows (one renderer, two hosts —
                   decision C). Reconciled with ConnectGraphLibrary below per §3.1:
                   the library owns graph STORES (packs & connections); these rows
                   own the per-stage model choice. No active graph ⇒ absent, never
                   disabled-and-teasing (ux-craft §2.4). -->
              <ConnectPipelineSlotRows graphTargetId={activeGraph.id} bundle={activeGraph.bundle} />
            {/if}
            {#if onboardingJourney}
              <!-- RES-113 PR-5: pack/schema design lives under Advanced — the Domain
                   step is off the Build spine (a built-in pack applies silently). -->
              <div class="advanced-actions">
                <a class="btn btn-outline btn-sm" href={INGEST_FLOW_HREF}>Open guided ingest flow</a>
                <a class="btn btn-outline btn-sm" href={DOMAIN_PACK_DESIGN_HREF}>Design a domain pack</a>
              </div>
            {:else}
              <a class="btn btn-outline btn-sm" href={INGEST_FLOW_HREF}>Open guided ingest flow →</a>
            {/if}

            <!-- Spec §6 Decision A — the graph library is no longer embedded here;
                 it lives at the standing graph home (GRAPHS_HREF). This Advanced
                 disclosure repoints there so no connect/switch/manage capability is
                 left stranded behind Advanced. (Flag-independent — deliberate, not
                 byte-identical; the sources plug-point snapshot is re-baselined.) -->
            <div class="advanced-packs">
              <div class="section-head">
                <h3 class="section-subtitle">Packs &amp; graphs</h3>
                {#if selectedPack}
                  <span class="section-meta">Flow pack: {selectedPack.title}</span>
                {/if}
              </div>
              <a class="btn btn-outline btn-sm" href={GRAPHS_HREF}>Manage graphs &amp; data store →</a>
            </div>
          </div>
        {/if}
      </section>
    {:catch}
      <section class="sources-section" aria-labelledby="docs-heading-err">
        <div class="section-head">
          <h2 id="docs-heading-err" class="section-title">Sources</h2>
        </div>
        <BrutalErrorBanner
          title="Couldn't load sources"
          message="We couldn't reach your sources just now. Your documents are unchanged — try again."
        >
          {#snippet actions()}
            <button type="button" class="btn btn-primary btn-sm" on:click={() => invalidateAll()}>
              Try again
            </button>
          {/snippet}
        </BrutalErrorBanner>
      </section>
    {/await}
  {/if}
</div>

<style>
  .sources-page {
    max-width: 64rem;
    padding: 0.5rem 0 2rem;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }
  .sources-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .section-title {
    font-family: var(--font-display);
    font-size: var(--text-display-sm, 1.25rem);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
    margin: 0;
    color: var(--color-ink);
  }
  .section-subtitle {
    font-family: var(--font-display);
    font-size: var(--text-display-sm, 1.1rem);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
    margin: 0;
    color: var(--color-ink);
  }
  .section-link,
  .section-meta {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
  }
  .section-link {
    text-decoration: none;
  }
  .section-link:hover {
    text-decoration: underline;
  }
  .inline-link {
    color: var(--color-ink-muted);
    text-decoration: underline;
  }
  .first-run {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    align-items: flex-start;
    padding: var(--space-5);
    border: var(--border);
    background: var(--color-surface);
    box-shadow: var(--shadow-md);
  }
  .first-run-title {
    font-family: var(--font-display);
    font-size: var(--text-display-md, 1.5rem);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
    margin: 0;
    color: var(--color-ink);
  }
  .first-run-sub {
    margin: 0;
    max-width: 38rem;
    color: var(--color-ink-muted);
  }
  .docs-summary {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
    margin: 0;
  }
  .doc-list {
    list-style: none;
    margin: 0;
    padding: 0;
    border: var(--border);
    background: var(--color-surface);
  }
  .doc-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-bottom: var(--border-thin);
  }
  .doc-row:last-child {
    border-bottom: none;
  }
  .doc-name {
    flex: 1 1 auto;
    font-weight: 700;
    color: var(--color-ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .doc-kind {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
  }
  .doc-status {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    text-transform: uppercase;
  }

  /* ── Advanced disclosure ── */
  .advanced {
    border-top: var(--border);
    padding-top: var(--space-4);
  }
  .advanced-toggle {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    flex-wrap: wrap;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    color: inherit;
  }
  .advanced-toggle:focus-visible {
    outline: 2px solid var(--color-yellow);
    outline-offset: 2px;
  }
  .advanced-caret {
    font-family: var(--font-mono);
    color: var(--color-ink);
  }
  .advanced-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    align-items: flex-start;
    margin-top: var(--space-3);
  }
  .advanced-note {
    margin: 0;
    max-width: 40rem;
    color: var(--color-ink-muted);
  }
  .advanced-packs {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-top: var(--space-2);
  }
  .advanced-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
