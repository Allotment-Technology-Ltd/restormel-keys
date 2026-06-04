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

  <h2 id="mcp">MCP tools</h2>
  <p>
    <code>@restormel/mcp</code> registers <code>connect.verify</code>, <code>connect.retrieve</code>,
    <code>connect.ingest.start</code>, and <code>connect.ingest.status</code>. Set
    <code>RESTORMEL_CONNECT_API_BASE</code> + <code>RESTORMEL_GATEWAY_KEY</code> to proxy verify/retrieve to hosted
    REST from MCP.
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
