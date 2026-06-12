<script lang="ts">
  /**
   * Shared versions panel: list version history, publish the current draft,
   * roll back to a prior version.
   *
   * Accepts endpoint URLs for history, publish, and rollback so it works for
   * both routes and policies without duplicating logic.
   *
   * docs/ux-contracts.md §3 state model: loading / error / empty / success.
   * Publish and rollback are state-changing actions; rollback requires confirmation.
   */
  import BrutalLoadingState from "$lib/components/brutalist/BrutalLoadingState.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import VersionDiffView from "$lib/components/dashboard/VersionDiffView.svelte";
  import {
    buildRouteDiff,
    buildPolicyDiff,
    summarizeDiff,
    exportBundleFileName,
    type DiffModel,
    type PolicyDiffChange,
  } from "$lib/route-version-diff";

  /** Fetch URL for GET history, e.g. `${DASHBOARD_BASE}/api/projects/p1/routes/r1/history`. */
  export let historyUrl: string;
  /** POST URL for publish. */
  export let publishUrl: string;
  /** POST URL for rollback. */
  export let rollbackUrl: string;

  /**
   * Callback fired after a successful publish or rollback so the parent can
   * invalidate its load (e.g. `refreshRouteDetail()` / `invalidateAll()`).
   */
  export let onMutated: (() => void) | (() => Promise<void>);

  /** The currently-published version number, if known (shown in the header). */
  export let currentVersion: number | null | undefined = undefined;
  /** The draft (working) version number, if known. */
  export let publishedVersion: number | null | undefined = undefined;

  /** Entity noun used in copy, e.g. "route" or "policy". */
  export let entityNoun = "route";

  /**
   * W3.5 — diff source. Routes diff client-side over the snapshots the history
   * endpoint already returns (truthful to stored versions, no recompute). When
   * `diffUrl` is set (policies), the panel POSTs `{fromVersion,toVersion}` to
   * the existing server `/diff` endpoint instead.
   */
  export let diffMode: "client" | "server" = "client";
  /** POST URL for the server diff endpoint (policies). Required when diffMode === "server". */
  export let diffUrl: string | undefined = undefined;
  /**
   * GET URL for the canonical export bundle (routes only — the route-graph
   * bundle, schema 1.0.0). When set, an Export affordance is shown.
   */
  export let exportUrl: string | undefined = undefined;
  /** Filename stem for the export download, e.g. the route name. */
  export let exportName = "route";
  /**
   * Optional deep-link callback wiring a diff field back to the builder
   * (rubric X4). Receives a `fieldPath` like `step.1.modelId` and, for step
   * rows, the snapshot step's stable `stepId` (preferred over the path's
   * orderIndex, which can drift if the draft was reordered since — m4).
   */
  export let onOpenDiffField: ((fieldPath: string, stepId?: string) => void) | undefined = undefined;

  /**
   * W3.5 (M2) — the *pending* draft, shaped like a stored snapshot so the
   * publish confirm can show the blast radius of THIS publish (draft vs the
   * latest published version) rather than the previous published change. Routes
   * supply `{ routeSnapshot: data.route, stepsSnapshot: orderedSteps }`. Omit it
   * (policies, which have no client-side draft model) and the confirm falls back
   * to the most-recent published change, explicitly labelled as such.
   */
  export let draftSnapshot:
    | { routeSnapshot?: unknown; stepsSnapshot?: unknown }
    | null
    | undefined = undefined;

  // --- state model ---
  type VersionEvent = {
    id: string;
    version: number;
    action: string;
    actorId: string | null;
    actorType: string | null;
    summary: string | null;
    routeSnapshot?: unknown;
    stepsSnapshot?: unknown;
    policySnapshot?: unknown;
    createdAt: number;
  };

  type LoadState =
    | { phase: "idle" }
    | { phase: "loading" }
    | { phase: "error"; message: string }
    | { phase: "ready"; events: VersionEvent[] };

  let loadState: LoadState = { phase: "idle" };

  let publishing = false;
  let publishError = "";
  let publishSuccess = "";

  let rollingBackVersion: number | null = null;
  let rollbackError = "";
  let rollbackSuccess = "";

  // --- W3.5: compare (diff) ---
  let compareOpen = false;
  let compareFrom: number | "" = "";
  let compareTo: number | "" = "";
  let diffLoading = false;
  let diffError = "";
  let diffModel: DiffModel | null = null;
  let diffRawFrom: unknown = undefined;
  let diffRawTo: unknown = undefined;

  // --- W3.5: export ---
  let exporting = false;
  let exportError = "";
  let exportCopied = false;

  const MAX_RETRIES = 3;

  async function fetchWithRetry(url: string, opts: RequestInit, retries = MAX_RETRIES): Promise<Response> {
    let lastErr: Error | null = null;
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url, opts);
        return res;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        if (i < retries - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
      }
    }
    throw lastErr ?? new Error("Network error");
  }

  async function loadHistory() {
    loadState = { phase: "loading" };
    publishError = "";
    publishSuccess = "";
    rollbackError = "";
    rollbackSuccess = "";
    try {
      const res = await fetchWithRetry(historyUrl, { credentials: "include" }, MAX_RETRIES);
      const body = (await res.json()) as { data?: VersionEvent[]; error?: string };
      if (!res.ok) {
        loadState = { phase: "error", message: body.error ?? `Failed to load history (${res.status})` };
        return;
      }
      loadState = { phase: "ready", events: body.data ?? [] };
    } catch (e) {
      loadState = { phase: "error", message: e instanceof Error ? e.message : "Failed to load version history" };
    }
  }

  async function publishDraft() {
    // Embed the blast radius of THIS publish into the confirm: when the caller
    // supplied the pending draft (routes), diff it against the latest published
    // snapshot so the operator sees exactly what is about to go live. Policies
    // have no client-side draft model, so they fall back to the most-recent
    // published change, explicitly labelled (the asymmetry is noted in
    // docs/ux-contracts.md §3, W3.5).
    const context = publishConfirmContext;
    if (
      !confirm(
        `Publish the current ${entityNoun} configuration? This makes it the live version and it begins receiving traffic immediately.${context}`
      )
    ) {
      return;
    }
    publishing = true;
    publishError = "";
    publishSuccess = "";
    try {
      const res = await fetchWithRetry(
        publishUrl,
        { method: "POST", credentials: "include" },
        MAX_RETRIES
      );
      const body = (await res.json()) as {
        data?: { publishedVersion?: number };
        error?: string;
        errors?: { message: string }[];
      };
      if (!res.ok) {
        const detail =
          body.errors?.map((e) => e.message).join("; ") ??
          body.error ??
          `Publish failed (${res.status})`;
        publishError = detail;
      } else {
        const v = body.data?.publishedVersion;
        publishSuccess = v != null ? `Version ${v} is now live.` : "Published.";
        await onMutated();
        await loadHistory();
      }
    } catch (e) {
      publishError = e instanceof Error ? e.message : "Publish failed";
    } finally {
      publishing = false;
    }
  }

  async function rollback(toVersion: number) {
    if (
      !confirm(
        `Roll back to version ${toVersion}? This replaces the live ${entityNoun} config with the snapshot from version ${toVersion}. This takes effect immediately.`
      )
    ) {
      return;
    }
    rollingBackVersion = toVersion;
    rollbackError = "";
    rollbackSuccess = "";
    try {
      const res = await fetchWithRetry(
        rollbackUrl,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toVersion }),
        },
        MAX_RETRIES
      );
      const body = (await res.json()) as {
        data?: { rolledBackToVersion?: number };
        error?: string;
      };
      if (!res.ok) {
        rollbackError = body.error ?? `Rollback failed (${res.status})`;
      } else {
        const v = body.data?.rolledBackToVersion ?? toVersion;
        rollbackSuccess = `Rolled back to version ${v}. This ${entityNoun} is now live at version ${v}.`;
        await onMutated();
        await loadHistory();
      }
    } catch (e) {
      rollbackError = e instanceof Error ? e.message : "Rollback failed";
    } finally {
      rollingBackVersion = null;
    }
  }

  // --- W3.5: compare / diff -------------------------------------------------

  /** Versions available to compare (from the loaded history). */
  $: availableVersions =
    loadState.phase === "ready"
      ? [...new Set(loadState.events.map((e) => e.version))].sort((a, b) => b - a)
      : [];

  function eventForVersion(version: number): VersionEvent | undefined {
    if (loadState.phase !== "ready") return undefined;
    // History is newest-first; the first matching event is the latest snapshot for that version.
    return loadState.events.find((e) => e.version === version);
  }

  function openCompare() {
    compareOpen = true;
    diffError = "";
    diffModel = null;
    // Sensible default: latest two versions.
    if (availableVersions.length >= 2) {
      compareTo = availableVersions[0];
      compareFrom = availableVersions[1];
      void runCompare();
    }
  }

  async function runCompare() {
    diffError = "";
    diffModel = null;
    diffRawFrom = undefined;
    diffRawTo = undefined;
    if (compareFrom === "" || compareTo === "") {
      diffError = "Pick two versions to compare.";
      return;
    }
    const fromV = Number(compareFrom);
    const toV = Number(compareTo);
    diffLoading = true;
    try {
      if (diffMode === "server") {
        if (!diffUrl) {
          diffError = "Diff endpoint not configured.";
          return;
        }
        const res = await fetchWithRetry(
          diffUrl,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fromVersion: fromV, toVersion: toV }),
          },
          MAX_RETRIES
        );
        const body = (await res.json()) as {
          data?: { changes?: PolicyDiffChange[]; fromVersion?: number | null; toVersion?: number | null };
          error?: string;
        };
        if (!res.ok) {
          diffError = body.error ?? `Diff failed (${res.status})`;
          return;
        }
        diffModel = buildPolicyDiff(body.data?.changes ?? [], fromV, toV);
        diffRawFrom = eventForVersion(fromV)?.policySnapshot;
        diffRawTo = eventForVersion(toV)?.policySnapshot;
      } else {
        // Client diff over the stored snapshots the history endpoint returned.
        const fromEvent = eventForVersion(fromV);
        const toEvent = eventForVersion(toV);
        diffModel = buildRouteDiff(
          fromEvent ? { ...fromEvent, version: fromV } : { version: fromV },
          toEvent ? { ...toEvent, version: toV } : { version: toV }
        );
        diffRawFrom = fromEvent
          ? { route: fromEvent.routeSnapshot, steps: fromEvent.stepsSnapshot }
          : null;
        diffRawTo = toEvent ? { route: toEvent.routeSnapshot, steps: toEvent.stepsSnapshot } : null;
      }
    } catch (e) {
      diffError = e instanceof Error ? e.message : "Diff failed";
    } finally {
      diffLoading = false;
    }
  }

  /** The latest published version's stored snapshot event (the live version), if any. */
  $: latestPublishedEvent =
    diffMode === "client" && availableVersions.length >= 1
      ? eventForVersion(availableVersions[0])
      : undefined;

  /**
   * M2 — blast radius of THIS publish: the pending draft diffed against the
   * latest published snapshot. Only available for routes (diffMode === "client")
   * when the caller supplied `draftSnapshot`. Null when not computable.
   */
  $: pendingPublishDiff =
    diffMode === "client" && draftSnapshot && latestPublishedEvent
      ? buildRouteDiff(
          {
            routeSnapshot: latestPublishedEvent.routeSnapshot,
            stepsSnapshot: latestPublishedEvent.stepsSnapshot,
            version: latestPublishedEvent.version,
          },
          {
            routeSnapshot: draftSnapshot.routeSnapshot,
            stepsSnapshot: draftSnapshot.stepsSnapshot,
            version: null,
          }
        )
      : null;
  $: pendingPublishSummary = pendingPublishDiff ? summarizeDiff(pendingPublishDiff) : "";

  /**
   * Summary of the most-recent *published* change (the diff of the two most
   * recent published snapshots). Used only as the policy fallback, where there
   * is no client-side draft model to diff. Explicitly labelled in the confirm.
   */
  $: latestChangeSummary = (() => {
    if (diffMode !== "client" || availableVersions.length < 2) return "";
    const toV = availableVersions[0];
    const fromV = availableVersions[1];
    const toEvent = eventForVersion(toV);
    const fromEvent = eventForVersion(fromV);
    if (!toEvent || !fromEvent) return "";
    const model = buildRouteDiff(
      { ...fromEvent, version: fromV },
      { ...toEvent, version: toV }
    );
    return summarizeDiff(model);
  })();

  /**
   * The context line appended to the publish confirm. Prefers the pending
   * blast radius (draft vs live) when the caller gave us a draft; otherwise
   * falls back to the labelled most-recent-published-change summary; otherwise
   * an honest "no prior published version" note for a never-published entity.
   */
  $: publishConfirmContext = (() => {
    if (draftSnapshot && diffMode === "client") {
      if (!latestPublishedEvent) {
        return `\n\nThis is the first published version — there is no live version to compare against.`;
      }
      if (pendingPublishDiff?.empty) {
        return `\n\nNo changes vs live version ${latestPublishedEvent.version} — this re-publishes the same configuration.`;
      }
      return `\n\nPublishing changes: ${pendingPublishSummary} (vs live version ${latestPublishedEvent.version})`;
    }
    if (latestChangeSummary) {
      return `\n\nMost recent published change: ${latestChangeSummary}`;
    }
    return "";
  })();

  // --- W3.5: export ---------------------------------------------------------

  async function fetchExportBundle(): Promise<unknown | null> {
    if (!exportUrl) return null;
    exportError = "";
    try {
      const res = await fetchWithRetry(exportUrl, { credentials: "include" }, MAX_RETRIES);
      const body = (await res.json()) as { data?: unknown; error?: string };
      if (!res.ok) {
        exportError = body.error ?? `Export failed (${res.status})`;
        return null;
      }
      return body.data ?? null;
    } catch (e) {
      exportError = e instanceof Error ? e.message : "Export failed";
      return null;
    }
  }

  async function downloadExport() {
    exporting = true;
    exportCopied = false;
    try {
      const bundle = await fetchExportBundle();
      if (!bundle) return;
      const json = JSON.stringify(bundle, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = exportBundleFileName(exportName);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      exporting = false;
    }
  }

  async function copyExport() {
    exporting = true;
    exportCopied = false;
    try {
      const bundle = await fetchExportBundle();
      if (!bundle) return;
      const json = JSON.stringify(bundle, null, 2);
      try {
        await navigator.clipboard.writeText(json);
        exportCopied = true;
      } catch {
        exportError = "Could not copy to clipboard. Use Download instead.";
      }
    } finally {
      exporting = false;
    }
  }

  function formatDate(ms: number): string {
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(ms));
    } catch {
      return String(ms);
    }
  }

  // Load history when component mounts
  import { onMount } from "svelte";
  onMount(() => { void loadHistory(); });
