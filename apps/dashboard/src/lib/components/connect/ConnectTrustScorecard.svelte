<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { CLAIMS_HREF, INGEST_FLOW_HREF } from "$lib/nav-config";
  import type { ConnectTrustScorecard } from "@restormel/contracts";
  import BrutalCard from "$lib/components/brutalist/BrutalCard.svelte";
  import BrutalLoadingState from "$lib/components/brutalist/BrutalLoadingState.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";

  /** Streamed scorecard for the workspace's active graph (null = no graph to score yet). */
  export let scorecard: Promise<ConnectTrustScorecard | null>;

  const GRAPH_BASE = CLAIMS_HREF;
  const PIPELINE_STORE_HREF = INGEST_FLOW_HREF + "?step=store";
  const REVALIDATE_HREF = GRAPH_BASE + "?workspace=tools&focus=validate";

  let retrying = false;
  async function retry() {
    retrying = true;
    try {
      await invalidateAll();
    } finally {
      retrying = false;
    }
  }

  const STATE_LABELS: Record<string, string> = {
    supported: "Supported",
    inferred: "Inferred",
    unverified: "Unverified",
    contradicted: "Contradicted",
    excluded: "Excluded",
  };
  const STATE_ORDER = ["supported", "inferred", "unverified", "contradicted", "excluded"] as const;

  /**
   * W2.3: each factor maps to a graph-explorer filter so "−6.2 pts" rows are receipts
   * that link to the ideas that caused the deduction. W2.1 defined the ?filter= contract;
   * W2.2 adds evidence-state filters once it merges (coordinate values here).
   */
  const FACTOR_FILTER: Record<string, string | null> = {
    embedding_coverage: "missing_embed",
    verification_coverage: "unverified",
    orphan_rate: "review",
    issue_penalty: "review",
    vector_index: null,    // store-level — no per-idea filter
    relation_health: null, // graph-level — no per-idea filter
  };

  function factorHref(factorId: string): string | null {
    const filter = FACTOR_FILTER[factorId];
    if (!filter) return null;
    return `${GRAPH_BASE}?filter=${filter}`;
  }

  function detractors(card: ConnectTrustScorecard) {
    return card.score_factors
      .map((f) => ({ ...f, lost: f.max_points - f.points }))
      .filter((f) => f.lost > 0.05)
      .sort((a, b) => b.lost - a.lost);
  }

  function fmtPoints(n: number): string {
    return (Math.round(n * 10) / 10).toString();
  }

  function fmtDate(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }
</script>

