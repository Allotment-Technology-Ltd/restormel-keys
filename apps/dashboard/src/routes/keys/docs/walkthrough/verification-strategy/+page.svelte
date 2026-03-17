<script lang="ts">
  /** Verification strategy. Progressive disclosure: checklist + expandable sections. */
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { getWalkthroughPrevNext } from "$lib/docs-walkthrough-nav";
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";
  import WalkthroughChecklist from "$lib/components/walkthrough/WalkthroughChecklist.svelte";
  import WalkthroughStep from "$lib/components/walkthrough/WalkthroughStep.svelte";
  import WalkthroughPhaseNav from "$lib/components/walkthrough/WalkthroughPhaseNav.svelte";

  const { prev, next, stepOf } = getWalkthroughPrevNext("verification-strategy");
  const phaseSlug = "verification-strategy";

  const verificationSteps = [
    { id: "layers", label: "1. Verification layers" },
    { id: "dashboard", label: "2. Dashboard checks" },
    { id: "cli", label: "3. CLI checks" },
    { id: "smoke", label: "4. Smoke tests" },
    { id: "monitoring", label: "5. Ongoing monitoring recommendations" },
    { id: "schedule", label: "6. Verification schedule summary" },
  ];
</script>

<svelte:head>
  <title>Verification strategy — Restormel Keys</title>
  <meta name="description" content="Dashboard checks, CLI checks, and smoke tests for Restormel Keys — during rollout and ongoing." />
</svelte:head>

