<script lang="ts">
  /**
   * Tutorials hub — the single spine for step-by-step Keys learning.
   * Unifies what used to be three competing trees: "Choose your path" (personas),
   * the Keys integration walkthrough, and the Integrations (CLI/MCP/Dispatch) walkthrough.
   */
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { page } from "$app/stores";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

  $: flags = $page.data.moduleFlags ?? MVP_MODULE_DEFAULTS;
</script>

<svelte:head>
  <title>Tutorials — Restormel Keys</title>
  <meta
    name="description"
    content="Step-by-step Keys tutorials: choose your path by role, follow the integration walkthrough, or onboard CLI / MCP / Dispatch."
  />
</svelte:head>

<div class="doc-content">
  <h1>Tutorials</h1>
  <p class="doc-tagline">
    One place for every step-by-step path. Start with your role, then follow the walkthrough that fits. For task-focused
    reference, use <a href="/keys/docs">Guides</a>; for API and config, use the collapsed Reference in the sidebar.
  </p>

  <h2>Choose your path</h2>
  <p>Pick the persona closest to you. Each path routes you into the right walkthrough and guides.</p>
  <div class="intent-grid">
    <a class="intent-card" href="/keys/docs/journeys/new-project">
      <strong>Starting a new project</strong>
      <span>Routing plus your first resolve in 15–20 minutes.</span>
    </a>
    <a class="intent-card" href="/keys/docs/journeys/existing-stack">
      <strong>Adding control to an existing stack</strong>
      <span>OpenRouter / Vercel / Portkey plus the Restormel control-plane path.</span>
    </a>
    <a class="intent-card" href="/keys/docs/journeys/byok-saas">
      <strong>Adding BYOK to a SaaS</strong>
      <span>KeyManager plus policy-bounded model choice for end users.</span>
    </a>
    <a class="intent-card" href="/keys/docs/journeys/agent-ide">
      <strong>CLI, agent, or IDE path</strong>
      <span>Developer tooling path (CLI, MCP, Dispatch).</span>
    </a>
    <a class="intent-card" href="/keys/docs/journeys/platform-ops">
      <strong>Running platform operations</strong>
      <span>Lifecycle, readiness, coverage, CI/CD, governance.</span>
    </a>
  </div>

  <h2>Keys integration walkthrough</h2>
  <p>
    The primary end-to-end journey: from "I have an AI app" to a working integration that resolves, routes, enforces
    policies, and shows embeddable UI. Phases build on each other; each page has optional, collapsed agent prompts.
  </p>
  <ol class="walkthrough-steps">
    <li><a href="/keys/docs/walkthrough/phase-0-inventory">Phase 0 — Inventory your routing</a></li>
    <li><a href="/keys/docs/walkthrough/phase-1-install">Phase 1 — Install and configure</a></li>
    <li><a href="/keys/docs/walkthrough/phase-2-resolve">Phase 2 — Resolve your first model</a></li>
    <li><a href="/keys/docs/walkthrough/phase-3-routes">Phase 3 — Add routes and fallbacks</a></li>
    {#if flags.guardrails}
      <li><a href="/keys/docs/walkthrough/phase-4-policies">Phase 4 — Apply policies</a></li>
    {/if}
    <li><a href="/keys/docs/walkthrough/phase-5-ui">Phase 5 — Embed the UI</a></li>
    <li><a href="/keys/docs/walkthrough/phase-6-golive">Phase 6 — Go live</a></li>
  </ol>
  <p>
    <a href="/keys/docs/walkthrough">Walkthrough overview</a> · migration paths, verification strategy, and staging/CI
    setup are linked from there.
  </p>

  <h2>Integrations: CLI, MCP, Dispatch</h2>
  <p>
    The developer-enablement walkthrough for connecting Keys to your terminal, agent workflows, and typed AI contracts.
    Same shape as the integration walkthrough above — choose a surface, then install, configure, and verify.
  </p>
  <ol class="walkthrough-steps">
    <li><a href="/keys/docs/integrations-walkthrough/phase-0-overview">Phase 0 — What is Restormel Integrations?</a></li>
    <li><a href="/keys/docs/integrations-walkthrough/phase-1-choose-workflow">Phase 1 — Choose your workflow</a></li>
    <li><a href="/keys/docs/integrations-walkthrough/phase-2-cli">Phase 2 — CLI</a></li>
    <li><a href="/keys/docs/integrations-walkthrough/phase-3-mcp">Phase 3 — MCP</a></li>
    <li><a href="/keys/docs/integrations-walkthrough/phase-4-aaif">Phase 4 — Dispatch</a></li>
    <li><a href="/keys/docs/integrations-walkthrough/phase-6-verify">Phase 6 — Verify and go live</a></li>
  </ol>
  <p><a href="/keys/docs/integrations-walkthrough">Integrations walkthrough overview</a> · reference lives in the <a href="/keys/docs/integrations">Integrations hub</a>.</p>

  <h2>Next</h2>
  <p>
    <a href="/keys/docs/compatibility">Framework compatibility</a> for install commands ·
    <a href={DASHBOARD_BASE}>Dashboard</a> to create a project and Gateway key ·
    <a href="/keys/docs/cloud-api">Cloud API</a> for the gateway URL and OpenAPI.
  </p>
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
  .intent-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--space-3);
    margin: 0 0 var(--space-6);
  }
  .intent-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface-raised);
    padding: var(--space-3);
    text-decoration: none;
  }
  .intent-card strong {
    color: var(--rm-text);
    font-size: var(--text-sm);
  }
  .intent-card span {
    color: var(--rm-muted);
    font-size: var(--text-xs);
    line-height: 1.4;
  }
</style>
