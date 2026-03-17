<script lang="ts">
  /** Phase 4 — Policies. Progressive disclosure: checklist + expandable steps. */
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { getWalkthroughPrevNext } from "$lib/docs-walkthrough-nav";
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";
  import AgentPromptsSection from "$lib/components/walkthrough/AgentPromptsSection.svelte";
  import WalkthroughChecklist from "$lib/components/walkthrough/WalkthroughChecklist.svelte";
  import WalkthroughStep from "$lib/components/walkthrough/WalkthroughStep.svelte";
  import WalkthroughPhaseNav from "$lib/components/walkthrough/WalkthroughPhaseNav.svelte";

  const { prev, next, stepOf } = getWalkthroughPrevNext("phase-4-policies");
  const phaseSlug = "phase-4-policies";

  const phase4Steps = [
    { id: "4.1", label: "Understand policy types" },
    { id: "4.2", label: "Create a model allowlist" },
    { id: "4.3", label: "Add a deprecated-model block" },
    { id: "4.4", label: "Add a budget cap" },
    { id: "4.5", label: "Test policy stacking" },
    { id: "4.6", label: "Handle policy errors in your resolve wrapper" },
  ];

  const curlEvaluate = `curl -s -X POST \\
  "https://restormel.dev/keys/dashboard/api/policies/evaluate" \\
  -H "Authorization: Bearer \${RESTORMEL_MANAGEMENT_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "projectId": "'\${RESTORMEL_PROJECT_ID}'",
    "environmentId": "production",
    "modelId": "gpt-4-0314",
    "providerType": "openai"
  }' | jq '.data'`;

  const curlStacking = `curl -s -X POST "..." /api/policies/evaluate \\
  -H "Authorization: Bearer \${RESTORMEL_MANAGEMENT_KEY}" \\
  -d '{ "projectId": "...", "environmentId": "production", "modelId": "gpt-4o", "providerType": "openai" }' \\
  | jq '.data'`;

  const policyErrorHandlingSnippet = `} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('budget') || message.includes('cap')) {
    console.error('[restormel] Budget cap reached:', message);
  } else if (message.includes('no_key_available')) {
    console.warn('[restormel] No provider key available for route');
  } else {
    console.error('[restormel] Resolve failed:', message);
  }
  // Fall through to legacy
}`;

  const addPoliciesPrompt = `You are working in [your app repo].

Goal: Update resolve error handling so policy errors are distinguishable (budget cap, blocked models) while preserving safe fallback behaviour.

Steps:
1. Read the Phase 4 walkthrough page (policy types, evaluate endpoint, and the policy error handling guidance).
2. In your resolve wrapper (e.g. src/lib/server/resolve-provider.ts), update the catch block for restormelResolve to classify errors:
   - budget/cap → log as error and optionally trigger an alert
   - no_key_available → log as warning
   - deprecated/blocked → log as warning
   - anything else → log as error
3. Ensure errors are user-safe: do not surface raw Restormel errors to end users; translate to friendly messages.
4. Ensure fallback behaviour is preserved (either legacy fallback during rollout, or a safe default if legacy has been removed).
5. Verify by triggering at least one policy failure (e.g. blocked model or budget cap) in a non-production environment.

DO NOT: Use a Gateway Key to call /api/policies/* from the browser. Log raw keys. Commit secrets. Remove fallback handling.`;

  const agentPrompts = [
    {
      id: "p4-review",
      title: "Prompt 4A — Review this phase (no code changes)",
      intent: "Have an agent read Phase 4 and plan which policies to add and how you’ll test them (resolve + evaluate).",
      contextDocs: ["This page: /keys/docs/walkthrough/phase-4-policies", "Phase 2: /keys/docs/walkthrough/phase-2-resolve"],
      prompt: `You are working in [your app repo].

Goal: Review Phase 4 of the Restormel Keys walkthrough and produce a concrete plan (no code changes).

Steps:
1. Read the Phase 4 walkthrough page in full.
2. Decide which policies you will create first (model_allowlist, deprecated_model_block, optional budget_cap) and at what scope.
3. Plan how you will test each policy (route step with blocked model, evaluate endpoint with Management Key, etc.).
4. Identify what (if anything) must change in your app code for policy errors (logging, user-safe messages, alerts).
5. Restate the Phase 4 gate in your own words.

DO NOT: Create policies yet. Paste real keys into prompts. Change code.`,
      gate: "You have a Phase 4 plan: policies to create + test strategy + any required app-side error handling changes, with no changes made yet.",
    },
    {
      id: "p4-handle",
      title: "Prompt 4B — Add policy-aware error handling",
      intent: "Update your app’s resolve error handling to distinguish policy failures from network/auth failures without leaking sensitive info.",
      contextDocs: ["This page: /keys/docs/walkthrough/phase-4-policies"],
      prompt: addPoliciesPrompt,
      gate: "Policy failures are logged distinctly and handled safely; fallback behaviour remains intact; no raw secrets appear in logs or UI.",
    },
  ];
</script>

