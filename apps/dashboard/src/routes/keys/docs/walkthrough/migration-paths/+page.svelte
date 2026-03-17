<script lang="ts">
  /** Migration paths. Progressive disclosure: checklist + expandable sections. */
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { getWalkthroughPrevNext } from "$lib/docs-walkthrough-nav";
  import WalkthroughChecklist from "$lib/components/walkthrough/WalkthroughChecklist.svelte";
  import WalkthroughStep from "$lib/components/walkthrough/WalkthroughStep.svelte";
  import WalkthroughPhaseNav from "$lib/components/walkthrough/WalkthroughPhaseNav.svelte";

  const { prev, next, stepOf } = getWalkthroughPrevNext("migration-paths");
  const phaseSlug = "migration-paths";

  const migrationSteps = [
    { id: "principle", label: "Migration principle: the strangler pattern" },
    { id: "variant-a", label: "Variant A: custom routing code" },
    { id: "variant-b", label: "Variant B: LiteLLM" },
    { id: "variant-c", label: "Variant C: Portkey" },
    { id: "variant-d", label: "Variant D: OpenRouter" },
    { id: "comparison", label: "Comparison: what each source gives you" },
    { id: "strangler", label: "The safe strangler approach in detail" },
    { id: "checkpoint", label: "Checkpoint" },
  ];
</script>

<svelte:head>
  <title>Migration paths — Restormel Keys</title>
  <meta name="description" content="Strangler pattern for migrating from custom routing, LiteLLM, Portkey, or OpenRouter to Restormel Keys." />
</svelte:head>

