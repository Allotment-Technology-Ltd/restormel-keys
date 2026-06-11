<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import type { TestingVerdictEntry } from "@restormel/contracts";
  import BrutalCard from "$lib/components/brutalist/BrutalCard.svelte";
  import BrutalLoadingState from "$lib/components/brutalist/BrutalLoadingState.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";

  /**
   * W3.8 Testing hub: timeline of testing run verdicts.
   *
   * `history` is a streamed Promise — the page server resolves it from
   * GET /connect/v1/testing/verdicts. The promise rejects on storage errors so
   * the panel renders its error state (ux-contracts §3).
   */
  export let history: Promise<TestingVerdictEntry[]>;

  const DOCS_CI_GUIDE = "/keys/docs/guides/testing-gpu-route-smoke";
  const CI_SETUP_GUIDE = "/keys/docs/guides/keys-testing-onboarding";

  let retrying = false;
  async function retry() {
    retrying = true;
    try {
      await invalidateAll();
    } finally {
      retrying = false;
    }
  }

  const SOURCE_LABELS: Record<TestingVerdictEntry["verdict"]["source"], string> = {
    ci_action: "CI action",
    cli: "CLI",
    manual: "Manual",
  };

  function fmtDate(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
  }

  function goalLabel(entry: TestingVerdictEntry): string | null {
    const { goals_passed, goals_total } = entry.verdict;
    if (goals_total == null) return null;
    if (goals_passed == null) return `${goals_total} goal${goals_total === 1 ? "" : "s"}`;
    return `${goals_passed} / ${goals_total} goal${goals_total === 1 ? "" : "s"} passed`;
  }
</script>

