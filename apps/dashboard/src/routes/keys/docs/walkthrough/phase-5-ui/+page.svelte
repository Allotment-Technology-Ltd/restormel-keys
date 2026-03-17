<script lang="ts">
  /** Phase 5 — UI. Progressive disclosure: checklist + expandable steps. */
  import { getWalkthroughPrevNext } from "$lib/docs-walkthrough-nav";
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";
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
  <p>Use <code>KeysProvider</code> from <code>@restormel/keys-react</code> and a client component that renders <code>ModelSelector</code> with <code>keys</code>, <code>providers</code>, and <code>onSelect</code>. The <code>onSelect</code> callback should save the user's model preference to your backend (e.g. <code>POST /api/preferences</code> with <code>modelId</code> and <code>providerId</code>).</p>
  <div class="callout callout-tip">
    <strong>Tip</strong> — Use <code>next/dynamic</code> with <code>ssr: false</code> to lazy-load the model selector so it doesn't increase your initial page bundle.
  </div>
  <h3>You'll see</h3>
  <p>A model selection UI grouped by provider. Each model shows its availability based on whether a key exists for that provider. Users click a model to select it.</p>
  <h3>How to test</h3>
  <p>Start your dev server, navigate to your settings page, confirm the ModelSelector renders with provider groups and models, and click a model to confirm the <code>onSelect</code> callback fires (check the network tab for the preferences API call).</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="5.3" title="Step 5.3 — Embed ModelSelector (SvelteKit)" {phaseSlug}>
  <p>Import <code>ModelSelector</code> from <code>@restormel/keys-svelte</code> and <code>createKeys</code> plus provider definitions from <code>@restormel/keys</code>. Create the <code>keys</code> instance and pass <code>keys</code>, <code>providers</code>, and <code>onSelect</code> to the component. Wire <code>onSelect</code> to your backend (e.g. <code>POST /api/preferences</code> with <code>modelId</code> and <code>providerId</code>).</p>
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
  <p><strong>Server-side filtering (recommended):</strong> Add an API route (e.g. <code>GET /api/allowed-models</code>) that calls the Restormel <strong>evaluate</strong> endpoint for each candidate model, using a <strong>Management Key</strong> (not the Gateway Key). Return only the allowed model IDs to the client and configure the component with that list.</p>
  <div class="callout callout-security">
    <strong>Security</strong> — Never call the policies API from the browser. Keep <code>RESTORMEL_MANAGEMENT_KEY</code> server-side only. Use a server proxy like <code>/api/allowed-models</code> and return only the filtered model IDs to the client.
  </div>
  <p><strong>Client-side filtering:</strong> If you use local resolve (Phase 2, Step 2.6), you can use <code>keys.entitlements.getAvailableModels(allModelIds)</code> to filter.</p>
  <h3>You'll see</h3>
  <p>The ModelSelector shows only models that pass your policies. Blocked models are either hidden or shown as unavailable.</p>
  <h3>How to test</h3>
  <p>Add a <code>model_allowlist</code> policy that excludes one model. Refresh the settings page; that model should not appear (or should appear greyed out with "Not allowed").</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="5.6" title="Step 5.6 — Embed KeyManager (optional — for BYOK apps)" {phaseSlug}>
  <p>If your app lets end-users bring their own API keys, embed the KeyManager component. It provides a settings panel for users to add, validate, list, and remove their provider credentials. Wire <code>onKeyAdded</code> and <code>onKeyRemoved</code> to your backend (e.g. <code>POST /api/keys</code>, <code>DELETE /api/keys/:id</code>).</p>
  <div class="callout callout-security">
    <strong>Security</strong> — KeyManager validates keys client-side via a lightweight test call to the provider. Raw key material is never sent to Restormel. Your backend should store only hashed keys and metadata (provider, label, key prefix). Never log or expose raw keys.
  </div>
  <h3>You'll see</h3>
  <p>A settings panel with an empty state, a form to select a provider and paste a key, validation feedback, a list of stored keys (masked), and delete buttons.</p>
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

  <div class="build-agent-block">
    <h3>Build-agent prompt: embed-ui-components</h3>
    <p><strong>Context docs</strong> (adapt paths for your project): this page; <a href="/keys/docs/compatibility">Framework compatibility</a> (which package for which framework).</p>
    <p><strong>Goal:</strong> Embed ModelSelector (and optionally KeyManager) into your app's settings page. Use KeysProvider + client component for Next.js/React; direct import for SvelteKit; <code>@restormel/keys-elements</code> and properties for Web Components. Wire <code>onSelect</code> / <code>rk-model-selected</code> to save preferences; wire KeyManager callbacks to your key storage API. Add <code>--rk-*</code> overrides. Handle loading, error, and empty states. Verify rendering, callbacks, theme, and keyboard navigation.</p>
    <p><strong>DO NOT:</strong> Import UI packages in server-only code. Log or expose raw API keys. Skip empty/error/loading states. Hardcode model lists. Commit real API keys or secrets.</p>
    <p><strong>Gate:</strong> ModelSelector renders and fires onSelect with modelId and providerId. (If BYOK) KeyManager add/remove callbacks work. Theme tokens apply. Loading, error, empty states handled. Keyboard navigation works.</p>
  </div>

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
  .build-agent-block {
    margin: var(--space-6) 0;
    padding: var(--space-4);
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
  }
  .build-agent-block h3 { margin-top: 0; }
</style>
