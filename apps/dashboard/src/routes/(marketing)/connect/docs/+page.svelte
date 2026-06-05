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
    <li id="ingest"><code>POST /connect/v1/ingest/jobs</code> — create ingest job (workspace-scoped persistence)</li>
    <li><code>GET /connect/v1/ingest/jobs</code> — list jobs for a workspace</li>
    <li><code>GET /connect/v1/ingest/jobs/{`{jobId}`}</code> — job status and stage progress</li>
  </ul>

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
    <li><code>connect.get_context_for</code> — topic + optional <code>seed_claim_id</code> from the graph explorer</li>
    <li><code>connect.retrieve</code> — deprecated alias of <code>connect.search</code></li>
    <li><code>connect.verify</code>, <code>connect.ingest.*</code> — verify and ingest job helpers</li>
  </ul>
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
        href="https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/restormel/CONNECT-PRODUCT.md"
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
