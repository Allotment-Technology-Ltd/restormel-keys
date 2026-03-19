<script lang="ts">
  import { getIntegrationsWalkthroughPrevNext } from "$lib/docs-integrations-walkthrough-nav";
  import AgentPromptsSection from "$lib/components/walkthrough/AgentPromptsSection.svelte";
  import WalkthroughPhaseNav from "$lib/components/walkthrough/WalkthroughPhaseNav.svelte";

  const { prev, next, stepOf } = getIntegrationsWalkthroughPrevNext("phase-5-dashboard-docs");

  const agentPrompts = [
    {
      id: "i07-dashboard-docs",
      title: "Prompt I07 — Dashboard and doc links",
      intent: "Add a short Restormel Integrations section to README or docs with links to Dashboard and doc pages.",
      contextDocs: ["This page: /keys/docs/integrations-walkthrough/phase-5-dashboard-docs"],
      prompt: `You are working in [your app repo]. Goal: Add a "Restormel Integrations" section to README or docs. Steps: 1) Add section with links: Dashboard Developer Tools (/keys/dashboard/dev-tools), Integrations walkthrough (/keys/docs/integrations-walkthrough), and the reference for your surface (CLI, MCP, or AAIF). 2) One sentence on what you use. DO NOT: Paste URLs with secrets or session tokens.`,
      gate: "README or doc has an Integrations section with at least two correct links.",
    },
  ];
</script>

<svelte:head>
  <title>Phase 5 — Dashboard & docs — Integrations walkthrough</title>
  <meta name="description" content="Developer Tools section, usage path, doc links." />
</svelte:head>

<div class="doc-content">
  <p class="doc-meta"><span class="doc-step">{stepOf}</span></p>
  <h1>Phase 5 — Dashboard & docs</h1>
  <p class="doc-prereqs">
    <strong>Time:</strong> ~5 minutes<br />
    <strong>Prerequisites:</strong> Phases 0–2 (or 3–4) complete<br />
    <strong>You'll need:</strong> Restormel account, signed in to the Dashboard
  </p>

  <p>This phase ties the Integrations experience together: Developer Tools section, usage path, and doc links.</p>

  <h2>Step 5.1 — Developer Tools in the Dashboard</h2>
  <p>In the Dashboard sidebar, open <strong>Developer Tools</strong>. You see an overview with cards for CLI, MCP, AAIF and tabs: CLI (install + commands), MCP (connection + tools), AAIF (schema + logs when wired).</p>

  <h2>Step 5.2 — Usage path and quick links</h2>
  <p>On the Dashboard <strong>Overview</strong> page, the usage path selector shows your chosen workflow and links to SDK docs, CLI quickstart, or MCP setup, plus Developer tools and "Change."</p>

  <h2>Step 5.3 — Doc links</h2>
  <p>Bookmark: <a href="/keys/docs/integrations">Integrations overview</a>, <a href="/keys/docs/integrations-walkthrough">Integrations walkthrough</a>, <a href="/keys/docs/integrations/cli">CLI quickstart</a>, <a href="/keys/docs/integrations/mcp">MCP setup</a>, <a href="/keys/docs/integrations/aaif">AAIF overview</a>.</p>

  <AgentPromptsSection
    intro="Optional. Use if a coding agent should add Integrations section and links to your docs."
    prompts={agentPrompts}
    defaultOpen={false}
  />

  <h2>Checkpoint</h2>
  <p>You now have Developer Tools and usage path in use and doc links saved.</p>

  <WalkthroughPhaseNav {prev} {next} {stepOf} />
</div>

<style>
  .doc-content { max-width: var(--rm-container-narrow); }
  .doc-meta { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-2); }
  .doc-prereqs { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-6); line-height: var(--leading-relaxed); }
  .doc-content h1 { font-family: var(--rm-font-display); font-size: var(--text-2xl); margin: 0 0 var(--space-4); }
  .doc-content h2 { font-size: var(--text-xl); margin: var(--space-6) 0 var(--space-3); }
  .doc-content p { color: var(--rm-muted); line-height: var(--leading-relaxed); margin: 0 0 var(--space-4); }
  .doc-content a { color: var(--rm-sage); }
</style>
