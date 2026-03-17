<script lang="ts">
  /** Phase 2 — Resolve. Progressive disclosure: checklist + expandable steps. */
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { getWalkthroughPrevNext } from "$lib/docs-walkthrough-nav";
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";
  import AgentPromptsSection from "$lib/components/walkthrough/AgentPromptsSection.svelte";
  import WalkthroughChecklist from "$lib/components/walkthrough/WalkthroughChecklist.svelte";
  import WalkthroughStep from "$lib/components/walkthrough/WalkthroughStep.svelte";
  import WalkthroughPhaseNav from "$lib/components/walkthrough/WalkthroughPhaseNav.svelte";

  const { prev, next, stepOf } = getWalkthroughPrevNext("phase-2-resolve");
  const phaseSlug = "phase-2-resolve";

  const phase2Steps = [
    { id: "2.1", label: "Understand the resolve flow" },
    { id: "2.2", label: "Test resolve with curl" },
    { id: "2.3", label: "Create a typed resolve client" },
    { id: "2.4", label: "Wire resolve into the feature flag" },
    { id: "2.5", label: "Add error handling and local fallback" },
    { id: "2.6", label: "(Optional) Use the npm package resolve locally" },
  ];

  const curlResolve = `curl -X POST \\
  "https://restormel.dev/keys/dashboard/api/projects/\${RESTORMEL_PROJECT_ID}/resolve" \\
  -H "Authorization: Bearer \${RESTORMEL_GATEWAY_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{ "environmentId": "production" }'`;

  const resolveResponseExample = `{
  "data": {
    "routeId": "route_123",
    "providerType": "openai",
    "modelId": "gpt-4o",
    "explanation": "route=route_123 step=0 provider=openai model=gpt-4o"
  }
}`;

  const typedResolveClientExample = `// src/lib/server/restormel.ts
interface ResolveRequest { environmentId: string; routeId?: string; }
interface ResolveResponse {
  data: { routeId: string; providerType: string | null; modelId: string | null; explanation: string; };
}
const RESTORMEL_BASE_URL = process.env.RESTORMEL_BASE_URL ?? 'https://restormel.dev/keys/dashboard';
const RESTORMEL_GATEWAY_KEY = process.env.RESTORMEL_GATEWAY_KEY ?? '';
const RESTORMEL_PROJECT_ID = process.env.RESTORMEL_PROJECT_ID ?? '';

export async function restormelResolve(request: ResolveRequest): Promise<ResolveResponse> {
  const url = \`\${RESTORMEL_BASE_URL}/api/projects/\${RESTORMEL_PROJECT_ID}/resolve\`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': \`Bearer \${RESTORMEL_GATEWAY_KEY}\`, 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(\`Restormel resolve failed (\${res.status}): \${body.slice(0, 200)}\`);
  }
  return res.json() as Promise<ResolveResponse>;
}`;

  const resolveClientTabs = [
    { label: "TypeScript", language: "ts", code: typedResolveClientExample },
    {
      label: "JavaScript",
      language: "js",
      code: `// src/lib/server/restormel.js
const RESTORMEL_BASE_URL = process.env.RESTORMEL_BASE_URL ?? 'https://restormel.dev/keys/dashboard';
const RESTORMEL_GATEWAY_KEY = process.env.RESTORMEL_GATEWAY_KEY ?? '';
const RESTORMEL_PROJECT_ID = process.env.RESTORMEL_PROJECT_ID ?? '';

export async function restormelResolve(request) {
  const url = \`\${RESTORMEL_BASE_URL}/api/projects/\${RESTORMEL_PROJECT_ID}/resolve\`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': \`Bearer \${RESTORMEL_GATEWAY_KEY}\`, 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(\`Restormel resolve failed (\${res.status}): \${body.slice(0, 200)}\`);
  }
  return res.json();
}`,
    },
  ];

  const sveltekitImportExample = "import { restormelResolve } from '$lib/server/restormel';";

  const testResolveScriptExample = `// scripts/test-resolve.ts (run with tsx or ts-node)
import { restormelResolve } from '../src/lib/server/restormel';
const result = await restormelResolve({ environmentId: 'production' });
console.log('Resolved:', JSON.stringify(result, null, 2));`;

  const resolveProviderWiringExample = `// src/lib/server/resolve-provider.ts
import { USE_RESTORMEL_KEYS } from '../feature-flags';
import { restormelResolve } from './restormel';

export async function resolveProvider(preferredModel?: string) {
  if (USE_RESTORMEL_KEYS) {
    const result = await restormelResolve({
      environmentId: process.env.RESTORMEL_ENVIRONMENT_ID ?? 'production',
    });
    return {
      provider: result.data.providerType ?? process.env.DEFAULT_AI_PROVIDER ?? 'openai',
      model: result.data.modelId ?? preferredModel ?? null,
      source: 'restormel',
    };
  }
  return legacyResolve(preferredModel);
}`;

  const resolveErrorHandlingExample = `if (USE_RESTORMEL_KEYS) {
  try {
    const result = await restormelResolve({ environmentId: process.env.RESTORMEL_ENVIRONMENT_ID ?? 'production' });
    return {
      provider: result.data.providerType ?? process.env.DEFAULT_AI_PROVIDER ?? 'openai',
      model: result.data.modelId ?? preferredModel ?? null,
      source: 'restormel',
    };
  } catch (err) {
    console.error('[restormel] Resolve failed, falling back to legacy:', err);
  }
}
return legacyResolve(preferredModel);`;

  const createResolveClientPrompt = `You are working in [your app repo].

Goal: Create a typed Restormel resolve client, wire it into the feature flag from Phase 0, and add error handling with legacy fallback.

Steps:
1. Identify the legacy function that currently decides which provider/model to call (from your Phase 0 routing inventory).
2. Create src/lib/server/restormel.ts (or equivalent server-only module) that:
   - Reads RESTORMEL_BASE_URL (default https://restormel.dev/keys/dashboard), RESTORMEL_GATEWAY_KEY, RESTORMEL_PROJECT_ID from environment.
   - Exports restormelResolve({ environmentId, routeId? }) that POSTs to /api/projects/\${RESTORMEL_PROJECT_ID}/resolve with Authorization: Bearer \${RESTORMEL_GATEWAY_KEY}.
   - Throws on non-2xx responses with status and a truncated response body (no secrets).
3. Create scripts/test-resolve.ts and run it with npx tsx to confirm the response contains data.providerType and data.modelId.
4. Update your resolve wrapper (e.g. src/lib/server/resolve-provider.ts):
   - If USE_RESTORMEL_KEYS=true: call restormelResolve inside try/catch.
   - On any failure: log a safe message (no raw keys), then fall back to legacy routing unchanged.
   - If USE_RESTORMEL_KEYS=false: always use legacy routing unchanged.
5. Add RESTORMEL_BASE_URL= to .env.example (placeholder only).
6. Verify:
   - Flag off (default): app behaviour unchanged.
   - Flag on: resolve happens via Restormel.
   - Flag on + invalid Gateway Key: fallback to legacy and request still succeeds.

DO NOT: Default USE_RESTORMEL_KEYS to true. Log the Gateway Key. Commit secrets. Remove legacy routing in this phase.`;

  const createLocalResolvePrompt = `You are working in [your app repo].

Goal: Add an optional local (in-process) Restormel Keys resolve path, so you can avoid an HTTP call while keeping the same resolve wrapper API.

Steps:
1. Create src/lib/server/restormel-local.ts (or equivalent) that:
   - Imports createKeys and provider definitions from @restormel/keys.
   - Uses getPlatformKey(provider) to read existing provider API keys from env vars (do not hardcode values).
   - Exports a keys instance.
2. Update your resolve wrapper to support a local option (e.g. USE_RESTORMEL_LOCAL=true):
   - If USE_RESTORMEL_KEYS and USE_RESTORMEL_LOCAL: call keys.resolve(...) locally.
   - If USE_RESTORMEL_KEYS and not local: call the HTTP resolve client.
   - Otherwise: legacy path.
3. Add USE_RESTORMEL_LOCAL=false (placeholder) to .env.example.
4. Verify keys.resolve() returns a valid provider/model result when provider env vars are present.

DO NOT: Import UI packages in server code. Remove the HTTP resolve client. Commit secrets.`;

  const agentPrompts = [
    {
      id: "p2-review",
      title: "Prompt 2A — Review this phase (no code changes)",
      intent: "Have an agent read Phase 2 and produce an implementation plan for adding resolve behind the Phase 0 feature flag.",
      contextDocs: [
        "This page: /keys/docs/walkthrough/phase-2-resolve",
        "Phase 0 output: docs/restormel-integration/00-routing-inventory.md (in your app repo)",
      ],
      prompt: `You are working in [your app repo].

Goal: Review Phase 2 of the Restormel Keys walkthrough and produce a concrete implementation plan (no code changes).

Steps:
1. Read the Phase 2 walkthrough page in full.
2. Identify the existing “legacy routing” entry point(s) from the Phase 0 inventory.
3. Decide where the resolve client and wrapper should live in this repo (paths + module boundaries).
4. List the environment variables that must be added (placeholders only).
5. Define exactly how you will test: curl test, script test, flag-on/flag-off validation, and failure fallback.

DO NOT: Create files yet. Install packages. Paste secrets.`,
      gate: "You have a Phase 2 plan: exact file paths, test commands, and gate criteria, with no changes made yet.",
    },
    {
      id: "p2-http",
      title: "Prompt 2B — Create HTTP resolve client + wire feature flag",
      intent: "Implement the HTTP resolve client, wire it into the Phase 0 feature flag, and add safe fallback behaviour.",
      contextDocs: ["This page: /keys/docs/walkthrough/phase-2-resolve"],
      prompt: createResolveClientPrompt,
      gate: "A test script prints a valid resolve response; flag off is unchanged; flag on resolves via Restormel or safely falls back to legacy.",
    },
    {
      id: "p2-local",
      title: "Prompt 2C — (Optional) Add local resolve (no HTTP)",
      intent: "Add an optional local resolve path that keeps secrets server-side and preserves the wrapper API.",
      contextDocs: ["This page: /keys/docs/walkthrough/phase-2-resolve (Step 2.6)"],
      prompt: createLocalResolvePrompt,
      gate: "Local resolve can be enabled without breaking HTTP resolve or the legacy path; keys remain unlogged and uncommitted.",
    },
  ];
