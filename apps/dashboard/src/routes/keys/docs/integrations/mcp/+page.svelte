<svelte:head>
  <title>MCP — Integrations — Docs — Restormel Keys</title>
  <meta name="description" content="Set up Restormel MCP tools for agent workflows and IDE integrations." />
</svelte:head>

<h1 class="docs-h1">MCP</h1>
<p class="docs-intro">
  The Restormel MCP package exposes tools that agents and IDEs can call via the
  <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer">Model Context Protocol</a>.
  Use these tools to query models, estimate costs, explain routing, manage control-plane resources, and more — directly from your
  agent workflow.
</p>
<p class="docs-p">
  <strong>Canonical env names:</strong>
  <a href="/keys/docs/guides/environment-vocabulary">Environment vocabulary</a> — use these <code class="inline-code">RESTORMEL_*</code> names everywhere (apps, CI, wizards). Gateway key and server token are the same secret; evaluate URL, control-plane base, and site origin are three different strings.
</p>

<h2 class="docs-h2">Runtime server</h2>
<p class="docs-p">
  <code class="inline-code">@restormel/mcp</code> ships a <strong>stdio MCP server</strong> you run locally
  (Cursor, Claude Desktop, Codex, etc.). Install the package, then point your client at
  <code class="inline-code">pnpm exec restormel-mcp</code> or <code class="inline-code">npx restormel-mcp</code>.
  See the package <a href="https://github.com/Allotment-Technology-Ltd/restormel-keys/tree/main/packages/mcp#readme">README</a> for env vars and security notes.
</p>

<h2 id="server-side-environment-policy-evaluate-vs-control-plane" class="docs-h2">Server-side environment (policy evaluate vs control-plane)</h2>
<p class="docs-p">
  Configure credentials in the <strong>MCP host process environment</strong> (not in the browser). Do not commit Gateway keys; do not log them. Summary of the two cloud bases:
</p>
<ul class="docs-list">
  <li>
    <strong>Live policy checks</strong> (<code>entitlements.check</code>): set <code class="inline-code">RESTORMEL_EVALUATE_URL</code> to the full Dashboard API URL
    <code class="inline-code">https://restormel.dev/keys/dashboard/api/policies/evaluate</code> (self-host: same path on your host) and <code class="inline-code">RESTORMEL_GATEWAY_KEY</code> to your project Gateway Key (<code>rk_…</code>).
    Details: <a href="/keys/docs/cloud-api">Cloud API</a> (Policy evaluate section).
  </li>
  <li>
    <strong>Route and policy MCP tools</strong> (<code>routes.*</code>, <code>policies.*</code>, <code>fallback_chain.set</code>): set <code class="inline-code">RESTORMEL_CONTROL_PLANE_URL</code> to the dashboard app base
    <code class="inline-code">https://restormel.dev/keys/dashboard</code> (no trailing slash; paths append <code class="inline-code">/api/projects/…</code>) and <code class="inline-code">RESTORMEL_SERVER_TOKEN</code> (or gateway key) for Bearer auth.
    This is <strong>not</strong> the same string as <code class="inline-code">RESTORMEL_EVALUATE_URL</code>.
  </li>
</ul>
<p class="docs-p">
  Canonical checklist and operator notes: <a href="https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/runbooks/mcp-implementation-workflow.md">MCP implementation workflow</a> (repo runbook). API portal mirror: open the Restormel API portal → <em>MCP &amp; agent setup</em>.
</p>

