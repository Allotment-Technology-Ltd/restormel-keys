<script lang="ts">
  /** Phase 3 — Routes. Progressive disclosure: checklist + expandable steps. */
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { getWalkthroughPrevNext } from "$lib/docs-walkthrough-nav";
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";
  import TextPanel from "$lib/components/docs/TextPanel.svelte";
  import AgentPromptsSection from "$lib/components/walkthrough/AgentPromptsSection.svelte";
  import WalkthroughChecklist from "$lib/components/walkthrough/WalkthroughChecklist.svelte";
  import WalkthroughStep from "$lib/components/walkthrough/WalkthroughStep.svelte";
  import WalkthroughPhaseNav from "$lib/components/walkthrough/WalkthroughPhaseNav.svelte";

  const { prev, next, stepOf } = getWalkthroughPrevNext("phase-3-routes");
  const phaseSlug = "phase-3-routes";

  const phase3Steps = [
    { id: "3.1", label: "Understand routes and steps" },
    { id: "3.2", label: "Create your first route in the Dashboard" },
    { id: "3.3", label: "Resolve with the route ID" },
    { id: "3.4", label: "Test fallback behaviour" },
    { id: "3.5", label: "Wire route IDs into your application" },
    { id: "3.6", label: "(Optional) Create a second route" },
  ];

  const curlRoute = `curl -X POST \\
  "https://restormel.dev/keys/dashboard/api/projects/\${RESTORMEL_PROJECT_ID}/resolve" \\
  -H "Authorization: Bearer \${RESTORMEL_GATEWAY_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{ "environmentId": "production", "routeId": "ingestion" }'`;

  const curlJq = `curl -s -X POST "..." -d '{ "environmentId": "production", "routeId": "ingestion" }' | jq '.data.providerType, .data.modelId'`;

  const resolveClientSnippet = `const result = await restormelResolve({
  environmentId: process.env.RESTORMEL_ENVIRONMENT_ID ?? 'production',
  routeId: 'ingestion',
});`;

  const stepsApiBodyExample = `{
  "orderIndex": 0,
  "providerPreference": "openai",
  "modelId": "gpt-4o",
  "fallbackOn": "error",
  "enabled": true
}`;

  const providerPreferenceEnum = `openai | anthropic | cohere | google | deepseek | groq | mistral | openrouter | portkey | together | vercel | voyage`;
  const fallbackOnEnum = `error | rate_limit | no_key | policy_block | any`;

  const createStepCurl = `curl -s -X POST \\
  "https://restormel.dev/keys/dashboard/api/projects/\${RESTORMEL_PROJECT_ID}/routes/\${RESTORMEL_ROUTE_INTERNAL_ID}/steps" \\
  -H "Authorization: Bearer \${RESTORMEL_GATEWAY_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '${stepsApiBodyExample}' | jq '.data'`;

  const listStepsCurl = `curl -s \\
  "https://restormel.dev/keys/dashboard/api/projects/\${RESTORMEL_PROJECT_ID}/routes/\${RESTORMEL_ROUTE_INTERNAL_ID}/steps" \\
  -H "Authorization: Bearer \${RESTORMEL_GATEWAY_KEY}" | jq '.data'`;

  const updateStepCurl = `curl -s -X PATCH \\
  "https://restormel.dev/keys/dashboard/api/projects/\${RESTORMEL_PROJECT_ID}/routes/\${RESTORMEL_ROUTE_INTERNAL_ID}/steps/\${RESTORMEL_STEP_ID}" \\
  -H "Authorization: Bearer \${RESTORMEL_GATEWAY_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{ "enabled": false }' | jq '.data'`;

  const deleteStepCurl = `curl -s -X DELETE \\
  "https://restormel.dev/keys/dashboard/api/projects/\${RESTORMEL_PROJECT_ID}/routes/\${RESTORMEL_ROUTE_INTERNAL_ID}/steps/\${RESTORMEL_STEP_ID}" \\
  -H "Authorization: Bearer \${RESTORMEL_GATEWAY_KEY}"`;

  const routeDiagram = `Route: "ingestion"
Mode:  fallback_chain

  Step 1 → OpenAI   (gpt-4o)           → try first
  Step 2 → Anthropic (claude-sonnet)  → if step 1 fails
  Step 3 → Google    (gemini-2.5-pro) → if step 2 fails`;

  const callSiteIngestion = "resolveProvider({ routeId: 'ingestion' })";
  const callSiteChat = "resolveProvider({ routeId: 'interactive', model: userSelectedModel })";
  const optionsSignature = "options?: { routeId?: string; model?: string }";

  const resolveProviderWithRouteIdExample = `export async function resolveProvider(options?: { routeId?: string; model?: string }) {
  if (USE_RESTORMEL_KEYS) {
    try {
      const result = await restormelResolve({
        environmentId: process.env.RESTORMEL_ENVIRONMENT_ID ?? 'production',
        routeId: options?.routeId,
      });
      return {
        provider: result.data.providerType ?? process.env.DEFAULT_AI_PROVIDER ?? 'openai',
        model: result.data.modelId ?? options?.model ?? null,
        source: 'restormel',
      };
    } catch (err) {
      console.error('[restormel] Resolve failed, falling back to legacy:', err);
    }
  }
  return legacyResolve(options?.model);
}`;

  const wireRouteIdsPrompt = `You are working in [your app repo].

Goal: Update your resolve wrapper to accept a routeId so different parts of your app can use different Restormel routes, then update all call sites.

Steps:
1. Open your resolve wrapper module (e.g. src/lib/server/resolve-provider.ts from Phase 2).
2. Update the function signature to accept options?: { routeId?: string; model?: string }.
3. Pass options.routeId through to restormelResolve({ environmentId, routeId: options.routeId }).
4. Use your Phase 0 routing inventory to find every call site that resolves a provider/model, and update each call site to pass the appropriate routeId:
   - ingestion/background jobs → routeId: 'ingestion'
   - chat/interactive requests → routeId: 'interactive' (or whatever you named it)
5. If you need multiple routes, create them in the Dashboard and configure steps.
6. Verify with USE_RESTORMEL_KEYS=true that each call site resolves via its intended route, and that fallback works when the first step is unavailable.

DO NOT: Change the legacy path. Remove error handling / legacy fallback. Reference route IDs that do not exist. Commit secrets.`;

  const agentPrompts = [
    {
      id: "p3-review",
      title: "Prompt 3A — Review this phase (no code changes)",
      intent: "Have an agent read Phase 3 and plan route creation + how routeIds map to your app’s call sites.",
      contextDocs: [
        "This page: /keys/docs/walkthrough/phase-3-routes",
        "Phase 0 output: docs/restormel-integration/00-routing-inventory.md (in your app repo)",
      ],
      prompt: `You are working in [your app repo].

Goal: Review Phase 3 of the Restormel Keys walkthrough and produce a plan (no code changes).

Steps:
1. Read the Phase 3 walkthrough page in full.
2. List the routes you will create in the Dashboard (names, purpose, step order).
3. Map each major app code path (from the Phase 0 inventory) to a routeId.
4. Describe how you will validate fallback behaviour safely in staging/dev.
5. Restate the Phase 3 gate in your own words.

DO NOT: Create routes/steps yet. Change any application code. Paste secrets.`,
      gate: "You have a route plan (routeIds + step order) and a call-site mapping, with no changes made yet.",
    },
    {
      id: "p3-wire",
      title: "Prompt 3B — Wire route IDs into your application",
      intent: "Implement routeId plumbing in the resolve wrapper and update call sites to pass the correct routeId.",
      contextDocs: ["This page: /keys/docs/walkthrough/phase-3-routes", "Phase 2: /keys/docs/walkthrough/phase-2-resolve"],
      prompt: wireRouteIdsPrompt,
      gate: "All relevant call sites pass routeId; flag off remains unchanged; flag on resolves via the intended route; fallback works.",
    },
  ];