</script>

<div class="versions-panel">
  <div class="versions-header">
    <h2 class="versions-title">Versions</h2>
    {#if currentVersion != null && publishedVersion != null && currentVersion !== publishedVersion}
      <p class="versions-draft-notice" role="status">
        Working version <strong>{currentVersion}</strong> differs from published version
        <strong>{publishedVersion}</strong>. Publish to send edits live.
      </p>
    {/if}
    <div class="versions-publish-row">
      <button
        type="button"
        class="btn btn-primary"
        disabled={publishing}
        onclick={() => void publishDraft()}
      >
        {publishing ? "Publishing…" : "Publish draft"}
      </button>
      <p class="versions-publish-hint muted">
        Publishing makes the current {entityNoun} configuration receive live traffic.
      </p>
    </div>

    <div class="versions-tools-row">
      <button
        type="button"
        class="btn btn-secondary"
        aria-expanded={compareOpen}
        onclick={() => (compareOpen ? (compareOpen = false) : openCompare())}
      >
        {compareOpen ? "Hide compare" : "Compare versions"}
      </button>
      {#if exportUrl}
        <button type="button" class="btn btn-secondary" disabled={exporting} onclick={() => void downloadExport()}>
          {exporting ? "Exporting…" : "Export bundle"}
        </button>
        <button type="button" class="btn btn-secondary" disabled={exporting} onclick={() => void copyExport()}>
          Copy as JSON
        </button>
      {/if}
    </div>
    {#if exportUrl}
      <p class="versions-publish-hint muted">
        Export the canonical route bundle (schema 1.0.0) — portable JSON for GitOps and agent diffs; no secrets.
      </p>
    {/if}
    {#if exportError}
      <BrutalErrorBanner message={exportError}>
        {#snippet actions()}
          <button type="button" class="btn btn-secondary" onclick={() => { exportError = ""; }}>Dismiss</button>
        {/snippet}
      </BrutalErrorBanner>
    {/if}
    {#if exportCopied}
      <p class="versions-success" role="status">Route bundle copied to clipboard.</p>
    {/if}

    {#if compareOpen}
      <div class="versions-compare" role="group" aria-label="Compare two versions">
        <div class="versions-compare-controls">
          <label class="versions-compare-field">
            <span class="versions-compare-label">From</span>
            <select class="input" bind:value={compareFrom} onchange={() => void runCompare()}>
              <option value="" disabled>—</option>
              {#each availableVersions as v (v)}
                <option value={v}>v{v}</option>
              {/each}
            </select>
          </label>
          <span class="versions-compare-arrow" aria-hidden="true">→</span>
          <label class="versions-compare-field">
            <span class="versions-compare-label">To</span>
            <select class="input" bind:value={compareTo} onchange={() => void runCompare()}>
              <option value="" disabled>—</option>
              {#each availableVersions as v (v)}
                <option value={v}>v{v}</option>
              {/each}
            </select>
          </label>
          <button type="button" class="btn btn-secondary" disabled={diffLoading} onclick={() => void runCompare()}>
            {diffLoading ? "Comparing…" : "Compare"}
          </button>
        </div>
        {#if availableVersions.length < 2}
          <p class="versions-publish-hint muted">
            Compare needs at least two published versions. Publish again to build a history you can diff.
          </p>
        {/if}
        <VersionDiffView
          model={diffModel}
          loading={diffLoading}
          errorMessage={diffError}
          onRetry={() => void runCompare()}
          onOpenField={onOpenDiffField}
          rawFrom={diffRawFrom}
          rawTo={diffRawTo}
        />
      </div>
    {/if}

    {#if publishError}
      <BrutalErrorBanner message={publishError}>
        {#snippet actions()}
          <button type="button" class="btn btn-primary" onclick={() => void publishDraft()}>Retry publish</button>
        {/snippet}
      </BrutalErrorBanner>
    {/if}
    {#if publishSuccess}
      <p class="versions-success" role="status">{publishSuccess}</p>
    {/if}
    {#if rollbackError}
      <BrutalErrorBanner message={rollbackError}>
        {#snippet actions()}
          <button type="button" class="btn btn-secondary" onclick={() => { rollbackError = ""; }}>Dismiss</button>
        {/snippet}
      </BrutalErrorBanner>
    {/if}
    {#if rollbackSuccess}
      <p class="versions-success" role="status">{rollbackSuccess}</p>
    {/if}
  </div>

  <div class="versions-history">
    <h3 class="versions-history-title">Version history</h3>

    {#if loadState.phase === "idle" || loadState.phase === "loading"}
      <BrutalLoadingState message="Loading version history…" rows={3} />

    {:else if loadState.phase === "error"}
      <BrutalErrorBanner
        title="Could not load version history"
        message={loadState.message}
      >
        {#snippet actions()}
          <button type="button" class="btn btn-primary" onclick={() => void loadHistory()}>Retry</button>
        {/snippet}
      </BrutalErrorBanner>

    {:else if loadState.events.length === 0}
      <EmptyState
        title="No published versions yet"
        description="This {entityNoun} has never been published. Until you publish, it will not receive discovery traffic — changes you make stay as a local draft."
      >
        {#snippet children()}
          <button type="button" class="btn btn-primary" onclick={() => void publishDraft()}>
            {publishing ? "Publishing…" : "Publish now"}
          </button>
        {/snippet}
      </EmptyState>

    {:else}
      <ol class="versions-list" aria-label="Version history for this {entityNoun}">
        {#each loadState.events as event (event.id)}
          {@const isPublished = publishedVersion != null && event.version === publishedVersion}
          <li class="version-row" class:version-row--published={isPublished}>
            <div class="version-row-meta">
              <span class="version-number" aria-label="Version {event.version}">v{event.version}</span>
              {#if isPublished}
                <span class="version-live-badge" aria-label="Currently live">Live</span>
              {/if}
              <span class="version-action">{event.action}</span>
              <span class="version-date muted">{formatDate(event.createdAt)}</span>
              {#if event.actorType}
                <span class="version-actor muted">by {event.actorType === "session" ? "dashboard" : event.actorType}</span>
              {/if}
            </div>
            {#if event.summary}
              <p class="version-summary muted">{event.summary}</p>
            {/if}
            {#if !isPublished}
              <button
                type="button"
                class="btn btn-secondary version-rollback-btn"
                disabled={rollingBackVersion === event.version}
                aria-label="Roll back {entityNoun} to version {event.version}"
                onclick={() => void rollback(event.version)}
              >
                {rollingBackVersion === event.version ? "Rolling back…" : "Roll back to this version"}
              </button>
            {/if}
          </li>
        {/each}
      </ol>
    {/if}
  </div>
</div>

<style>
  .versions-panel {
    max-width: 52rem;
  }

  .versions-header {
    margin-bottom: var(--space-6);
    padding-bottom: var(--space-5);
    border-bottom: 1px solid var(--rm-border);
  }

  .versions-title {
    font-size: var(--text-xl);
    font-weight: 700;
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }

  .versions-draft-notice {
    font-size: var(--text-sm);
    color: var(--rm-text);
    background: var(--brut-neon);
    border: 1px solid var(--brut-ink);
    padding: var(--space-2) var(--space-3);
    margin: 0 0 var(--space-3);
  }

  .versions-publish-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    margin-bottom: var(--space-3);
  }

  .versions-tools-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-bottom: var(--space-2);
  }

  .versions-compare {
    margin: var(--space-3) 0;
    padding: var(--space-3);
    border: var(--brut-border-width, 2px) solid var(--brut-ink);
    background: var(--brut-canvas, var(--rm-surface-raised));
  }

  .versions-compare-controls {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .versions-compare-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .versions-compare-label {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--rm-muted);
  }

  .versions-compare-arrow {
    font-weight: 800;
    padding-bottom: var(--space-2);
    color: var(--rm-muted);
  }

  .versions-publish-hint {
    margin: 0;
  }

  .versions-success {
    font-size: var(--text-sm);
    color: var(--rm-sage);
    font-weight: 600;
    margin: var(--space-2) 0 0;
  }

  .versions-history-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-3);
  }

  .versions-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .version-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--rm-border);
  }

  .version-row--published {
    background: transparent;
  }

  .version-row-meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    font-size: var(--text-sm);
  }

  .version-number {
    font-family: var(--rm-font-mono, monospace);
    font-weight: 700;
    font-size: var(--text-sm);
    color: var(--rm-text);
  }

  .version-live-badge {
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: var(--brut-ink);
    color: var(--brut-white, #fff);
    padding: 1px var(--space-2);
    border: 1px solid var(--brut-ink);
  }

  .version-action {
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--rm-muted);
  }

  .version-date {
    font-size: var(--text-xs);
  }

  .version-actor {
    font-size: var(--text-xs);
  }

  .version-summary {
    margin: 0;
    font-size: var(--text-xs);
  }

  .version-rollback-btn {
    align-self: flex-start;
    margin-top: var(--space-1);
    font-size: var(--text-xs);
  }

  .muted {
    color: var(--rm-muted);
  }

  /* btn copies from global styles — ensures self-contained rendering. */
  .btn {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    font-weight: 500;
    border: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }
  .btn:disabled {
    opacity: 0.55;
    cursor: default;
  }
  .btn-primary {
    background: var(--brut-ink);
    color: var(--brut-white, #fff);
  }
  .btn-secondary {
    background: transparent;
    border: 1px solid var(--rm-border);
    color: var(--rm-text);
  }
</style>
