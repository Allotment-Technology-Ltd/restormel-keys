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

  // --- state model ---
  type VersionEvent = {
    id: string;
    version: number;
    action: string;
    actorId: string | null;
    actorType: string | null;
    summary: string | null;
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