<section class="testing-timeline" aria-labelledby="testing-timeline-heading">
  <h2 id="testing-timeline-heading" class="timeline-heading">Testing runs</h2>

  {#await history}
    <BrutalLoadingState message="Loading testing runs…" rows={3} />
  {:then entries}
    {#if entries.length === 0}
      <EmptyState
        title="No testing runs recorded yet"
        description="Wire your CI action to POST verdicts — every run becomes a data point in this timeline. Use the snippet below to get started."
      >
        <a class="btn btn-primary btn-sm" href={CI_SETUP_GUIDE}>Wire the testing action</a>
        <a class="btn btn-outline btn-sm" href={DOCS_CI_GUIDE}>GPU route smoke guide</a>
      </EmptyState>
    {:else}
      <!-- Latest verdict banner -->
      {@const latest = entries[0]}
      <div
        class="latest-banner"
        class:latest-pass={latest.verdict.pass}
        class:latest-fail={!latest.verdict.pass}
        role="status"
        aria-label="Latest testing run verdict"
      >
        <span class="latest-tag" class:tag-pass={latest.verdict.pass} class:tag-fail={!latest.verdict.pass}>
          {latest.verdict.pass ? "LATEST: PASS" : "LATEST: FAIL"}
        </span>
        <span class="latest-suite">{latest.verdict.suite_id}</span>
        <time class="latest-time" datetime={latest.verdict.evaluated_at}>
          {fmtDate(latest.verdict.evaluated_at)}
        </time>
        {#if latest.verdict.artifact_ref}
          <a
            class="btn btn-outline btn-xs latest-download"
            href={latest.verdict.artifact_ref}
            download
            aria-label="Download release pack for latest run"
          >
            ↓ Release pack
          </a>
        {/if}
      </div>

      <!-- Full timeline -->
      <BrutalCard fill="white">
        <ul class="timeline-list" role="list" aria-label="Testing run history">
          {#each entries as entry (entry.id)}
            {@const goals = goalLabel(entry)}
            <li
              class="timeline-entry"
              class:entry-pass={entry.verdict.pass}
              class:entry-fail={!entry.verdict.pass}
            >
              <div class="entry-head">
                <span
                  class="entry-tag"
                  class:tag-pass={entry.verdict.pass}
                  class:tag-fail={!entry.verdict.pass}
                >
                  {entry.verdict.pass ? "PASS" : "FAIL"}
                </span>
                <span class="entry-suite">{entry.verdict.suite_id}</span>
                <span class="entry-source">{SOURCE_LABELS[entry.verdict.source] ?? entry.verdict.source}</span>
                <time class="entry-time" datetime={entry.verdict.evaluated_at}>
                  {fmtDate(entry.verdict.evaluated_at)}
                </time>
              </div>

              {#if goals}
                <p class="entry-goals">{goals}</p>
              {/if}

              {#if entry.verdict.commit_sha}
                <p class="entry-meta">
                  <span class="meta-label">Commit</span>
                  <code class="meta-mono">{entry.verdict.commit_sha.slice(0, 8)}</code>
                  {#if entry.verdict.repository}
                    <span class="meta-sep">·</span>
                    <span class="meta-label">{entry.verdict.repository}</span>
                  {/if}
                  {#if entry.verdict.pr_number}
                    <span class="meta-sep">·</span>
                    <span class="meta-label">PR #{entry.verdict.pr_number}</span>
                  {/if}
                </p>
              {/if}

              {#if !entry.verdict.pass && entry.verdict.reasons.length > 0}
                <details class="entry-reasons">
                  <summary class="entry-reasons-summary">
                    {entry.verdict.reasons.length} failure reason{entry.verdict.reasons.length === 1 ? "" : "s"}
                  </summary>
                  <ul aria-label="Failure reasons">
                    {#each entry.verdict.reasons as reason (reason)}
                      <li>{reason}</li>
                    {/each}
                  </ul>
                </details>
              {/if}

              {#if entry.verdict.artifact_ref}
                <div class="entry-artifact">
                  <a
                    class="btn btn-outline btn-xs"
                    href={entry.verdict.artifact_ref}
                    download
                    aria-label="Download release pack"
                  >
                    ↓ Release pack
                  </a>
                </div>
              {/if}
            </li>
          {/each}
        </ul>

        <p class="timeline-footer">
          Showing the {entries.length} most recent testing run{entries.length === 1 ? "" : "s"}.
          <a href={CI_SETUP_GUIDE}>Testing setup →</a>
        </p>
      </BrutalCard>
    {/if}
  {:catch}
    <BrutalErrorBanner
      title="Testing runs unavailable"
      message="Could not read the testing run history. Your project is unaffected — this is a read failure."
    >
      {#snippet actions()}
        <button
          type="button"
          class="btn btn-primary btn-sm"
          disabled={retrying}
          on:click={retry}
        >
          {retrying ? "Retrying…" : "Try again"}
        </button>
      {/snippet}
    </BrutalErrorBanner>
  {/await}
</section>

<style>
  .testing-timeline {
    margin: 0 0 var(--space-5);
  }

  .timeline-heading {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
    margin: 0 0 var(--space-3);
  }

  /* ── Latest verdict banner ──────────────────────────────────────────────── */

  .latest-banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: var(--border);
    margin: 0 0 var(--space-3);
    box-shadow: var(--shadow-sm);
  }

  .latest-pass {
    background: var(--color-green-tint, #e8f5e9);
  }

  .latest-fail {
    background: var(--color-red-tint, #fde8e8);
  }

  .latest-tag {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    border: var(--border);
    padding: 0 var(--space-1);
    text-transform: uppercase;
  }

  .tag-pass {
    background: var(--color-green-tint, #c8e6c9);
    color: var(--color-ink);
  }

  .tag-fail {
    background: var(--brut-coral, #fde8e8);
    color: var(--color-ink);
  }

  .latest-suite {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 600;
  }

  .latest-time {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
    margin-left: auto;
  }

  .latest-download {
    margin-left: var(--space-2);
  }

  /* ── Timeline list ──────────────────────────────────────────────────────── */

  .timeline-list {
    list-style: none;
    margin: 0 0 var(--space-3);
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .timeline-entry {
    border: var(--border);
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface);
  }

  .entry-pass {
    border-left: 4px solid var(--color-green-tint, #4caf50);
  }

  .entry-fail {
    border-left: 4px solid var(--color-red-tint, #e53935);
  }

  .entry-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin: 0 0 var(--space-1);
  }

  .entry-tag {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    border: var(--border);
    padding: 0 var(--space-1);
    text-transform: uppercase;
  }

  .entry-suite {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 600;
  }

  .entry-source {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
    text-transform: uppercase;
  }

  .entry-time {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
    margin-left: auto;
  }

  .entry-goals {
    font-size: var(--text-sm);
    font-weight: 500;
    margin: 0 0 2px;
  }

  .entry-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-xs);
    color: var(--color-ink-muted);
    margin: var(--space-1) 0 0;
  }

  .meta-label {
    font-family: var(--font-mono);
  }

  .meta-mono {
    font-family: var(--font-mono);
    font-size: 0.9em;
  }

  .meta-sep {
    color: var(--color-ink-muted);
  }

  .entry-reasons {
    margin: var(--space-1) 0 0;
  }

  .entry-reasons-summary {
    font-size: var(--text-xs);
    font-weight: 600;
    cursor: pointer;
    color: var(--color-red-tint, #c62828);
  }

  .entry-reasons ul {
    margin: var(--space-1) 0 0;
    padding: 0 0 0 var(--space-3);
    font-size: var(--text-xs);
    color: var(--color-ink-muted);
    line-height: 1.5;
  }

  .entry-artifact {
    margin: var(--space-2) 0 0;
  }

  /* ── Footer ─────────────────────────────────────────────────────────────── */

  .timeline-footer {
    font-size: var(--text-xs);
    color: var(--color-ink-muted);
    margin: 0;
  }
</style>
