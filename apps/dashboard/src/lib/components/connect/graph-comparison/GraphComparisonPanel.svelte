<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type {
    ChatRouteOption,
    QualityDelta,
    RetrievalSummary,
    SuggestedQuestion,
  } from "$lib/connect/graph-comparison-types";
  import { deriveAnswerVerdict } from "$lib/connect/graph-comparison-types";
  import { streamComparison } from "$lib/connect/comparison-stream";
  import { INGEST_FLOW_HREF, INGEST_ROUTES_HREF } from "$lib/nav-config";
  import ComparisonQuestion from "./ComparisonQuestion.svelte";
  import ResponsePanel from "./ResponsePanel.svelte";
  import VerdictBadge from "./VerdictBadge.svelte";
  import QualityDeltaPanel from "./QualityDelta.svelte";
  import ExportTraceLink from "./ExportTraceLink.svelte";

  export let graphNodeCount = 0;
  export let hasGraph = false;
  export let routes: ChatRouteOption[] = [];
  export let suggestCacheKey = "";
  export let proveBase = "/keys/dashboard/prove";
  /** Opaque workspace id (non-PII) threaded to the claim→span north metric. */
  export let workspaceId: string | null = null;
  /** True when the console is answering over the seeded first-run demo graph. */
  export let isDemo = false;
  /** Pre-authored demo questions (incl. a deliberate abstention) — first-run fallback. */
  export let demoQuestions: { type: "answerable" | "abstention"; question: string }[] = [];

  type PanelMode = "raw" | "graph";
  type PanelState = {
    status: "idle" | "retrieving" | "streaming" | "complete" | "error";
    text: string;
    model: { provider: string; model: string } | null;
    retrieval: RetrievalSummary | null;
    traceExportUrl: string | null;
    error: string | null;
  };

  const initialPanel = (): PanelState => ({
    status: "idle",
    text: "",
    model: null,
    retrieval: null,
    traceExportUrl: null,
    error: null,
  });

  let selectedRouteId = routes[0]?.id ?? "";
  let question = "";
  let running = false;

  /**
   * Depth toggle (Stage 1 reframe): the verified answer is the hero by default;
   * the raw-vs-graph side-by-side is opt-in depth, not the framing. Turning it on
   * also streams the baseline so the quality delta can be computed.
   */
  let showComparison = false;

  let panelRaw: PanelState = initialPanel();
  let panelGraph: PanelState = initialPanel();
  let delta: QualityDelta | null = null;
  let deltaLoading = false;

  let suggestions: SuggestedQuestion[] = [];
  let suggestionsLoading = false;
  let suggestionsFailed = false;

  let lastQuestion = "";
  let lastSeeds: string[] = [];
  const controllers: Partial<Record<PanelMode, AbortController>> = {};

  $: noRoutes = routes.length === 0;
  $: hasAnswer = panelGraph.status === "complete";
  // The verdict is derived from the verified answer's retrieved claims (or null
  // when retrieval failed entirely — distinct from a designed abstention).
  $: verdict = hasAnswer ? deriveAnswerVerdict(panelGraph.retrieval) : null;

  function setPanel(mode: PanelMode, next: PanelState): void {
    if (mode === "raw") panelRaw = next;
    else panelGraph = next;
  }
  function updatePanel(mode: PanelMode, fn: (p: PanelState) => PanelState): void {
    if (mode === "raw") panelRaw = fn(panelRaw);
    else panelGraph = fn(panelGraph);
  }

  function errMessage(e: unknown): string {
    return e instanceof Error ? e.message : "Unknown error";
  }

  async function streamOne(mode: PanelMode): Promise<void> {
    const isGraph = mode === "graph";
    controllers[mode]?.abort();
    const ac = new AbortController();
    controllers[mode] = ac;

    setPanel(mode, {
      status: isGraph ? "retrieving" : "streaming",
      text: "",
      model: null,
      retrieval: null,
      traceExportUrl: null,
      error: null,
    });

    try {
      const { retrieval, traceExportUrl } = await streamComparison({
        proveBase,
        mode,
        question: lastQuestion,
        routeId: selectedRouteId || undefined,
        seedNodeIds: isGraph ? lastSeeds : undefined,
        signal: ac.signal,
        onModel: (m) => updatePanel(mode, (p) => ({ ...p, model: m })),
        onRetrieval: (s) => updatePanel(mode, (p) => ({ ...p, retrieval: s, status: "streaming" })),
        onTrace: (t) => updatePanel(mode, (p) => ({ ...p, traceExportUrl: t.exportUrl })),
        onDelta: (t) => updatePanel(mode, (p) => ({ ...p, text: p.text + t, status: "streaming" })),
      });
      updatePanel(mode, (p) => ({
        ...p,
        status: "complete",
        retrieval: retrieval ?? p.retrieval,
        traceExportUrl: traceExportUrl ?? p.traceExportUrl,
      }));
    } catch (e) {
      if (ac.signal.aborted) return; // superseded by a newer run
      updatePanel(mode, (p) => ({ ...p, status: "error", error: errMessage(e) }));
    }
  }

  async function maybeRunDelta(): Promise<void> {
    if (!showComparison) return;
    if (panelRaw.status !== "complete" || panelGraph.status !== "complete") return;
    deltaLoading = true;
    try {
      const res = await fetch(`${proveBase}/api/delta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: lastQuestion,
          responseA: panelRaw.text,
          responseB: panelGraph.text,
          claims: panelGraph.retrieval?.claims.map((c) => c.text) ?? [],
          routeId: selectedRouteId || undefined,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { delta?: QualityDelta };
        delta = data.delta ?? null;
      }
    } catch {
      delta = null;
    } finally {
      deltaLoading = false;
    }
  }

  /**
   * Ask → verified answer. The graph-grounded answer always streams (the hero);
   * the raw baseline only streams when the depth toggle is on, so the default
   * experience is "one verified answer", not "compare two boxes".
   */
  async function ask(q: string, seeds: string[] = []): Promise<void> {
    if (!q.trim() || noRoutes) return;
    lastQuestion = q.trim();
    lastSeeds = seeds;
    question = q;
    delta = null;
    running = true;
    const jobs = showComparison ? [streamOne("graph"), streamOne("raw")] : [streamOne("graph")];
    await Promise.allSettled(jobs);
    running = false;
    await maybeRunDelta();
  }

  async function retry(mode: PanelMode): Promise<void> {
    delta = null;
    await streamOne(mode);
    await maybeRunDelta();
  }

  /** Reveal the baseline on demand: stream it for the current answer, then delta. */
  async function enableComparison(): Promise<void> {
    showComparison = true;
    if (!lastQuestion) return;
    if (panelRaw.status === "idle" || panelRaw.status === "error") {
      await streamOne("raw");
    }
    await maybeRunDelta();
  }

  function handleSelectSuggestion(suggestion: SuggestedQuestion): void {
    void ask(suggestion.question, suggestion.seedNodeIds);
  }

  /** Map the pre-authored demo questions into the suggestion shape (no seeds). */
  function demoToSuggestions(): SuggestedQuestion[] {
    return demoQuestions.map((q, i) => ({
      id: `demo-${i}`,
      question: q.question,
      type: q.type === "abstention" ? "generic" : ("A" as const),
      seedNodeIds: [],
    }));
  }

  async function loadSuggestions(): Promise<void> {
    if (!hasGraph) return;
    suggestionsLoading = true;
    suggestionsFailed = false;
    try {
      const res = await fetch(`${proveBase}/api/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cacheKey: suggestCacheKey }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { questions?: SuggestedQuestion[] };
      const generated = data.questions ?? [];
      // First-run/demo fallback: if the generator returns nothing (e.g. no chat
      // route yet), surface the curated demo questions incl. the abstention demo.
      suggestions = generated.length > 0 ? generated : demoToSuggestions();
    } catch {
      // Never leave a first-run user with an empty console: fall back to the demo
      // questions when the generator errors.
      if (demoQuestions.length > 0) {
        suggestions = demoToSuggestions();
        suggestionsFailed = false;
      } else {
        suggestionsFailed = true;
      }
    } finally {
      suggestionsLoading = false;
    }
  }

  onMount(() => {
    void loadSuggestions();
  });

  onDestroy(() => {
    controllers.raw?.abort();
    controllers.graph?.abort();
  });