</script>

<svelte:head>
  <title>Phase 3 — Add routes and fallbacks — Restormel Keys</title>
  <meta name="description" content="Create routes with steps in the Dashboard; configure fallback chain; wire route IDs into your resolve client." />
</svelte:head>

<div class="doc-content">
  <p class="doc-meta"><span class="doc-step">{stepOf}</span></p>
  <h1>Phase 3 — Add routes and fallbacks</h1>
  <p class="doc-prereqs">
    <strong>Time:</strong> ~20 minutes<br />
    <strong>Prerequisites:</strong> <a href="/keys/docs/walkthrough/phase-2-resolve">Phase 2</a> complete (resolve client works, feature flag wired)<br />
    <strong>You'll need:</strong> Access to the <a href={DASHBOARD_BASE}>Dashboard</a>, your project and environment from Phase 1
  </p>

  <p>This phase moves your routing decisions from "Restormel picks the default provider" to "Restormel evaluates a named route with multiple steps and fails over automatically." By the end, you have a fallback chain configured in the dashboard, and your resolve call returns results shaped by that chain.</p>

  <WalkthroughStep stepId="3.1" title="Step 3.1 — Understand routes and steps" defaultOpen={true} {phaseSlug}>
  <p>A <strong>route</strong> is a named routing configuration inside your project. It contains one or more <strong>steps</strong>, evaluated in order. Each step specifies a provider preference and an optional model. The <strong>route mode</strong> controls how steps are evaluated.</p>
  <TextPanel title="Route diagram" kind="diagram" content={routeDiagram} />
  <p>When your backend calls resolve with <code>routeId: "ingestion"</code>, Restormel walks the chain. If the first step's provider has a valid key and is not blocked by a policy, it's returned. If not (no key, rate-limited, deprecated), Restormel tries the next step.</p>
  <table class="doc-table">
    <thead>
      <tr><th>Mode</th><th>Behaviour</th></tr>
    </thead>
    <tbody>
      <tr><td><code>fallback_chain</code></td><td>Try steps in order; return the first that resolves successfully</td></tr>
      <tr><td><code>user_preferred</code></td><td>Use the user's preferred provider if a BYOK key exists, then fall back to the chain</td></tr>
    </tbody>
  </table>
  <p>You can create multiple routes per project — for example, <code>ingestion</code> for background jobs and <code>interactive</code> for user-facing requests with different fallback priorities.</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="3.2" title="Step 3.2 — Create your first route in the Dashboard" {phaseSlug}>
  <div class="callout callout-note">
    <strong>Dashboard</strong> — Your project → <strong>Routes</strong> → <strong>Create route</strong>.
  </div>
  <ol>
    <li><strong>Name:</strong> Give the route a descriptive name (e.g. <code>ingestion</code>, <code>chat</code>, <code>interactive</code>). This becomes the <code>routeId</code> you pass to resolve.</li>
    <li><strong>Route mode:</strong> Select <code>fallback_chain</code>.</li>
    <li><strong>Save</strong> the route.</li>
  </ol>
  <p>At the moment, the Dashboard UI shows the route and its steps list, but step editing is API-first. You create, reorder, and disable steps via the Steps API in Step 3.4a.</p>
  <h3>You'll see</h3>
  <p>The route detail page in the dashboard showing your named route, mode, and the steps in order. Each step shows the provider, model, and fallback condition.</p>
  <h3>How to test</h3>
  <p>No code change yet. Confirm the route appears in the dashboard and the steps are in the correct order.</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="3.3" title="Step 3.3 — Resolve with the route ID" {phaseSlug}>
  <p>Update your resolve call to specify the route. This tells Restormel to evaluate that route's fallback chain instead of the project default.</p>
  <p><strong>curl test:</strong></p>
  <CodeBlock language="bash" code={curlRoute} />
  <p><strong>In your resolve client:</strong></p>
  <CodeBlock language="ts" code={resolveClientSnippet} />
  <div class="callout callout-tip">
    <strong>Tip</strong> — You can make the <code>routeId</code> configurable per call site. For example, your ingestion pipeline passes <code>routeId: 'ingestion'</code> while your chat handler passes <code>routeId: 'interactive'</code>. This lets different parts of your app have different fallback strategies.
  </div>
  <h3>You'll see</h3>
  <p>The resolve response now reflects the route's first available step: <code>data.routeId</code>, <code>data.providerType</code>, <code>data.modelId</code>, <code>data.explanation</code>.</p>
  <h3>How to test</h3>
  <CodeBlock language="bash" code={curlJq} />
  <p>Expected output: <code>"openai"</code> and <code>"gpt-4o"</code> (or whatever your first step is).</p>

  <h2>Step 3.4 — Test fallback behaviour</h2>
  <p>To confirm the fallback chain works, make the first step unusable and confirm resolve returns the next enabled step. You create and manage steps via the Steps API (or the dashboard when a full step editor is available).</p>
  <h3>Step 3.4a — Create steps via the Steps API</h3>
  <p>The Steps API is how you configure the fallback chain programmatically. You’ll use two identifiers:</p>
  <ul>
    <li><strong>Route name</strong> (e.g. <code>ingestion</code>) — used in your <strong>Resolve</strong> call (<code>routeId</code> field).</li>
    <li>
      <strong>Route internal ID</strong> (UUID) — used in the Steps API URL. Copy it from the Dashboard URL when viewing the route:
      <code>/keys/dashboard/projects/{'{'}projectId{'}'}/routes/{'{'}routeInternalId{'}'}</code>.
    </li>
  </ul>

  <p><strong>Step schema (create):</strong></p>
  <CodeBlock language="json" code={stepsApiBodyExample} />
  <p><strong>Valid values:</strong></p>
  <ul>
    <li><code>providerPreference</code>: <code>{providerPreferenceEnum}</code></li>
    <li><code>fallbackOn</code>: <code>{fallbackOnEnum}</code> (defaults to <code>error</code>)</li>
  </ul>
  <p><strong>Ordering:</strong> <code>orderIndex</code> is 0-based; lower indices are tried first.</p>

  <p><strong>Create a step (orderIndex 0):</strong></p>
  <CodeBlock language="bash" code={createStepCurl} />
  <p>Create a second step with <code>orderIndex: 1</code> and another provider/model.</p>

  <p><strong>List steps (ordered by orderIndex):</strong></p>
  <CodeBlock language="bash" code={listStepsCurl} />

  <p><strong>Update a step (disable):</strong></p>
  <CodeBlock language="bash" code={updateStepCurl} />

  <p><strong>Delete a step:</strong></p>
  <CodeBlock language="bash" code={deleteStepCurl} />
  <h3>Step 3.4b — Disable the first step and re-resolve</h3>
  <p>Temporarily disable (or delete) the first step so resolve returns the second step. Then call resolve again with the same route.</p>
  <div class="callout callout-tip">
    <strong>Tip</strong> — If you do not yet have a step update endpoint, deleting the first step is the simplest way to force the fallback path; re-create it afterwards.
  </div>
  <h3>You'll see</h3>
  <p>The resolve response returns the <strong>second</strong> step's provider (<code>data.providerType</code> and <code>data.modelId</code>). Restormel skipped the first step and fell through to the next.</p>
  <h3>How to test</h3>
  <p>After removing or disabling the first step's credential, call resolve again. Expected: <code>"anthropic"</code> (or your second step's provider). Re-enable (or re-create) the first step after testing.</p>
  <div class="callout callout-pitfall">
    <strong>Pitfall</strong> — If you want route resolution to depend on which platform keys are present in your app's environment, use local resolve (Phase 2, Step 2.6) and implement <code>getPlatformKey</code>. Under <strong>Connections</strong>, you can store a <strong>hosted API key</strong> (encrypted at rest when configured) or a <strong>vault reference</strong> only; the UI never echoes full secrets after save. See <a href="/keys/docs/guides/keys-testing-onboarding">Keys + Testing onboarding</a> for the Testing-oriented path.
  </div>
  </WalkthroughStep>

  <WalkthroughStep stepId="3.5" title="Step 3.5 — Wire route IDs into your application" {phaseSlug}>
  <p>Make the route ID configurable in your resolve wrapper so different parts of your app can use different routes.</p>
  <CodeBlock language="ts" code={resolveProviderWithRouteIdExample} />
  <p>Call sites: <code>{callSiteIngestion}</code> for ingestion; <code>{callSiteChat}</code> for chat.</p>
  <h3>You'll see</h3>
  <p>No visible change yet (the flag is still off by default). When you test with the flag on, different call sites resolve through different routes.</p>
  <h3>How to test</h3>
  <p><code>USE_RESTORMEL_KEYS=true pnpm dev</code> — trigger an ingestion job (should resolve via <code>ingestion</code> route) and a chat request (should resolve via <code>interactive</code> if you created one).</p>

  <p><strong>Implementors:</strong> See “Agent prompts for this phase” below for a prompt you can paste into a coding agent.</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="3.6" title="Step 3.6 — (Optional) Create a second route" {phaseSlug}>
  <p>If your app has distinct AI call patterns — for example, fast-and-cheap for autocomplete vs. powerful-and-expensive for analysis — create separate routes with different step orders and models (e.g. <code>autocomplete</code> with gpt-4o-mini first, <code>analysis</code> with claude-sonnet first). Create both in the Dashboard, then use the appropriate <code>routeId</code> in each call site.</p>
  <h3>How to test</h3>
  <p>Resolve with <code>routeId: "autocomplete"</code> and <code>routeId: "analysis"</code>; <code>jq '.data.providerType, .data.modelId'</code> should show different providers/models.</p>
  </WalkthroughStep>

  <AgentPromptsSection
    intro="These are optional and collapsed by default. Use them if you're implementing Phase 3 with a coding agent."
    prompts={agentPrompts}
    defaultOpen={false}
  />

  <p><strong>Checkpoint checklist:</strong> mark each step complete as you finish it.</p>
  <WalkthroughChecklist phaseSlug={phaseSlug} steps={phase3Steps} />

  <h2>Checkpoint</h2>
  <p>You now have: at least one named route in the Dashboard with multiple steps (fallback chain); your resolve client passes a <code>routeId</code> so different parts of your app use different routing strategies; fallback verified. The feature flag is still off by default. When on, your app resolves through Restormel routes.</p>

  <WalkthroughPhaseNav {prev} {next} {stepOf} />
</div>

<style>
  .doc-content { max-width: var(--rm-container-narrow); }
  .doc-meta { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-2); }
  .doc-step { font-weight: var(--font-medium); }
  .doc-prereqs { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-6); line-height: var(--leading-relaxed); }
  .doc-prereqs a { color: var(--rm-primary); }
  .doc-content h1 { font-family: var(--rm-font-display); font-size: var(--text-2xl); margin: 0 0 var(--space-4); }
  .doc-content h2 { font-size: var(--text-xl); margin: var(--space-8) 0 var(--space-3); }
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
