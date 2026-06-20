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
  import FirstRunStrip from "./FirstRunStrip.svelte";
  import GetCodePanel from "./GetCodePanel.svelte";
  import RoutingStrip from "./RoutingStrip.svelte";
  import CrossModelDisclosure from "./CrossModelDisclosure.svelte";
  import PublishConfigPanel from "./PublishConfigPanel.svelte";

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
  /** Project scope for the "Get Code" snippet (matches the Gateway key project). */
  export let projectId: string | null = null;
  /** Non-secret Gateway key prefix (`rk_xxxxxxxx…`) shown as a hint in "Get Code". Never the full key. */
  export let keyPrefixHint: string | null = null;
  /** Public Connect API origin for the "Get Code" snippet. */
  export let connectApiBase = "https://restormel.dev";

  /** First-run strip is shown until dismissed; only meaningful over the demo graph. */
  let firstRunDismissed = false;

  /**
   * Stage 4 — inline routing context shared by the strip, the cross-model
   * disclosure, and the publish panel. The validation provider grounds the
   * "validated by …" claim; the publish counts drive the "go live" action. These
   * are fetched once (and re-fetched after any model change / publish) from the
   * routing-strip snapshot — the same source of truth the strip renders.
   */
  let routingValidationProvider: string | null = null;
  let routingNeedsPublish = 0;
  let routingHasLive = false;
  /** RoutingStrip instance — its reload() refreshes the strip after publish/change. */
  let routingStripRef: { reload: () => Promise<void> } | undefined;

  /** Pull the validation provider + publish state for disclosure/publish surfaces. */
  async function refreshRoutingContext(): Promise<void> {
    try {
      const res = await fetch("/keys/dashboard/prove/api/routing-strip");
      if (!res.ok) return;
      const snap = (await res.json()) as {
        validationProvider?: string | null;
        needsPublishCount?: number;
        stages?: { isChat: boolean; isPublished: boolean; modelId: string | null }[];
      };
      routingValidationProvider = snap.validationProvider ?? null;
      routingNeedsPublish = snap.needsPublishCount ?? 0;
      routingHasLive = (snap.stages ?? []).some(
        (s) => s.isChat && s.isPublished && !!s.modelId,
      );
    } catch {
      /* non-fatal — disclosure simply omits the validator side */
    }
  }

  /** A stage's model changed (or config published) — refresh strip + context. */
  async function onRoutingChanged(): Promise<void> {
    await Promise.allSettled([
      refreshRoutingContext(),
      routingStripRef?.reload() ?? Promise.resolve(),
    ]);
  }

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

  /**
   * First-run (Phase 3 Stage 2): one-tap a curated demo question — including the
   * deliberate abstention — straight into the same ask() path, so the very first
   * action lands a verified (or honestly-abstained) answer with citations. This is
   * the SAME flow as a typed question, so the claim→span north metric fires
   * unchanged (ProvenanceDrawer wiring); no metric is duplicated here.
   */
  function runFirstRunQuestion(q: string): void {
    firstRunDismissed = true; // value is on screen — collapse the prompt, don't block
    void ask(q);
  }

  // Show the first-run strip only over the demo graph, before any answer, until the
  // user dismisses it or asks something. Non-blocking: it sits above the input, never
  // a modal, and the input stays fully usable while it is shown.
  $: showFirstRun =
    isDemo &&
    hasGraph &&
    !noRoutes &&
    !firstRunDismissed &&
    demoQuestions.length > 0 &&
    panelGraph.status === "idle";

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
    if (!noRoutes) void refreshRoutingContext();
  });

  onDestroy(() => {
    controllers.raw?.abort();
    controllers.graph?.abort();
  });
</script>

<section class="proof">
  <header class="proof-head">
    <div class="proof-headings">
      <span class="proof-tag">ASK YOUR SOURCES · GET AN ANSWER YOU CAN TRUST</span>
      <p class="proof-lede">
        Ask your sources a question. The answer comes back bound to verified claims — click any
        one to the exact quote it came from. Happy with it? Ship the same query into your app.
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
      <strong>This is a demo graph to play with.</strong> Ask it anything below and watch a verified,
      cited answer come back right away — no setup. When you're ready, connect your own sources and
      ask over your data instead.
    </p>
  {/if}

  {#if !hasGraph}
    <div class="empty">
      <h2 class="empty-title">CONNECT A SOURCE TO ASK</h2>
      <p class="empty-body">
        Point Restormel at a source — a doc, a URL, a connector — and it builds a knowledge graph in
        the background. Then ask it anything here and get an answer bound to verified claims, each one
        clickable straight to its source quote.
      </p>
      <a class="empty-cta brut-pressable brut-focus" href={INGEST_FLOW_HREF}>
        CONNECT YOUR FIRST SOURCE →
      </a>
    </div>
  {:else if noRoutes}
    <div class="notice">
      <p>
        Pick a model in
        <a href={INGEST_ROUTES_HREF}>Ingest routes</a>
        and you're ready to ask your sources a question.
      </p>
    </div>
  {:else}
    {#if showFirstRun}
      <FirstRunStrip
        questions={demoQuestions}
        disabled={running}
        onRun={runFirstRunQuestion}
        onDismiss={() => (firstRunDismissed = true)}
      />
    {/if}

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

    <!-- Stage 4: the routing strip sits in service of the query — the models behind
         the answer, changeable in-context without a screen-hop. -->
    <RoutingStrip bind:this={routingStripRef} on:changed={onRoutingChanged} />

    {#if verdict}
      <VerdictBadge summary={verdict} />
    {/if}

    <!-- Stage 4: cross-model disclosure ties routing to the verdict. Grounded in the
         live answer model + the applied validation model; only asserts cross-family
         when both are known, different families. -->
    {#if hasAnswer && panelGraph.model}
      <CrossModelDisclosure
        answerProvider={panelGraph.model.provider}
        validationProvider={routingValidationProvider}
        claimCount={panelGraph.retrieval?.claims.length ?? 0}
      />
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

    <!-- Publish = config deploy (Stage 4): promote THIS routing to a live endpoint
         the user's app calls. Resolves the publish-stranding (K-P0-3) for the common
         case without hopping into the advanced route builder. Sits just above
         Get-Code: publish first, then copy the snippet that calls the live config. -->
    {#if panelGraph.status === "complete" && workspaceId && lastQuestion}
      <PublishConfigPanel
        needsPublishCount={routingNeedsPublish}
        hasLiveConfig={routingHasLive}
        on:published={onRoutingChanged}
      />
    {/if}

    <!-- Get Code (Stage 2): once an answer renders, the console becomes the API
         on-ramp — a copy-paste snippet reproducing THIS retrieve_context query.
         The key is never embedded; the snippet reads it from the environment. -->
    {#if panelGraph.status === "complete" && workspaceId && lastQuestion}
      <GetCodePanel
        {workspaceId}
        question={lastQuestion}
        {projectId}
        {keyPrefixHint}
        apiBase={connectApiBase}
      />
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
