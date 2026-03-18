<script lang="ts">
  /** Phase 0 — Inventory. Progressive disclosure: checklist + expandable steps. */
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { getWalkthroughPrevNext } from "$lib/docs-walkthrough-nav";
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";
  import TextPanel from "$lib/components/docs/TextPanel.svelte";
  import AgentPromptsSection from "$lib/components/walkthrough/AgentPromptsSection.svelte";
  import WalkthroughChecklist from "$lib/components/walkthrough/WalkthroughChecklist.svelte";
  import WalkthroughStep from "$lib/components/walkthrough/WalkthroughStep.svelte";
  import WalkthroughPhaseNav from "$lib/components/walkthrough/WalkthroughPhaseNav.svelte";

  const { prev, next, stepOf } = getWalkthroughPrevNext("phase-0-inventory");
  const phaseSlug = "phase-0-inventory";

  const phase0Steps = [
    { id: "0.1", label: "Identify your current routing surface" },
    { id: "0.2", label: "Classify each piece: remove, keep, or wrap" },
    { id: "0.3", label: "Document the current provider call pattern" },
    { id: "0.4", label: "Plan the replacement sequence" },
    { id: "0.5", label: "Set up a feature flag (optional)" },
  ];

  const resolveProviderSnippet = `// src/lib/server/resolve-provider.ts
import { USE_RESTORMEL_KEYS } from '../feature-flags';

export async function resolveProvider(request: AIRequest) {
  if (USE_RESTORMEL_KEYS) {
    return await restormelResolve(request);
  }
  return await legacyRouter.resolve(request);
}`;

  const inventoryExample = `REMOVE  src/lib/server/ai-router.ts        — custom fallback chain, replaced by Restormel routes
REMOVE  src/lib/server/model-allowlist.ts   — hardcoded model list, replaced by Restormel policies
KEEP    src/lib/server/billing/wallet.ts    — billing logic, not routing
WRAP    src/lib/server/ingestion/worker.ts — replace ai-router call with Restormel Resolve
REMOVE  src/components/ModelPicker.svelte  — custom model UI, replaced by Restormel ModelSelector
WRAP    src/components/KeySettings.tsx     — BYOK UI, may replace with Restormel KeyManager or keep as wrapper`;

  const featureFlagSnippet = `// src/lib/feature-flags.ts
export const USE_RESTORMEL_KEYS = process.env.USE_RESTORMEL_KEYS === 'true';`;

  const flagTestSnippet = `# Confirm the flag defaults to off
echo $USE_RESTORMEL_KEYS  # should be empty or unset

# Confirm your app starts normally
pnpm dev  # or your start command`;

  const buildAgentInventoryPrompt = `You are working in [your app repo].

Goal: Audit the codebase to produce a routing inventory for Restormel Keys integration.

Steps:
1. Search for shared routing helpers and SDK imports. List every file that chooses or calls a model.
2. Trace routing/selection modules; include secondary entrypoints (verify, extract, learn, eval), not only chat.
3. Search for model selection UI (dropdowns, selectors, settings pages). List those components.
4. Search for BYOK / key management code. List those files.
5. For each item, classify as REMOVE (Restormel replaces it), KEEP (app-specific, not routing), or WRAP (insert Restormel Resolve before the existing provider call).
6. Document the current provider call pattern for at least one primary entry point: entry point → selection logic → credential source → provider call → error handling.
7. Write the results to docs/restormel-integration/00-routing-inventory.md (or your equivalent docs folder).

DO NOT: Delete or modify any existing code. Commit real API keys or secrets. Guess about routing logic — trace the actual code paths.`;

  const buildAgentFlagPrompt = `You are working in [your app repo].

Goal: Add a feature flag USE_RESTORMEL_KEYS to gate the Restormel Keys integration.

Steps:
1. Create a feature flags module (e.g. src/lib/feature-flags.ts) that exports USE_RESTORMEL_KEYS, reading from process.env.USE_RESTORMEL_KEYS and defaulting to false.
2. Prefer one shared resolver module: add the flag branch there so chat, verify, extract, and learn paths stay aligned. If you branch many files, list every entrypoint so none are missed.
3. If USE_RESTORMEL_KEYS is true, call a placeholder restormelResolve() that throws "not yet implemented"; otherwise existing logic unchanged.
4. Add USE_RESTORMEL_KEYS=false to .env.example (not .env).
5. Verify the app starts and behaves identically with the flag unset.

DO NOT: Set the flag to true yet. Modify existing routing logic beyond adding the branch. Implement restormelResolve yet. Commit real API keys or secrets.`;

  const agentPrompts = [
    {
      id: "p0-review",
      title: "Prompt 0A — Review this phase (no code changes)",
      intent: "Have an agent read this page and produce a Phase 0 execution plan for your repo (files to touch later, risks, and gates), without changing code.",
      contextDocs: [
        "This page: /keys/docs/walkthrough/phase-0-inventory",
        "Optional: docs/walkthrough/11-prompt-index.md (reference prompt ordering)",
      ],
      prompt: `You are working in [your app repo].

Goal: Review Phase 0 of the Restormel Keys walkthrough and produce an implementation-ready plan (no code changes).

Steps:
1. Read the Phase 0 walkthrough page in full.
2. Summarise the Phase 0 deliverables in your own words.
3. List exactly what evidence you will collect during the inventory (imports, call sites, UI, BYOK, env vars, fallback chains).
4. Identify likely files/directories to search in this repo and the search terms you will use.
5. Define what the routing inventory document will contain (tables/sections) and where it will live.
6. State the gate criteria you will use to decide Phase 0 is complete.

DO NOT: Modify or delete any code. Create feature flags. Commit anything. Copy real secrets into docs.`,
      gate: "You have a written Phase 0 plan and a checklist of what you will inventory (but no code or docs changed yet).",
    },
    {
      id: "p0-inventory",
      title: "Prompt 0B — Inventory current routing (audit-only)",
      intent: "Generate a routing inventory document that identifies what to REMOVE, KEEP, or WRAP before integrating.",
      contextDocs: ["This page: /keys/docs/walkthrough/phase-0-inventory"],
      prompt: buildAgentInventoryPrompt,
      gate: "A routing inventory doc exists with all routing/selection/BYOK files classified and at least one end-to-end provider call pattern documented.",
    },
    {
      id: "p0-flag",
      title: "Prompt 0C — Add feature flag (optional but recommended)",
      intent: "Add a USE_RESTORMEL_KEYS flag that defaults off, so later phases can be rolled out safely.",
      contextDocs: [
        "This page: /keys/docs/walkthrough/phase-0-inventory (Step 0.5)",
        "Phase 2: /keys/docs/walkthrough/phase-2-resolve (where the flag is used)",
        "Phase 6: /keys/docs/walkthrough/phase-6-golive (where the flag is flipped)",
      ],
      prompt: buildAgentFlagPrompt,
      gate: "The flag exists (defaults off) and the app behaves identically when unset.",
    },
  ];
