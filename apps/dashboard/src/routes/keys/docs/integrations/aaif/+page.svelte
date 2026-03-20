<svelte:head>
  <title>AAIF — Integrations — Docs — Restormel Keys</title>
  <meta name="description" content="AAIF: Agent-to-Agent Interaction Format — a structured request/response contract for predictable AI interactions." />
</svelte:head>

<h1 class="docs-h1">AAIF</h1>
<p class="docs-intro">
  The Agent-to-Agent Interaction Format (AAIF) defines a structured request/response contract
  for predictable AI interactions. Use it to standardise how your application communicates
  task intent, cost constraints, and routing context.
</p>

<h2 class="docs-h2">Status</h2>
<p class="docs-p">
  AAIF is <strong>advanced</strong> — the type contract is defined and exported from
  <code class="inline-code">@restormel/aaif</code>. AAIF runtime helpers are available via
  <code class="inline-code">executeAAIFRequest()</code>. Before install, verify availability with
  <code class="inline-code">npm view @restormel/aaif version</code>.
</p>

<h2 class="docs-h2">Request</h2>
<pre class="code-block"><code>type AAIFRequest = &#123;
  input: string
  task?: "chat" | "completion" | "embedding"
  constraints?: &#123;
    maxCost?: number
    latency?: "low" | "balanced" | "high"
    tokens?: &#123;
      inputTokensM?: number
      outputTokensM?: number
    &#125;
  &#125;
  user?: &#123;
    id: string
    plan?: string
  &#125;
  routing?: &#123;
    model?: string
    provider?: string
  &#125;
&#125;</code></pre>

<h2 class="docs-h2">Response</h2>
<pre class="code-block"><code>type AAIFResponse = &#123;
  output: string
  provider: string
  model: string
  cost: number
  routing: &#123;
    reason: string
  &#125;
&#125;</code></pre>

<h2 class="docs-h2">Package</h2>
<p class="docs-p">
  Types, runtime guards, and the runtime helper are exported from <code class="inline-code">@restormel/aaif</code>:
</p>
<pre class="code-block"><code>import type &#123; AAIFRequest, AAIFResponse &#125; from "@restormel/aaif";
import &#123; isAAIFRequest, isAAIFResponse &#125; from "@restormel/aaif";</code></pre>

<h2 class="docs-h2">Use cases</h2>
<ul class="docs-list">
  <li><strong>Agent orchestration</strong> — standardise how agents request model completions with cost and latency constraints.</li>
  <li><strong>Routing transparency</strong> — responses include the routing reason so callers understand why a provider/model was chosen.</li>
  <li><strong>Cost control</strong> — the <code class="inline-code">maxCost</code> constraint caps estimated spend per request.</li>
</ul>

<h2 class="docs-h2">When to choose AAIF vs MCP vs CLI</h2>
<ul class="docs-list">
  <li><strong>AAIF</strong> — your app/service wants a typed contract and runtime helper for routing + cost estimation.</li>
  <li><strong>MCP</strong> — an agent or IDE wants to call Restormel tool surface (routing/cost/validation) via stdio.</li>
  <li><strong>CLI</strong> — you need local, developer-friendly inspection and debugging without embedding into runtime code.</li>
</ul>

<h2 class="docs-h2">Runtime helper</h2>
<p class="docs-p">
  The AAIF runtime helper resolves <strong>provider/model</strong> and estimates cost via
  <code class="inline-code">@restormel/keys</code>. Hosts can optionally provide the final model
  output via the <code class="inline-code">generate</code> callback.
</p>
<pre class="code-block"><code>import &#123; executeAAIFRequest &#125; from "@restormel/aaif";
import &#123; createKeys, openaiProvider &#125; from "@restormel/keys";

const keys = createKeys(
  &#123; routing: &#123; defaultProvider: "openai" &#125;, keys: [&#123; id: "k1", provider: "openai" &#125;] &#125;,
  &#123; providers: [openaiProvider] &#125;
);

const res = await executeAAIFRequest(
  &#123; input: "Summarise…", task: "chat", routing: &#123; model: "gpt-4o-mini" &#125; &#125;,
  keys,
  &#123; generate: async (ctx) => "output(cost=" + ctx.cost + ")" &#125;
);</code></pre>

<h2 class="docs-h2">Next steps</h2>
<ul class="docs-links">
  <li><a href="/keys/docs/integrations/cli">CLI quickstart</a> — terminal-based tools</li>
  <li><a href="/keys/docs/integrations/mcp">MCP setup</a> — connect to agent workflows</li>
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
  .docs-list {
    padding-left: var(--space-5);
    margin: 0 0 var(--space-5);
  }
  .docs-list li {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin-bottom: var(--space-2);
    line-height: var(--leading-relaxed);
  }
  .docs-list strong {
    color: var(--rm-text);
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