<h2 class="docs-h2">Available tools</h2>
<table class="tools-table">
  <thead>
    <tr>
      <th>Tool</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><code>models.list</code></td><td>List available models across configured providers</td></tr>
    <tr><td><code>providers.validate</code></td><td>Validate provider configuration and access</td></tr>
    <tr><td><code>cost.estimate</code></td><td>Estimate cost for a model and token volume</td></tr>
    <tr><td><code>routing.explain</code></td><td>Explain routing decisions for a given request</td></tr>
    <tr><td><code>routing.export / routing.import / routing.explain_chain</code></td><td>Control plane: route graph bundle export/import; read-only route + steps + policy-scope summary for agents</td></tr>
    <tr><td><code>entitlements.check</code></td><td>Check plan entitlements and feature access</td></tr>
    <tr><td><code>integration.generate</code></td><td>Generate integration configuration for a stack</td></tr>
    <tr><td><code>integration.bootstrap_nextjs</code></td><td>Generate Next.js server resolver + admin KeyManager wiring contract</td></tr>
    <tr><td><code>routes.list/create/update/delete</code></td><td>Project route CRUD in the control plane (server token required)</td></tr>
    <tr><td><code>policies.list/create/update/delete</code></td><td>Project policy CRUD in the control plane (server token required)</td></tr>
    <tr><td><code>fallback_chain.set</code></td><td>Set primary + fallback model chain for a route</td></tr>
    <tr><td><code>byok.schema.generate</code></td><td>Generate DB schema templates for global and user BYOK scope</td></tr>
    <tr><td><code>byok.api_contract.generate</code></td><td>Generate validate/add/remove/revalidate endpoint contracts</td></tr>
    <tr><td><code>policy.simulate</code></td><td>Batch policy simulation with expected allow/deny assertions</td></tr>
    <tr><td><code>catalog.sync_check</code></td><td>Check model references against current catalog</td></tr>
    <tr><td><code>catalog.deprecation_alerts</code></td><td>Return deprecation/retirement alerts for referenced models</td></tr>
    <tr><td><code>readiness.check</code></td><td>Run CI-friendly readiness checks with stable error codes</td></tr>
    <tr><td><code>docs.search</code></td><td>Search Restormel documentation</td></tr>
  </tbody>
</table>

<h2 class="docs-h2">Connect knowledge &amp; graph tools</h2>
<p class="docs-p">
  With a <strong>Bring-Your-Own SurrealDB</strong> graph store configured in the Connect hub, the same MCP server
  exposes retrieval tools over your workspace knowledge graph. These return curated, ranked, token-budgeted context —
  structured claims, relations and paths, never raw rows. Set <code class="inline-code">RESTORMEL_CONNECT_API_BASE</code>,
  <code class="inline-code">RESTORMEL_GATEWAY_KEY</code> and <code class="inline-code">RESTORMEL_WORKSPACE_ID</code>.
</p>
<table class="tools-table">
  <thead>
    <tr><th>Tool</th><th>Description</th></tr>
  </thead>
  <tbody>
    <tr><td><code>connect.search</code></td><td>Semantic search → claims, relations, pass-specific context packs</td></tr>
    <tr><td><code>connect.get_context_for</code></td><td>Topic + optional seed claim id from Claims</td></tr>
    <tr><td><code>connect.graph.retrieve_context</code></td><td>Primary retrieval: vector + graph traversal, token-budgeted subgraph + trace</td></tr>
    <tr><td><code>connect.graph.expand_context</code></td><td>Graph expansion from explicit seed node ids (optional edge-type filter)</td></tr>
    <tr><td><code>connect.graph.find_relevant_subgraph</code></td><td>Topic subgraph with semantic / causal / temporal reasoning modes</td></tr>
    <tr><td><code>connect.graph.find_paths</code></td><td>Ranked reasoning paths between two graph nodes</td></tr>
    <tr><td><code>connect.graph.summarise_subgraph</code></td><td>Condense a subgraph under a token budget (seeds preserved)</td></tr>
    <tr><td><code>connect.verify</code> / <code>connect.ingest.*</code></td><td>Claim verification + ingest job helpers</td></tr>
  </tbody>
</table>
<p class="docs-p">
  <strong>Trust promise:</strong> every <code>connect.graph.*</code> tool defaults to <strong>supported-only</strong>
  retrieval — weak/unsupported claims are excluded unless you pass <code class="inline-code">verification_policy.include</code>.
  Full reference: <a href="/connect/docs">Connect API docs</a> (Graph orchestrator).
</p>

<h2 class="docs-h2">How MCP maps to Restormel Keys</h2>
<p class="docs-p">
  MCP exposes Restormel’s core building blocks to agent workflows. These tools correspond to
  the same primitives you can inspect with the CLI and validate with Doctor/Validate.
