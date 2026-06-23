<script lang="ts">
  /**
   * R5: Agents / Catalogs tab.
   * Merges /dev-tools/cli, /dev-tools/mcp (W2.4 generated catalog), and /dev-tools/aaif
   * into a single scrollable reference page. No sub-tabs (one-tab-level invariant).
   */
  import EmptyState from "$lib/components/EmptyState.svelte";
  import type { CatalogEntry } from "./+page.server";

  export let data: { catalogEntries: CatalogEntry[] };

  // Split catalog entries: suite tools vs control-plane tools (same split as dev-tools/mcp).
  const suiteToolNames = new Set([
    "connect.verify",
    "connect.search",
    "connect.get_context_for",
    "connect.retrieve",
    "connect.retrieve_verified",
    "connect.memory.write",
    "connect.graph.retrieve_context",
    "connect.graph.expand_context",
    "connect.graph.find_relevant_subgraph",
    "connect.graph.find_paths",
    "connect.graph.summarise_subgraph",
    "connect.ingest.start",
    "connect.ingest.status",
    "docs.canonical_resolve",
    "routing.capabilities",
    "testing.config_validate",
    "observability.trace_summarize",
    "graph.fixture_validate",
    "state.memory_preview",
  ]);

  $: suiteTools = data.catalogEntries.filter((e) => suiteToolNames.has(e.name));
  $: controlPlaneTools = data.catalogEntries.filter((e) => !suiteToolNames.has(e.name));

  let suiteFilter = "";
  $: suiteFiltered = suiteTools.filter(
    (t) =>
      !suiteFilter.trim() ||
      `${t.pillar} ${t.name} ${t.description}`.toLowerCase().includes(suiteFilter.trim().toLowerCase()),
  );
</script>

<svelte:head>
  <title>Agents — Catalogs – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<h1 class="page-title">Catalogs</h1>
<p class="page-desc">
  Reference catalog for all agent integration surfaces: MCP tools, CLI commands, and Dispatch contracts.
  Install the surface you need and return here for the full tool list.
</p>

