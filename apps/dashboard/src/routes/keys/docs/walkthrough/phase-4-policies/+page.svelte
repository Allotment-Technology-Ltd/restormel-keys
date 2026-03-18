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
  -H "Authorization: Bearer \${RESTORMEL_GATEWAY_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "projectId": "'\${RESTORMEL_PROJECT_ID}'",
    "environmentId": "YOUR_ENV_ID",
    "modelId": "PICK_A_MODEL_ID_FROM_YOUR_CATALOG",
    "providerType": "openai"
  }' | jq '.data'`;

  const curlStacking = `curl -s -X POST \\
  "https://restormel.dev/keys/dashboard/api/policies/evaluate" \\
  -H "Authorization: Bearer \${RESTORMEL_GATEWAY_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "projectId": "'\${RESTORMEL_PROJECT_ID}'",
    "environmentId": "YOUR_ENV_ID",
    "modelId": "MODEL_ON_ALLOWLIST",
    "providerType": "openai"
  }' | jq '.data'`;

  const resolvePolicyBlockedJson = `{
  "error": "policy_blocked",
  "message": "All route steps were blocked by policy",
  "violations": [
    {
      "policyId": "…",
      "policyName": "…",
      "type": "model_allowlist",
      "message": "…"
    }
  ]
}`;

  const evaluateOkShapeJson = `{
  "data": {
    "allowed": true,
    "violations": []
  }
}`;

  const policyErrorHandlingSnippet = [
    "// After fetch to /resolve — always parse JSON on non-2xx; do not classify from err.message alone.",
    "const res = await fetch(resolveUrl, { method: 'POST', headers, body: JSON.stringify({ environmentId, routeId }) });",
    "const body = await res.json().catch(() => ({} as Record<string, unknown>));",
    "if (!res.ok) {",
    "  const code = typeof body.error === 'string' ? body.error : 'unknown';",
    "  const violations = Array.isArray(body.violations) ? body.violations : [];",
    "  if (res.status === 403 && code === 'policy_blocked') {",
    "    // Classify by violations[].type: model_allowlist, budget_cap, token_cap, deprecated_model_block, …",
    "    console.error('[restormel] policy_blocked', violations); // detail for logs; user-facing message separate",
    "  }",
    "  if (code === 'usage_limit_reached') { /* 402 + body.data.limit/used */ }",
    "  if (code === 'no_route') { /* 404 */ }",
    "  // App legacy fallback (non-Restormel routing) — not the same as Restormel route-step fallback",
    "  return legacyResolve();",
    "}",
  ].join("\n");

  const backendEvaluateExample = [
    "// Server-only. Load RESTORMEL_GATEWAY_KEY from env; never send to the browser.",
    "const base = process.env.RESTORMEL_KEYS_BASE ?? 'https://restormel.dev';",
    "",
    "export async function evaluatePoliciesRemote(input: {",
    "  projectId: string;",
    "  environmentId?: string;",
    "  routeId?: string;",
    "  modelId?: string;",
    "  providerType?: string;",
    "}) {",
    "  const key = process.env.RESTORMEL_GATEWAY_KEY;",
    "  if (!key) throw new Error('RESTORMEL_GATEWAY_KEY is not set');",
    "  const res = await fetch(",
    "    `${base}/keys/dashboard/api/policies/evaluate`,",
    "    {",
    "      method: 'POST',",
    "      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },",
    "      body: JSON.stringify(input),",
    "    }",
    "  );",
    "  const json = (await res.json()) as {",
    "    data?: { allowed: boolean; violations: { policyId: string; policyName: string; type: string; message: string }[] };",
    "    error?: string;",
    "  };",
    "  if (!res.ok) throw new Error(json.error ?? `evaluate HTTP ${res.status}`);",
    "  return json.data!; // { allowed, violations }",
    "}",
    "",
    "// Assertions in tests: expect(allowed).toBe(false); expect(violations[0].type).toBe('model_allowlist');",
  ].join("\n");

  const addPoliciesPrompt = `You are working in [your app repo].

Goal: Parse structured Restormel resolve errors (HTTP status + JSON body), not substring-matching on thrown Error messages.

Steps:
1. Read this page: policy_blocked contract (403, error, message, violations[] with policyId, policyName, type, message).
2. Ensure your resolve client reads response.json() on non-2xx and branches on body.error and violations[].type.
3. Map violation types to internal logging; expose only user-safe messages in UI.
4. Preserve app legacy fallback (non-Restormel routing) when resolve fails.
5. Test with a deliberate policy_blocked response in a non-production environment.

DO NOT: Classify failures only from err.message. Expose raw API text to end users. Log Gateway Keys.`;

  const prompt4c = `You are working in the Restormel dashboard (or via API with session/key).

Goal: Create and bind Phase 4 policies end-to-end.

Steps:
1. Create model_allowlist at project scope: ruleDefinition.modelIds must list only model IDs that exist in your live catalog (Dashboard → Models or GET /api/models).
2. Create deprecated_model_block at project scope (no rule fields).
3. Optionally create budget_cap bound to an environment: ruleDefinition.limit (number), period is calendar month server-side.
4. For each policy, create policy bindings at the intended scope (project / environment). Record policy IDs, binding IDs, target_type, target_id in a short RUNBOOK.md or team doc.
5. If the dashboard cannot edit ruleDefinition or bindings for a policy, use POST/PATCH policies API and POST bindings API as documented.

Pass evidence: list of policy IDs + scopes + binding targets saved.

DO NOT: Use model IDs not present in the catalog (steps API will reject). Commit secrets.`;

  const prompt4d = `You are working in [your app repo] + Restormel dashboard.

Goal: Verify policies with evaluate and resolve; record pass/fail evidence.

Steps:
1. evaluate: From backend, call POST .../policies/evaluate with Gateway Key. Test (a) a model on the allowlist + provider → data.allowed true; (b) same project, model NOT on allowlist → allowed false, violations[0].type model_allowlist; (c) if you have a deprecated model in catalog, test that case.
2. resolve: Route with first enabled step using a blocked model and second step allowed → 200, data.modelId from second step. Temporarily make all steps blocked → 403, error policy_blocked, non-empty violations.
3. stacking: With allowlist + deprecated_block active, evaluate a model that is allowlisted but deprecated (if such a model exists) → should be blocked.
4. Paste redacted evidence (HTTP status + error code + violation types, no keys) into your run notes; restore any temporary allowlist/route changes.

Pass evidence: screenshots or log excerpts for steps 1–2 minimum; step 3 if applicable.

DO NOT: Call evaluate from the browser with Gateway Key. Leave production in a broken state.`;

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
3. Plan how you will test each policy (route step with blocked model, evaluate endpoint with Gateway Key from your backend or dashboard session, etc.).
4. Identify what (if anything) must change in your app code for policy errors (logging, user-safe messages, alerts).
5. Restate the Phase 4 gate in your own words.

