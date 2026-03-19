<svelte:head>
  <title>MCP — Integrations — Docs — Restormel Keys</title>
  <meta name="description" content="Set up Restormel MCP tools for agent workflows and IDE integrations." />
</svelte:head>

<h1 class="docs-h1">MCP</h1>
<p class="docs-intro">
  The Restormel MCP package exposes tools that agents and IDEs can call via the
  <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer">Model Context Protocol</a>.
  Use these tools to query models, estimate costs, explain routing, and more — directly from your
  agent workflow.
</p>

<h2 class="docs-h2">Runtime server</h2>
<p class="docs-p">
  <code class="inline-code">@restormel/mcp</code> ships a <strong>stdio MCP server</strong> you run locally
  (Cursor, Claude Desktop, Codex, etc.). Install the package, then point your client at
  <code class="inline-code">pnpm exec restormel-mcp</code> or <code class="inline-code">npx restormel-mcp</code>.
  See the package <a href="https://github.com/Allotment-Technology-Ltd/restormel-keys/tree/main/packages/mcp#readme">README</a> for env vars and security notes.
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
    <tr><td><code>entitlements.check</code></td><td>Check plan entitlements and feature access</td></tr>
    <tr><td><code>integration.generate</code></td><td>Generate integration configuration for a stack</td></tr>
    <tr><td><code>docs.search</code></td><td>Search Restormel documentation</td></tr>
  </tbody>
</table>

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
