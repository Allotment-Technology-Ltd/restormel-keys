<script lang="ts">
  /** Phase 5 — UI. Progressive disclosure: checklist + expandable steps. */
  import { getWalkthroughPrevNext } from "$lib/docs-walkthrough-nav";
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";
  import AgentPromptsSection from "$lib/components/walkthrough/AgentPromptsSection.svelte";
  import WalkthroughChecklist from "$lib/components/walkthrough/WalkthroughChecklist.svelte";
  import WalkthroughStep from "$lib/components/walkthrough/WalkthroughStep.svelte";
  import WalkthroughPhaseNav from "$lib/components/walkthrough/WalkthroughPhaseNav.svelte";

  const { prev, next, stepOf } = getWalkthroughPrevNext("phase-5-ui");
  const phaseSlug = "phase-5-ui";

  const themeCssSnippet = `rk-model-selector,
.rk-model-selector {
  --rk-bg: #1a1a1e;
  --rk-text: #e8e8ec;
  --rk-accent: #3b82f6;
  --rk-border: #2a2a2e;
  --rk-error: #ef4444;
  --rk-success: #22c55e;
}`;

  const phase5Steps = [
    { id: "5.1", label: "Decide what to embed" },
    { id: "5.2", label: "Embed ModelSelector (Next.js / React)" },
    { id: "5.3", label: "Embed ModelSelector (SvelteKit)" },
    { id: "5.4", label: "Embed ModelSelector (Web Components / vanilla)" },
    { id: "5.5", label: "Filter the model list by policies" },
    { id: "5.6", label: "Embed KeyManager (optional — for BYOK apps)" },
    { id: "5.7", label: "Theme the components" },
  ];

  const resolveProviderModelExample = "resolveProvider({ model: userSelectedModel })";

  const embedUiPrompt = `You are working in [your app repo].

Goal: Embed Restormel Keys UI components (ModelSelector and optionally KeyManager) in your settings page, with safe key handling and required UI states.

Steps:
1. Find the existing model picker / BYOK settings UI from your Phase 0 routing inventory.
2. Based on your framework:
   - Next.js/React: use @restormel/keys-react (KeysProvider + client component ModelSelector).
   - SvelteKit: use @restormel/keys-svelte (ModelSelector component + createKeys).
   - Other: use @restormel/keys-elements (Web Component) and set keys/providers as JS properties.
3. Wire selection events:
   - ModelSelector: send { modelId, providerId } to your backend (e.g. persist via POST /api/preferences, or use request-scoped selection per request — both valid).
   - KeyManager (if BYOK): wire add/remove to your key storage API (KeyManager sits on top of host-owned endpoints: POST /api/keys, DELETE /api/keys/:id).
4. Filter models by policy:
   - Recommended: a server-side endpoint (e.g. GET /api/allowed-models) that calls policy evaluate using your project Gateway Key; return only allowed model IDs to the browser.
5. Add required UI states: loading, error (with retry), empty.
6. Theme the components via --rk-* CSS custom properties to match your app.
7. Verify: renders, callbacks fire, theming applies, keyboard navigation works.

DO NOT: Expose Gateway Key in the browser. Log raw keys. Skip empty/error/loading states. Hardcode real secrets.`;

  const agentPrompts = [
    {
      id: "p5-review",
      title: "Prompt 5A — Review this phase (no code changes)",
      intent: "Have an agent read Phase 5 and plan exactly where to embed UI, how events map to your backend, and what states must exist.",
      contextDocs: ["This page: /keys/docs/walkthrough/phase-5-ui", "Phase 0 output: docs/restormel-integration/00-routing-inventory.md (in your app repo)"],
      prompt: `You are working in [your app repo].

Goal: Review Phase 5 of the Restormel Keys walkthrough and produce a concrete plan (no code changes).

Steps:
1. Read the Phase 5 walkthrough page in full.
2. Identify which components you need (ModelSelector required? KeyManager for BYOK?).
3. Identify the target page(s) and component boundaries in your app where these will be embedded.
4. Define the backend endpoints you will wire (preferences save, key storage) and the data contracts.
5. Decide how model filtering will work (server proxy using Gateway Key vs local entitlements if using local resolve).
6. List required UI states and accessibility checks.

DO NOT: Implement UI yet. Add secrets to client code. Commit secrets.`,
      gate: "You have an implementation plan (files + endpoints + states + security constraints) with no changes made yet.",
    },
    {
      id: "p5-embed",
      title: "Prompt 5B — Embed ModelSelector (and optional KeyManager)",
      intent: "Implement UI embedding and wiring, including policy-filtered model list and safe key handling.",
      contextDocs: ["This page: /keys/docs/walkthrough/phase-5-ui", "Compatibility: /keys/docs/compatibility"],
      prompt: embedUiPrompt,
      gate: "Components render; callbacks work; policy filtering is server-side; required states exist; no raw keys are logged or exposed.",
    },
  ];
</script>

<svelte:head>
  <title>Phase 5 — Embed the UI — Restormel Keys</title>
  <meta name="description" content="Embed ModelSelector and KeyManager; policy-filtered model list via server-side proxy; theming with --rk-* CSS." />
