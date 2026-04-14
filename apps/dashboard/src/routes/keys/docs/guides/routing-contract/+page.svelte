<svelte:head>
  <title>Routing contract — Restormel Keys</title>
  <meta
    name="description"
    content="Canonical routing contract: resolve, stepChain, ingestion workload/stage, simulate diagnostics, MCP and AAIF alignment for SOPHIA-class workloads."
  />
</svelte:head>

<div class="doc-content">
  <h1>Routing contract (canonical)</h1>
  <p class="doc-intro">
    This page mirrors the repository source of truth
    <code class="inline-code">docs/keys-routing-contract.md</code>. It describes how Restormel Keys exposes
    <strong>multi-step routes</strong>, <strong>resolve</strong>, and <strong>simulate</strong> for complex hosts (for example SOPHIA ingestion), without executing LLM calls in Keys.
  </p>

  <div class="callout callout-tip">
    <strong>Agents:</strong> use MCP <code class="inline-code">docs.canonical_resolve</code> with topic
    <code class="inline-code">keys_routing_contract</code>, or suite tool <code class="inline-code">routing.capabilities</code>, for paths and tool names.
  </div>

  <h2>Contract version</h2>
  <p>
    Successful resolve and simulate responses include <code class="inline-code">contractVersion</code> (currently <strong>2026-04-14</strong>).
    Additive features (2026-04-15): <code class="inline-code">GET …/routes/&#123;routeId&#125;/export</code> bundle, simulate <code class="inline-code">routingAttempts</code>,
    and <code class="inline-code">stepChain</code> <code class="inline-code">advanceOn</code> / <code class="inline-code">retryOn</code> hints — see repo canonical doc for detail.
  </p>

  <h2>Resolve highlights</h2>
  <ul>
    <li>
      <strong>Discovery:</strong> optional <code class="inline-code">workload</code> + <code class="inline-code">stage</code> pick a dedicated ingestion route, then a shared route with the same workload and null stage.
    </li>
    <li>
      <strong>Explicit route:</strong> pass <code class="inline-code">routeId</code> (UUID or name) to skip discovery for other routes.
    </li>
    <li>
      <strong>Chains:</strong> <code class="inline-code">stepChain</code> lists every enabled step in order with per-step metadata (timeout, policies, fallback hint, optional <code class="inline-code">advanceOn</code>/<code class="inline-code">retryOn</code> when set in JSON). Exactly one row has
      <code class="inline-code">selected: true</code> on success.
    </li>
    <li>
      <strong>Server-advanced fallback:</strong> <code class="inline-code">attemptNumber</code> + <code class="inline-code">previousFailure</code> skip exhausted tiers.
    </li>
  </ul>

  <h2>Ingestion stages</h2>
  <div class="doc-table-wrap">
    <table class="doc-table">
      <thead>
        <tr>
          <th>stage</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>
        <tr><td><code>ingestion_extraction</code></td><td>Extract</td></tr>
        <tr><td><code>ingestion_relations</code></td><td>Relate</td></tr>
        <tr><td><code>ingestion_grouping</code></td><td>Group</td></tr>
        <tr><td><code>ingestion_validation</code></td><td>Validate</td></tr>
        <tr><td><code>ingestion_remediation</code></td><td>Remediate</td></tr>
        <tr><td><code>ingestion_embedding</code></td><td>Embed</td></tr>
        <tr><td><code>ingestion_json_repair</code></td><td>JSON repair</td></tr>
      </tbody>
    </table>
  </div>

  <h2>Simulate</h2>
  <p>
    <code class="inline-code">POST …/routes/&#123;routeId&#125;/simulate</code> dry-runs selection for one route. Set
    <code class="inline-code">includeStepDiagnostics: false</code> to skip per-step policy evaluation when you only need cost hints.
    Set <code class="inline-code">includeRoutingAttempts: true</code> for hypothetical tier outcomes (<code class="inline-code">routingAttempts</code>).
  </p>

  <h2>Export (GitOps)</h2>
  <p>
    <code class="inline-code">GET …/routes/&#123;routeId&#125;/export</code> returns a versioned JSON bundle of the route and ordered steps (no secrets). MCP: <code class="inline-code">routing.export</code>.
  </p>

  <h2>Import (GitOps)</h2>
  <p>
    <code class="inline-code">POST …/routes/import</code> applies the same bundle shape: creates a route, or pass <code class="inline-code">replaceRouteId</code> in the JSON body to overwrite an existing route’s fields and ordered steps. MCP: <code class="inline-code">routing.import</code>.
  </p>

  <h2>Explain chain (agents)</h2>
  <p>
    <code class="inline-code">GET …/routes/&#123;routeId&#125;/explain-chain</code> returns a compact summary: route metadata, ordered steps (including <code class="inline-code">advanceOn</code> / <code class="inline-code">retryOn</code> hints when present), and policies bound at workspace, project, environment, and route scope (read-only). Optional query <code class="inline-code">includePolicyRuleJson=true</code>. MCP: <code class="inline-code">routing.explain_chain</code>.
  </p>

  <h2>AAIF</h2>
  <p>
    <code class="inline-code">@restormel/aaif</code> adds optional <code class="inline-code">routingContext</code> on requests (mirrors resolve hints). The AAIF helper does not call HTTP resolve; use
    <code class="inline-code">@restormel/keys</code> dashboard client <code class="inline-code">resolve()</code> when you need a full <code class="inline-code">stepChain</code>.
  </p>

  <p class="muted">
    Full detail, capability matrix, and security notes: see the markdown file linked above or the public GitHub copy in the restormel-keys repo.
  </p>
</div>
