<script lang="ts">
  import { getIntegrationsWalkthroughPrevNext } from "$lib/docs-integrations-walkthrough-nav";
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";
  import AgentPromptsSection from "$lib/components/walkthrough/AgentPromptsSection.svelte";
  import WalkthroughPhaseNav from "$lib/components/walkthrough/WalkthroughPhaseNav.svelte";

  const { prev, next, stepOf } = getIntegrationsWalkthroughPrevNext("phase-3-mcp");

  const agentPrompts = [
    {
      id: "i05-mcp-schemas",
      title: "Prompt I05 — MCP schemas install",
      intent: "Install @restormel/mcp and confirm you can import the tool definitions.",
      contextDocs: [
        "This page: /keys/docs/integrations-walkthrough/phase-3-mcp",
        "/keys/docs/integrations/mcp",
      ],
      prompt: `You are working in [your repo or an agent/MCP server repo]. Goal: Install @restormel/mcp and confirm you can import the tool definitions. Steps: 1) Add @restormel/mcp. 2) Import ALL_TOOLS and modelsListTool; log ALL_TOOLS.length and modelsListTool.name ("models.list"). 3) Document: "Restormel MCP tool schemas from @restormel/mcp; runtime server via restormel-mcp stdio; server-side env for cloud: RESTORMEL_EVALUATE_URL (full …/policies/evaluate) + RESTORMEL_GATEWAY_KEY vs RESTORMEL_CONTROL_PLANE_URL (dashboard base …/keys/dashboard) for routes.* / policies.* — see runbook mcp-implementation-workflow.md." DO NOT: Implement a full MCP server unless the task explicitly asks.`,
      gate: "Package installed; import works; docs mention MCP.",
    },
  ];
</script>

<svelte:head>
  <title>Phase 3 — MCP — Integrations walkthrough</title>
  <meta name="description" content="Tool surface, schemas, connection when runtime exists." />
</svelte:head>

<div class="doc-content">
  <p class="doc-meta"><span class="doc-step">{stepOf}</span></p>
  <h1>Phase 3 — MCP</h1>
  <p class="doc-prereqs">
    <strong>Time:</strong> ~15 minutes<br />
    <strong>Prerequisites:</strong> <a href="/keys/docs/integrations-walkthrough/phase-1-choose-workflow">Phase 1</a> complete; you chose "In my agent or IDE" or want MCP<br />
    <strong>You'll need:</strong> Understanding of <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer">Model Context Protocol</a>; optional: an MCP client
  </p>

  <p>This phase introduces the Restormel MCP tool surface. <strong>Tool schemas</strong> are defined in <code>@restormel/mcp</code>; runtime is available via the stdio server binary <code>restormel-mcp</code> (and optional custom transports via <code>createRestormelMcpServer()</code>).</p>

  <h2>Step 3.1 — Understand the tool surface</h2>
  <p>
    Core tools include <strong>models.list</strong>, <strong>providers.validate</strong>, <strong>cost.estimate</strong>, <strong>routing.explain</strong>, <strong>entitlements.check</strong>, <strong>integration.generate</strong>, <strong>docs.search</strong>, plus rollout helpers (control-plane CRUD, bootstrap, BYOK contracts, <strong>readiness.check</strong>, etc.). See
    <a href="/keys/docs/integrations/mcp">MCP reference</a> and the repo runbook
    <a href="https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/runbooks/mcp-implementation-workflow.md">mcp-implementation-workflow.md</a> for the <strong>server-side env journey</strong> (evaluate URL vs control-plane base).
  </p>

  <h2>Step 3.2 — Install the MCP package (schemas)</h2>
  <CodeBlock language="bash" code="pnpm add @restormel/mcp" label="CLI" />
  <CodeBlock language="typescript" code={`import { ALL_TOOLS, modelsListTool } from "@restormel/mcp";`} label="TypeScript" />
  <p>Use these to build or customise an MCP server (e.g. with <code>@modelcontextprotocol/sdk</code>). You can also run the provided stdio server binary: <code>pnpm exec restormel-mcp</code>.</p>

  <h2>Step 3.3 — Dashboard</h2>
  <p>In <a href="/keys/dashboard/dev-tools/mcp">Dashboard → Developer Tools → MCP</a> you can see connection status, available tools, and recent calls when wired. For now the tab shows the tool list and links to the MCP setup guide.</p>
  <p><strong>How to test:</strong> You have <code>@restormel/mcp</code> installed and can import <code>ALL_TOOLS</code>.</p>

  <AgentPromptsSection
    intro="Optional. Use if a coding agent should install @restormel/mcp and verify imports."
    prompts={agentPrompts}
    defaultOpen={false}
  />

  <h2>Checkpoint</h2>
  <p>You now have clarity on the MCP tool surface, <code>@restormel/mcp</code> installed and importable, and the Dashboard MCP tab bookmarked.</p>

  <WalkthroughPhaseNav {prev} {next} {stepOf} />
</div>

<style>
  .doc-content { max-width: var(--rm-container-narrow); }
  .doc-meta { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-2); }
  .doc-prereqs { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-6); line-height: var(--leading-relaxed); }
  .doc-prereqs a { color: var(--rm-sage); }
  .doc-content h1 { font-family: var(--rm-font-display); font-size: var(--text-2xl); margin: 0 0 var(--space-4); }
  .doc-content h2 { font-size: var(--text-xl); margin: var(--space-6) 0 var(--space-3); }
  .doc-content p { color: var(--rm-muted); line-height: var(--leading-relaxed); margin: 0 0 var(--space-4); }
  .doc-content a { color: var(--rm-sage); }
  .doc-content code { font-family: "JetBrains Mono", monospace; font-size: var(--text-sm); }
</style>
