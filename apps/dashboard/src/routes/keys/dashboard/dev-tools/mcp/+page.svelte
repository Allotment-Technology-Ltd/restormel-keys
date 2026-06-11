<!--
  W2.4: MCP catalog now generated from @restormel/mcp CATALOG_ENTRIES (FUNC P2-7 fix).
  connect.memory.write is always included; the catalog can never go stale.
-->
<script lang="ts">
  import EmptyState from "$lib/components/EmptyState.svelte";
  import type { CatalogEntry } from "./+page.server";

  export let data: { catalogEntries: CatalogEntry[] };

  // Split into suite tools (connect.* + horizon) and control-plane tools.
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

<h1 class="page-title">MCP</h1>
<p class="page-desc">
  Connect Restormel to your agent workflow via the Model Context Protocol. Use MCP tools from IDEs, agent
  frameworks, and automation pipelines.
</p>

<section class="section" aria-labelledby="env-heading">
  <h2 id="env-heading" class="section-title">Server-side environment</h2>
  <p class="page-desc">
    MCP reads credentials from the <strong>stdio server process</strong> (your IDE or agent host). For production-style
    rollout, set env vars there — never in the browser. Full checklist:
    <a href="/keys/docs/integrations/mcp#server-side-environment-policy-evaluate-vs-control-plane" class="btn-link"
      >MCP docs — policy evaluate vs control-plane</a
    >
    ·
    <a href="https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/runbooks/mcp-implementation-workflow.md" class="btn-link"
      >Runbook (GitHub)</a
    >
    ·
    <a href="/keys/docs/cloud-api" class="btn-link">Cloud API</a>
  </p>
  <ul class="tool-list">
    <li>
      <span class="tool-desc"
        ><strong>Policy evaluate</strong> — <code class="tool-name">RESTORMEL_EVALUATE_URL</code> = full URL to
        <code class="tool-name">…/keys/dashboard/api/policies/evaluate</code> + <code class="tool-name">RESTORMEL_GATEWAY_KEY</code>
        (<code>rk_…</code>).</span
      >
    </li>
    <li>
      <span class="tool-desc"
        ><strong>Control-plane MCP tools</strong> — <code class="tool-name">RESTORMEL_CONTROL_PLANE_URL</code> =
        <code class="tool-name">https://restormel.dev/keys/dashboard</code> (no trailing slash) +
        <code class="tool-name">RESTORMEL_SERVER_TOKEN</code> or gateway key.</span
      >
    </li>
    <li>
      <span class="tool-desc"
        ><strong>Keys HTTP resolve (Testing)</strong> — <code class="tool-name">RESTORMEL_KEYS_BASE</code> (site origin) +
        bearer (<code class="tool-name">RESTORMEL_GATEWAY_KEY</code> or aliases) for
        <code class="tool-name">testing.resolve_probe</code>. See
        <a href="/keys/docs/guides/environment-vocabulary" class="btn-link">environment vocabulary</a>.</span
      >
    </li>
    <li>
      <span class="tool-desc"
        ><strong>Connect agent memory</strong> — <code class="tool-name">RESTORMEL_CONNECT_API_BASE</code> =
        <code class="tool-name">https://restormel.dev</code> + <code class="tool-name">RESTORMEL_GATEWAY_KEY</code> (<code>rk_…</code>) for
        <code class="tool-name">connect.memory.write</code> and other Connect tools. See
        <a href="/keys/dashboard/connect/memory" class="btn-link">Memory inbox</a>.</span
      >
    </li>
  </ul>
</section>

<section class="section" aria-labelledby="status-heading">
  <h2 id="status-heading" class="section-title">Connection status</h2>
  <EmptyState
    title="MCP runs in your IDE or agent"
    description="Install @restormel/mcp, add restormel-mcp to your MCP client config (stdio), and open this tab as a reference. The dashboard does not host the stdio server."
  >
    <a href="/keys/docs/integrations/mcp" class="btn-link">MCP setup guide</a>
  </EmptyState>
</section>

