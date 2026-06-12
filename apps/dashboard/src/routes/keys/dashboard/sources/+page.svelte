<script lang="ts">
  import ConnectGraphLibrary from "$lib/components/connect/ConnectGraphLibrary.svelte";
  import SignInNotice from "$lib/components/connect/SignInNotice.svelte";
  import BrutalPageHeader from "$lib/components/brutalist/BrutalPageHeader.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import BrutalLoadingState from "$lib/components/brutalist/BrutalLoadingState.svelte";
  import { invalidateAll } from "$app/navigation";
  import { INGEST_FLOW_HREF } from "$lib/nav-config";
  import { formatSourceKind, pipelineStatusClass } from "$lib/connect/pipeline-utils";
  import type { ConnectGraphTarget } from "@restormel/contracts/connect";
  import type { SourcesDocumentRow } from "./+page.server";

  export let data: {
    signedIn: boolean;
    panels: Promise<{
      graphs: ConnectGraphTarget[];
      packs: { id: string; title: string; slug: string }[];
      documents: SourcesDocumentRow[];
      selectedPackId: string | null;
      loadFailed: boolean;
    }>;
  };
</script>

<svelte:head>
  <title>Sources – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="sources-page">
  <BrutalPageHeader
    kicker="Sources"
    title="What goes in"
    description="Documents, domain packs, and what changed since your last run — then launch the guided ingest flow."
  >
    {#snippet actions()}
      <a class="btn btn-primary" href={INGEST_FLOW_HREF}>Ingest →</a>
    {/snippet}
  </BrutalPageHeader>

  {#if !data.signedIn}
    <SignInNotice message="Sign in to manage your sources." />
  {:else}
    <!-- Changed-source state (W3.6). The server cannot yet answer "what changed
         since the last run", so this is an honest absent-state — never a
         fabricated count. -->
    <section class="sources-section" aria-labelledby="changed-heading">
      <h2 id="changed-heading" class="section-title">Changed since last run</h2>
      <div class="changed-absent" role="status">
        <p class="changed-absent-title">Change tracking not available yet</p>
        <p class="changed-absent-sub">
          We don't track which sources changed between runs yet, so there's nothing to re-ingest
          selectively. Run ingest to process your current document selection.
        </p>
        <a class="btn btn-outline btn-sm" href={INGEST_FLOW_HREF}>Start an ingest run →</a>
      </div>
    </section>

    <!-- Streamed panels: documents + packs + graphs resolve after the shell paints.
         Shell (header, changed-source section, section headings) renders immediately;
         BrutalLoadingState skeletons fill the panels while the DB queries are in flight. -->
    {#await data.panels}
      <!-- Documents loading skeleton -->
      <section class="sources-section" aria-labelledby="docs-heading-loading">
        <div class="section-head">
          <h2 id="docs-heading-loading" class="section-title">Documents</h2>
        </div>
        <BrutalLoadingState message="Loading documents…" rows={3} />
      </section>

      <!-- Packs loading skeleton -->
      <section class="sources-section" aria-labelledby="packs-heading-loading">
        <div class="section-head">
          <h2 id="packs-heading-loading" class="section-title">Packs &amp; graphs</h2>
        </div>
        <BrutalLoadingState message="Loading packs…" rows={2} />
      </section>
    {:then panels}
      {@const parsedCount = panels.documents.filter((d) => d.status === "parsed").length}
      {@const selectedPack = panels.packs.find((p) => p.id === panels.selectedPackId) ?? null}

      <!-- Documents -->
      <section class="sources-section" aria-labelledby="docs-heading">
        <div class="section-head">
          <h2 id="docs-heading" class="section-title">Documents</h2>
          <a class="section-link" href={`${INGEST_FLOW_HREF}?step=sources`}>Manage sources →</a>
        </div>
        {#if panels.loadFailed}
          <!-- R4-S3/X7: a load failure is distinct from a genuinely empty workspace —
               show an error + retry, never a misleading "No documents yet". -->
          <BrutalErrorBanner
            title="Couldn't load your documents"
            message="We couldn't reach your sources just now. Your documents are unchanged — try again."
          >
            {#snippet actions()}
              <button type="button" class="btn btn-primary btn-sm" on:click={() => invalidateAll()}>
                Try again
              </button>
              <a class="btn btn-outline btn-sm" href={`${INGEST_FLOW_HREF}?step=sources`}>Manage sources →</a>
            {/snippet}
          </BrutalErrorBanner>
        {:else if panels.documents.length === 0}
          <div class="empty-state">
            <p class="empty-title">No documents yet</p>
            <p class="empty-sub">
              Import documents from URLs, uploads, connectors, or crawls in the guided flow.
            </p>
            <a class="btn btn-primary btn-sm" href={`${INGEST_FLOW_HREF}?step=sources`}>Add documents →</a>
          </div>
        {:else}
          <p class="docs-summary">
            {panels.documents.length} document{panels.documents.length === 1 ? "" : "s"} ·
            {parsedCount} ready
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
        {/if}
      </section>

      <!-- Packs (the absorbed /connect/library view). Pack selection is shared with
           the guided flow via getSelectedDomainPackId — no re-selection. -->
      <section class="sources-section" aria-labelledby="packs-heading">
        <div class="section-head">
          <h2 id="packs-heading" class="section-title">Packs &amp; graphs</h2>
          {#if selectedPack}
            <span class="section-meta">Flow pack: {selectedPack.title}</span>
          {/if}
        </div>
        <ConnectGraphLibrary initialGraphs={panels.graphs} packs={panels.packs} />
      </section>
    {:catch}
      <!-- Streamed panels failed (network error reaching the panels promise itself,
           distinct from the loadFailed flag inside the resolved value). -->
      <section class="sources-section" aria-labelledby="docs-heading-err">
        <div class="section-head">
          <h2 id="docs-heading-err" class="section-title">Documents</h2>
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
  .changed-absent,
  .empty-state {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    align-items: flex-start;
    padding: var(--space-4);
    border: var(--border);
    background: var(--color-bg);
  }
  .changed-absent-title,
  .empty-title {
    font-family: var(--font-display);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
    margin: 0;
    color: var(--color-ink);
  }
  .changed-absent-sub,
  .empty-sub {
    margin: 0;
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
  }
  .doc-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-bottom: var(--border);
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
</style>
