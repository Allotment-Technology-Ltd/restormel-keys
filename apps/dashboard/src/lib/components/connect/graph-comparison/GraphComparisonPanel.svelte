<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type {
    ChatRouteOption,
    QualityDelta,
    RetrievalSummary,
    SuggestedQuestion,
  } from "$lib/connect/graph-comparison-types";
  import { streamComparison } from "$lib/connect/comparison-stream";
  import ComparisonQuestion from "./ComparisonQuestion.svelte";
  import ResponsePanel from "./ResponsePanel.svelte";
  import QualityDeltaPanel from "./QualityDelta.svelte";

  export let graphNodeCount = 0;
  export let hasGraph = false;
  export let routes: ChatRouteOption[] = [];
  export let suggestCacheKey = "";
  export let connectBase = "/keys/dashboard/connect";

  type PanelMode = "raw" | "graph";
  type PanelState = {
    status: "idle" | "retrieving" | "streaming" | "complete" | "error";
    text: string;
    model: { provider: string; model: string } | null;
    retrieval: RetrievalSummary | null;
    error: string | null;
  };

  const initialPanel = (): PanelState => ({
    status: "idle",
    text: "",
    model: null,
    retrieval: null,
    error: null,
  });

  let selectedRouteId = routes[0]?.id ?? "";
  let question = "";
  let running = false;

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
      error: null,
    });

    try {
      const { retrieval } = await streamComparison({
        connectBase,
        mode,
        question: lastQuestion,
        routeId: selectedRouteId || undefined,
        seedNodeIds: isGraph ? lastSeeds : undefined,
        signal: ac.signal,
        onModel: (m) => updatePanel(mode, (p) => ({ ...p, model: m })),
        onRetrieval: (s) => updatePanel(mode, (p) => ({ ...p, retrieval: s, status: "streaming" })),
        onDelta: (t) => updatePanel(mode, (p) => ({ ...p, text: p.text + t, status: "streaming" })),
      });
      updatePanel(mode, (p) => ({
        ...p,
        status: "complete",
        retrieval: retrieval ?? p.retrieval,
      }));
    } catch (e) {
      if (ac.signal.aborted) return; // superseded by a newer run
      updatePanel(mode, (p) => ({ ...p, status: "error", error: errMessage(e) }));
    }
  }

  async function maybeRunDelta(): Promise<void> {
    if (panelRaw.status !== "complete" || panelGraph.status !== "complete") return;
    deltaLoading = true;
    try {
      const res = await fetch(`${connectBase}/proof/api/delta`, {
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

  async function runComparison(q: string, seeds: string[] = []): Promise<void> {
    if (!q.trim() || noRoutes) return;
    lastQuestion = q.trim();
    lastSeeds = seeds;
    question = q;
    delta = null;
    running = true;
    await Promise.allSettled([streamOne("raw"), streamOne("graph")]);
    running = false;
    await maybeRunDelta();
  }

  async function retry(mode: PanelMode): Promise<void> {
    delta = null;
    await streamOne(mode);
    await maybeRunDelta();
  }

  function handleSelectSuggestion(suggestion: SuggestedQuestion): void {
    void runComparison(suggestion.question, suggestion.seedNodeIds);
  }

  async function loadSuggestions(): Promise<void> {
    if (!hasGraph) return;
    suggestionsLoading = true;
    suggestionsFailed = false;
    try {
      const res = await fetch(`${connectBase}/proof/api/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cacheKey: suggestCacheKey }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { questions?: SuggestedQuestion[] };
      suggestions = data.questions ?? [];
    } catch {
      suggestionsFailed = true;
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
    <span class="proof-tag">PROVE YOUR GRAPH</span>
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

  {#if !hasGraph}
    <div class="empty">
      <h2 class="empty-title">YOUR GRAPH HAS NOTHING TO COMPARE YET</h2>
      <p class="empty-body">
        Run your first ingest to build your knowledge graph, then come back here to see what it knows.
      </p>
      <a class="empty-cta brut-pressable brut-focus" href={`${connectBase}/pipeline`}>
        START YOUR FIRST RUN →
      </a>
    </div>
  {:else if noRoutes}
    <div class="notice">
      <p>
        Configure a model route in
        <a href={`${connectBase}/models`}>Ingest routes</a>
        before testing your graph.
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
      onCompare={(q) => runComparison(q)}
      onSelectSuggestion={handleSelectSuggestion}
    />

    <div class="panels">
      <ResponsePanel
        variant="raw"
        status={panelRaw.status}
        text={panelRaw.text}
        model={panelRaw.model}
        error={panelRaw.error}
        onRetry={() => retry("raw")}
      />
      <ResponsePanel
        variant="graph"
        status={panelGraph.status}
        text={panelGraph.text}
        model={panelGraph.model}
        retrieval={panelGraph.retrieval}
        error={panelGraph.error}
        onRetry={() => retry("graph")}
      />
    </div>

    {#if delta}
      <QualityDeltaPanel {delta} />
    {:else if deltaLoading}
      <p class="delta-pending">Analysing the difference…</p>
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

  .proof-tag {
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-ink);
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

  .panels {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
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

  @media (max-width: 860px) {
    .panels {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .delta-pending {
      animation: none;
    }
  }
</style>