<section class="section" aria-labelledby="suite-heading">
  <h2 id="suite-heading" class="section-title">Suite tools (Horizon)</h2>
  <p class="page-desc">
    Cross-product read helpers (stdio MCP and HTTP). Same names as <code class="tool-name">@restormel/mcp</code> 0.2+.
    <a
      href="https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/restormel/THEME-L-IA-MATRIX.md"
      class="btn-link">Theme L IA matrix</a
    >
    ·
    <a
      href="https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/restormel/THEME-L-MCP-PARITY.md"
      class="btn-link">MCP parity table</a
    >
    · HTTP envelope:
    <a
      href="https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/integrations/restormel-suite-tool-envelope.schema.json"
      class="btn-link">JSON Schema</a
    >
    · Zuplo:
    <code class="tool-name">POST /api/suite/invoke</code>
    → dashboard
    <code class="tool-name">POST …/keys/dashboard/api/suite/invoke</code>
    · Connect agents:
    <code class="tool-name">POST …/keys/dashboard/api/connect/invoke</code>
    (<code class="tool-name">connect.search</code>,
    <code class="tool-name">connect.get_context_for</code>) — requires BYO Surreal; see
    <a href="/keys/dashboard/connect" class="btn-link">Connect hub</a>
    · Memory writes:
    <a href="/keys/dashboard/connect/memory" class="btn-link">Memory inbox</a>
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
    <p class="page-desc" role="status">No suite tools match this filter.</p>
  {/if}
</section>

<section class="section" aria-labelledby="usecase-heading">
  <h2 id="usecase-heading" class="section-title">Core use-cases</h2>
  <p class="page-desc">
    Use MCP when your agent workflow needs tool-based access to Restormel's routing, pricing, and policy checks
    from inside an IDE or automation runner.
  </p>
  <ul class="tool-list">
    <li>
      <strong>Routing explain</strong>
      <span class="tool-desc"> — maps to `keys routing explain` for transparency.</span>
    </li>
    <li>
      <strong>Cost estimate</strong>
      <span class="tool-desc"> — maps to `keys estimate` using provider pricing.</span>
    </li>
    <li>
      <strong>Validate + entitlements</strong>
      <span class="tool-desc"> — aligns with `restormel validate` and plan policy checks.</span>
    </li>
    <li>
      <strong>Agent memory write</strong>
      <span class="tool-desc"> — <code class="tool-name">connect.memory.write</code> submits agent observations through the EBV quality gate; view results in the <a href="/keys/dashboard/connect/memory" class="btn-link">Memory inbox</a>.</span>
    </li>
  </ul>
</section>

<section class="section" aria-labelledby="tools-heading">
  <h2 id="tools-heading" class="section-title">Available tools</h2>
  <ul class="tool-list">
    {#each controlPlaneTools as t (t.name)}
      <li>
        <code class="tool-name">{t.name}</code>
        <span class="tool-desc">{t.description}</span>
      </li>
    {/each}
  </ul>
</section>

<section class="section" aria-labelledby="calls-heading">
  <h2 id="calls-heading" class="section-title">Recent calls</h2>
  <EmptyState
    title="No MCP calls yet"
    description="Recent MCP tool calls will appear here once an agent connects."
  >
    <a href="/keys/docs/integrations/mcp" class="btn-link">Learn about MCP tools</a>
  </EmptyState>
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
    max-width: 42rem;
  }
  .section {
    margin-bottom: var(--space-6);
  }
  .section-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-3);
  }
  .tool-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .tool-list li {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
  }
  .tool-name {
    font-family: "JetBrains Mono", monospace;
    font-size: var(--text-xs);
    background: var(--rm-surface);
    padding: 0.15rem 0.4rem;
    border-radius: var(--rm-radius);
    border: 1px solid var(--rm-border);
    color: var(--rm-text);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .tool-desc {
    font-size: var(--text-sm);
    color: var(--rm-muted);
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
    border-radius: var(--rm-radius);
    border: 1px solid var(--rm-border);
    background: var(--rm-surface);
    color: var(--rm-text);
    margin-bottom: var(--space-4);
  }
  .suite-tool-list li.suite-row {
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .tool-pillar {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--rm-sage);
    min-width: 6.5rem;
    flex-shrink: 0;
  }
</style>