<section class="scorecard" aria-labelledby="trust-scorecard-heading">
  <h2 id="trust-scorecard-heading" class="scorecard-heading">Graph trust scorecard</h2>

  {#await scorecard}
    <BrutalLoadingState message="Computing graph scorecard…" rows={3} />
  {:then card}
    {#if !card}
      <EmptyState
        title="No graph to score yet"
        description="The scorecard appears after your first ingest run writes ideas to the graph store. Run the pipeline to build a graph, then come back here for the trust score, G2 quality bar, and evidence-bound coverage."
      >
        <a class="btn btn-primary btn-sm" href={INGEST_FLOW_HREF}>Open the pipeline</a>
      </EmptyState>
    {:else}
      {@const lowered = detractors(card)}
      {@const g2Pass = card.g2.ok_pct >= card.targets.ok_pct_min && card.g2.unsupported_pct <= card.targets.unsupported_pct_max}
      {@const neverVerified = !card.last_verified_at}
      <BrutalCard fill="white">
        <div class="score-head">
          <div class="score-readout" role="group" aria-label="Trust score">
            <span class="score-value">{card.trust_score}</span>
            <span class="score-denominator">/100</span>
          </div>
          <dl class="score-meta">
            <div class="score-meta-row">
              <dt>G2 quality bar</dt>
              <dd>
                <span class="bar-tag" class:bar-pass={g2Pass} class:bar-fail={!g2Pass}>
                  {g2Pass ? "MEETS BAR" : "BELOW BAR"}
                </span>
                {card.g2.ok_pct}% supported (target ≥{card.targets.ok_pct_min}%) ·
                {card.g2.unsupported_pct}% unsupported (max {card.targets.unsupported_pct_max}%)
              </dd>
            </div>
            <div class="score-meta-row">
              <dt>Last verified</dt>
              <dd>
                {#if neverVerified}
                  <!-- D-P1-2: "Never" is no longer a dead-end; link to the revalidate tool -->
                  <a href={REVALIDATE_HREF} class="action-link">Never — run validation →</a>
                {:else}
                  {fmtDate(card.last_verified_at!)}
                {/if}
              </dd>
            </div>
          </dl>
        </div>

        <ul class="metric-grid" aria-label="Scorecard metrics">
          <li>
            <a class="metric-link" href="{GRAPH_BASE}?filter=unbound" aria-label="Evidence-bound: {card.evidence.bound_pct}% — see unbound ideas">
              <span class="metric-value">{card.evidence.bound_pct}%</span>
              <span class="metric-label">Evidence-bound</span>
              <span class="metric-detail">{card.evidence.bound.toLocaleString()} of {card.units.toLocaleString()} ideas carry a re-checkable source span</span>
            </a>
          </li>
          <li>
            <a class="metric-link" href="{GRAPH_BASE}?filter=missing_embed" aria-label="Embedding coverage: {card.embedding.pct}% — see un-embedded ideas">
              <span class="metric-value">{card.embedding.pct}%</span>
              <span class="metric-label">Embedding coverage</span>
              <span class="metric-detail">{card.embedding.embedded.toLocaleString()} of {card.units.toLocaleString()} ideas embedded</span>
            </a>
          </li>
          <li>
            <a class="metric-link" href="{GRAPH_BASE}?filter=review" aria-label="Validated supported: {card.g2.ok} — triage flagged ideas">
              <span class="metric-value">{card.g2.ok}/{card.g2.ok + card.g2.weak + card.g2.unsupported}</span>
              <span class="metric-label">Validated supported</span>
              <span class="metric-detail">{card.g2.weak.toLocaleString()} weak · {card.g2.unsupported.toLocaleString()} unsupported</span>
            </a>
          </li>
          {#if card.temporal}
            <li>
              <span class="metric-value">{card.temporal.pct == null ? "—" : `${card.temporal.pct}%`}</span>
              <span class="metric-label">Temporal coverage</span>
              <span class="metric-detail">
                {#if card.temporal.versioned == null}
                  Store could not answer — version data unknown
                {:else}
                  {card.temporal.versioned.toLocaleString()} of {card.temporal.units.toLocaleString()} ideas carry validity windows (as-of ready)
                {/if}
              </span>
            </li>
          {/if}
          <li>
            <!-- D-P1-2: coverage-gap rows now link to the pipeline store step -->
            {#if card.coverage.validator_gaps != null || card.coverage.remediation_drops != null}
              <a class="metric-link" href={PIPELINE_STORE_HREF} aria-label="Coverage gaps — check graph store">
                <span class="metric-value">
                  {(card.coverage.validator_gaps ?? 0) + (card.coverage.remediation_drops ?? 0)}
                </span>
                <span class="metric-label">Coverage gaps</span>
                <span class="metric-detail">
                  {card.coverage.validator_gaps ?? "?"} validator omissions · {card.coverage.remediation_drops ?? "?"} remediation drops
                </span>
              </a>
            {:else}
              <span class="metric-value">—</span>
              <span class="metric-label">Coverage gaps</span>
              <span class="metric-detail">
                <!-- D-P1-2: dead-end resolved — link to the store config page -->
                Store could not answer — <a href={PIPELINE_STORE_HREF}>check graph store connection</a>
              </span>
            {/if}
          </li>
        </ul>

        <p class="states-label">Verification states</p>
        <ul class="state-chips" aria-label="Per-state idea counts">
          {#each STATE_ORDER as state (state)}
            {@const count = card.verification_states[state] ?? 0}
            <li class="state-chip state-{state}" class:state-zero={!count}>
              <a
                class="state-chip-link"
                href="{GRAPH_BASE}?filter={state}"
                aria-label="{count.toLocaleString()} {STATE_LABELS[state].toLowerCase()} ideas — view in explorer"
                tabindex={count === 0 ? -1 : undefined}
              >
                <span class="state-count">{count.toLocaleString()}</span>
                {STATE_LABELS[state]}
              </a>
            </li>
          {/each}
        </ul>

        <!-- W2.3: factor rails — each deduction row is a receipt that links to the ideas causing it -->
        <details class="lowered" open={lowered.length > 0}>
          <summary class="lowered-summary">What lowered this score</summary>
          {#if lowered.length === 0}
            <p class="lowered-none">Nothing — full marks on every factor.</p>
          {:else}
            <ul class="lowered-list">
              {#each lowered as factor (factor.id)}
                {@const href = factorHref(factor.id)}
                <li>
                  <span class="lowered-points" aria-label="minus {fmtPoints(factor.lost)} points">−{fmtPoints(factor.lost)} pts</span>
                  <span class="lowered-factor">{factor.label}</span>
                  <span class="lowered-attained">{fmtPoints(factor.points)} of {factor.max_points}</span>
                  {#if href}
                    <a class="lowered-drill" href={href} aria-label="Show ideas that caused this deduction">Show →</a>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        </details>

        <p class="scorecard-footnote">
          {card.trust_formula}. Computed {fmtDate(card.generated_at)} from the
          {card.store === "surreal" ? "SurrealDB graph store" : "Postgres graph spine"}.
        </p>
      </BrutalCard>
    {/if}
  {:catch}
    <!-- D-P2-2: recovery actions inside BrutalErrorBanner's actions snippet -->
    <BrutalErrorBanner
      title="Scorecard unavailable"
      message="Could not read the graph store to compute the trust scorecard. Your graph is unaffected — this is a read failure."
    >
      {#snippet actions()}
        <button type="button" class="btn btn-primary btn-sm" disabled={retrying} on:click={retry}>
          {retrying ? "Retrying…" : "Try again"}
        </button>
        <a class="btn btn-outline btn-sm" href={PIPELINE_STORE_HREF}>Check graph store</a>
      {/snippet}
    </BrutalErrorBanner>
  {/await}
</section>

<style>
  .scorecard {
    margin: 0 0 var(--space-5);
  }
  .scorecard-heading {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
    margin: 0 0 var(--space-3);
  }
  .score-head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--space-4);
    margin: 0 0 var(--space-4);
  }
  .score-readout {
    display: flex;
    align-items: baseline;
    border: var(--border);
    background: var(--brut-neon, var(--color-surface));
    box-shadow: var(--shadow-md);
    padding: var(--space-2) var(--space-3);
  }
  .score-value {
    font-family: var(--font-display);
    font-size: 2.5rem;
    font-weight: 900;
    line-height: 1;
  }
  .score-denominator {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    margin-left: var(--space-1);
    color: var(--color-ink-muted);
  }
  .score-meta {
    margin: 0;
    flex: 1;
    min-width: 14rem;
  }
  .score-meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin: 0 0 var(--space-2);
  }
  .score-meta dt {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    text-transform: uppercase;
    color: var(--color-ink-muted);
    min-width: 8.5rem;
  }
  .score-meta dd {
    margin: 0;
    font-size: var(--text-sm);
  }
  .action-link {
    color: var(--color-ink);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .bar-tag {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    border: var(--border);
    padding: 0 var(--space-1);
    margin-right: var(--space-2);
  }
  /* W2.3: defined state tokens — no --color-*-tint fallbacks */
  .bar-pass {
    background: var(--state-ok-bg);
    color: var(--state-ok-fg);
  }
  .bar-fail {
    background: var(--state-fail-bg);
    color: var(--state-fail-fg);
  }
  .metric-grid {
    list-style: none;
    margin: 0 0 var(--space-4);
    padding: 0;
    display: grid;
    gap: var(--space-2);
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  }
  .metric-grid li {
    border: var(--border);
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: var(--color-surface);
  }
  /* W2.3: metric cells are links so every number is a receipt that leads somewhere */
  .metric-link {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-2) var(--space-3);
    text-decoration: none;
    color: inherit;
    transition: background 0.1s ease;
  }
  .metric-link:hover {
    background: color-mix(in oklab, var(--color-yellow) 12%, var(--color-surface));
  }
  .metric-grid li > :not(.metric-link) {
    padding: var(--space-2) var(--space-3);
  }
  .metric-value {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 900;
  }
  .metric-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .metric-detail {
    font-size: var(--text-xs);
    color: var(--color-ink-muted);
    line-height: 1.4;
  }
  .states-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    text-transform: uppercase;
    color: var(--color-ink-muted);
    margin: 0 0 var(--space-1);
  }
  .state-chips {
    list-style: none;
    margin: 0 0 var(--space-4);
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .state-chip {
    border: var(--border);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    padding: 0;
    background: var(--color-surface);
  }
  /* W2.3: defined state tokens — no --color-*-tint hex fallbacks (D-P1-4) */
  .state-chip.state-supported {
    background: var(--state-ok-bg);
    color: var(--state-ok-fg);
    border-color: var(--state-ok-fg);
  }
  .state-chip.state-contradicted {
    background: var(--state-fail-bg);
    color: var(--state-fail-fg);
    border-color: var(--state-fail-fg);
  }
  .state-chip.state-unverified {
    background: var(--state-warn-bg);
    color: var(--state-warn-fg);
    border-color: var(--state-warn-fg);
  }
  .state-chip.state-zero {
    opacity: 0.45;
  }
  /* Chip is a link to the filtered explorer */
  .state-chip-link {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: 2px var(--space-2);
    text-decoration: none;
    color: inherit;
  }
  .state-chip-link:hover {
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .state-chip-link {
    color: inherit;
    text-decoration: none;
  }
  .state-chip-link:hover {
    text-decoration: underline;
  }
  .state-count {
    font-weight: 700;
  }
  .lowered {
    border: var(--border);
    padding: var(--space-2) var(--space-3);
    margin: 0 0 var(--space-3);
    background: var(--color-surface);
  }
  .lowered-summary {
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .lowered-none {
    margin: var(--space-2) 0 0;
    font-size: var(--text-sm);
    color: var(--color-ink-muted);
  }
  .lowered-list {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: 0;
  }
  .lowered-list li {
    display: flex;
    gap: var(--space-2);
    align-items: baseline;
    padding: var(--space-1) 0;
    border-bottom: 1px solid var(--rm-border, #ddd);
    font-size: var(--text-sm);
  }
  .lowered-list li:last-child {
    border-bottom: 0;
  }
  .lowered-points {
    font-family: var(--font-mono);
    font-weight: 700;
    min-width: 4.5rem;
    /* D-P2-1: color is not the only indicator — weight + minus glyph also signal severity */
    color: var(--state-fail-fg);
  }
  .lowered-factor {
    flex: 1;
  }
  .lowered-attained {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
  }
  /* W2.3: per-factor "Show →" deep-link — the receipt for each deduction */
  .lowered-drill {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    color: var(--color-ink);
    text-decoration: underline;
    text-underline-offset: 2px;
    white-space: nowrap;
  }
  .scorecard-footnote {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-ink-muted);
    line-height: 1.5;
  }
</style>
