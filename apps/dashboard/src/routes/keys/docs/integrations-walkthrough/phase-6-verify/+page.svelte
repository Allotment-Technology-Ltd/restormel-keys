<script lang="ts">
  import { getIntegrationsWalkthroughPrevNext } from "$lib/docs-integrations-walkthrough-nav";
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";
  import AgentPromptsSection from "$lib/components/walkthrough/AgentPromptsSection.svelte";
  import WalkthroughPhaseNav from "$lib/components/walkthrough/WalkthroughPhaseNav.svelte";

  const { prev, next, stepOf } = getIntegrationsWalkthroughPrevNext("phase-6-verify");

  const agentPrompts = [
    {
      id: "i08-verify",
      title: "Prompt I08 — Verify and document",
      intent: "Run the Phase 6 verification checklist and document completion.",
      contextDocs: ["This page: /keys/docs/integrations-walkthrough/phase-6-verify"],
      prompt: `You are working in [your app repo]. Goal: Run Phase 6 verification and document. Steps: 1) If CLI: run keys doctor (exit 0), keys models list, keys routing explain <model>. 2) Add Verification subsection: CLI verified, Dashboard checked, doc links in README; optional CLI in CI. 3) If you used agent prompts, add: "Integrations setup followed the Integrations walkthrough prompt index." DO NOT: Mark go live done if any step failed.`,
      gate: "Verification steps run; checklist and prompt-index reference (if applicable) in docs.",
    },
  ];
</script>

<svelte:head>
  <title>Phase 6 — Verify and go live — Integrations walkthrough</title>
  <meta name="description" content="CLI doctor, dashboard checks, go live checklist." />
</svelte:head>

<div class="doc-content">
  <p class="doc-meta"><span class="doc-step">{stepOf}</span></p>
  <h1>Phase 6 — Verify and go live</h1>
  <p class="doc-prereqs">
    <strong>Time:</strong> ~10 minutes<br />
    <strong>Prerequisites:</strong> At least one of Phase 2 (CLI), 3 (MCP), or 4 (AAIF) complete<br />
    <strong>You'll need:</strong> Terminal, Dashboard access
  </p>

  <p>This phase confirms your Integrations setup and gives you a short checklist for go live.</p>

  <h2>Step 6.1 — CLI verification</h2>
  <p>If you use the CLI:</p>
  <ol>
    <li>Run <code>npx keys doctor</code> — exit 0.</li>
    <li>Run <code>npx keys models list</code> — you see at least one provider's models.</li>
    <li>Run <code>npx keys routing explain &lt;model&gt;</code> — you see a resolution path.</li>
  </ol>
  <CodeBlock language="bash" code="npx keys doctor && npx keys models list" label="CLI" />
  <p><strong>How to test:</strong> All three commands complete without errors.</p>

  <h2>Step 6.2 — Dashboard verification</h2>
  <p>Open <a href="/keys/dashboard/dev-tools">Developer Tools</a>. Confirm overview and the tab for your surface (CLI, MCP, or AAIF) match your setup.</p>

  <h2>Step 6.3 — Document and share</h2>
  <p>Add a short section to your README or docs: "Restormel Integrations" with links to the CLI quickstart and/or MCP/AAIF docs. If you use the CLI in CI, add a step that runs <code>keys doctor</code>. If you used agent prompts, keep the <a href="/keys/docs/integrations-walkthrough/prompt-index">Prompt index</a> link.</p>

  <h2>Step 6.4 — Go live checklist</h2>
  <ul>
    <li>At least one surface (CLI / MCP / AAIF) installed and verified.</li>
    <li>Dashboard Developer Tools and usage path set.</li>
    <li>Doc links (or README) updated.</li>
    <li>Optional: CLI in CI; agent prompts documented.</li>
  </ul>

  <AgentPromptsSection
    intro="Optional. Use if a coding agent should run verification and add the checklist to docs."
    prompts={agentPrompts}
    defaultOpen={false}
  />

  <h2>Checkpoint</h2>
  <p>You now have CLI and/or Dashboard checks passing, documentation and optional CI or agent-prompt workflow in place, and the Integrations walkthrough complete.</p>

  <WalkthroughPhaseNav {prev} {next} {stepOf} />
</div>

<style>
  .doc-content { max-width: var(--rm-container-narrow); }
  .doc-meta { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-2); }
  .doc-prereqs { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-6); line-height: var(--leading-relaxed); }
  .doc-prereqs a { color: var(--rm-sage); }
  .doc-content h1 { font-family: var(--rm-font-display); font-size: var(--text-2xl); margin: 0 0 var(--space-4); }
  .doc-content h2 { font-size: var(--text-xl); margin: var(--space-6) 0 var(--space-3); }
  .doc-content p, .doc-content li { color: var(--rm-muted); line-height: var(--leading-relaxed); margin: 0 0 var(--space-4); }
  .doc-content ol { margin: 0 0 var(--space-4); padding-left: var(--space-5); }
  .doc-content ul { margin: 0 0 var(--space-4); padding-left: var(--space-5); }
  .doc-content a { color: var(--rm-sage); }
  .doc-content code { font-family: "JetBrains Mono", monospace; font-size: var(--text-sm); }
</style>