</p>
<ul class="docs-list">
  <li><strong>`models.list`</strong> — same model inventory as `keys models list`.</li>
  <li><strong>`providers.validate`</strong> — same credential health check as `keys validate`.</li>
  <li><strong>`cost.estimate`</strong> — same pricing lookup as `keys estimate`.</li>
  <li><strong>`routing.explain`</strong> — same static provider resolution as `keys routing explain` (policies require a configured project).</li>
  <li><strong>`routing.export` / `routing.import` / `routing.explain_chain`</strong> — control-plane route graph GitOps and agent-oriented summaries (server token + control-plane base URL).</li>
  <li><strong>`entitlements.check`</strong> — policy checks (local rules via `RESTORMEL_MCP_CONFIG` or remote evaluation via `RESTORMEL_EVALUATE_URL` + `RESTORMEL_GATEWAY_KEY`).</li>
  <li><strong>`integration.generate`</strong> — scaffolding helper for a new integration.</li>
  <li><strong>`integration.bootstrap_nextjs`</strong> — project-scoped server bootstrap contract for Next.js.</li>
  <li><strong>`routes.*` / `policies.*` / `fallback_chain.set`</strong> — control-plane write tools for operational rollout.</li>
  <li><strong>`byok.*` / `policy.simulate`</strong> — key lifecycle contract generation + deployment scenario simulation.</li>
  <li><strong>`catalog.*` / `readiness.check`</strong> — model lifecycle guardrails and CI gating outputs.</li>
  <li><strong>`docs.search`</strong> — offline documentation index search.</li>
</ul>

<h2 class="docs-h2">Package</h2>
<p class="docs-p">
  Tool schemas and server factory are exported from <code class="inline-code">@restormel/mcp</code>:
</p>
<pre class="code-block"><code>import &#123; ALL_TOOLS, createRestormelMcpServer &#125; from "@restormel/mcp";
// or: import &#123; createRestormelMcpServer &#125; from "@restormel/mcp/server";</code></pre>
<p class="docs-p">
  Programmatic hosts can call <code class="inline-code">createRestormelMcpServer()</code> and attach their own
  transport from <code class="inline-code">@modelcontextprotocol/sdk</code>.
</p>

<h2 class="docs-h2">Next steps</h2>
<ul class="docs-links">
  <li><a href="/keys/docs/cloud-api">Cloud API</a> — policy evaluate and resolve (same surfaces MCP uses)</li>
  <li><a href="/keys/docs/integrations/cli">CLI quickstart</a> — terminal-based tools</li>
  <li><a href="/keys/docs/integrations/aaif">AAIF overview</a> — structured AI interaction contract</li>
  <li><a href="/keys/docs/integrations">All integrations</a></li>
</ul>

<style>
  .docs-h1 {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-3);
  }
  .docs-intro {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-5);
    max-width: 42rem;
  }
  .docs-intro a {
    color: var(--rm-sage);
  }
  .docs-h2 {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--rm-text);
    margin: var(--space-6) 0 var(--space-3);
  }
  .docs-p {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-3);
    line-height: var(--leading-relaxed);
  }
  .tools-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: var(--space-5);
    font-size: var(--text-sm);
  }
  .tools-table th {
    text-align: left;
    font-weight: 600;
    color: var(--rm-text);
    padding: var(--space-2) var(--space-3);
    border-bottom: 2px solid var(--rm-border);
  }
  .tools-table td {
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--rm-border);
    color: var(--rm-muted);
  }
  .tools-table code {
    font-family: "JetBrains Mono", monospace;
    font-size: var(--text-xs);
    color: var(--rm-text);
  }
  .inline-code {
    font-family: "JetBrains Mono", monospace;
    font-size: var(--text-xs);
    background: var(--rm-surface);
    padding: 0.1rem 0.3rem;
    border-radius: var(--rm-radius);
    border: 1px solid var(--rm-border);
  }
  .code-block {
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-3) var(--space-4);
    font-family: "JetBrains Mono", monospace;
    font-size: var(--text-xs);
    color: var(--rm-text);
    overflow-x: auto;
    margin: 0 0 var(--space-4);
  }
  .docs-links {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .docs-links li {
    margin-bottom: var(--space-2);
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .docs-links a {
    color: var(--rm-sage);
    font-weight: 500;
    text-decoration: none;
  }
  .docs-links a:hover {
    text-decoration: underline;
  }
</style>
