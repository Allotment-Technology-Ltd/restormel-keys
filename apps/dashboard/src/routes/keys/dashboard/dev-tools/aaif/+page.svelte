<script lang="ts">
  import EmptyState from "$lib/components/EmptyState.svelte";
</script>

<h1 class="page-title">AAIF</h1>
<p class="page-desc">
  Agent-to-Agent Interaction Format — a structured request/response contract for predictable AI interactions.
  View request logs, routing explanations, and cost outputs.
</p>

<section class="section" aria-labelledby="schema-heading">
  <h2 id="schema-heading" class="section-title">Request / response schema</h2>
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
</section>

<section class="section" aria-labelledby="mapping-heading">
  <h2 id="mapping-heading" class="section-title">Core use-cases</h2>
  <p class="docs-p">
    Use AAIF to standardise how agents request work with explicit routing and spend constraints. The
    runtime helper resolves <strong>provider/model</strong> and estimates cost via
    <code class="inline-code">@restormel/keys</code>.
  </p>
  <ul class="docs-list">
    <li><strong>Keys:</strong> `keys.resolve()` + `keys.estimateCost()` power routing and cost estimation.</li>
    <li><strong>CLI:</strong> `keys routing explain` + `keys estimate` help debug the same decisions.</li>
    <li><strong>Validate:</strong> gates provider credential health before runtime usage.</li>
    <li><strong>Doctor:</strong> quick repo/config sanity checks (“is the catalog/routing wired?”).</li>
  </ul>
</section>

<section class="section" aria-labelledby="logs-heading">
  <h2 id="logs-heading" class="section-title">Request logs</h2>
  <EmptyState
    title="No AAIF requests yet"
    description="AAIF request logs with routing explanations and cost outputs will appear here."
  >
    <a href="/keys/docs/integrations/aaif" class="btn-link">AAIF documentation</a>
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
  .schema-cols {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: var(--space-4);
  }
  .schema-label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--rm-muted);
    margin: 0 0 var(--space-2);
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
    margin: 0;
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