</svelte:head>

<div class="doc-content">
  <p class="doc-meta"><span class="doc-step">{stepOf}</span></p>
  <h1>Phase 5 — Embed the UI</h1>
  <p class="doc-prereqs">
    <strong>Time:</strong> ~25 minutes<br />
    <strong>Prerequisites:</strong> <a href="/keys/docs/walkthrough/phase-4-policies">Phase 4</a> complete (routes and policies configured, resolve works with route IDs)<br />
    <strong>You'll need:</strong> Your app's frontend codebase, the UI packages installed in Phase 1
  </p>

  <p>This phase puts Restormel's embeddable components into your app so end-users can select models and (optionally) manage their own provider credentials. By the end, your app shows a ModelSelector filtered by your policies and optionally a KeyManager for BYOK, both wired to your backend.</p>

  <div class="callout callout-note">
    <strong>Package availability</strong> — The UI packages (<code>@restormel/keys-svelte</code>, <code>@restormel/keys-react</code>, <code>@restormel/keys-elements</code>) may not be published to npm yet and can return <strong>404</strong> from <code>npm view</code>. Before following the install steps below, verify: <code>npm view @restormel/keys-svelte version</code> (and the same for <code>keys-react</code>, <code>keys-elements</code>). If any return 404, use the <strong>headless path</strong> until they are published: keep <code>@restormel/keys</code> only, implement a server-side allowed-models proxy (e.g. <code>GET /api/allowed-models</code>) backed by Restormel evaluate, and use your own model picker UI (or copy patterns from the repo demos). See <strong>docs/reference/npm-packages.md</strong> in the repo for verify-before-install and 404 handling.
  </div>

  <WalkthroughStep stepId="5.1" title="Step 5.1 — Decide what to embed" defaultOpen={true} {phaseSlug}>
  <p>Not every app needs every component. Use this decision matrix:</p>
  <table class="doc-table">
    <thead>
      <tr><th>If your app…</th><th>Embed</th><th>Skip</th></tr>
    </thead>
    <tbody>
      <tr><td>Lets users choose which AI model to use</td><td><strong>ModelSelector</strong></td><td>—</td></tr>
      <tr><td>Lets users bring their own provider API keys (BYOK)</td><td><strong>KeyManager</strong></td><td>—</td></tr>
      <tr><td>Shows cost estimates before running a request</td><td><strong>CostEstimator</strong></td><td>—</td></tr>
      <tr><td>Only uses platform keys with no user choice</td><td>—</td><td>All UI components (server-side resolve is enough)</td></tr>
    </tbody>
  </table>
  <p>Most apps that reached this phase want <strong>ModelSelector</strong>. KeyManager is for apps where users supply their own OpenAI/Anthropic/Google keys. CostEstimator is a nice-to-have.</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="5.2" title="Step 5.2 — Embed ModelSelector (Next.js / React)" {phaseSlug}>
  <p>Use <code>KeysProvider</code> from <code>@restormel/keys-react</code> and a client component that renders <code>ModelSelector</code> with <code>keys</code>, <code>providers</code>, and <code>onSelect</code>. Wire <code>onSelect</code> to your backend — for example persist to <code>POST /api/preferences</code> with <code>modelId</code> and <code>providerId</code>, or use request-scoped model selection (pass selection per request); both are valid.</p>
  <div class="callout callout-tip">
    <strong>Tip</strong> — Use <code>next/dynamic</code> with <code>ssr: false</code> to lazy-load the model selector so it doesn't increase your initial page bundle.
  </div>
  <h3>You'll see</h3>
  <p>A model selection UI grouped by provider. Each model shows its availability based on whether a key exists for that provider. Users click a model to select it.</p>
  <h3>How to test</h3>
  <p>Start your dev server, navigate to your settings page, confirm the ModelSelector renders with provider groups and models, and click a model to confirm the <code>onSelect</code> callback fires (check the network tab for the preferences API call).</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="5.3" title="Step 5.3 — Embed ModelSelector (SvelteKit)" {phaseSlug}>
  <p>Import <code>ModelSelector</code> from <code>@restormel/keys-svelte</code> and <code>createKeys</code> plus provider definitions from <code>@restormel/keys</code>. Create the <code>keys</code> instance and pass <code>keys</code>, <code>providers</code>, and <code>onSelect</code> to the component. Wire <code>onSelect</code> to your backend (e.g. persist via <code>POST /api/preferences</code> or use request-scoped selection — both are valid).</p>
  <h3>You'll see</h3>
  <p>The same model selection UI as the React version, rendered natively in Svelte.</p>
  <h3>How to test</h3>
  <p>Same as Step 5.2: navigate to the settings page, confirm rendering, click a model, verify the callback.</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="5.4" title="Step 5.4 — Embed ModelSelector (Web Components / vanilla)" {phaseSlug}>
  <p>For frameworks not covered by the React or Svelte wrappers, use the Web Components: import <code>@restormel/keys-elements</code>, create the <code>keys</code> instance, set <code>el.keys</code> and <code>el.providers</code> on the <code>&lt;rk-model-selector&gt;</code> element, and listen for the <code>rk-model-selected</code> event to save the selection to your backend.</p>
  <div class="callout callout-pitfall">
    <strong>Pitfall</strong> — Web Components require setting object props (<code>keys</code>, <code>providers</code>) via JavaScript properties, not HTML attributes. See <a href="/keys/docs/compatibility">Framework compatibility</a> for the full list.
  </div>
  <h3>You'll see</h3>
  <p>The model selector rendered inside a shadow DOM. Theming applies via <code>--rk-*</code> CSS custom properties.</p>
  <h3>How to test</h3>
  <p>Open your page in a browser, confirm the custom element renders, click a model, and confirm the <code>rk-model-selected</code> event fires.</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="5.5" title="Step 5.5 — Filter the model list by policies" {phaseSlug}>
  <p>The ModelSelector shows all models from the configured providers by default. If you have policies (Phase 4) that restrict which models are allowed, filter the model list so users only see valid choices.</p>
  <p><strong>Server-side filtering (recommended):</strong> Add an API route (e.g. <code>GET /api/allowed-models</code>) that calls the Restormel <strong>evaluate</strong> endpoint for each candidate model, using your project <strong>Gateway Key</strong> from server-side environment variables. Return only the allowed model IDs to the client and configure the component with that list.</p>
  <div class="callout callout-security">
    <strong>Security</strong> — Never call the policies API from the browser. Keep <code>RESTORMEL_GATEWAY_KEY</code> server-side only. Use a server proxy like <code>/api/allowed-models</code> and return only the filtered model IDs to the client.
  </div>
  <p><strong>Client-side filtering:</strong> If you use local resolve (Phase 2, Step 2.6), you can use <code>keys.entitlements.getAvailableModels(allModelIds)</code> to filter.</p>
  <h3>You'll see</h3>
  <p>The ModelSelector shows only models that pass your policies. Blocked models are either hidden or shown as unavailable.</p>
  <h3>How to test</h3>
  <p>Add a <code>model_allowlist</code> policy that excludes one model. Refresh the settings page; that model should not appear (or should appear greyed out with "Not allowed").</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="5.6" title="Step 5.6 — Embed KeyManager (optional — for BYOK apps)" {phaseSlug}>
  <p>If your app lets end-users bring their own API keys, embed the KeyManager component. It provides a settings panel for users to add, validate, list, and remove their provider credentials. <strong>KeyManager sits on top of your own storage and validation endpoints</strong> — you implement and own the key storage API (e.g. <code>POST /api/keys</code>, <code>DELETE /api/keys/:id</code>) and any server-side validation; KeyManager is the UI layer that calls them via <code>onKeyAdded</code> and <code>onKeyRemoved</code>.</p>
  <div class="callout callout-security">
    <strong>Security</strong> — Treat provider credentials as <em>builder-managed</em>. Raw key material should never be logged or persisted in plaintext. Restormel does not need to custody raw provider secrets by default: store credentials in your own backend/secret store (or use a gateway-backed scheme) and return only masked identifiers and metadata to the UI.
  </div>
  <h3>You'll see</h3>
  <p>A settings panel with an empty state, a form to select a provider and add a credential, feedback, a list of saved credentials (masked), and remove buttons.</p>
  <h3>How to test</h3>
  <p>Navigate to settings, add a key (test/invalid is fine to confirm validation), confirm <code>onKeyAdded</code> fires and your API receives the request. With a valid key, confirm validation passes. Delete the key and confirm <code>onKeyRemoved</code> fires.</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="5.7" title="Step 5.7 — Theme the components" {phaseSlug}>
  <p>Restormel UI components use <code>--rk-*</code> CSS custom properties for theming. Override them to match your app:</p>
  <CodeBlock language="css" code={themeCssSnippet} />
  <p>The components ship with dark (`.rk-dark`) and light (`.rk-light`) presets.</p>
  <h3>You'll see</h3>
  <p>Components render with your app's colour scheme.</p>
  <h3>How to test</h3>
  <p>Change a token (e.g. <code>--rk-accent</code>) to something distinct; confirm the accent colour updates on buttons and highlights.</p>
  </WalkthroughStep>

  <p><strong>Checkpoint checklist:</strong> mark each step complete as you finish it.</p>
  <WalkthroughChecklist phaseSlug={phaseSlug} steps={phase5Steps} />

  <AgentPromptsSection
    intro="These are optional and collapsed by default. Use them if you're implementing Phase 5 with a coding agent."
    prompts={agentPrompts}
    defaultOpen={false}
  />

  <h2>Checkpoint</h2>
  <p>You now have: ModelSelector embedded and filtered by your policies; (optional) KeyManager for BYOK with callbacks wired to your backend; components themed via <code>--rk-*</code>; callbacks saving user selections. The UI components work alongside your resolve integration from Phases 2–4. When a user selects a model, your backend can pass that to <code>{resolveProviderModelExample}</code> and Restormel evaluates it against routes and policies.</p>

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
</style>
