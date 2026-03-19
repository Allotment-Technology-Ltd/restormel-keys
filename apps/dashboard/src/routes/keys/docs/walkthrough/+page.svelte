<script lang="ts">
  /** Walkthrough — integration journey entry. Content aligned with docs/walkthrough/00-index.md. */
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
</script>

<svelte:head>
  <title>Walkthrough — Restormel Keys</title>
  <meta name="description" content="Step-by-step integration walkthrough for Restormel Keys: install, resolve, routes, policies, UI, go live." />
</svelte:head>

<div class="doc-content">
  <h1>Integration walkthrough</h1>
  <p class="doc-tagline">From "I have an AI app" to "my app resolves, routes, enforces policies, and shows embeddable UI through Restormel Keys."</p>

  <p>This walkthrough is the primary onboarding journey. It takes you through install, first resolve call, routes and fallbacks, policies, embeddable UI, and go-live. Use it with the Dashboard and Cloud API (Zuplo) as you go.</p>

  <h2>Before you begin</h2>
  <p>Prerequisites: an existing AI-powered app, a Restormel account, and your routing inventory (what you use today for model selection).</p>

  <h2>Phases</h2>
  <ol class="walkthrough-steps">
    <li><a href="/keys/docs/walkthrough/phase-0-inventory"><strong>Phase 0 — Inventory</strong></a> — Audit existing routing and decide what to remove, keep, or wrap.</li>
    <li><a href="/keys/docs/walkthrough/phase-1-install"><strong>Phase 1 — Install and configure</strong></a> — Packages, dashboard project, Gateway Key, Restormel Doctor (framework and config; Cloud env is verified in Phase 2).</li>
    <li><a href="/keys/docs/walkthrough/phase-2-resolve"><strong>Phase 2 — Resolve your first model</strong></a> — One resolve call from your backend; verify <code>providerType</code> and <code>modelId</code> in the response.</li>
    <li><a href="/keys/docs/walkthrough/phase-3-routes"><strong>Phase 3 — Add routes and fallbacks</strong></a> — Create routes with steps in the Dashboard; configure fallback chain; wire route IDs.</li>
    <li><a href="/keys/docs/walkthrough/phase-4-policies"><strong>Phase 4 — Apply policies</strong></a> — Model allowlist, deprecated-model block, budget cap; use the evaluate endpoint from your backend with your project <strong>Gateway Key</strong> (or from dashboard session).</li>
    <li><a href="/keys/docs/walkthrough/phase-5-ui"><strong>Phase 5 — Embed the UI</strong></a> — ModelSelector and optional KeyManager; policy-filtered model list via a server-side proxy.</li>
    <li><a href="/keys/docs/walkthrough/phase-6-golive"><strong>Phase 6 — Go live</strong></a> — Parallel run, cutover, smoke test, legacy code removal.</li>
    <li><a href="/keys/docs/walkthrough/migration-paths"><strong>Migration paths</strong></a> — LiteLLM, Portkey, OpenRouter, custom.</li>
    <li><a href="/keys/docs/walkthrough/verification-strategy"><strong>Verification strategy</strong></a> — Dashboard, CLI, smoke tests; ongoing monitoring and CI.</li>
    <li><a href="/keys/docs/walkthrough/staging-and-ci-setup"><strong>Staging and CI setup</strong></a> — Non-production project, secrets (where to get them, what to call them, where to save them, how to rotate); nightly and post-deploy.</li>
  </ol>

  <h2>Implementing with a coding agent</h2>
  <p>Each phase page includes an <strong>“Agent prompts”</strong> section. It’s collapsed by default so you only see it when you need it. Use it if you want a coding agent to review the docs for that phase and implement it in your repo in a safe, gated sequence.</p>

  <h2>Auth at a glance</h2>
  <ul>
    <li><strong>Gateway Key</strong> — Resolve API and backend policy evaluate calls for your project; keep it server-side only.</li>
    <li><strong>Session</strong> — Dashboard UI (Sign in with GitHub) and policy testing from the dashboard.</li>
  </ul>

  <h2>Next</h2>
  <p><a href="/keys/docs/compatibility">Framework compatibility</a> for install commands. <a href={DASHBOARD_BASE}>Dashboard</a> to create a project and generate a Gateway Key. <a href="/keys/docs/cloud-api">Cloud API</a> for gateway URL and Zuplo.</p>
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
  .walkthrough-steps {
    padding-left: var(--space-6);
    margin: 0 0 var(--space-4);
  }
  .walkthrough-steps li {
    margin-bottom: var(--space-2);
  }
</style>