<!-- ── MCP ──────────────────────────────────────────────────────────────── -->
<section class="catalog-section" aria-labelledby="mcp-heading">
  <h2 id="mcp-heading" class="section-title">MCP</h2>
  <p class="section-desc">
    Connect Restormel to your agent workflow via the Model Context Protocol. Use MCP tools from IDEs,
    agent frameworks, and automation pipelines.
  </p>

  <details class="catalog-details" open>
    <summary class="catalog-summary">Server-side environment</summary>
    <div class="catalog-detail-body">
      <p class="hint">
        MCP reads credentials from the <strong>stdio server process</strong> (your IDE or agent host).
        Full checklist:
        <a href="/keys/docs/integrations/mcp#server-side-environment-policy-evaluate-vs-control-plane" class="btn-link">MCP docs</a>
        ·
        <a href="https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/runbooks/mcp-implementation-workflow.md" class="btn-link">Runbook</a>
        ·
        <a href="/keys/docs/cloud-api" class="btn-link">Cloud API</a>
      </p>
      <ul class="tool-list">
        <li>
          <span class="tool-desc"><strong>Policy evaluate</strong> —
            <code class="tool-name">RESTORMEL_EVALUATE_URL</code> + <code class="tool-name">RESTORMEL_GATEWAY_KEY</code> (<code>rk_…</code>).
          </span>
        </li>
        <li>
          <span class="tool-desc"><strong>Control-plane MCP tools</strong> —
            <code class="tool-name">RESTORMEL_CONTROL_PLANE_URL</code> + <code class="tool-name">RESTORMEL_SERVER_TOKEN</code> or gateway key.
          </span>
        </li>
        <li>
          <span class="tool-desc"><strong>Connect agent memory</strong> —
            <code class="tool-name">RESTORMEL_CONNECT_API_BASE</code> + <code class="tool-name">RESTORMEL_GATEWAY_KEY</code>
            for <code class="tool-name">connect.memory.write</code>. See
            <a href="/keys/dashboard/claims/memory" class="btn-link">Memory inbox</a>.
          </span>
        </li>
      </ul>
    </div>
  </details>

  <details class="catalog-details">
    <summary class="catalog-summary">Suite tools (Horizon) — {suiteTools.length} tools</summary>
    <div class="catalog-detail-body">
      <p class="hint">
        Cross-product read helpers. Same names as <code class="tool-name">@restormel/mcp</code> 0.2+.
        <a href="https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/architecture/THEME-L-MCP-PARITY.md" class="btn-link">MCP parity table</a>
        · HTTP envelope:
        <a href="https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/integrations/restormel-suite-tool-envelope.schema.json" class="btn-link">JSON Schema</a>
        · Memory writes:
        <a href="/keys/dashboard/claims/memory" class="btn-link">Memory inbox</a>
      </p>
      <label class="suite-search-label" for="suite-tool-filter">Filter suite tools</label>
      <input
        id="suite-tool-filter"
        class="suite-search"
        type="search"
        autocomplete="off"
        placeholder="Search by pillar, tool name, or description"
        bind:value={suiteFilter}
      />
      <ul class="tool-list suite-tool-list" aria-label="Filtered suite MCP tools">
        {#each suiteFiltered as t (t.name)}
          <li class="suite-row" data-suite-tool={t.name}>
            <span class="tool-pillar">{t.pillar}</span>
            <code class="tool-name">{t.name}</code>
            <span class="tool-desc">{t.description}</span>
          </li>
        {/each}
      </ul>
      {#if suiteFiltered.length === 0}
        <p class="hint" role="status">No suite tools match this filter.</p>
      {/if}
    </div>
  </details>

  <details class="catalog-details">
    <summary class="catalog-summary">Control-plane tools — {controlPlaneTools.length} tools</summary>
    <div class="catalog-detail-body">
      <ul class="tool-list">
        {#each controlPlaneTools as t (t.name)}
          <li>
            <code class="tool-name">{t.name}</code>
            <span class="tool-desc">{t.description}</span>
          </li>
        {/each}
      </ul>
      {#if controlPlaneTools.length === 0}
        <EmptyState
          title="No MCP calls yet"
          description="Recent MCP tool calls will appear here once an agent connects."
        >
          <a href="/keys/docs/integrations/mcp" class="btn-link">Learn about MCP tools</a>
        </EmptyState>
      {/if}
    </div>
  </details>
</section>

<!-- ── CLI ──────────────────────────────────────────────────────────────── -->
<section class="catalog-section" aria-labelledby="cli-heading">
  <h2 id="cli-heading" class="section-title">CLI</h2>
  <p class="section-desc">
    Install and configure the Restormel Keys CLI for terminal-based debugging, validation, and inspection.
  </p>

  <details class="catalog-details" open>
    <summary class="catalog-summary">Installation &amp; commands</summary>
    <div class="catalog-detail-body">
      <div class="code-block">
        <code>npm install -g @restormel/keys-cli</code>
      </div>
      <p class="hint">Run <code class="tool-name">keys doctor</code> after install to validate your environment.</p>
      <ul class="tool-list">
        <li><code class="tool-name">keys init</code> <span class="tool-desc">— scaffold a Restormel configuration</span></li>
        <li><code class="tool-name">keys doctor</code> <span class="tool-desc">— validate environment and configuration</span></li>
        <li><code class="tool-name">keys validate</code> <span class="tool-desc">— check key validity</span></li>
        <li><code class="tool-name">keys estimate &lt;model&gt;</code> <span class="tool-desc">— cost estimate for a model</span></li>
        <li><code class="tool-name">keys models list</code> <span class="tool-desc">— list available models across providers</span></li>
        <li><code class="tool-name">keys routing explain &lt;model&gt;</code> <span class="tool-desc">— explain routing decisions</span></li>
        <li>
          <code class="tool-name">keys login</code>
          <span class="tool-desc">— device authorization: link this machine to a project.
            <a href="/keys/dashboard/cli/connect" class="btn-link">Open Connect CLI</a>
          </span>
        </li>
      </ul>
    </div>
  </details>
</section>

<!-- ── Dispatch ─────────────────────────────────────────────────────────── -->
<section class="catalog-section" aria-labelledby="aaif-heading">
  <h2 id="aaif-heading" class="section-title">Dispatch</h2>
  <p class="section-desc">
    A structured request/response contract for predictable AI interactions.
    Your host provides final model output; Restormel resolves provider/model and estimates cost.
  </p>

  <details class="catalog-details" open>
    <summary class="catalog-summary">Request / response schema</summary>
    <div class="catalog-detail-body">
      <div class="schema-cols">
        <div class="schema-block">
          <h3 class="schema-label">Request</h3>
          <pre class="code-block"><code>&#123;
  input: string
  task?: "chat" | "completion" | "embedding"
  constraints?: &#123;
    maxCost?: number
    latency?: "low" | "balanced" | "high"
  &#125;
  user?: &#123; id: string; plan?: string &#125;
&#125;</code></pre>
        </div>
        <div class="schema-block">
          <h3 class="schema-label">Response</h3>
          <pre class="code-block"><code>&#123;
  output: string
  provider: string
  model: string
  cost: number
  routing: &#123; reason: string &#125;
&#125;</code></pre>
        </div>
      </div>
      <p class="hint" style="margin-top: var(--space-3)">
        Use <code class="tool-name">keys.resolve()</code> + <code class="tool-name">keys.estimateCost()</code> for routing and cost.
        <a href="/keys/docs/integrations/aaif" class="btn-link">Dispatch documentation</a>
      </p>
    </div>
  </details>
</section>

<style>
  .page-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .page-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-5);
    max-width: 46rem;
  }
  .catalog-section {
    margin-bottom: var(--space-7);
  }
  .section-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    font-weight: 700;
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
    border-bottom: var(--border);
    padding-bottom: var(--space-2);
  }
  .section-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-3);
    max-width: 42rem;
  }
  .catalog-details {
    border: var(--border);
    margin-bottom: var(--space-2);
  }
  .catalog-summary {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    color: var(--color-ink);
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
    list-style: none;
    user-select: none;
  }
  .catalog-summary::-webkit-details-marker {
    display: none;
  }
  details[open] .catalog-summary {
    border-bottom: var(--border);
    background: var(--color-yellow);
  }
  .catalog-detail-body {
    padding: var(--space-3);
  }
  .hint {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-3);
    max-width: 42rem;
  }
  .tool-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .tool-list li {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .tool-name {
    font-family: "JetBrains Mono", monospace;
    font-size: var(--text-xs);
    background: var(--rm-surface);
    padding: 0.15rem 0.4rem;
    border-radius: var(--rm-radius);
    border: var(--border-thin);
    color: var(--rm-text);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .tool-desc {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .tool-pillar {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--rm-sage);
    min-width: 6.5rem;
    flex-shrink: 0;
  }
  .suite-search-label {
    display: block;
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--rm-text);
    margin-bottom: var(--space-2);
  }
  .suite-search {
    width: 100%;
    max-width: 24rem;
    font-size: var(--text-sm);
    padding: var(--space-2) var(--space-3);
    border: var(--border-thin);
    background: var(--rm-surface);
    color: var(--rm-text);
    margin-bottom: var(--space-4);
  }
  .suite-tool-list li.suite-row {
    align-items: flex-start;
  }
  .schema-cols {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: var(--space-4);
  }
  .schema-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .schema-label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--rm-muted);
    margin: 0;
  }
  .code-block {
    background: var(--rm-surface);
    border: var(--border-thin);
    padding: var(--space-3) var(--space-4);
    font-family: "JetBrains Mono", monospace;
    font-size: var(--text-xs);
    color: var(--rm-text);
    overflow-x: auto;
    margin: 0 0 var(--space-3);
  }
  .btn-link {
    font-size: var(--text-sm);
    color: var(--rm-sage);
    text-decoration: none;
    font-weight: 500;
  }
  .btn-link:hover {
    text-decoration: underline;
  }
</style>
