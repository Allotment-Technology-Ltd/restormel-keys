<svelte:head>
  <title>Hosted MCP — BYO execution default — Restormel Keys</title>
  <meta
    name="description"
    content="Roadmap posture: hosted MCP transport and policy with customer-owned execution; HTTP suite invoke today."
  />
</svelte:head>

<div class="doc-content">
  <h1>Hosted MCP (BYO execution default)</h1>
  <p class="doc-intro">
    <strong>Today:</strong> run <code>restormel-mcp</code> locally (stdio) or call the dashboard
    <code>POST …/keys/dashboard/api/suite/invoke</code> mirror with a Gateway key—execution of your LLM calls stays in <strong>your</strong> stack.
  </p>

  <h2>Product direction</h2>
  <ul>
    <li><strong>Hosted MCP transport + auth</strong> — durable endpoint so IDEs need not run Node locally.</li>
    <li><strong>BYO backend</strong> — tools resolve policies and project state; model calls forward to <strong>your</strong> URLs / BYOK providers.</li>
    <li><strong>GPU bridge tools</strong> — register/probe private OpenAI-compatible routes (pairs with BYO-GPU guides).</li>
  </ul>

  <div class="callout callout-warn">
    <strong>Security</strong> — Multi-tenant MCP needs strict tool allowlists and threat modeling. Do not route arbitrary tool execution through Restormel until reviewed.
  </div>

  <p>
    See also: <a href="/keys/docs/integrations/mcp">MCP setup</a> and
    <a href="/keys/docs/guides/byo-gpu-vm">BYO-GPU VM path</a>.
  </p>
</div>

<style>
  .doc-content {
    max-width: var(--rm-container-narrow);
  }
  .doc-intro {
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
    line-height: var(--leading-relaxed);
  }
  .doc-content h1 {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    margin: 0 0 var(--space-4);
  }
  .doc-content h2 {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    margin: var(--space-8) 0 var(--space-3);
  }
  .doc-content p,
  .doc-content li {
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-3);
  }
  .doc-content ul {
    margin: 0 0 var(--space-4);
    padding-left: var(--space-5);
  }
  .callout {
    border-radius: var(--radius-md);
    padding: var(--space-4);
    margin: var(--space-6) 0;
  }
  .callout-warn {
    background: color-mix(in srgb, var(--rm-amber) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--rm-amber) 40%, transparent);
  }
</style>