DO NOT: Create policies yet. Paste real keys into prompts. Change code.`,
      gate: "You have a Phase 4 plan: policies to create + test strategy + any required app-side error handling changes, with no changes made yet.",
    },
    {
      id: "p4-create-bind",
      title: "Prompt 4C — Create and bind policies",
      intent: "Actually create policies and bindings at the correct scope; record IDs and targets.",
      contextDocs: ["This page: /keys/docs/walkthrough/phase-4-policies"],
      prompt: prompt4c,
      gate: "Policies exist, are bound to project/environment as intended, and IDs + scopes are recorded. Model IDs used exist in the live catalog.",
    },
    {
      id: "p4-verify",
      title: "Prompt 4D — Verify with evaluate + resolve",
      intent: "Run evaluate and resolve checks and capture structured pass/fail evidence.",
      contextDocs: ["This page: /keys/docs/walkthrough/phase-4-policies", "Phase 2: /keys/docs/walkthrough/phase-2-resolve"],
      prompt: prompt4d,
      gate: "Documented evidence: evaluate allowed/blocked cases; resolve skip-to-next-step; policy_blocked when all steps fail; app error parsing uses JSON body.",
    },
    {
      id: "p4-handle",
      title: "Prompt 4B — Structured resolve error handling",
      intent: "Parse policy_blocked and other errors from JSON response bodies, not message substrings.",
      contextDocs: ["This page: /keys/docs/walkthrough/phase-4-policies"],
      prompt: addPoliciesPrompt,
      gate: "Non-2xx resolve responses parsed as JSON; branching on error and violations[].type; user-safe messages; legacy fallback preserved.",
    },
  ];
</script>

<svelte:head>
  <title>Phase 4 — Apply policies — Restormel Keys</title>
  <meta name="description" content="Add model allowlist, deprecated-model block, budget cap; use the evaluate endpoint from your backend with your Gateway Key." />
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

  <div class="callout callout-note">
    <strong>Terminology</strong>
    <ul>
      <li><strong>Evaluate</strong> — Hypothetical check: “would this <code>modelId</code> / <code>providerType</code> (and optional route context) pass all bound policies?” Returns <code>allowed</code> + <code>violations</code>. Does not run route resolution.</li>
      <li><strong>Resolve</strong> — Route execution: picks the first <em>enabled</em> route step in order that passes the same policy engine. Mutually reinforcing with evaluate for the same context, but resolve walks real steps.</li>
      <li><strong>Policy binding</strong> — Links a policy to a <strong>target</strong> (workspace, project, environment, or route). <strong>Scope</strong> in the UI usually means which target you bind to.</li>
      <li><strong>Restormel step fallback</strong> — Next enabled step when the current step is blocked by policy. Not the same as <strong>app legacy fallback</strong> (your app’s non-Restormel routing when resolve fails).</li>
      <li><strong>policy_blocked</strong> — HTTP 403 from resolve when every enabled step fails policy checks; body includes <code>violations</code>.</li>
    </ul>
  </div>

  <WalkthroughStep stepId="4.1" title="Step 4.1 — Understand policy types" defaultOpen={true} {phaseSlug}>
  <p>Policies are rules attached at the workspace, project, or environment level. They are evaluated during every resolve call. Resolve uses <strong>enabled-step order with policy filtering</strong>: it tries each enabled step in order and returns the first step that passes all policies. There is no implicit provider health probing. If a policy blocks a step, Restormel skips to the next step; if all steps are blocked, resolve returns a <code>policy_blocked</code> error (403) with violation details.</p>
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
    <li><strong>Models:</strong> Pick each ID from your live model catalog (Dashboard → Models or <code>GET /api/models</code>). Do not assume walkthrough example IDs exist in your deployment.</li>
    <li><strong>Save</strong> the policy.</li>
  </ol>
  <h3>You'll see</h3>
  <p>The policy listed on the project's Policies page with the type, scope, and allowed models.</p>
  <h3>How to test</h3>
  <p>Call resolve; the response <code>data.modelId</code> comes from the first enabled step that passes policies. If your route steps include a blocked model, resolve skips that step and returns the next allowed step.</p>
  <div class="callout callout-tip">
    <strong>Tip</strong> — The resolve endpoint does not take an arbitrary <code>model</code> override today. To test allowlisting deterministically, set a route step's <code>modelId</code> to a blocked model, then confirm resolve skips it.
  </div>
  <p>Call resolve with an allowed model in your route; expected: a <code>modelId</code> from your allowlist. The resolve API returns <code>data.providerType</code> as <code>vertex</code> when the step uses Google internally (policies still use <code>google</code>).</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="4.3" title="Step 4.3 — Add a deprecated-model block" {phaseSlug}>
  <p>This policy prevents your app from resolving to models that the Restormel model catalog has marked as approaching end-of-life. Even if a route step specifies a deprecated model, this policy blocks it and forces a fallback.</p>
  <div class="callout callout-note">
    <strong>Dashboard</strong> — Your project → <strong>Policies</strong> → <strong>Create policy</strong>. Type: <code>deprecated_model_block</code>, Scope: Project. No additional configuration — the policy reads deprecation status from the model catalog automatically.
  </div>
  <h3>You'll see</h3>
  <p>The policy listed on the Policies page. Its effect depends on whether any models in your routes are actually deprecated in the catalog.</p>
  <h3>How to test</h3>
  <p>If you have a route step that specifies a model currently marked as deprecated in <em>your</em> catalog, resolve skips that step. If none are deprecated, test via evaluate using any deprecated ID that exists in your catalog, or skip until one exists.</p>
  <div class="callout callout-security">
    <strong>Security</strong> — Never call <code>/api/policies/*</code> from the browser with a Gateway Key. Call from your backend (key in env) or use dashboard session.
  </div>
  <p><strong>Evaluate response shape (200):</strong></p>
  <CodeBlock language="json" code={evaluateOkShapeJson} />
  <p>Each violation object has <code>policyId</code>, <code>policyName</code>, <code>type</code>, <code>message</code>.</p>
  <CodeBlock language="bash" code={curlEvaluate} />
  <p><strong>Minimal backend helper</strong> (server-only; key from <code>process.env.RESTORMEL_GATEWAY_KEY</code>):</p>
  <CodeBlock language="ts" code={backendEvaluateExample} />
  <p><strong>Expected:</strong> <code>data.allowed</code> is <code>false</code> when blocked; inspect <code>violations[].type</code>.</p>
  <div class="callout callout-tip">
    <strong>Tip</strong> — The evaluate endpoint is useful for testing policies without actually resolving. It answers "would this model/provider combination pass all policies?" without executing a full route evaluation.
  </div>
  </WalkthroughStep>

  <WalkthroughStep stepId="4.4" title="Step 4.4 — Add a budget cap" {phaseSlug}>
  <p><code>budget_cap</code> / <code>token_cap</code> compare usage in <strong>request_logs</strong> for the bound scope over the <strong>current calendar month</strong>. Resolve and evaluate both enforce them when policies are bound.</p>
  <div class="callout callout-note">
    <strong>Dashboard</strong> — Create policy type <code>budget_cap</code>, bind to environment. Rule uses numeric <code>limit</code> (monthly ceiling on summed <code>estimated_cost</code> in request_logs). <code>token_cap</code> sums input+output tokens the same way.
  </div>
  <h3>Success criteria (pick what matches your setup)</h3>
  <ol>
    <li><strong>Config only:</strong> Policy + binding created via dashboard or API — you’ve proven the object exists; no runtime assertion yet.</li>
    <li><strong>Evaluate shape:</strong> With usage under cap, evaluate returns allowed; after synthetic over-cap usage in logs (or very low limit), evaluate returns <code>budget_cap</code> / <code>token_cap</code> violations.</li>
    <li><strong>End-to-end:</strong> Resolve rejects when caps are exceeded the same way as other policy failures (step skip or <code>policy_blocked</code> if all steps hit the cap). <code>estimated_cost</code> on logs only increases if you report usage; until then, token_cap may be easier to test than budget_cap.</li>
  </ol>
  <div class="callout callout-pitfall">
    <strong>Operational clarity</strong> — “Policy created” ≠ “spend is tracked.” Without usage reporting, budget caps mostly reflect resolution-time log rows (often zero cost). Prefer token_cap for deterministic tests, or accept config-level validation until reporting is wired.
  </div>
  </WalkthroughStep>

  <WalkthroughStep stepId="4.5" title="Step 4.5 — Test policy stacking" {phaseSlug}>
  <p>Policies stack: all active policies must pass for a model to be resolved. Verify by having both a <code>model_allowlist</code> and a <code>deprecated_model_block</code> active, then evaluating a model that is on the allowlist but deprecated (if one exists).</p>
  <CodeBlock language="bash" code={curlStacking} />
  <p><strong>Expected:</strong> Allowed model + provider → <code>allowed: true</code>. Same flow with a model on the allowlist but deprecated in your catalog → <code>allowed: false</code>, <code>violations[].type</code> includes <code>deprecated_model_block</code>. Use IDs that exist in your catalog.</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="4.6" title="Step 4.6 — Handle policy errors in your resolve wrapper" {phaseSlug}>
  <p>When all route steps are blocked by policies, resolve returns <strong>HTTP 403</strong> with a JSON body (not necessarily thrown as <code>Error</code> with that text). Primary contract:</p>
  <ul>
    <li><code>error</code> — e.g. <code>"policy_blocked"</code></li>
    <li><code>message</code> — short human-readable summary</li>
    <li><code>violations</code> — array of objects with <code>policyId</code>, <code>policyName</code>, <code>type</code>, <code>message</code></li>
  </ul>
  <p><strong>Example body:</strong></p>
  <CodeBlock language="json" code={resolvePolicyBlockedJson} />
  <p>Parse <code>response.json()</code>, branch on <code>error</code> and <code>violations[].type</code>. Use violation detail only in server logs; map to safe user-facing copy in your app. Same pattern for <strong>402</strong> <code>usage_limit_reached</code> and <strong>404</strong> <code>no_route</code> (different shapes — see Phase 2).</p>
  <CodeBlock language="ts" code={policyErrorHandlingSnippet} />
  <p><strong>App legacy fallback</strong> (Phase 2) remains appropriate when resolve fails; that is separate from Restormel trying the next route step inside one resolve call.</p>
  </WalkthroughStep>

  <p><strong>Checkpoint checklist:</strong> mark each step complete as you finish it.</p>
  <WalkthroughChecklist phaseSlug={phaseSlug} steps={phase4Steps} />

  <AgentPromptsSection
    intro="These are optional and collapsed by default. Use them if you're implementing Phase 4 with a coding agent."
    prompts={agentPrompts}
    defaultOpen={false}
  />

  <h2>Checkpoint</h2>
  <p><strong>Phase 4 is complete only if all apply:</strong></p>
  <ul>
    <li>Policies <strong>created</strong> and <strong>bound</strong> at the intended scope (project/environment); binding targets documented.</li>
    <li><strong>Evaluate</strong> run from backend for at least one allowed and one blocked model/provider pair; <code>violations[].type</code> observed.</li>
    <li><strong>Resolve</strong> tested: step skip when first step blocked, or <code>policy_blocked</code> when all steps blocked.</li>
    <li>App resolve client parses <strong>structured JSON</strong> on failure (not only <code>err.message</code> substring matching).</li>
    <li>Optional: stacking or budget/token evidence per Step 4.4 criteria.</li>
  </ul>
  <p>Dashboard: policy creation works; detailed <code>ruleDefinition</code> edits and bindings may still require the Policies API — see Prompt 4C. A future “test policy” UI would reduce curl-only workflows.</p>

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
