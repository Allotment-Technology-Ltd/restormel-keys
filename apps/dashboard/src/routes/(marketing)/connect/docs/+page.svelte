<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
</script>

<svelte:head>
  <title>Connect API docs – Restormel</title>
</svelte:head>

<article class="docs">
  <h1>Restormel Connect API</h1>
  <p class="intro">
    Wire agents and apps to a workspace-scoped knowledge graph. After ingest builds your corpus, these endpoints serve
    retrieval and verification — the production layer between your documents and your AI products.
  </p>
  <p>
    Public REST lives on <code>restormel.dev</code> under <code>/connect/v1/*</code>. Authenticate with a Gateway key
    (<code>rk_…</code>) and include a Keys <code>workspace_id</code> on every request body.
  </p>

  <h2 id="endpoints">Endpoints</h2>
  <ul>
    <li id="verify"><code>POST /connect/v1/verify</code> — Connect Verify (<code>@restormel/reasoning-core</code>)</li>
    <li id="retrieve"><code>POST /connect/v1/retrieve</code> — Connect Retrieve (<code>@restormel/graphrag-core</code>)</li>
    <li id="graph"><code>POST /connect/v1/graph</code> — Graph orchestrator: higher-order retrieval (<code>@restormel/graphrag-core</code>)</li>
    <li id="ingest"><code>POST /connect/v1/ingest/jobs</code> — create ingest job (workspace-scoped persistence)</li>
    <li><code>GET /connect/v1/ingest/jobs</code> — list jobs for a workspace</li>
    <li><code>GET /connect/v1/ingest/jobs/{`{jobId}`}</code> — job status and stage progress</li>
    <li id="traces"><code>GET /connect/v1/traces/{`{traceId}`}</code> — fetch a stored provenance trace</li>
    <li><code>GET /connect/v1/traces/{`{traceId}`}/export?format=json</code> — download a provenance trace as JSON</li>
  </ul>

  <h2 id="graph-orchestrator">Graph orchestrator</h2>
  <p>
    <code>POST /connect/v1/graph</code> exposes the curated, "smart MCP not dumb pipe" operations: each returns a
    ranked, structured subgraph (or paths) with a compact audit trace — never raw rows. Pick the operation with the
    <code>operation</code> field:
  </p>
  <ul>
    <li><code>retrieve_context</code> — vector-seeded, graph-expanded context for a <code>query</code> (the primary entry point)</li>
    <li><code>expand_context</code> — graph expansion from explicit <code>seed_node_ids</code> (where graph-RAG beats vector-RAG)</li>
    <li><code>find_relevant_subgraph</code> — topic subgraph with <code>reasoning_mode</code>: <code>semantic</code> · <code>causal</code> · <code>temporal</code> (causal/temporal re-weight edge priors)</li>
    <li><code>find_paths</code> — ranked paths between <code>source_node_id</code> and <code>target_node_id</code></li>
    <li><code>summarise_subgraph</code> — condense a retrieved subgraph under a <code>max_tokens</code> budget (dedup + salience prune, seeds preserved)</li>
  </ul>
  <p>
    <strong>Trust by default:</strong> every operation accepts an optional <code>verification_policy</code> and defaults to
    <strong>supported-only</strong> (flagged claims excluded). Opt into weaker evidence explicitly with
    <code>{`{ "verification_policy": { "include": ["supported", "weak"] } }`}</code>. The response
    <code>trace.verification</code> reports what was included and excluded, by trust category.
  </p>
  <p>
    Pass <code>max_tokens</code> on any operation to fit your model's context window; <code>trace.tokens_used</code> and
    <code>trace.nodes_dropped</code> report the budgeting outcome.
  </p>

  <h2 id="provenance-traces">Provenance traces</h2>
  <p>
    Every <code>POST /connect/v1/retrieve</code> and <code>POST /connect/v1/graph</code> query stores a full audit
    trace and returns its <code>trace_id</code> in the response. Fetch the structured document later with
    <code>GET /connect/v1/traces/{`{traceId}`}</code>, or download it with
    <code>GET /connect/v1/traces/{`{traceId}`}/export?format=json</code> (sets <code>Content-Disposition</code> so it
    saves as a file). Both take the same <code>workspace_id</code> (and optional <code>project_id</code>) query
    parameters and Gateway-key auth as the rest of Connect v1.
  </p>
  <p><strong>What a trace contains</strong> (<code>schema_version 1.0</code>, from <code>@restormel/contracts/provenance-trace</code>):</p>
  <ul>
    <li>the <code>query</code>, <code>domain_pack</code>, <code>graph_store_type</code>, and the <code>verification_policy</code> actually applied;</li>
    <li><code>seeds</code> — the entry-point claims chosen by vector/lexical search;</li>
    <li><code>expansion</code> — the traversal band(s): depth, claims traversed, relations kept, edge types;</li>
    <li><code>claims</code> — a per-claim verdict for every claim considered: whether it was <code>included</code>, its <code>verification_state</code>/<code>trust_score</code>/<code>confidence_score</code>, its <code>hop_depth</code> and <code>edge_path</code>, and (when excluded) the <code>exclusion_reason</code>;</li>
    <li><code>result</code> — claims retrieved vs filtered, tokens used vs budget, whether the context was truncated;</li>
    <li><code>timing</code> — total wall-clock duration (sub-phase timings are reserved in 1.0).</li>
  </ul>
  <p>
    <strong>Retention:</strong> traces are kept for <strong>90 days</strong>, then pruned. <strong>Use them to</strong>
    debug why a claim was (or was not) returned, audit the trust filter on a specific answer, compare retrieval quality
    across queries, and — with <code>restormel replay</code> — deterministically reproduce an agent's retrieval. A trace
    owned by another workspace returns <code>404</code>.
  </p>

  <h2 id="contract">Contract</h2>
  <p>
    Request/response envelopes use <code>CONNECT_API_CONTRACT_VERSION = 2026-06-01</code> from
    <code>@restormel/contracts/connect</code>. OpenAPI draft:
    <a href="https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/api/openapi-suite-v1-draft.yaml"
      >openapi-suite-v1-draft.yaml</a
    >.
  </p>

  <h2 id="mcp">MCP tools (BYO graph — hero path)</h2>
  <p>
    Configure a <strong>Bring-Your-Own SurrealDB</strong> graph store in the Connect hub first. Then wire agents with
    <code>@restormel/mcp</code>:
  </p>
  <ul>
    <li><code>connect.search</code> — semantic search → structured claims, relations, and pass-specific <code>context_pack</code></li>
    <li><code>connect.get_context_for</code> — topic + optional <code>seed_claim_id</code> from Claims</li>
    <li><code>connect.retrieve</code> — deprecated alias of <code>connect.search</code></li>
    <li><code>connect.verify</code>, <code>connect.ingest.*</code> — verify and ingest job helpers</li>
  </ul>
  <p>
    <strong>Graph orchestrator tools</strong> (model-agnostic; map 1:1 to <code>POST /connect/v1/graph</code>) — curated,
    ranked, token-budgeted context for any agent host:
  </p>
  <ul>
    <li><code>connect.graph.retrieve_context</code> — primary retrieval (vector + graph), token-budgeted</li>
    <li><code>connect.graph.expand_context</code> — expand from explicit seed node ids, optional edge-type filter</li>
    <li><code>connect.graph.find_relevant_subgraph</code> — semantic / causal / temporal reasoning modes</li>
    <li><code>connect.graph.find_paths</code> — ranked paths between two nodes</li>
    <li><code>connect.graph.summarise_subgraph</code> — condense a subgraph under a token budget</li>
  </ul>
  <p>
    Every graph tool defaults to <strong>supported-only</strong> retrieval (the trust promise, visible in each tool's
    schema) — set <code>verification_policy.include</code> to widen.
  </p>
  <p>
    Env: <code>RESTORMEL_CONNECT_API_BASE</code> (e.g. <code>https://restormel.dev</code>),
    <code>RESTORMEL_GATEWAY_KEY</code> (<code>rk_…</code>), <code>RESTORMEL_WORKSPACE_ID</code>. HTTP mirror:
    <code>POST /keys/dashboard/api/connect/invoke</code> with <code>{`{ "tool": "connect.search", "payload": { … } }`}</code>.
  </p>
  <p>
    Restormel does <strong>not</strong> host your graph corpus in MVP — your Surreal endpoint must be reachable from
    hosted retrieve. See <a href="/keys/docs/integrations/mcp">MCP integration guide</a>.
  </p>

  <h2>Operator hub</h2>
  <p>
    Signed-in operators: <a href={DASHBOARD_BASE + "/connect"}>{DASHBOARD_BASE}/connect</a>.
  </p>

  <h2>Related</h2>
  <ul>
    <li><a href="/keys/docs/cloud-api">Keys Cloud API</a></li>
    <li><a href="/keys/docs/integrations/mcp">MCP integration</a></li>
    <li>
      <a
        href="https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/product/CONNECT-PRODUCT.md"
        >Connect product brief</a
      >
    </li>
  </ul>
</article>

<style>
  .docs {
    max-width: var(--rm-container-max, 72rem);
    margin: 0 auto;
    padding: 2rem 1.25rem 3rem;
    line-height: 1.6;
  }
  .docs h1 {
    margin-top: 0;
  }
  .intro {
    font-size: 1.05rem;
    color: var(--rm-muted);
    line-height: 1.55;
  }
  .docs h2 {
    margin-top: 1.75rem;
    font-size: 1.15rem;
  }
</style>
