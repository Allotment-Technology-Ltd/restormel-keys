<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { getIntegrationsWalkthroughPrevNext } from "$lib/docs-integrations-walkthrough-nav";
  import AgentPromptsSection from "$lib/components/walkthrough/AgentPromptsSection.svelte";
  import WalkthroughPhaseNav from "$lib/components/walkthrough/WalkthroughPhaseNav.svelte";

  const { prev, next, stepOf } = getIntegrationsWalkthroughPrevNext("phase-1-choose-workflow");

  const agentPrompts = [
    {
      id: "i02-choose-workflow",
      title: "Prompt I02 — Choose workflow and persist",
      intent: "Record the chosen usage path (app / terminal / agent) so later phases know which surface to configure.",
      contextDocs: [
        "This page: /keys/docs/integrations-walkthrough/phase-1-choose-workflow",
        "Dashboard: /keys/dashboard (usage path selector)",
      ],
      prompt: `You are working in [your app repo].

Goal: Record the chosen Integrations usage path so later phases know which surface to configure.

Steps:
1. Decide usage path: "app" | "terminal" | "agent" (or document that a human will choose in the Dashboard).
2. If automating: add to .env.example a placeholder RESTORMEL_USAGE_PATH= with a comment that values are app, terminal, or agent. Do not set a value in .env.
3. If not automating: document in README or docs that the user should open the Restormel Dashboard, go to Overview, and select "In my app" / "In my terminal" / "In my agent or IDE."

DO NOT: Commit a real value for RESTORMEL_USAGE_PATH. Overwrite any existing env docs without reading them first.`,
      gate: "Usage path is documented or env placeholder exists; no secrets.",
    },
  ];
</script>

<svelte:head>
  <title>Phase 1 — Choose your workflow — Integrations walkthrough</title>
  <meta name="description" content="In my app / terminal / agent — persist your choice and get the right quick-links." />
</svelte:head>

<div class="doc-content">
  <p class="doc-meta"><span class="doc-step">{stepOf}</span></p>
  <h1>Phase 1 — Choose your workflow</h1>
  <p class="doc-prereqs">
    <strong>Time:</strong> ~5 minutes<br />
    <strong>Prerequisites:</strong> <a href="/keys/docs/integrations-walkthrough/phase-0-overview">Phase 0</a> complete<br />
    <strong>You'll need:</strong> Access to the <a href={DASHBOARD_BASE}>Dashboard</a> (optional)
  </p>

  <p>This phase captures how you want to use Restormel: <strong>in my app</strong>, <strong>in my terminal</strong>, or <strong>in my agent or IDE</strong>. The choice drives which phases you do next and surfaces the right quick-links in the dashboard.</p>

  <h2>Step 1.1 — Choose a usage path</h2>
  <p>When you open the <a href={DASHBOARD_BASE}>Dashboard</a> overview, you see: <strong>"How do you want to use Restormel?"</strong></p>
  <ul>
    <li><strong>In my app</strong> — You integrate via the SDK and Cloud API. Focus on the <a href="/keys/docs/walkthrough">Keys walkthrough</a>. The CLI is still useful for validation and routing explain.</li>
    <li><strong>In my terminal</strong> — You want the CLI for doctor, validate, models list, routing explain. Proceed to <a href="/keys/docs/integrations-walkthrough/phase-2-cli">Phase 2 — CLI</a>.</li>
    <li><strong>In my agent or IDE</strong> — You want MCP tools. Proceed to <a href="/keys/docs/integrations-walkthrough/phase-3-mcp">Phase 3 — MCP</a>.</li>
  </ul>
  <p>You can change your answer later (Dismiss or Change on the dashboard).</p>

  <h2>Step 1.2 — Persist your selection</h2>
  <p>If you are in the Dashboard, click one of the three options. Your choice is stored in localStorage and the overview shows follow-up links (SDK docs, CLI quickstart, MCP setup). If you are implementing with an agent, the agent can add a config or env placeholder (e.g. <code>RESTORMEL_USAGE_PATH=</code>) so later phases know which path to configure.</p>
  <h3>How to test</h3>
  <p>Reload the dashboard overview. Your selection is still there. Click "Change" and pick a different option; confirm the links update.</p>

  <AgentPromptsSection
    intro="Optional. Use if a coding agent should record the usage path in your repo."
    prompts={agentPrompts}
    defaultOpen={false}
  />

  <h2>Checkpoint</h2>
  <p>You now have a chosen usage path (app / terminal / agent), persisted selection, and a clear next step: Phase 2 (CLI), Phase 3 (MCP), or the Keys walkthrough (app).</p>

  <WalkthroughPhaseNav {prev} {next} {stepOf} />
</div>

<style>
  .doc-content { max-width: var(--rm-container-narrow); }
  .doc-meta { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-2); }
  .doc-prereqs { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-6); line-height: var(--leading-relaxed); }
  .doc-prereqs a { color: var(--rm-sage); }
  .doc-content h1 { font-family: var(--rm-font-display); font-size: var(--text-2xl); margin: 0 0 var(--space-4); }
  .doc-content h2 { font-size: var(--text-xl); margin: var(--space-6) 0 var(--space-3); }
  .doc-content h3 { font-size: var(--text-base); margin: var(--space-4) 0 var(--space-2); }
  .doc-content p, .doc-content li { color: var(--rm-muted); line-height: var(--leading-relaxed); margin: 0 0 var(--space-4); }
  .doc-content ul { margin: 0 0 var(--space-4); padding-left: var(--space-5); }
  .doc-content a { color: var(--rm-sage); }
  .doc-content code { font-family: "JetBrains Mono", monospace; font-size: var(--text-sm); }
</style>
