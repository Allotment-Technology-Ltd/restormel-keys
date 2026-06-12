<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import type { ConnectEvalVerdictEntry } from "@restormel/contracts";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import BrutalCard from "$lib/components/brutalist/BrutalCard.svelte";
  import BrutalLoadingState from "$lib/components/brutalist/BrutalLoadingState.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";

  /**
   * Streamed quality-history entries for the workspace's active graph. An empty array
   * means "no verdicts recorded yet" (panel empty state). The promise REJECTS on storage
   * errors so the panel renders its error state.
   *
   * Stage 2.4 — docs/verified-context-pivot-roadmap.md
   */
  export let history: Promise<ConnectEvalVerdictEntry[]>;

  const DOCS_CI_GUIDE = "/keys/docs/guides/context-regression-ci";
  const CONNECT_BASE = DASHBOARD_BASE + "/connect";

  let retrying = false;
  async function retry() {
    retrying = true;
    try {
      await invalidateAll();
    } finally {
      retrying = false;
    }
  }

  const SOURCE_LABELS: Record<ConnectEvalVerdictEntry["source"], string> = {
    cli: "CLI",
    ci_action: "CI action",
    ingest_run: "Ingest run",
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

  function g2Label(entry: ConnectEvalVerdictEntry): string {
    const g2 = entry.verdict.g2;
    return `${g2.ok_pct}% supported · ${g2.unsupported_pct}% unsupported`;
  }

  function regressionSummary(entry: ConnectEvalVerdictEntry): string | null {
    const diff = entry.diff;
    if (!diff || !diff.regression) return null;
    if (diff.regressions.length > 0) return diff.regressions[0];
    return "Regression detected";
  }

  function hasRegression(entry: ConnectEvalVerdictEntry): boolean {
    return Boolean(entry.diff?.regression);
  }

  function isNewCorpus(entry: ConnectEvalVerdictEntry): boolean {
    return Boolean(entry.diff?.fingerprint_changed);
  }

  /**
   * W3.4 handoff: for ingest_run verdicts that carry source_run_id, return the
   * run-console URL so the history row links to the producing run.
   */
  function sourceRunHref(entry: ConnectEvalVerdictEntry): string | null {
    if (entry.source === "ingest_run" && entry.source_run_id) {
      return `${CONNECT_BASE}/ingest/${entry.source_run_id}?from=quality-history`;
    }
    return null;
  }

  /**
   * W2.3 / D-P2-1: glyph signals result state so colour is not the only indicator.
   *   ■ = pass (solid square — affirmative)
   *   ▲ = regression (triangle — caution)
   *   □ = fail (open square — incomplete/lacking)
   */
  function verdictGlyph(entry: ConnectEvalVerdictEntry): string {
    if (hasRegression(entry)) return "▲";
    if (entry.verdict.pass) return "■";
    return "□";
  }

  function verdictLabel(entry: ConnectEvalVerdictEntry): string {
    if (hasRegression(entry)) return "REGRESSION";
    if (entry.verdict.pass) return "PASS";
    return "FAIL";
  }
</script>

<section class="quality-history" aria-labelledby="quality-history-heading">
  <!-- D-P1-3: heading drops the jargon; screen reader gets "Quality history" not "Eval verdict history" -->
  <h2 id="quality-history-heading" class="history-heading">Quality history</h2>

  {#await history}
    <BrutalLoadingState message="Loading quality history…" rows={3} />
  {:then entries}
    {#if entries.length === 0}
      <EmptyState
        title="No eval verdicts recorded yet"
        description="Run the CI gate to start building your quality timeline. Each CLI or CI run that POSTs a verdict here becomes a data point — G2 bar, trust score, and regression events — so you can track quality over time."
      >
        <a class="btn btn-primary btn-sm" href={DOCS_CI_GUIDE}>Wire the CI gate</a>
        <a class="btn btn-outline btn-sm" href="{CONNECT_BASE}/pipeline">Open pipeline</a>
      </EmptyState>
    {:else}
      <BrutalCard fill="white">
        <ul class="history-list" role="list" aria-label="Quality history">
          {#each entries as entry (entry.id)}
            {@const regression = regressionSummary(entry)}
            {@const newCorpus = isNewCorpus(entry)}
            {@const runHref = sourceRunHref(entry)}
            {@const glyph = verdictGlyph(entry)}
            {@const label = verdictLabel(entry)}
            <li
              class="history-entry"
              class:entry-pass={entry.verdict.pass && !hasRegression(entry)}
              class:entry-fail={!entry.verdict.pass}
              class:entry-regression={hasRegression(entry)}
              class:entry-new-corpus={newCorpus}
            >
              <div class="entry-head">
                <!-- D-P2-1: glyph + text so result is not colour-only -->
                <span
                  class="entry-verdict-tag"
                  class:tag-pass={entry.verdict.pass && !hasRegression(entry)}
                  class:tag-fail={!entry.verdict.pass}
                  class:tag-regression={hasRegression(entry)}
                  aria-label="{label}"
                >
                  <span class="verdict-glyph" aria-hidden="true">{glyph}</span>
                  {label}
                </span>
                <span class="entry-source">{SOURCE_LABELS[entry.source] ?? entry.source}</span>
                <time class="entry-time" datetime={entry.verdict.evaluated_at}>{fmtDate(entry.verdict.evaluated_at)}</time>
                <!-- W3.4: cross-link to producing run console for ingest_run entries -->
                {#if runHref}
                  <a class="entry-run-link" href={runHref} aria-label="Open the ingest run that produced this verdict">Run →</a>
                {/if}
              </div>

              <div class="entry-metrics">
                <span class="entry-g2">{g2Label(entry)}</span>
                {#if entry.verdict.trust_score != null}
                  <span class="entry-trust">trust {entry.verdict.trust_score}/100</span>
                {/if}
                {#if entry.verdict.coverage_gaps != null}
                  <span class="entry-gaps">{entry.verdict.coverage_gaps} gap{entry.verdict.coverage_gaps === 1 ? "" : "s"}</span>
                {/if}
              </div>

              {#if regression}
                <p class="entry-regression-note" role="alert">
                  <!-- D-P2-1: glyph + text, not colour alone -->
                  <span aria-hidden="true">▲</span> {regression}
                </p>
              {/if}

              {#if newCorpus}
                <p class="entry-corpus-note">Corpus changed — this run supersedes the prior baseline.</p>
              {/if}

              {#if entry.verdict.reasons.length > 0}
                <ul class="entry-reasons" aria-label="Failure reasons">
                  {#each entry.verdict.reasons as reason (reason)}
                    <li>{reason}</li>
                  {/each}
                </ul>
              {/if}
            </li>
          {/each}
        </ul>

        <p class="history-footer">
          Showing the {entries.length} most recent eval run{entries.length === 1 ? "" : "s"}.
          <a href={DOCS_CI_GUIDE}>CI gate guide →</a>
        </p>
      </BrutalCard>
    {/if}
  {:catch}
    <!-- D-P2-2: recovery actions inside BrutalErrorBanner's actions snippet -->
    <BrutalErrorBanner
      title="Quality history unavailable"
      message="Could not read the eval verdict history. Your graph is unaffected — this is a read failure."
    >
      {#snippet actions()}
        <button type="button" class="btn btn-primary btn-sm" disabled={retrying} on:click={retry}>
          {retrying ? "Retrying…" : "Try again"}
        </button>
      {/snippet}
    </BrutalErrorBanner>
  {/await}
</section>

<style>
  .quality-history {
    margin: 0 0 var(--space-5);
  }

  .history-heading {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
    margin: 0 0 var(--space-3);
  }

  .history-list {
    list-style: none;
    margin: 0 0 var(--space-3);
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .history-entry {
    border: var(--border);
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface);
  }

  /* W2.3: defined state tokens — no --color-*-tint hex fallbacks (D-P1-4) */
  .entry-pass {
    border-left: 4px solid var(--state-ok-fg);
  }

  .entry-fail {
    border-left: 4px solid var(--state-fail-fg);
  }

  .entry-regression {
    border-left: 4px solid var(--state-warn-fg);
    background: color-mix(in oklab, var(--state-warn-bg) 20%, var(--color-surface));
  }

  .entry-new-corpus {
    opacity: 0.85;
  }

  .entry-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin: 0 0 var(--space-1);
  }

  .entry-verdict-tag {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    border: var(--border);
    padding: 0 var(--space-1);
    text-transform: uppercase;
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }

  /* W2.3: defined state tokens for verdict tags (D-P1-4) */
  .tag-pass {
    background: var(--state-ok-bg);
    color: var(--state-ok-fg);
    border-color: var(--state-ok-fg);
  }

  .tag-fail {
    background: var(--state-fail-bg);
    color: var(--state-fail-fg);
    border-color: var(--state-fail-fg);
  }

  .tag-regression {
    background: var(--state-warn-bg);
    color: var(--state-warn-fg);
    border-color: var(--state-warn-fg);
  }

  .verdict-glyph {
    font-size: 0.7em;
    line-height: 1;
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

  /* W3.4: run cross-link */
  .entry-run-link {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    color: var(--color-ink);
    text-decoration: underline;
    text-underline-offset: 2px;
    white-space: nowrap;
  }

  .entry-metrics {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    font-size: var(--text-sm);
    margin: 0 0 2px;
  }

  .entry-g2 {
    font-weight: 500;
  }

  .entry-trust,
  .entry-gaps {
    color: var(--color-ink-muted);
  }

  .entry-regression-note {
    margin: var(--space-1) 0 0;
    font-size: var(--text-xs);
    font-weight: 600;
    /* W2.3: defined state token — no --color-red-tint hex fallback (D-P1-4) */
    color: var(--state-fail-fg);
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .entry-corpus-note {
    margin: var(--space-1) 0 0;
    font-size: var(--text-xs);
    color: var(--color-ink-muted);
    font-style: italic;
  }

  .entry-reasons {
    margin: var(--space-1) 0 0;
    padding: 0 0 0 var(--space-3);
    font-size: var(--text-xs);
    color: var(--color-ink-muted);
    line-height: 1.5;
  }

  .history-footer {
    font-size: var(--text-xs);
    color: var(--color-ink-muted);
    margin: 0;
  }
</style>
