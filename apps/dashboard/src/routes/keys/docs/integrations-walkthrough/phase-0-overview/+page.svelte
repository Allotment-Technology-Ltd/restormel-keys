<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { getIntegrationsWalkthroughPrevNext } from "$lib/docs-integrations-walkthrough-nav";
  import AgentPromptsSection from "$lib/components/walkthrough/AgentPromptsSection.svelte";
  import WalkthroughPhaseNav from "$lib/components/walkthrough/WalkthroughPhaseNav.svelte";

  const { prev, next, stepOf } = getIntegrationsWalkthroughPrevNext("phase-0-overview");

  const agentPrompts = [
    {
      id: "i01-overview",
      title: "Prompt I01 — Review Phase 0 (no code changes)",
      intent: "Have an agent read Phase 0 and the Integrations spec and produce a short summary of what Integrations is and when to use CLI vs MCP vs Dispatch.",
      contextDocs: [
        "This page: /keys/docs/integrations-walkthrough/phase-0-overview",
        "docs/integrations/INTEGRATIONS-FULL-SPEC.md §0–1",
      ],
      prompt: `You are working in [your repo or the restormel-keys repo].

Goal: Review the Restormel Integrations walkthrough Phase 0 and produce a one-paragraph summary of what Integrations is and when you would use CLI vs MCP vs Dispatch. No code changes.

Steps:
1. Read Phase 0 (What is Restormel Integrations?) in full.
2. Read the Integrations full spec §0 (Purpose) and §1 (Product model).
3. Write 2–3 sentences: what Integrations is, and which surface (CLI / MCP / Dispatch) applies to "terminal workflow," "agent/IDE workflow," and "structured AI contract."

DO NOT: Install packages. Modify any code. Commit.`,
      gate: "You have a short written summary; no repo changes.",
    },
  ];
</script>

<svelte:head>
  <title>Phase 0 — What is Restormel Integrations? — Integrations walkthrough</title>
  <meta name="description" content="Product model, when to use CLI/MCP/Dispatch, and how Integrations relates to Keys." />
</svelte:head>

<div class="doc-content">
  <p class="doc-meta"><span class="doc-step">{stepOf}</span></p>
  <h1>Phase 0 — What is Restormel Integrations?</h1>
  <p class="doc-prereqs">
    <strong>Time:</strong> ~5 minutes<br />
    <strong>Prerequisites:</strong> None<br />
    <strong>You'll need:</strong> A browser; optional: Restormel account
  </p>

  <p>This phase establishes what Restormel Integrations is, how it relates to Restormel Keys, and when to use which surface (CLI, MCP, Dispatch).</p>

  <h2>Product model</h2>
  <ul>
    <li><strong>Restormel Keys</strong> — Core. BYOK, routing, cost, entitlements. You use it from your app via the SDK and Cloud API.</li>
    <li><strong>Restormel Integrations</strong> — Developer surfaces. Connects Keys to your <strong>terminal</strong> (CLI), <strong>agent/IDE</strong> (MCP), and <strong>structured AI contracts</strong> (Dispatch).</li>
    <li><strong>Future Restormel</strong> — Graph, evaluation, reasoning (out of scope for this walkthrough).</li>
  </ul>
  <p>Integrations does not replace Keys. It makes Keys usable from more places.</p>

  <h2>When to use which surface</h2>
  <table class="docs-table">
    <thead>
      <tr><th>Surface</th><th>Status</th><th>Use when</th></tr>
    </thead>
    <tbody>
      <tr><td><strong>CLI</strong></td><td>Available</td><td>You want terminal-based doctor, validate, models list, routing explain</td></tr>
      <tr><td><strong>MCP</strong></td><td>Early</td><td>You want agents or IDEs to call Restormel tools</td></tr>
      <tr><td><strong>Dispatch</strong></td><td>Advanced</td><td>You want a typed request/response contract for AI interactions</td></tr>
    </tbody>
  </table>

  <h2>Step 0.1 — Confirm your starting point</h2>
  <p>You either already use Restormel Keys (project, Gateway Key, routes) — then Integrations adds CLI/MCP/Dispatch on top — or you are new to Restormel. If new, start with the <a href="/keys/docs/walkthrough">Keys walkthrough</a> for install and first resolve; then return here for Integrations phases 1–6.</p>

  <AgentPromptsSection
    intro="Optional. Use if you're implementing with a coding agent and want a gated review of Phase 0."
    prompts={agentPrompts}
    defaultOpen={false}
  />

  <h2>Checkpoint</h2>
  <p>You now have a clear picture of what Restormel Integrations is and how it relates to Keys, and a decision on whether to complete the Keys walkthrough first or proceed to Phase 1.</p>

  <WalkthroughPhaseNav {prev} {next} {stepOf} />
</div>

<style>
  .doc-content { max-width: var(--rm-container-narrow); }
  .doc-meta { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-2); }
  .doc-step { font-weight: var(--font-medium); }
  .doc-prereqs { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-6); line-height: var(--leading-relaxed); }
  .doc-content h1 { font-family: var(--rm-font-display); font-size: var(--text-2xl); margin: 0 0 var(--space-4); }
  .doc-content h2 { font-size: var(--text-xl); margin: var(--space-8) 0 var(--space-3); }
  .doc-content p, .doc-content li { color: var(--rm-muted); line-height: var(--leading-relaxed); margin: 0 0 var(--space-4); }
  .doc-content ul { margin: 0 0 var(--space-4); padding-left: var(--space-5); }
  .docs-table { width: 100%; border-collapse: collapse; margin: 0 0 var(--space-4); font-size: var(--text-sm); }
  .docs-table th { text-align: left; font-weight: 600; padding: var(--space-2) var(--space-3); border-bottom: 2px solid var(--rm-border); }
  .docs-table td { padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--rm-border); color: var(--rm-muted); }
  .doc-content a { color: var(--rm-sage); }
</style>