<div class="doc-content">
  <p class="doc-meta"><span class="doc-step">{stepOf}</span></p>
  <h1>Verification strategy</h1>
  <p class="doc-intro">Canonical verification approach for Restormel Keys integrations — during rollout and ongoing.</p>
  <p>This document defines three layers of verification: <strong>dashboard checks</strong> (visual, no code), <strong>CLI checks</strong> (terminal, scriptable), and <strong>smoke tests</strong> (HTTP, automatable). Use all three during cutover (Phase 6) and the first two on an ongoing basis.</p>

  <WalkthroughStep stepId="layers" title="1. Verification layers" defaultOpen={true} {phaseSlug}>
  <table class="doc-table">
    <thead>
      <tr><th>Layer</th><th>When to use</th><th>Who runs it</th><th>Automatable?</th></tr>
    </thead>
    <tbody>
      <tr><td><strong>Dashboard</strong></td><td>After any config change (route, policy, credential); during cutover monitoring</td><td>Human (or browser automation)</td><td>Partially</td></tr>
      <tr><td><strong>CLI</strong></td><td>After install, before deploy, in CI, during cutover</td><td>Human or CI</td><td>Yes</td></tr>
      <tr><td><strong>Smoke tests</strong></td><td>After deploy, during cutover, as a scheduled health check</td><td>CI or cron</td><td>Yes</td></tr>
    </tbody>
  </table>
  </WalkthroughStep>

  <WalkthroughStep stepId="dashboard" title="2. Dashboard checks" {phaseSlug}>
  <p>Open the <a href={DASHBOARD_BASE}>Dashboard</a> and verify the following. These checks require no code — just visual confirmation. You can also try the embeddable KeyManager and ModelSelector and run doctor/validate-style checks in the <a href={DASHBOARD_BASE + "/sandbox"}>Sandbox</a> (after signing in).</p>

  <h3>2.1 Project health</h3>
  <table class="doc-table">
    <thead>
      <tr><th>What to check</th><th>Where</th><th>Expected</th></tr>
    </thead>
    <tbody>
      <tr><td>Project exists</td><td>Projects list</td><td>Your project is listed</td></tr>
      <tr><td>Environment exists</td><td>Project → Environments</td><td><code>production</code> (and <code>staging</code> if used)</td></tr>
      <tr><td>Gateway Key exists</td><td>Project → API Keys</td><td>At least one key with <code>rk_…</code> prefix</td></tr>
      <tr><td>Provider credentials valid</td><td>Project → Provider Credentials</td><td>Green "valid" status for each configured provider</td></tr>
    </tbody>
  </table>

  <h3>2.2 Route health</h3>
  <table class="doc-table">
    <thead>
      <tr><th>What to check</th><th>Where</th><th>Expected</th></tr>
    </thead>
    <tbody>
      <tr><td>Routes exist</td><td>Project → Routes</td><td>At least one route (e.g. <code>ingestion</code>, <code>interactive</code>)</td></tr>
      <tr><td>Steps in correct order</td><td>Route detail</td><td>Steps listed in your intended fallback order</td></tr>
      <tr><td>Route mode correct</td><td>Route detail</td><td><code>fallback_chain</code> (or your intended mode)</td></tr>
    </tbody>
  </table>

  <h3>2.3 Policy health</h3>
  <table class="doc-table">
    <thead>
      <tr><th>What to check</th><th>Where</th><th>Expected</th></tr>
    </thead>
    <tbody>
      <tr><td>Policies exist</td><td>Project → Policies</td><td>At least one policy (e.g. <code>model_allowlist</code>)</td></tr>
      <tr><td>Policy scope correct</td><td>Policy detail</td><td>Scoped to the right project/environment</td></tr>
      <tr><td>No conflicting policies</td><td>Policies list</td><td>No two policies that contradict each other</td></tr>
    </tbody>
  </table>

  <h3>2.4 Usage and logs</h3>
  <table class="doc-table">
    <thead>
      <tr><th>What to check</th><th>Where</th><th>Expected</th></tr>
    </thead>
    <tbody>
      <tr><td>Request count non-zero</td><td>Project → Usage</td><td>After cutover, requests appear</td></tr>
      <tr><td>No error spikes</td><td>Project → Usage / Logs</td><td>Error rate comparable to or lower than pre-cutover</td></tr>
      <tr><td>Correct route distribution</td><td>Project → Usage</td><td>Traffic hitting the expected routes</td></tr>
    </tbody>
  </table>
  </WalkthroughStep>

  <WalkthroughStep stepId="cli" title="3. CLI checks" {phaseSlug}>
  <p>These checks run in a terminal and can be scripted into CI.</p>

  <h3>3.1 <code>keys doctor</code></h3>
  <CodeBlock language="bash" code="npx @restormel/doctor" />
  <p><strong>Checks:</strong> Framework detection, packages installed, config file validity, and whether local provider keys are present (if you use them).</p>
  <p><strong>Expected:</strong> Exit code 0, all checks green.</p>
  <p><strong>When to run:</strong> After install (Phase 1), before every deploy, in CI on every PR.</p>

  <h3>3.2 <code>keys validate</code></h3>
  <CodeBlock language="bash" code="npx @restormel/validate" />
  <p><strong>Checks:</strong> Re-validates all stored provider keys (makes lightweight test calls to each provider).</p>
  <p><strong>Expected:</strong> Exit code 0 if all keys are valid. Exit code 1 if any key is invalid or expired.</p>
  <p><strong>When to run:</strong> Before deploy, in CI on a schedule (e.g. daily), after rotating any provider keys.</p>
  <div class="callout callout-tip">
    <strong>Tip</strong> — <code>keys validate</code> with exit code 1 is designed for CI gates. Add it to your deploy pipeline so deploys fail if a provider key has been revoked or expired.
  </div>
  <CodeBlock language="yaml" code={`# .github/workflows/deploy.yml
- name: Validate Restormel keys
  run: npx @restormel/validate`} />

  <h3>3.3 <code>keys estimate</code> (optional)</h3>
  <CodeBlock language="bash" code="npx @restormel/keys-cli estimate gpt-4o --input 1000 --output 500" />
  <p><strong>Checks:</strong> Returns the estimated cost for a given model and token count.</p>
  <p><strong>When to run:</strong> Before enabling a new model in a route, to understand cost implications.</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="smoke" title="4. Smoke tests" {phaseSlug}>
  <p>HTTP-based tests that verify the resolve endpoint and policy evaluation. Automatable; run after every deploy and on a schedule.</p>

  <h3>4.1 Resolve smoke test</h3>
  <p>POST to the resolve endpoint with your project ID, environment, and route ID. Expect HTTP 200 and a non-null <code>providerType</code> (and <code>modelId</code>) in the response. Use <code>RESTORMEL_GATEWAY_KEY</code> for auth.</p>
  <p><strong>Expected:</strong> HTTP 200, non-null provider in response.</p>

  <h3>4.2 Fallback smoke test</h3>
  <p>Create a dedicated <strong>test route</strong> in the dashboard with a deliberately failing first step (e.g. invalid provider), then a second step (e.g. OpenAI). Call resolve for that route and confirm the result is the fallback provider.</p>
  <p><strong>Expected:</strong> Resolve returns the fallback step's provider.</p>

  <h3>4.3 Policy smoke test</h3>
  <p>Call the policy evaluate endpoint for an allowed model (expect <code>allowed: true</code>) and for a blocked model (expect <code>allowed: false</code>). Use <code>RESTORMEL_MANAGEMENT_KEY</code> for auth.</p>

  <h3>4.4 Combined smoke test script</h3>
  <p>The script from Phase 6 (Step 6.4) combines all checks:</p>
  <CodeBlock language="bash" code="pnpm run smoke:restormel" />
  </WalkthroughStep>

  <WalkthroughStep stepId="monitoring" title="5. Ongoing monitoring recommendations" {phaseSlug}>
  <table class="doc-table">
    <thead>
      <tr><th>What</th><th>How</th><th>Frequency</th></tr>
    </thead>
    <tbody>
      <tr><td>Resolve latency</td><td>Log time per <code>restormelResolve()</code> call; alert if p95 &gt; 200ms</td><td>Every request</td></tr>
      <tr><td>Resolve errors</td><td>Count errors from resolve client; alert on spike</td><td>Every request</td></tr>
      <tr><td>Fallback rate</td><td>Count fallback-to-legacy or next-step events; alert if &gt; 5%</td><td>Every request</td></tr>
      <tr><td>Credential expiry</td><td><code>keys validate</code> in CI; alert on exit code 1</td><td>Daily</td></tr>
      <tr><td>Policy violations</td><td>Dashboard logs; alert if unexpected blocks</td><td>Daily</td></tr>
      <tr><td>Budget utilisation</td><td>Dashboard usage; alert at 80% of cap</td><td>Daily</td></tr>
      <tr><td>Config drift</td><td><code>keys doctor</code> in CI; alert on warnings</td><td>Every deploy</td></tr>
    </tbody>
  </table>

  <div class="build-agent-block">
    <h3>Build-agent prompt: add-ci-verification</h3>
    <p><strong>Context docs</strong> (adapt for your project): this page; <a href="/keys/docs/walkthrough/phase-6-golive">Phase 6 — Go live</a> (smoke test script).</p>
    <p><strong>Goal:</strong> Add Restormel Keys verification steps to your CI pipeline. Add a step after build: <code>npx @restormel/doctor</code> (fail on non-zero exit). Add <code>npx @restormel/validate</code> (fail on non-zero exit; requires <code>RESTORMEL_GATEWAY_KEY</code> as a CI secret). Use a dedicated staging key in CI, not production. Optionally add post-deploy <code>pnpm run smoke:restormel</code> (gate behind env if staging isn't available in CI).</p>
    <p><strong>DO NOT:</strong> Use the production Gateway Key in CI. Commit secrets to the workflow file. Make the smoke test block deploys if it hits an unavailable endpoint.</p>
    <p><strong>Gate:</strong> CI runs <code>keys doctor</code> and <code>keys validate</code> on every PR; both pass; Gateway Key is a CI secret.</p>
  </div>
  </WalkthroughStep>

  <WalkthroughStep stepId="schedule" title="6. Verification schedule summary" {phaseSlug}>
  <table class="doc-table">
    <thead>
      <tr><th>Event</th><th>Checks to run</th></tr>
    </thead>
    <tbody>
      <tr><td><strong>Phase 1 complete</strong></td><td><code>keys doctor</code></td></tr>
      <tr><td><strong>Phase 2 complete</strong></td><td><code>keys doctor</code>, resolve curl test</td></tr>
      <tr><td><strong>Phase 3 complete</strong></td><td>Resolve with route ID, fallback test</td></tr>
      <tr><td><strong>Phase 4 complete</strong></td><td>Policy evaluate (allowed + blocked)</td></tr>
      <tr><td><strong>Phase 5 complete</strong></td><td>Visual: ModelSelector renders, callbacks fire</td></tr>
      <tr><td><strong>Phase 6 cutover</strong></td><td>Full smoke test, dashboard usage, error rate</td></tr>
      <tr><td><strong>Ongoing</strong></td><td><code>keys doctor</code> + <code>keys validate</code> in CI; smoke test on schedule; dashboard monitoring</td></tr>
    </tbody>
  </table>
  </WalkthroughStep>

  <p><strong>Checkpoint checklist:</strong> mark each section complete as you read it.</p>
  <WalkthroughChecklist phaseSlug={phaseSlug} steps={verificationSteps} />

  <p class="doc-footer">See the <a href="/keys/docs/walkthrough">Walkthrough</a> index for the full phase listing and related docs.</p>

  <WalkthroughPhaseNav {prev} {next} {stepOf} />
</div>

<style>
  .doc-content { max-width: var(--rm-container-narrow); }
  .doc-meta { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-2); }
  .doc-step { font-weight: var(--font-medium); }
  .doc-intro { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-2); font-style: italic; }
  .doc-content h1 { font-family: var(--rm-font-display); font-size: var(--text-2xl); margin: 0 0 var(--space-4); }
  .doc-content h3 { font-size: var(--text-lg); margin: var(--space-4) 0 var(--space-2); }
  .doc-content p { color: var(--rm-muted); line-height: var(--leading-relaxed); margin: 0 0 var(--space-4); }
  .doc-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 var(--space-4);
    font-size: var(--text-sm);
  }
  .doc-table th, .doc-table td {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rm-border);
    text-align: left;
  }
  .doc-table th { background: var(--rm-surface-raised); font-weight: var(--font-medium); }
  .doc-table td { color: var(--rm-muted); }
  .doc-table code { font-family: var(--rm-font-ui); font-size: 0.9em; }
  .build-agent-block {
    margin: var(--space-6) 0;
    padding: var(--space-4);
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
  }
  .build-agent-block h3 { margin-top: 0; }
  .doc-footer { margin-top: var(--space-6); font-size: var(--text-sm); color: var(--rm-muted); }
  .doc-footer a { color: var(--rm-primary); }
</style>
