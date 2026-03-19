<script lang="ts">
  import EmptyState from "$lib/components/EmptyState.svelte";
</script>

<h1 class="page-title">MCP</h1>
<p class="page-desc">
  Connect Restormel to your agent workflow via the Model Context Protocol. Use MCP tools from IDEs, agent
  frameworks, and automation pipelines.
</p>

<section class="section" aria-labelledby="status-heading">
  <h2 id="status-heading" class="section-title">Connection status</h2>
  <EmptyState
    title="MCP runs in your IDE or agent"
    description="Install @restormel/mcp, add restormel-mcp to your MCP client config (stdio), and open this tab as a reference. The dashboard does not host the stdio server."
  >
    <a href="/keys/docs/integrations/mcp" class="btn-link">MCP setup guide</a>
  </EmptyState>
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
      <code class="tool-name">entitlements.check</code>
      <span class="tool-desc">Check plan entitlements and feature access</span>
    </li>
    <li>
      <code class="tool-name">integration.generate</code>
      <span class="tool-desc">Generate integration configuration</span>
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
</style>
