<script lang="ts">
  /**
   * Traces — "what my app actually asked" (Phase 3 Stage 5).
   *
   * Each row is the SAME verified-query entity the Answer Console produced: the question, the
   * trust VERDICT (reusing the console's VerdictBadge + vocabulary), the cited sources, the real
   * answer-stage model, and timing. Abstentions are flagged distinctly — a designed state, a
   * feature, not a failure. Console ↔ Traces share one provenance + verdict language, so they
   * read as one product: every row links back to the console and to the exact same provenance
   * trace the console can export.
   */
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { ANSWER_CONSOLE_HREF } from "$lib/nav-config";
  import BrutalPageHeader from "$lib/components/brutalist/BrutalPageHeader.svelte";
  import BrutalButton from "$lib/components/brutalist/BrutalButton.svelte";
  import VerdictBadge from "$lib/components/connect/graph-comparison/VerdictBadge.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import type { TraceListItem } from "$lib/server/connect-traces";
  import type { AnswerVerdictSummary } from "$lib/connect/graph-comparison-types";

  export let data: {
    traces: TraceListItem[];
    projectOptions: { id: string; name: string }[];
    filter: { projectId: string | null; verdict: string | null };
    workspaceId: string | null;
    error: string | null;
  };

  /** Adapt the trace verdict into the exact summary shape the console's VerdictBadge renders. */
  function toBadgeSummary(t: TraceListItem): AnswerVerdictSummary {
    const v = t.verdict;
    const detail =
      v.verdict === "abstained"
        ? "No verified claim in your graph matched this question — the answer was not graph-grounded."
        : v.verdict === "uncertain"
          ? `${v.supportedCount} supported, ${v.weakCount} weaker — the cited sources were flagged for review.`
          : `Bound to ${v.supportedCount} verified ${v.supportedCount === 1 ? "claim" : "claims"}, each quoting its source.`;
    return {
      verdict: v.verdict,
      label: v.label,
      detail,
      supportedCount: v.supportedCount,
      weakCount: v.weakCount,
      totalClaims: v.totalIncluded,
    };
  }

  function projectName(id: string | null): string {
    if (!id) return "—";
    return data.projectOptions.find((p) => p.id === id)?.name ?? "Unknown project";
  }

  function relativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return iso;
    const diff = Date.now() - then;
    const mins = Math.round(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.round(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(then).toLocaleDateString();
  }

  /** Build a filtered URL, preserving the other filter. */
  function filterHref(next: { projectId?: string | null; verdict?: string | null }): string {
    const q = new URLSearchParams();
    const projectId = next.projectId !== undefined ? next.projectId : data.filter.projectId;
    const verdict = next.verdict !== undefined ? next.verdict : data.filter.verdict;
    if (projectId) q.set("projectId", projectId);
    if (verdict) q.set("verdict", verdict);
    const qs = q.toString();
    return qs ? `?${qs}` : DASHBOARD_BASE + "/traces";
  }

  /** Export the same provenance trace the console produces, via the existing Connect v1 endpoint. */
  function exportHref(traceId: string, projectId: string | null): string {
    const q = new URLSearchParams({ format: "json" });
    if (data.workspaceId) q.set("workspace_id", data.workspaceId);
    if (projectId) q.set("project_id", projectId);
    return `/connect/v1/traces/${traceId}/export?${q.toString()}`;
  }

  const VERDICT_TABS: { id: string | null; label: string }[] = [
    { id: null, label: "All" },
    { id: "grounded", label: "Grounded" },
    { id: "uncertain", label: "Uncertain" },
    { id: "abstained", label: "Abstained" },
  ];

  $: abstentionCount = data.traces.filter((t) => t.verdict.abstained).length;
</script>

<svelte:head><title>Traces · Restormel Keys</title></svelte:head>

<section class="traces">
  <BrutalPageHeader
    kicker="Observe"
    title="Traces"
    description="What your app actually asked. Every verified query — the same entity the Answer Console produced — with its trust verdict, cited sources, and the model that answered. Abstentions are flagged on purpose: an honest decline is a feature."
  >
    {#snippet actions()}
      <BrutalButton href={ANSWER_CONSOLE_HREF} variant="blue">Open Answer Console</BrutalButton>
    {/snippet}
  </BrutalPageHeader>

  <!-- Honest data-coverage note: say plainly what is real vs not-yet-captured. -->
  <p class="coverage" role="note">
    <strong>What's recorded:</strong> the question, the verdict, cited sources, and the model that
    answered come straight from each query's provenance trace.
    <strong>Not yet captured:</strong> per-query cost and the gateway key / route are not written to
    the verified-query trace today, and retrieval/embedding models aren't recorded per stage — so
    those columns are intentionally omitted rather than estimated.
  </p>

  {#if data.error}
    <div class="banner" role="alert">{data.error}</div>
  {/if}

  <!-- Filter bar: verdict tabs (abstentions are a first-class filter) + project scope. -->
  <div class="filters">
    <div class="tabs" role="tablist" aria-label="Filter by verdict">
      {#each VERDICT_TABS as tab}
        <a
          class="tab tab-{tab.id ?? 'all'}"
          class:tab-active={(data.filter.verdict ?? null) === tab.id}
          href={filterHref({ verdict: tab.id })}
          role="tab"
          aria-selected={(data.filter.verdict ?? null) === tab.id}
        >
          {tab.label}
          {#if tab.id === "abstained" && abstentionCount > 0}
            <span class="tab-count">{abstentionCount}</span>
          {/if}
        </a>
      {/each}
    </div>

    {#if data.projectOptions.length > 0}
      <div class="project-filter">
        <span class="filter-label">Project</span>
        <a
          class="chip"
          class:chip-active={!data.filter.projectId}
          href={filterHref({ projectId: null })}>All</a
        >
        {#each data.projectOptions as p}
          <a
            class="chip"
            class:chip-active={data.filter.projectId === p.id}
            href={filterHref({ projectId: p.id })}>{p.name}</a
          >
        {/each}
      </div>
    {/if}
  </div>

  {#if data.traces.length === 0 && !data.error}
    <EmptyState
      title="No verified queries yet"
      description="Ask a question in the Answer Console — verified or honestly abstained — and it lands here as a trace your app can be audited against."
    >
      {#snippet children()}
        <BrutalButton href={ANSWER_CONSOLE_HREF} variant="blue">Ask the first question</BrutalButton>
      {/snippet}
    </EmptyState>
  {:else}
    <ol class="ledger">
      {#each data.traces as t (t.traceId)}
        <li class="trace" class:trace-abstained={t.verdict.abstained}>
          <div class="trace-cap">
            <span class="trace-id mono" title={t.traceId}>{t.traceId.slice(0, 8)}</span>
            <span class="trace-time mono">{relativeTime(t.queriedAt)}</span>
            <span class="trace-project mono">{projectName(t.projectId)}</span>
          </div>

          <p class="trace-q">{t.query}</p>

          <VerdictBadge summary={toBadgeSummary(t)} />

          <div class="trace-meta">
            <div class="meta-block">
              <span class="meta-label mono">Cited sources</span>
              {#if t.citedSourceCount === 0}
                <span class="meta-empty">None (abstained)</span>
              {:else}
                <ul class="sources">
                  {#each t.citedSources as src}
                    <li class="source-card">{src}</li>
                  {/each}
                  {#if t.citedSourceCount > t.citedSources.length}
                    <li class="source-more mono">
                      +{t.citedSourceCount - t.citedSources.length}
                    </li>
                  {/if}
                </ul>
              {/if}
            </div>

            <div class="meta-block">
              <span class="meta-label mono">Answer model</span>
              {#if t.answerModel}
                <span class="meta-value mono">{t.answerModel.provider} · {t.answerModel.model}</span
                >
              {:else}
                <span class="meta-empty">Not recorded</span>
              {/if}
            </div>

            <div class="meta-block">
              <span class="meta-label mono">Evidence</span>
              <span class="meta-value mono"
                >{t.claimsRetrieved} kept{#if t.claimsFiltered > 0} · {t.claimsFiltered} filtered{/if}</span
              >
            </div>

            <div class="meta-block">
              <span class="meta-label mono">Graph store</span>
              <span class="meta-value mono">{t.graphStoreType}</span>
            </div>
          </div>

          <div class="trace-actions">
            <BrutalButton href={exportHref(t.traceId, t.projectId)} variant="outline"
              >Export trace</BrutalButton
            >
            <a class="ask-again" href={`${ANSWER_CONSOLE_HREF}`}>Re-ask in console →</a>
          </div>
        </li>
      {/each}
    </ol>
  {/if}
</section>

<style>
  .traces {
    max-width: 72rem;
    margin: 0 auto;
    padding: var(--space-6) var(--space-4) var(--space-8);
  }

  .mono {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    letter-spacing: var(--text-mono-tracking);
  }

  .coverage {
    margin: 0 0 var(--space-5);
    padding: var(--space-3) var(--space-4);
    border: var(--border-thin);
    background: var(--color-canvas, #f3ead0);
    font-family: var(--font-body);
    font-size: var(--text-body-sm);
    line-height: 1.5;
    color: var(--color-ink);
  }
  .coverage strong {
    font-weight: 800;
  }

  .banner {
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    border: var(--border);
    background: var(--state-fail-bg);
    color: var(--state-fail-fg);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
  }

  /* ── Filter bar ── */
  .filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin: 0 0 var(--space-5);
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0;
    border: var(--border);
    box-shadow: var(--shadow-sm, var(--shadow-md));
  }
  .tab {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    padding: 0 var(--space-3);
    border-right: var(--border-thin);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    text-decoration: none;
    color: var(--color-ink);
    background: var(--color-white, #fff);
  }
  .tab:last-child {
    border-right: none;
  }
  .tab-active {
    background: var(--color-ink);
    color: var(--color-canvas, #f3ead0);
  }
  .tab-abstained.tab-active {
    background: var(--state-fail-fg);
    color: #fff;
  }
  .tab-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border: var(--border-thin);
    background: var(--state-fail-bg);
    color: var(--state-fail-fg);
    font-size: 0.65rem;
  }

  .project-filter {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .filter-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-ink-muted);
  }
  .chip {
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    padding: 0 var(--space-2);
    border: var(--border-thin);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    text-decoration: none;
    color: var(--color-ink);
    background: var(--color-white, #fff);
  }
  .chip-active {
    background: var(--color-yellow, #ffe600);
    color: var(--color-ink);
    font-weight: 700;
  }

  /* ── Ledger ── */
  .ledger {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .trace {
    border: var(--border);
    box-shadow: var(--shadow-md);
    background: var(--color-white, #fff);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  /* Abstentions read distinctly — a flagged, first-class state, not buried. */
  .trace-abstained {
    border-left: 6px solid var(--state-fail-fg);
  }

  .trace-cap {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-3);
    color: var(--color-ink-muted);
    text-transform: uppercase;
  }
  .trace-id {
    color: var(--color-ink);
    font-weight: 700;
  }

  .trace-q {
    margin: 0;
    font-family: var(--font-display, var(--font-body));
    font-size: var(--text-body-lg, 1.125rem);
    font-weight: 700;
    line-height: 1.35;
    color: var(--color-ink);
  }

  .trace-meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: var(--space-3);
    padding-top: var(--space-1);
  }
  .meta-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .meta-label {
    text-transform: uppercase;
    color: var(--color-ink-muted);
  }
  .meta-value {
    color: var(--color-ink);
  }
  .meta-empty {
    font-family: var(--font-body);
    font-size: var(--text-body-sm);
    font-style: italic;
    color: var(--color-ink-muted);
  }
  .sources {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }
  .source-card {
    padding: 2px var(--space-2);
    border: var(--border-thin);
    background: var(--color-canvas, #f3ead0);
    font-family: var(--font-body);
    font-size: var(--text-body-sm);
    max-width: 18rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .source-more {
    padding: 2px var(--space-2);
    color: var(--color-ink-muted);
  }

  .trace-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    padding-top: var(--space-2);
    border-top: var(--border-thin);
  }
  .ask-again {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    text-decoration: none;
    color: var(--color-ink);
  }
  .ask-again:hover {
    text-decoration: underline;
  }
</style>