<div class="doc-content">
  <p class="doc-meta"><span class="doc-step">{stepOf}</span></p>
  <h1>Migration paths</h1>
  <p class="doc-prereqs">
    <strong>Time:</strong> Varies by source system<br />
    <strong>Prerequisites:</strong> Familiarity with your current routing system, a Restormel Keys account<br />
    <strong>You'll need:</strong> Access to your current gateway/proxy config, your app's codebase, and the <a href={DASHBOARD_BASE}>Dashboard</a>
  </p>

  <p>This page covers migration from four starting points: custom routing code, LiteLLM, Portkey, and OpenRouter. Each variant follows the same principle: <strong>strangler pattern</strong> — run old and new in parallel, shift traffic incrementally, verify, then retire the old system.</p>
  <p>The walkthrough phases (0–6) are framework-agnostic. This page maps each migration source to the phases, highlights what's different, and provides source-specific prompts.</p>

  <WalkthroughStep stepId="principle" title="Migration principle: the strangler pattern" defaultOpen={true} phaseSlug={phaseSlug}>
  <p>Your app sends 100% traffic to the old routing system (LiteLLM, Portkey, or custom). A feature flag gates Restormel resolve; when enabled, some traffic takes the new path to the AI provider. Both paths can hit the provider until you cut over.</p>
  <ol>
    <li><strong>Install</strong> Restormel Keys alongside your existing system (Phase 1). Nothing changes yet.</li>
    <li><strong>Wire</strong> the resolve call behind a feature flag (Phase 2). Old system still handles 100%.</li>
    <li><strong>Shift</strong> a small percentage of traffic to Restormel (Phase 6, Step 6.2). Both systems run.</li>
    <li><strong>Verify</strong> — compare outcomes, latency, and errors between old and new paths.</li>
    <li><strong>Cut over</strong> — move all traffic to Restormel. Old system is idle.</li>
    <li><strong>Remove</strong> — decommission the old system after a burn-in period.</li>
  </ol>
  <p>At no point do you rip out the old system before the new one is proven. The feature flag (Phase 0, Step 0.5) is your safety net throughout.</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="variant-a" title="Variant A — I have custom routing code" phaseSlug={phaseSlug}>
  <p>This is the default path the walkthrough is written for. Your app has bespoke if/else, config files, or a small routing module that picks providers.</p>
  <p><strong>What's different:</strong> Nothing. Follow Phases 0–6 as written.</p>
  <table class="doc-table">
    <thead>
      <tr><th>Phase</th><th>What you do</th></tr>
    </thead>
    <tbody>
      <tr><td>0</td><td>Inventory your custom files (router, fallback, model picker, BYOK settings)</td></tr>
      <tr><td>1</td><td>Install packages, create project</td></tr>
      <tr><td>2</td><td>Wire resolve alongside your custom router via feature flag</td></tr>
      <tr><td>3</td><td>Move your fallback chain config into dashboard routes</td></tr>
      <tr><td>4</td><td>Move your model allowlists into dashboard policies</td></tr>
      <tr><td>5</td><td>Replace your custom model picker with ModelSelector</td></tr>
      <tr><td>6</td><td>Shift traffic, verify, remove custom code</td></tr>
    </tbody>
  </table>
  <div class="callout callout-note">
    <strong>Note</strong> — Custom routing code is often spread across many files with implicit dependencies. Phase 0 (inventory) is especially important; don't skip it.
  </div>
  </WalkthroughStep>

  <WalkthroughStep stepId="variant-b" title="Variant B — I'm using LiteLLM" phaseSlug={phaseSlug}>
  <p>LiteLLM is a proxy server that normalises provider APIs. You call LiteLLM's endpoint and it forwards to the configured provider. Common setup: Docker container running LiteLLM with a config file defining models, fallbacks, and provider keys.</p>
  <p><strong>What Restormel replaces:</strong> LiteLLM's routing and fallback logic → Restormel routes and steps. LiteLLM's model config → Restormel dashboard (routes, policies, model catalog). LiteLLM's proxy endpoint → your app calls providers directly using the resolve result.</p>
  <p><strong>What Restormel does NOT replace:</strong> LiteLLM's request/response normalisation if you depend on its unified schema. If you need this, keep LiteLLM as a normalisation layer and have Restormel decide which model LiteLLM should use.</p>
  <table class="doc-table">
    <thead>
      <tr><th>Phase</th><th>LiteLLM-specific notes</th></tr>
    </thead>
    <tbody>
      <tr><td>0</td><td>Inventory: your LiteLLM config, the Docker/process setup, and every place your app calls the LiteLLM proxy. Classify as "REMOVE" (call providers directly) or "WRAP" (keep LiteLLM as normalisation layer with Restormel doing routing).</td></tr>
      <tr><td>1</td><td>Install Restormel packages. No change to LiteLLM yet.</td></tr>
      <tr><td>2</td><td>Wire Restormel resolve. If keeping LiteLLM: resolve returns the model, you pass it to LiteLLM. If removing: resolve returns the provider, you call the provider SDK directly.</td></tr>
      <tr><td>3</td><td>Translate LiteLLM fallback settings into dashboard routes. Each LiteLLM fallback model becomes a step in a Restormel route.</td></tr>
      <tr><td>4</td><td>Translate any LiteLLM allowed_models or budget settings into Restormel policies.</td></tr>
      <tr><td>5</td><td>If LiteLLM had no UI, this is net-new. If it did, replace with Restormel ModelSelector.</td></tr>
      <tr><td>6</td><td>Shift traffic. When 100% is on Restormel: stop the LiteLLM container, remove config, remove Docker/process config.</td></tr>
    </tbody>
  </table>
  <div class="build-agent-block">
    <h3>Build-agent prompt: migrate-from-litellm</h3>
    <p><strong>Context docs</strong> (adapt for your project): this page (Variant B); <a href="/keys/docs/walkthrough/phase-0-inventory">Phase 0 — Inventory</a>; <a href="/keys/docs/walkthrough/phase-3-routes">Phase 3 — Routes</a>; <a href="/keys/docs/walkthrough/phase-4-policies">Phase 4 — Policies</a>.</p>
    <p><strong>Goal:</strong> Inventory the LiteLLM integration and produce a migration plan to Restormel Keys. Locate config; extract models, fallback order, allowed/blocked models, budget settings, env vars (no values). Map every LiteLLM feature to Restormel (route steps, fallback_chain, model_allowlist, budget_cap, provider credentials). Decide: remove LiteLLM entirely or keep as normalisation layer. Write the plan to a doc (e.g. <code>docs/restormel-integration/01-litellm-migration.md</code>).</p>
    <p><strong>DO NOT:</strong> Remove LiteLLM or its config yet (plan only). Copy real API keys into the migration doc. Assume features that aren't actually configured.</p>
    <p><strong>Gate:</strong> A migration plan document exists mapping every LiteLLM feature to its Restormel equivalent, with a decision on whether to keep LiteLLM as a normalisation layer or remove it entirely.</p>
  </div>
  </WalkthroughStep>

  <WalkthroughStep stepId="variant-c" title="Variant C — I'm using Portkey" phaseSlug={phaseSlug}>
  <p>Portkey is a gateway with routing, fallbacks, caching, and observability. You call Portkey's endpoint with a config header that specifies routing strategy.</p>
  <p><strong>What Restormel replaces:</strong> Portkey's routing configs → Restormel routes and steps. Portkey's fallback strategies → Restormel <code>fallback_chain</code> route mode. Portkey's model restrictions → Restormel policies.</p>
  <p><strong>What Restormel does NOT replace:</strong> Portkey's request caching (use a separate caching layer if needed). Portkey's observability/tracing (use your existing tracing).</p>
  <table class="doc-table">
    <thead>
      <tr><th>Phase</th><th>Portkey-specific notes</th></tr>
    </thead>
    <tbody>
      <tr><td>0</td><td>Inventory: Portkey configs (JSON headers or API configs), the Portkey API key, every place your app calls the Portkey API or uses the Portkey SDK.</td></tr>
      <tr><td>1</td><td>Install Restormel packages alongside Portkey.</td></tr>
      <tr><td>2</td><td>Wire Restormel resolve. Your app calls resolve first, then makes the provider call directly. Feature flag gates which path runs.</td></tr>
      <tr><td>3</td><td>Translate Portkey routing configs (provider order, fallback strategy) into dashboard routes with steps.</td></tr>
      <tr><td>4</td><td>Translate any Portkey model restrictions or budget controls into Restormel policies.</td></tr>
      <tr><td>5</td><td>Embed Restormel UI. Portkey has no embeddable BYOK UI — this is net-new.</td></tr>
      <tr><td>6</td><td>Shift traffic. When 100% is on Restormel: remove Portkey SDK, delete Portkey API key, cancel Portkey subscription if applicable.</td></tr>
    </tbody>
  </table>
  <p><strong>Key difference from LiteLLM:</strong> Portkey configs are typically JSON objects passed as headers or configured via their dashboard/SDK. Extract the routing logic from those configs manually.</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="variant-d" title="Variant D — I'm using OpenRouter" phaseSlug={phaseSlug}>
  <p>OpenRouter is a unified API that routes requests to multiple providers with a single endpoint. You call the OpenRouter API with a model name, and OpenRouter handles provider selection.</p>
  <p><strong>What Restormel replaces:</strong> OpenRouter's implicit provider routing → Restormel explicit routes and steps (you control exactly which provider handles each model). OpenRouter's model selection → Restormel ModelSelector with policy constraints.</p>
  <p><strong>What Restormel does NOT replace:</strong> OpenRouter's access to providers you don't have direct accounts with. If you use OpenRouter for that, you may keep OpenRouter as a provider within Restormel's routing (a step in a route that calls OpenRouter).</p>
  <table class="doc-table">
    <thead>
      <tr><th>Phase</th><th>OpenRouter-specific notes</th></tr>
    </thead>
    <tbody>
      <tr><td>0</td><td>Inventory: every place your app calls the OpenRouter API, the OpenRouter API key, any model-specific logic.</td></tr>
      <tr><td>1</td><td>Install Restormel packages. Set up direct provider accounts (OpenAI, Anthropic, Google) for the models you use — or keep OpenRouter as a "provider" in your route.</td></tr>
      <tr><td>2</td><td>Wire resolve. The resolve result tells you which provider to call. If keeping OpenRouter as a provider, add it as a custom provider in your config.</td></tr>
      <tr><td>3</td><td>Create routes. If you previously relied on OpenRouter to pick the cheapest provider for a given model, replicate that as explicit route steps.</td></tr>
      <tr><td>4</td><td>Add policies. OpenRouter has no policy concept — this is net-new governance.</td></tr>
      <tr><td>5</td><td>Embed ModelSelector. OpenRouter has no embeddable UI — this is net-new.</td></tr>
      <tr><td>6</td><td>Shift traffic. When 100% is on Restormel: remove OpenRouter SDK/API calls, revoke OpenRouter API key if no longer needed.</td></tr>
    </tbody>
  </table>
  <p><strong>Key difference:</strong> OpenRouter abstracts away provider choice entirely. Moving to Restormel means you take explicit control of which provider handles each request. More work, but full visibility and policy control.</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="comparison" title="Comparison: what each source gives you that Restormel doesn't" phaseSlug={phaseSlug}>
  <table class="doc-table doc-table-wide">
    <thead>
      <tr><th>Feature</th><th>LiteLLM</th><th>Portkey</th><th>OpenRouter</th><th>Restormel approach</th></tr>
    </thead>
    <tbody>
      <tr><td>Request/response normalisation</td><td>Yes (proxy)</td><td>Yes (proxy)</td><td>Yes (proxy)</td><td>No — call providers directly with their SDKs. Use Restormel for routing only.</td></tr>
      <tr><td>Request caching</td><td>Plugin</td><td>Yes</td><td>No</td><td>Not in scope — use a caching layer (Redis, CDN, etc.)</td></tr>
      <tr><td>Observability / tracing</td><td>Plugin</td><td>Yes</td><td>Basic</td><td>Not in scope — use your existing tracing</td></tr>
      <tr><td>Access to providers you don't have accounts with</td><td>No</td><td>No</td><td>Yes</td><td>No — you need direct provider accounts (or keep OpenRouter as a step)</td></tr>
      <tr><td>Embeddable BYOK UI</td><td>No</td><td>No</td><td>No</td><td><strong>Yes</strong> — KeyManager, ModelSelector</td></tr>
      <tr><td>Policy enforcement (allowlists, budgets)</td><td>Partial</td><td>Partial</td><td>No</td><td><strong>Yes</strong> — first-class policies in the dashboard</td></tr>
      <tr><td>Library-first (no proxy/container)</td><td>SDK only</td><td>No</td><td>No</td><td><strong>Yes</strong> — headless core, no infrastructure required</td></tr>
    </tbody>
  </table>
  </WalkthroughStep>

  <WalkthroughStep stepId="strangler" title="The safe strangler approach in detail" phaseSlug={phaseSlug}>
  <p>Regardless of your source system, the sequence is: Week 1 — install Restormel alongside the old system. Week 1–2 — wire resolve behind a feature flag. Week 2 — configure routes and policies in the dashboard. Week 2–3 — send 5% of traffic through Restormel. If errors, fix and retry at 5%; if no errors, increase to 25%, then 50%, then 100%. Burn-in for one release cycle (1–2 weeks), then remove the old system.</p>
  <p><strong>Timeline:</strong> Most teams complete the migration in 2–3 weeks. The burn-in period before removing the old system is typically one release cycle.</p>
  <div class="callout callout-tip">
    <strong>Rollback</strong> — At any point, flip the feature flag to <code>false</code> and 100% of traffic returns to the old system instantly. No code change, no deployment — just an env var.
  </div>
  </WalkthroughStep>

  <WalkthroughStep stepId="checkpoint" title="Checkpoint" phaseSlug={phaseSlug}>
  <p>You now have: a clear mapping from your source system (custom, LiteLLM, Portkey, or OpenRouter) to the walkthrough phases; a strangler approach that lets you migrate incrementally with instant rollback; source-specific notes on what Restormel replaces and what it doesn't; and (if LiteLLM) a build-agent prompt for producing a migration plan document.</p>
  <p><strong>Next:</strong> <a href="/keys/docs/walkthrough/verification-strategy">Verification strategy</a> — ongoing checks for dashboard, CLI, and smoke tests after integration.</p>
  </WalkthroughStep>

  <p><strong>Checkpoint checklist:</strong> mark each section complete as you read it.</p>
  <WalkthroughChecklist phaseSlug={phaseSlug} steps={migrationSteps} />

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
  .doc-content ol { margin: 0 0 var(--space-4); padding-left: var(--space-5); }
  .doc-content li { margin-bottom: var(--space-2); }
  .doc-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 var(--space-4);
    font-size: var(--text-sm);
  }
  .doc-table-wide { font-size: var(--text-xs); }
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