<svelte:head>
  <title>Phase 4 — Apply policies — Restormel Keys</title>
  <meta name="description" content="Add model allowlist, deprecated-model block, budget cap; use the evaluate endpoint with a Management Key (workspace-scoped)." />
</svelte:head>

<div class="doc-content">
  <p class="doc-meta"><span class="doc-step">{stepOf}</span></p>
  <h1>Phase 4 — Apply policies</h1>
  <p class="doc-prereqs">
    <strong>Time:</strong> ~15 minutes<br />
    <strong>Prerequisites:</strong> <a href="/keys/docs/walkthrough/phase-3-routes">Phase 3</a> complete (at least one route with steps configured, resolve returns route-aware results)<br />
    <strong>You'll need:</strong> Access to the <a href={DASHBOARD_BASE}>Dashboard</a>, your project from Phase 1
  </p>

  <p>This phase adds guardrails around resolution. Policies constrain which models and providers can be returned, block deprecated models, and cap spend. By the end, your resolve calls are filtered through policies before returning a result, and you can test that policy violations are correctly rejected.</p>

  <WalkthroughStep stepId="4.1" title="Step 4.1 — Understand policy types" defaultOpen={true} {phaseSlug}>
  <p>Policies are rules attached at the workspace, project, or environment level. They are evaluated during every resolve call. If a policy blocks the resolved model or provider, Restormel falls through to the next step in the route (or returns an error if no step passes).</p>
  <table class="doc-table">
    <thead>
      <tr><th>Policy type</th><th>What it does</th><th>Example</th></tr>
    </thead>
    <tbody>
      <tr><td><code>model_allowlist</code></td><td>Only these models can be resolved</td><td>Allow gpt-4o, claude-sonnet; block everything else</td></tr>
      <tr><td><code>model_denylist</code></td><td>These specific models are blocked</td><td>Block gpt-3.5-turbo</td></tr>
      <tr><td><code>provider_allowlist</code></td><td>Only these providers can be resolved</td><td>Allow openai and anthropic, block google</td></tr>
      <tr><td><code>provider_denylist</code></td><td>These specific providers are blocked</td><td>Block a provider with a compliance issue</td></tr>
      <tr><td><code>deprecated_model_block</code></td><td>Block models marked deprecated in the catalog</td><td>Prevent resolution to end-of-life models</td></tr>
      <tr><td><code>budget_cap</code></td><td>Cap total spend per period</td><td>Max $500/month per environment</td></tr>
      <tr><td><code>token_cap</code></td><td>Cap total tokens per period</td><td>Max 10M tokens/month</td></tr>
    </tbody>
  </table>
  <p>Policies stack. If you have both a <code>model_allowlist</code> and a <code>budget_cap</code>, both must pass for a model to be resolved.</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="4.2" title="Step 4.2 — Create a model allowlist" {phaseSlug}>
  <p>Start with the most common policy: restricting which models your app can use.</p>
  <div class="callout callout-note">
    <strong>Dashboard</strong> — Your project → <strong>Policies</strong> → <strong>Create policy</strong>.
  </div>
  <ol>
    <li><strong>Type:</strong> <code>model_allowlist</code></li>
    <li><strong>Scope:</strong> Project (applies to all environments and routes in this project)</li>
    <li><strong>Models:</strong> Add the models you want to allow (e.g. <code>gpt-4o</code>, <code>gpt-4o-mini</code>, <code>claude-sonnet-4-20250514</code>, <code>gemini-2.5-pro</code>)</li>
    <li><strong>Save</strong> the policy.</li>
  </ol>
  <h3>You'll see</h3>
  <p>The policy listed on the project's Policies page with the type, scope, and allowed models.</p>
  <h3>How to test</h3>
  <p>Call resolve; the response <code>data.modelId</code> comes from the first enabled step that passes policies. If your route steps include a blocked model, resolve skips that step and returns the next allowed step.</p>
  <div class="callout callout-tip">
    <strong>Tip</strong> — The resolve endpoint does not take an arbitrary <code>model</code> override today. To test allowlisting deterministically, set a route step's <code>modelId</code> to a blocked model, then confirm resolve skips it.
  </div>
  <p>Call resolve with an allowed model in your route; expected: one of your allowed models (e.g. <code>"gpt-4o"</code>).</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="4.3" title="Step 4.3 — Add a deprecated-model block" {phaseSlug}>
  <p>This policy prevents your app from resolving to models that the Restormel model catalog has marked as approaching end-of-life. Even if a route step specifies a deprecated model, this policy blocks it and forces a fallback.</p>
  <div class="callout callout-note">
    <strong>Dashboard</strong> — Your project → <strong>Policies</strong> → <strong>Create policy</strong>. Type: <code>deprecated_model_block</code>, Scope: Project. No additional configuration — the policy reads deprecation status from the model catalog automatically.
  </div>
  <h3>You'll see</h3>
  <p>The policy listed on the Policies page. Its effect depends on whether any models in your routes are actually deprecated in the catalog.</p>
  <h3>How to test</h3>
  <p>If you have a route step that specifies a model currently marked as deprecated, resolve should skip that step. To verify the policy is active, use the <strong>evaluate</strong> endpoint.</p>
  <div class="callout callout-security">
    <strong>Security</strong> — <code>/api/policies/*</code> endpoints are workspace-scoped and do <strong>not</strong> accept a project Gateway Key. Use a <strong>Management Key</strong> for server-to-server checks, or test from the dashboard UI (session cookie).
  </div>
  <CodeBlock language="bash" code={curlEvaluate} />
  <p><strong>Expected:</strong> <code>data.allowed</code> is <code>false</code> when the model/provider combination is blocked by policies; <code>data.violations</code> explains why.</p>
  <div class="callout callout-tip">
    <strong>Tip</strong> — The evaluate endpoint is useful for testing policies without actually resolving. It answers "would this model/provider combination pass all policies?" without executing a full route evaluation.
  </div>
  </WalkthroughStep>

  <WalkthroughStep stepId="4.4" title="Step 4.4 — Add a budget cap" {phaseSlug}>
  <p>Budget caps prevent unexpected spend. When the cap is reached for a period, resolve returns an error rather than allowing more requests.</p>
  <div class="callout callout-note">
    <strong>Dashboard</strong> — Your project → <strong>Policies</strong> → <strong>Create policy</strong>. Type: <code>budget_cap</code>, Scope: Environment (e.g. production), Limit: monthly USD (e.g. 500), Period: monthly.
  </div>
  <h3>You'll see</h3>
  <p>The policy listed with the cap amount and period. Current spend tracking appears in the project's usage section.</p>
  <h3>How to test</h3>
  <p>Budget caps take effect as usage accumulates. For immediate testing, set a very low cap (e.g. $0.01) and make a few resolve calls with tracked usage; then resolve should fail with a budget error. Restore the cap to a realistic value after testing.</p>
  <div class="callout callout-pitfall">
    <strong>Pitfall</strong> — Budget caps depend on usage tracking. The dashboard resolve endpoint logs resolutions but does not automatically know the cost of your provider call unless you report usage back to Restormel. Until usage reporting is part of your integration, treat <code>budget_cap</code> as a config you can create and bind, and validate it via evaluate and later via usage reporting.
  </div>
  </WalkthroughStep>

  <WalkthroughStep stepId="4.5" title="Step 4.5 — Test policy stacking" {phaseSlug}>
  <p>Policies stack: all active policies must pass for a model to be resolved. Verify by having both a <code>model_allowlist</code> and a <code>deprecated_model_block</code> active, then evaluating a model that is on the allowlist but deprecated (if one exists).</p>
  <CodeBlock language="bash" code={curlStacking} />
  <p><strong>Expected:</strong> <code>gpt-4o</code> on the allowlist and not deprecated → allowed. A model on the allowlist but deprecated → blocked by the deprecation policy. The evaluate response shows which policies passed and which blocked.</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="4.6" title="Step 4.6 — Handle policy errors in your resolve wrapper" {phaseSlug}>
  <p>When all route steps are blocked by policies, Restormel returns an error. Your resolve wrapper (from Phase 2) already catches errors and falls back to legacy. Add specific handling for policy errors so you can log or alert on them.</p>
  <CodeBlock language="ts" code={policyErrorHandlingSnippet} />
  <p>For budget cap errors, optionally add an alert. For all policy errors, the function still falls through to the legacy path. Do not expose raw Restormel error messages to end-users; translate them into user-friendly messages.</p>
  </WalkthroughStep>

  <p><strong>Checkpoint checklist:</strong> mark each step complete as you finish it.</p>
  <WalkthroughChecklist phaseSlug={phaseSlug} steps={phase4Steps} />

  <AgentPromptsSection
    intro="These are optional and collapsed by default. Use them if you're implementing Phase 4 with a coding agent."
    prompts={agentPrompts}
    defaultOpen={false}
  />

  <h2>Checkpoint</h2>
  <p>You now have: a <code>model_allowlist</code> policy; a <code>deprecated_model_block</code> policy; (optional) a <code>budget_cap</code> policy; policy error handling in your resolve wrapper that distinguishes budget, blocked, and generic errors; and the evaluate endpoint as a tool for testing policy combinations without executing a full resolve. Policies are active on the Restormel side. Your app handles policy errors gracefully and falls back to legacy when needed.</p>

  <WalkthroughPhaseNav {prev} {next} {stepOf} />
</div>

<style>
  .doc-content { max-width: var(--rm-container-narrow); }
  .doc-meta { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-2); }
  .doc-step { font-weight: var(--font-medium); }
  .doc-prereqs { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-6); line-height: var(--leading-relaxed); }
  .doc-prereqs a { color: var(--rm-primary); }
  .doc-content h1 { font-family: var(--rm-font-display); font-size: var(--text-2xl); margin: 0 0 var(--space-4); }
  .doc-content h3 { font-size: var(--text-lg); margin: var(--space-4) 0 var(--space-2); }
  .doc-content p, .doc-content li { color: var(--rm-muted); line-height: var(--leading-relaxed); margin: 0 0 var(--space-4); }
  .doc-content li { margin-bottom: var(--space-2); }
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
</style>