</script>

<svelte:head>
  <title>Phase 0 — Inventory your routing — Restormel Keys</title>
  <meta name="description" content="Audit your current AI routing and classify what to remove, keep, or wrap before integrating Restormel Keys." />
</svelte:head>

<div class="doc-content">
  <p class="doc-meta"><span class="doc-step">{stepOf}</span></p>
  <h1>Phase 0 — Inventory your routing</h1>
  <p class="doc-prereqs">
    <strong>Time:</strong> ~30 minutes (audit) + implementation time varies<br />
    <strong>Prerequisites:</strong> Access to your app's codebase, a Restormel Keys account (<a href="{DASHBOARD_BASE}/login">Sign in</a>)<br />
    <strong>You'll need:</strong> Your app's source code, terminal access, familiarity with where your app calls AI providers today
  </p>

  <h2>Before you begin</h2>
  <p>This walkthrough takes you from your current AI routing setup to a full Restormel Keys integration. By the end, your app uses Restormel for provider resolution, fallback routing, policy enforcement, and (optionally) embeddable UI for model selection and key management.</p>

  <h3>What you'll build across all phases</h3>
  <table class="doc-table">
    <thead>
      <tr><th>Phase</th><th>What you do</th><th>What you get</th></tr>
    </thead>
    <tbody>
      <tr><td><strong>0 — Inventory</strong></td><td>Audit and retire your custom routing</td><td>Clean separation; one shared resolver (or one place per entrypoint) identified</td></tr>
      <tr><td><strong>1 — Install</strong></td><td>Add packages, create a project in the dashboard</td><td>Working config, <code>keys doctor</code> passes</td></tr>
      <tr><td><strong>2 — Resolve</strong></td><td>Make your first resolve call</td><td>Backend knows which provider + model to use</td></tr>
      <tr><td><strong>3 — Routes</strong></td><td>Configure routes with fallback steps</td><td>Automatic failover when a provider is down</td></tr>
      <tr><td><strong>4 — Policies</strong></td><td>Add allowlists, deprecation blocks, budget caps</td><td>Guardrails enforced before resolution</td></tr>
      <tr><td><strong>5 — UI</strong></td><td>Embed ModelSelector and/or KeyManager</td><td>End-users choose models within your policy constraints</td></tr>
      <tr><td><strong>6 — Go live</strong></td><td>Parallel run, cutover, verify</td><td>Production traffic through Restormel</td></tr>
    </tbody>
  </table>

  <h3>Key terms</h3>
  <p>If these are unfamiliar, see the <a href="/keys/docs">Overview</a> or the terms below. For Phase 0:</p>
  <ul>
    <li><strong>Resolve</strong> — asking Restormel which provider + model + key source to use for a request.</li>
    <li><strong>Route</strong> — a named routing configuration in the dashboard; contains steps (a fallback chain).</li>
    <li><strong>Policy</strong> — a rule that constrains resolution (e.g. "only allow these models").</li>
    <li><strong>Gateway Key</strong> — the <code>rk_…</code> key your backend uses to authenticate to Restormel.</li>
  </ul>

  <h3>Skip ahead</h3>
  <p>Already done some of this?</p>
  <ul>
    <li>Packages installed and project created → <a href="/keys/docs/walkthrough/phase-2-resolve">Phase 2 — Resolve</a></li>
    <li>Routes configured → <a href="/keys/docs/walkthrough/phase-4-policies">Phase 4 — Policies</a></li>
    <li>Coming from LiteLLM, Portkey, or OpenRouter → <a href="/keys/docs/walkthrough/migration-paths">Migration paths</a></li>
  </ul>

  <h2>Why Phase 0 matters</h2>
  <p>Most apps that need Restormel Keys already have <em>something</em> doing provider routing — even if it's a hardcoded <code>if/else</code> or a config file mapping models to providers. Phase 0 is about finding all of those pieces so you can retire them cleanly rather than running two routing systems in parallel indefinitely.</p>
  <p>You are not deleting anything yet. You are making an inventory so the replacement in later phases is surgical.</p>

  <WalkthroughStep stepId="0.1" title="Step 0.1 — Identify your current routing surface" defaultOpen={true} {phaseSlug}>
  <p>Search your codebase for the code that currently decides which AI provider and model to use for a given request.</p>
  <p><strong>Look for:</strong></p>
  <ul>
    <li><strong>Shared resolver helpers</strong> — e.g. <code>getReasoningModelRoute</code>, <code>resolveModel</code>, <code>vertex.ts</code>, <code>ai-router</code>. Grep SDK imports alone often misses routing; trace callers of those helpers.</li>
    <li>Direct provider SDK imports (<code>openai</code>, <code>@anthropic-ai/sdk</code>, <code>@google/generative-ai</code>) — where are they called, and what decides <em>which</em> one to call?</li>
    <li>Environment variables like <code>DEFAULT_MODEL</code>, <code>AI_PROVIDER</code>, <code>OPENAI_API_KEY</code>, <code>ANTHROPIC_API_KEY</code> — who reads them and how do they affect routing?</li>
    <li>Custom router/gateway modules — any file named <code>router</code>, <code>provider</code>, <code>gateway</code>, <code>ai-client</code>, <code>model-selector</code>, or similar.</li>
    <li>Fallback logic — <code>try/catch</code> blocks that retry with a different provider on failure.</li>
    <li>Model selection UI — any dropdown, radio group, or settings page where users pick a model.</li>
    <li>BYOK settings — any UI or API where users paste their own provider API keys.</li>
  </ul>
  <p><strong>Multi-entrypoint apps:</strong> Include verification, extraction, learning, eval, and batch jobs — not only main chat — so policies stay consistent.</p>
  <div class="callout callout-note">
    <strong>BYOK during migration</strong> — Existing user BYOK storage can stay in place while Restormel handles provider/model resolution.
  </div>
  <h3>You'll see</h3>
  <p>A list of files and modules. Organise them into three categories:</p>
  <table class="doc-table">
    <thead>
      <tr><th>Category</th><th>What it contains</th><th>Example</th></tr>
    </thead>
    <tbody>
      <tr><td><strong>Routing logic</strong></td><td>Code that chooses provider/model</td><td><code>src/lib/server/ai-router.ts</code>, <code>src/lib/ai/fallback.ts</code></td></tr>
      <tr><td><strong>Model selection UI</strong></td><td>Frontend components for model/provider choice</td><td><code>src/components/ModelPicker.svelte</code>, <code>app/settings/page.tsx</code></td></tr>
      <tr><td><strong>BYOK / key management</strong></td><td>Storage, validation, or UI for user-provided API keys</td><td><code>src/lib/server/byok.ts</code>, <code>src/components/KeySettings.tsx</code></td></tr>
    </tbody>
  </table>
  <h3>How to test</h3>
  <p>There's nothing to test yet — this is an audit. Confirm you can answer: "If I grep for every place my app decides which AI provider to call, these are the files."</p>
  <div class="callout callout-tip">
    <strong>Tip</strong> — Use your IDE's "Find all references" on provider client constructors (e.g. <code>new OpenAI(...)</code>, <code>new Anthropic(...)</code>) to trace where provider choice happens. It's often faster than searching for strings.
  </div>
  </WalkthroughStep>

  <WalkthroughStep stepId="0.2" title="Step 0.2 — Classify each piece: remove, keep, or wrap" {phaseSlug}>
  <p>For each item in your inventory, decide its fate:</p>
  <table class="doc-table">
    <thead>
      <tr><th>Decision</th><th>When to use it</th><th>Action</th></tr>
    </thead>
    <tbody>
      <tr><td><strong>Remove</strong></td><td>Custom routing logic that Restormel will replace entirely (fallback chains, provider health checks, model allowlists)</td><td>Mark for deletion in Phase 2+. Do not delete yet.</td></tr>
      <tr><td><strong>Keep</strong></td><td>App-specific logic that Restormel does not own (billing, auth, session, orchestration/job logic, domain-specific pre/post-processing)</td><td>Leave untouched.</td></tr>
      <tr><td><strong>Wrap</strong></td><td>Code that currently calls providers directly but should call Restormel resolve first, then call the provider with the resolved result</td><td>Refactor in Phase 2 to insert a resolve call before the provider call.</td></tr>
    </tbody>
  </table>
  <h3>You'll see</h3>
  <p>An annotated version of your inventory. For example:</p>
  <TextPanel title="Example annotation" kind="output" content={inventoryExample} />
  <h3>How to test</h3>
  <p>Review your annotations with a second pair of eyes (or a coding agent). Confirm: every "REMOVE" item has a Restormel equivalent identified in the phases ahead. Every "KEEP" item genuinely has no routing responsibility.</p>
  <div class="callout callout-pitfall">
    <strong>Pitfall</strong> — Do not remove anything in this step. Phase 0 is audit-only. Deletion happens in Phase 2+ after the replacement is wired and tested.
  </div>
  </WalkthroughStep>

  <WalkthroughStep stepId="0.3" title="Step 0.3 — Document the current provider call pattern" {phaseSlug}>
  <p>Before you change anything, record how your app currently calls AI providers. This becomes your regression baseline.</p>
  <p>Write down (or have a coding agent extract):</p>
  <ol>
    <li><strong>Entry points:</strong> Which functions/routes initiate an AI provider call? (e.g. <code>POST /api/chat</code>, ingestion worker, background job)</li>
    <li><strong>Selection logic:</strong> For each entry point, how is provider + model chosen today? (e.g. env var, user preference, hardcoded, fallback chain)</li>
    <li><strong>Credential source:</strong> Where does the API key come from? (e.g. env var, user BYOK from database, config file)</li>
    <li><strong>Error handling:</strong> What happens when a provider call fails? (e.g. retry same provider, fallback to different provider, return error to user)</li>
    <li><strong>Observability:</strong> Are provider calls logged? Do you track which provider/model was used, latency, cost?</li>
  </ol>
  <h3>You'll see</h3>
  <p>A short document or code comment block that captures the current state. This is your "before" snapshot.</p>
  <h3>How to test</h3>
  <p>Pick one entry point. Trace the request from "user action" to "provider API call" and back. Confirm your documentation matches reality.</p>

  <p><strong>Implementors:</strong> See “Agent prompts for this phase” below for an audit-only prompt you can paste into a coding agent.</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="0.4" title="Step 0.4 — Plan the replacement sequence" {phaseSlug}>
  <p>Based on your inventory, plan which walkthrough phases address which items:</p>
  <table class="doc-table">
    <thead>
      <tr><th>Inventory item</th><th>Replaced by</th><th>Walkthrough phase</th></tr>
    </thead>
    <tbody>
      <tr><td>Custom fallback chain</td><td>Restormel routes + steps</td><td>Phase 3</td></tr>
      <tr><td>Hardcoded model allowlist</td><td>Restormel policies (model_allowlist)</td><td>Phase 4</td></tr>
      <tr><td>Provider selection logic</td><td>Restormel resolve call</td><td>Phase 2</td></tr>
      <tr><td>Model picker UI</td><td>Restormel ModelSelector component</td><td>Phase 5</td></tr>
      <tr><td>BYOK settings UI</td><td>Restormel KeyManager component (or keep as wrapper)</td><td>Phase 5</td></tr>
      <tr><td>Provider API key env vars</td><td>Restormel Gateway Key + provider credentials in dashboard</td><td>Phase 1</td></tr>
    </tbody>
  </table>
  <h3>How to test</h3>
  <p>Walk through each row and confirm: "When Phase N is complete, this inventory item will be retired." If any item has no corresponding phase, it either belongs in "KEEP" or you need to identify which phase handles it.</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="0.5" title="Step 0.5 — Set up a feature flag (optional but recommended)" {phaseSlug}>
  <p>If your app supports feature flags, create one now: <code>USE_RESTORMEL_KEYS</code> (or equivalent). This lets you run old and new routing in parallel during Phases 2–6 and roll back instantly if something breaks.</p>
  <p><strong>Larger apps:</strong> Gate inside a <strong>shared resolver</strong> so verify/learn/extract paths use the same branch — avoid sprinkling the flag only on chat.</p>
  <CodeBlock language="ts" code={featureFlagSnippet} />
  <p>Example — branch once in shared routing code:</p>
  <CodeBlock language="ts" code={resolveProviderSnippet} />
  <p>You'll wire <code>restormelResolve</code> in Phase 2. For now, the flag just exists.</p>
  <h3>You'll see</h3>
  <p>A feature flag that defaults to <code>false</code>. Your app behaves identically to before.</p>
  <h3>How to test</h3>
  <CodeBlock language="bash" code={flagTestSnippet} />

  <p><strong>Implementors:</strong> See “Agent prompts for this phase” below for a ready-to-run prompt for adding the flag safely.</p>
  </WalkthroughStep>

  <AgentPromptsSection
    intro="These are optional and collapsed by default. Use them if you're implementing Phase 0 with a coding agent."
    prompts={agentPrompts}
    defaultOpen={false}
  />

  <p><strong>Checkpoint checklist:</strong> mark each step complete as you finish it.</p>
  <WalkthroughChecklist phaseSlug={phaseSlug} steps={phase0Steps} />

  <h2>Checkpoint</h2>
  <p>You now have:</p>
  <ul>
    <li>A routing inventory listing every file that participates in AI provider selection, model choice, and BYOK.</li>
    <li>Each item classified as REMOVE, KEEP, or WRAP.</li>
    <li>A documented "before" snapshot of at least one provider call pattern.</li>
    <li>A replacement mapping showing which walkthrough phase handles each inventory item.</li>
    <li>(Optional) A feature flag ready to gate the new routing path.</li>
  </ul>
  <p>Nothing has been deleted or changed. Your app runs exactly as before.</p>

  <WalkthroughPhaseNav {prev} {next} {stepOf} />
