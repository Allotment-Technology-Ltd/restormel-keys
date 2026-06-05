<script lang="ts">
  import EmptyState from "$lib/components/EmptyState.svelte";

  type SuiteRow = { pillar: string; name: string; desc: string };
  const suiteTools: SuiteRow[] = [
    {
      pillar: "Docs",
      name: "docs.canonical_resolve",
      desc: "Map a canonical topic id to repo path and public URL (offline).",
    },
    {
      pillar: "Testing",
      name: "testing.config_validate",
      desc: "Validate restormel-testing YAML/JSON config offline (size-capped).",
    },
    {
      pillar: "Observability",
      name: "observability.trace_summarize",
      desc: "Normalize RunTrace JSON and return counts + short summary.",
    },
    {
      pillar: "Graph",
      name: "graph.fixture_validate",
      desc: "Structural GraphData check (nodes/edges/ghost arrays).",
    },
    {
      pillar: "State",
      name: "state.memory_preview",
      desc: "Project StateEvent stream to working memory; text lengths only.",
    },
    {
      pillar: "Connect",
      name: "connect.search",
      desc: "BYO Surreal graph — semantic search with structured context_pack (hosted retrieve).",
    },
    {
      pillar: "Connect",
      name: "connect.get_context_for",
      desc: "Topic + optional seed_claim_id traversal on your graph store.",
    },
    {
      pillar: "Connect",
      name: "connect.retrieve",
      desc: "Deprecated alias for connect.search.",
    },
    {
      pillar: "Connect",
      name: "connect.verify",
      desc: "Claim verification via hosted REST (BYOK LLM routes).",
    },
  ];

  let suiteFilter = "";
  $: suiteFiltered = suiteTools.filter(
    (t) =>
      !suiteFilter.trim() ||
      `${t.pillar} ${t.name} ${t.desc}`.toLowerCase().includes(suiteFilter.trim().toLowerCase()),
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
        <span class="tool-desc">{t.desc}</span>
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
    Use MCP when your agent workflow needs tool-based access to Restormel’s routing, pricing, and policy checks
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
  </ul>
</section>

<section class="section" aria-labelledby="tools-heading">
  <h2 id="tools-heading" class="section-title">Available tools</h2>
  <ul class="tool-list">
    <li>
      <code class="tool-name">models.list</code>
      <span class="tool-desc">List available models across configured providers</span>
    </li>
    <li>
      <code class="tool-name">providers.validate</code>
      <span class="tool-desc">Validate provider configuration and access</span>
    </li>
    <li>
      <code class="tool-name">cost.estimate</code>
      <span class="tool-desc">Estimate cost for a model and token volume</span>
    </li>
    <li>
      <code class="tool-name">routing.explain</code>
      <span class="tool-desc">Explain routing decisions for a given request</span>
    </li>
    <li>
      <code class="tool-name">routing.export | routing.import | routing.explain_chain</code>
      <span class="tool-desc">Route graph bundle (GET/POST import); read-only route + steps + policy-scope summary for agents (GET explain-chain)</span>
    </li>
    <li>
      <code class="tool-name">entitlements.check</code>
      <span class="tool-desc">Check plan entitlements and feature access</span>
    </li>
    <li>
      <code class="tool-name">integration.generate</code>
      <span class="tool-desc">Generate integration configuration</span>
    </li>
    <li>
      <code class="tool-name">integration.bootstrap_nextjs</code>
      <span class="tool-desc">Next.js server resolver + admin KeyManager contract</span>
    </li>
    <li>
      <code class="tool-name">projects.list</code>
      <span class="tool-desc">List projects for the control-plane token (pick <code>projectId</code>)</span>
    </li>
    <li>
      <code class="tool-name">project_models.list</code>
      <span class="tool-desc">List model bindings for a project (read-only)</span>
    </li>
    <li>
      <code class="tool-name">testing.journey</code>
      <span class="tool-desc">Structured onboarding map: dashboard URLs, docs, suggested MCP tools</span>
    </li>
    <li>
      <code class="tool-name">testing.ci_env_template</code>
      <span class="tool-desc">Canonical <code>RESTORMEL_*</code> snippet for Testing CLI/CI (placeholders only)</span>
    </li>
    <li>
      <code class="tool-name">testing.resolve_probe</code>
      <span class="tool-desc">Single POST to <code>/v1/testing/resolve-model</code>; HTTP status only</span>
    </li>
    <li>
      <code class="tool-name">testing.hub_snapshot</code>
      <span class="tool-desc">Project + environment IDs + masked Gateway keys + suggested <code>RESTORMEL_*</code> snippet</span>
    </li>
    <li>
      <code class="tool-name">project.environments.list</code>
      <span class="tool-desc">Environment UUIDs for <code>RESTORMEL_ENVIRONMENT_ID</code> in CI</span>
    </li>
    <li>
      <code class="tool-name">project.gateway_keys.list | .create | .delete</code>
      <span class="tool-desc">Manage <code>rk_…</code> keys via control plane (<strong>.create</strong> returns raw key once — treat as secret)</span>
    </li>
    <li>
      <code class="tool-name">routes.* / policies.* / fallback_chain.set</code>
      <span class="tool-desc">Control-plane CRUD (server token + control-plane base URL)</span>
    </li>
    <li>
      <code class="tool-name">byok.* / policy.simulate / catalog.* / readiness.check</code>
      <span class="tool-desc">Contracts, simulation, catalog checks, CI readiness</span>
    </li>
    <li>
      <code class="tool-name">docs.search</code>
      <span class="tool-desc">Search Restormel documentation</span>
    </li>
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