</script>

<section class="proof">
  <header class="proof-head">
    <div class="proof-headings">
      <span class="proof-tag">ASK · GET A VERIFIED ANSWER</span>
      <p class="proof-lede">
        Ask a question — get an answer bound to verified claims, each quoting its source.
      </p>
    </div>
    {#if !noRoutes}
      <label class="route-picker">
        <span class="route-label">MODEL</span>
        <select bind:value={selectedRouteId} class="route-select brut-focus" disabled={running}>
          {#each routes as route (route.id)}
            <option value={route.id}>
              {route.name}{route.model ? ` · ${route.model}` : ""}
            </option>
          {/each}
        </select>
      </label>
    {/if}
  </header>

  {#if isDemo && hasGraph}
    <p class="demo-banner">
      <strong>Demo graph.</strong> You're asking a small pre-loaded knowledge graph so you can see a
      verified answer right away — connect your own sources to answer over your data.
    </p>
  {/if}

  {#if !hasGraph}
    <div class="empty">
      <h2 class="empty-title">NOTHING TO ANSWER FROM YET</h2>
      <p class="empty-body">
        Connect a source and run your first ingest to build a knowledge graph, then ask it a question
        here to get a verified, cited answer.
      </p>
      <a class="empty-cta brut-pressable brut-focus" href={INGEST_FLOW_HREF}>
        START YOUR FIRST RUN →
      </a>
    </div>
  {:else if noRoutes}
    <div class="notice">
      <p>
        Configure a model route in
        <a href={INGEST_ROUTES_HREF}>Ingest routes</a>
        before asking your graph a question.
      </p>
    </div>
  {:else}
    <ComparisonQuestion
      bind:value={question}
      {running}
      graphEmpty={graphNodeCount === 0}
      {suggestions}
      {suggestionsLoading}
      {suggestionsFailed}
      onCompare={(q) => ask(q)}
      onSelectSuggestion={handleSelectSuggestion}
    />

    {#if verdict}
      <VerdictBadge summary={verdict} />
    {/if}

    <!-- Hero: the verified answer. The raw baseline is opt-in depth (below). -->
    <div class="answer">
      <ResponsePanel
        variant="graph"
        status={panelGraph.status}
        text={panelGraph.text}
        model={panelGraph.model}
        retrieval={panelGraph.retrieval}
        error={panelGraph.error}
        onRetry={() => retry("graph")}
        {workspaceId}
      />
    </div>

    {#if panelGraph.status === "complete" && panelGraph.traceExportUrl}
      <div class="trace-row">
        <ExportTraceLink href={panelGraph.traceExportUrl} />
      </div>
    {/if}

    <!-- Optional depth: compare the same question without the graph. -->
    {#if hasAnswer || showComparison}
      <div class="depth">
        {#if !showComparison}
          <button type="button" class="depth-toggle brut-focus" on:click={enableComparison}>
            COMPARE WITHOUT THE GRAPH →
          </button>
        {:else}
          <div class="depth-head">
            <span class="depth-label">WITHOUT THE GRAPH (BASELINE)</span>
            <button
              type="button"
              class="depth-toggle depth-toggle-hide brut-focus"
              on:click={() => (showComparison = false)}
            >
              HIDE
            </button>
          </div>
          <ResponsePanel
            variant="raw"
            status={panelRaw.status}
            text={panelRaw.text}
            model={panelRaw.model}
            error={panelRaw.error}
            onRetry={() => retry("raw")}
          />
          {#if delta}
            <QualityDeltaPanel {delta} />
          {:else if deltaLoading}
            <p class="delta-pending">Analysing the difference…</p>
          {/if}
        {/if}
      </div>
    {/if}
  {/if}
</section>

<style>
  .proof {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    padding: var(--space-6) 0;
  }

  .proof-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .proof-headings {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .proof-tag {
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-ink);
  }

  .proof-lede {
    margin: 0;
    font-family: var(--font-body);
    font-size: var(--text-body-md);
    line-height: 1.5;
    color: var(--color-ink-muted);
  }

  .demo-banner {
    margin: 0;
    padding: var(--space-3) var(--space-4);
    border: var(--border);
    border-left-width: 6px;
    background: var(--color-yellow);
    color: var(--color-ink);
    font-family: var(--font-body);
    font-size: var(--text-body-sm);
    line-height: 1.5;
  }

  .answer {
    display: block;
  }

  .depth {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .depth-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .depth-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-ink-faint);
  }

  .depth-toggle {
    align-self: flex-start;
    background: var(--color-surface);
    border: var(--border-thin);
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-ink);
  }
  .depth-toggle-hide {
    color: var(--color-blue);
  }

  .route-picker {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }
  .route-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-ink-faint);
  }
  .route-select {
    border: var(--border);
    border-radius: 0;
    background: var(--color-surface);
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    padding: var(--space-2) var(--space-3);
  }

  .trace-row {
    display: flex;
    justify-content: flex-end;
  }

  .delta-pending {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-ink-faint);
    animation: pulse 1.4s ease-in-out infinite;
  }

  .empty {
    border: var(--border);
    box-shadow: var(--shadow-md);
    background: var(--color-surface);
    padding: var(--space-8) var(--space-6);
    text-align: center;
  }
  .empty-title {
    margin: 0 0 var(--space-3);
    font-family: var(--font-display);
    font-size: var(--text-display-md);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
    line-height: var(--text-display-line-height);
    color: var(--color-ink);
  }
  .empty-body {
    margin: 0 auto var(--space-5);
    max-width: 42rem;
    font-family: var(--font-body);
    font-size: var(--text-body-md);
    line-height: 1.6;
    color: var(--color-ink-muted);
  }
  .empty-cta {
    display: inline-block;
    padding: var(--space-3) var(--space-5);
    border: var(--border);
    border-radius: 0;
    background: var(--color-yellow);
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    text-decoration: none;
  }

  .notice {
    border: var(--border);
    background: var(--color-surface);
    padding: var(--space-4);
    font-family: var(--font-body);
    font-size: var(--text-body-md);
    color: var(--color-ink-muted);
  }
  .notice a {
    color: var(--color-blue);
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.45;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .delta-pending {
      animation: none;
    }
  }
</style>