</div>

<style>
  .doc-content {
    max-width: var(--rm-container-narrow);
  }
  .doc-meta {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-2);
  }
  .doc-step {
    font-weight: var(--font-medium);
  }
  .doc-prereqs {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
    line-height: var(--leading-relaxed);
  }
  .doc-prereqs a {
    color: var(--rm-primary);
  }
  .doc-content h1 {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    margin: 0 0 var(--space-4);
  }
  .doc-content h2 {
    font-size: var(--text-xl);
    margin: var(--space-8) 0 var(--space-3);
  }
  .doc-content h3 {
    font-size: var(--text-lg);
    margin: var(--space-4) 0 var(--space-2);
  }
  .doc-content p, .doc-content li {
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-4);
  }
  .doc-content ul, .doc-content ol {
    margin: 0 0 var(--space-4);
    padding-left: var(--space-5);
  }
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
  .doc-table th {
    background: var(--rm-surface-raised);
    font-weight: var(--font-medium);
  }
  .doc-table td { color: var(--rm-muted); }
  .doc-table code { font-family: var(--rm-font-ui); font-size: 0.9em; }
  .build-agent-block {
    margin: var(--space-6) 0;
    padding: var(--space-4);
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
  }
  .build-agent-block h3 {
    margin-top: 0;
  }
</style>
