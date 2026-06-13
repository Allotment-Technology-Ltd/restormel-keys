<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
</script>

<svelte:head>
  <title>Integrations walkthrough — Restormel</title>
  <meta name="description" content="From never heard of it to full implementation: CLI, MCP, AAIF. Same principles and layout as the Keys walkthrough, with agent prompts." />
</svelte:head>

<div class="doc-content">
  <h1>Integrations walkthrough</h1>
  <p class="doc-tagline">From "What is Restormel Integrations?" to having CLI, MCP, or AAIF installed, configured, and verified.</p>

  <p>Part of <a href="/keys/docs/tutorials">Keys tutorials</a>. This walkthrough is the onboarding journey for <strong>Restormel Integrations</strong> — the developer enablement layer (CLI, MCP, AAIF) that connects Restormel Keys to your terminal, agent workflows, and structured AI contracts. It uses the same principles, layout, and design as the <a href="/keys/docs/walkthrough">Keys walkthrough</a>: second person, present tense, step-by-step phases, and optional agent prompts (collapsed by default).</p>

  <h2>Before you begin</h2>
  <p>Prerequisites: a Restormel account (or plan to create one), and a choice of surface — <strong>CLI</strong> (terminal), <strong>MCP</strong> (agent/IDE), or <strong>AAIF</strong> (typed contract). Phase 1 helps you choose and persist that choice.</p>

  <h2>Phases</h2>
  <ol class="walkthrough-steps">
    <li><a href="/keys/docs/integrations-walkthrough/phase-0-overview"><strong>Phase 0 — What is Restormel Integrations?</strong></a> — Product model, when to use CLI/MCP/AAIF, relation to Keys.</li>
    <li><a href="/keys/docs/integrations-walkthrough/phase-1-choose-workflow"><strong>Phase 1 — Choose your workflow</strong></a> — In my app / terminal / agent; persist selection.</li>
    <li><a href="/keys/docs/integrations-walkthrough/phase-2-cli"><strong>Phase 2 — CLI</strong></a> — Install CLI, optional device login or env snippet, doctor, validate, models list, routing explain.</li>
    <li><a href="/keys/docs/integrations-walkthrough/phase-3-mcp"><strong>Phase 3 — MCP</strong></a> — Tool surface, schemas, connection (when runtime exists).</li>
    <li><a href="/keys/docs/integrations-walkthrough/phase-4-aaif"><strong>Phase 4 — AAIF</strong></a> — Request/response types, validation, when to use.</li>
    <li><a href="/keys/docs/integrations-walkthrough/phase-5-dashboard-docs"><strong>Phase 5 — Dashboard & docs</strong></a> — Developer Tools, Gateway keys / Connect CLI, usage path, doc links.</li>
    <li><a href="/keys/docs/integrations-walkthrough/phase-6-verify"><strong>Phase 6 — Verify and go live</strong></a> — CLI doctor, dashboard checks, checklist.</li>
    <li><a href="/keys/docs/integrations-walkthrough/prompt-index"><strong>Prompt index</strong></a> — All agent prompts in one place for sequential execution.</li>
  </ol>

  <h2>Implementing with a coding agent</h2>
  <p>Each phase page includes an <strong>"Agent prompts"</strong> section. It's collapsed by default so you only see it when you need it. Use it if you want a coding agent to implement that phase in your repo in a safe, gated sequence. Run prompts in order; stop if a gate fails. The <a href="/keys/docs/integrations-walkthrough/prompt-index">Prompt index</a> collects every prompt with context doc references.</p>

  <h2>Next</h2>
  <p><a href="/keys/docs/integrations-walkthrough/phase-0-overview">Phase 0 — What is Restormel Integrations?</a>. <a href="/keys/docs/integrations">Integrations overview</a> for CLI, MCP, AAIF reference. <a href={DASHBOARD_BASE}>Dashboard</a> for Developer Tools and usage path.</p>
</div>

<style>
  .doc-content {
    max-width: var(--rm-container-narrow);
  }
  .doc-tagline {
    font-size: var(--text-lg);
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
  }
  .doc-content h1 {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    margin: 0 0 var(--space-2);
  }
  .doc-content h2 {
    font-size: var(--text-lg);
    margin: var(--space-6) 0 var(--space-2);
  }
  .doc-content p {
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-4);
  }
  .doc-content a {
    color: var(--rm-sage);
  }
  .walkthrough-steps {
    padding-left: var(--space-6);
    margin: 0 0 var(--space-4);
  }
  .walkthrough-steps li {
    margin-bottom: var(--space-2);
  }
</style>