</script>

<svelte:head>
  <title>Phase 2 — Resolve your first model — Restormel Keys</title>
  <meta name="description" content="Wire a resolve call into your backend; verify providerType and modelId; add error handling and feature-flag branch." />
</svelte:head>

<div class="doc-content">
  <p class="doc-meta"><span class="doc-step">{stepOf}</span></p>
  <h1>Phase 2 — Resolve your first model</h1>
  <p class="doc-prereqs">
    <strong>Time:</strong> ~15 minutes<br />
    <strong>Prerequisites:</strong> <a href="/keys/docs/walkthrough/phase-1-install">Phase 1</a> complete (packages installed, project created, Gateway Key in <code>.env</code>, <code>keys doctor</code> passes)<br />
    <strong>You'll need:</strong> Terminal access, a running dev server (or curl/httpie), your Gateway Key and Project ID from the <a href={DASHBOARD_BASE}>Dashboard</a>
  </p>

  <p>This phase wires a single resolve call into your backend. By the end, your app can ask Restormel "which provider and model should I use for this request?" and get a concrete answer. You verify the response shape, then plug it into the feature-flag branch from Phase 0.</p>

  <WalkthroughStep stepId="2.1" title="Step 2.1 — Understand the resolve flow" defaultOpen={true} {phaseSlug}>
  <p>Before writing code, understand what happens when your backend calls resolve:</p>
  <ol>
    <li>Your backend sends a <code>POST</code> to the resolve endpoint with your project ID and environment.</li>
    <li>Restormel evaluates the project's routes (fallback chain) and policies (allowlists, budgets, etc.).</li>
    <li>Restormel returns a JSON object telling you which provider, model, and key source to use.</li>
    <li>Your backend calls the AI provider directly using that information.</li>
  </ol>
  <p>Restormel does <strong>not</strong> proxy the AI request. It tells you <em>where</em> to send it; you send it yourself. This keeps latency low and means your provider API keys never transit through Restormel (unless you've stored provider credentials in the dashboard and want Restormel to supply them).</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="2.2" title="Step 2.2 — Test resolve with curl" {phaseSlug}>
  <p>Before writing any application code, confirm the resolve endpoint works with a raw HTTP call. This isolates Restormel from your app so you can verify the plumbing.</p>
  <CodeBlock language="bash" code={curlResolve} />
  <div class="callout callout-tip">
    <strong>Tip</strong> — If you use the Cloud API through the Zuplo gateway, the URL is your gateway URL and you authenticate with your consumer key (<code>zpka_…</code>). For this walkthrough we use the dashboard API directly with the Gateway Key. See <a href="/keys/docs/cloud-api">Cloud API</a> for the gateway path.
  </div>
  <h3>You'll see</h3>
  <p>A JSON response wrapped under <code>data</code>:</p>
  <CodeBlock language="json" code={resolveResponseExample} />
  <p><strong>Reading the response:</strong></p>
  <table class="doc-table">
    <thead>
      <tr><th>Field</th><th>Meaning</th></tr>
    </thead>
    <tbody>
      <tr><td><code>data.routeId</code></td><td>The matched route ID (created in the dashboard in Phase 3)</td></tr>
      <tr><td><code>data.providerType</code></td><td>The AI provider to call (e.g. <code>openai</code>, <code>anthropic</code>, <code>google</code>)</td></tr>
      <tr><td><code>data.modelId</code></td><td>The model to use; may be <code>null</code> if none configured</td></tr>
      <tr><td><code>data.explanation</code></td><td>A human-readable trace of the resolution path (useful for debugging)</td></tr>
    </tbody>
  </table>
  <p>If you have not created a route for this <code>environmentId</code> yet, resolve returns <strong>404</strong> with <code>{'{'} "error": "no_route" {'}'}</code>. That is expected — you create your first route in Phase 3.</p>
  <h3>How to test</h3>
  <p>The curl command returns HTTP 200 and a JSON body with <code>data.providerType</code>. If you get:</p>
  <ul>
    <li><strong>401 Unauthorized</strong> — your Gateway Key is wrong or missing. Check <code>RESTORMEL_GATEWAY_KEY</code>.</li>
    <li><strong>404 Not Found</strong> — your project ID is wrong. Check <code>RESTORMEL_PROJECT_ID</code> against the dashboard.</li>
    <li><strong>404 no_route</strong> — your project has no active route for the <code>environmentId</code> you sent. Create a route in Phase 3.</li>
  </ul>
  <div class="callout callout-note">
    <strong>If you see "no_key_available"</strong> — Your route's steps point at providers that are not currently usable. Create a route with at least one enabled step (Phase 3). If you only want Restormel to choose a route while you supply provider credentials in your own app, use local resolve (Step 2.6) instead of the dashboard resolve endpoint.
  </div>
  </WalkthroughStep>

  <WalkthroughStep stepId="2.3" title="Step 2.3 — Create a typed resolve client" {phaseSlug}>
  <p>Add a small server-side module that calls the resolve endpoint. This becomes the single place your app asks Restormel for routing decisions.</p>
  <p><strong>Next.js / generic Node (TypeScript):</strong></p>
  <CodeBlock tabs={resolveClientTabs} />
  <p><strong>SvelteKit:</strong> Same implementation — SvelteKit server modules use the same Node/fetch APIs. Import with <code>{sveltekitImportExample}</code></p>
  <h3>You'll see</h3>
  <p>A new file at <code>src/lib/server/restormel.ts</code> (or equivalent). No UI or behaviour changes yet.</p>
  <h3>How to test</h3>
  <CodeBlock language="ts" code={testResolveScriptExample} />
  <CodeBlock language="bash" code={`npx tsx scripts/test-resolve.ts`} />
  <p>You should see the same JSON structure as the curl response from Step 2.2.</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="2.4" title="Step 2.4 — Wire resolve into the feature flag" {phaseSlug}>
  <p>Connect the resolve client to the feature-flag branch you created in Phase 0 (Step 0.5). This is the moment your app can optionally route through Restormel — but still defaults to the old path.</p>
  <CodeBlock language="ts" code={resolveProviderWiringExample} />
  <h3>You'll see</h3>
  <p>Your existing routing code still runs (the flag is <code>false</code>). The new path exists but is not active.</p>
  <h3>How to test</h3>
  <p><strong>Legacy path (flag off):</strong> <code>pnpm dev</code> — make a request that triggers an AI call; it should behave identically to before.</p>
  <p><strong>Restormel path (flag on):</strong> <code>USE_RESTORMEL_KEYS=true pnpm dev</code> — make the same request; it should now resolve via Restormel. Turn the flag back off after testing. Production cutover happens in Phase 6.</p>
  <div class="callout callout-pitfall">
    <strong>Pitfall</strong> — If the Restormel path returns <code>no_key_available</code> and your app crashes, add error handling: catch the resolve error and fall back to the legacy path. This is your safety net during the parallel-run period.
  </div>
  </WalkthroughStep>

  <WalkthroughStep stepId="2.5" title="Step 2.5 — Add error handling and local fallback" {phaseSlug}>
  <p>The resolve call is a network request. It can fail (network error, Restormel downtime, misconfiguration). Your app should handle this gracefully.</p>
  <CodeBlock language="ts" code={resolveErrorHandlingExample} />
  <h3>You'll see</h3>
  <p>If Restormel is unreachable or returns an error, your app logs the error and continues with the legacy routing path. No user-facing impact.</p>
  <h3>How to test</h3>
  <p>Temporarily set an invalid Gateway Key and enable the flag: <code>RESTORMEL_GATEWAY_KEY=rk_invalid USE_RESTORMEL_KEYS=true pnpm dev</code>. Make a request that triggers an AI call. You should see a console error and the request should succeed via the legacy path. Restore your real Gateway Key after testing.</p>

  <p><strong>Implementors:</strong> See “Agent prompts for this phase” below for a sequenced set of prompts (review → implement).</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="2.6" title="Step 2.6 — (Optional) Use the npm package resolve locally" {phaseSlug}>
  <p>If your backend is Node/TypeScript and you prefer to resolve locally (no HTTP call to the dashboard), you can use <code>@restormel/keys</code> in-process. This uses the same routing engine but runs locally. Useful if you want zero added latency, manage provider keys in your own env vars, and don't need dashboard-configured routes yet.</p>
  <p>See the full code sample in the repo at <code>docs/walkthrough/04-phase-2-resolve.md</code> (Step 2.6). You get the same resolution shape but resolved locally.</p>
  <div class="callout callout-tip">
    <strong>Tip</strong> — You can start with local resolve (this step) and switch to HTTP resolve (Step 2.3) later when you're ready to use dashboard-managed routes and policies. The <code>resolveProvider</code> wrapper from Step 2.4 makes this a one-line change.
  </div>
  </WalkthroughStep>

  <AgentPromptsSection
    intro="These are optional and collapsed by default. Use them if you're implementing Phase 2 with a coding agent."
    prompts={agentPrompts}
    defaultOpen={false}
  />

  <p><strong>Checkpoint checklist:</strong> mark each step complete as you finish it.</p>
  <WalkthroughChecklist phaseSlug={phaseSlug} steps={phase2Steps} />

  <h2>Checkpoint</h2>
  <p>You now have:</p>
  <ul>
    <li>A typed resolve client that calls the Restormel API (<code>src/lib/server/restormel.ts</code>).</li>
    <li>(Optional) A local resolve instance using <code>@restormel/keys</code>.</li>
    <li>A <code>resolveProvider</code> function that branches on the feature flag: Restormel path (with error fallback) or legacy path.</li>
    <li>A test script that confirms the resolve endpoint works.</li>
    <li>Error handling that falls back to legacy routing if Restormel is unreachable.</li>
  </ul>
  <p>Your app still defaults to the legacy routing path. You've confirmed the Restormel path works when the flag is on.</p>

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
  .doc-content ul, .doc-content ol { margin: 0 0 var(--space-4); padding-left: var(--space-5); }
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
