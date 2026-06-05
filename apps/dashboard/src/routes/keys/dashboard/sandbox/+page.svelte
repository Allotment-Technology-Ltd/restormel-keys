<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { activeProject, syncActiveProjectFromSession, type ActiveProjectSelection } from "$lib/stores/active-project";
  import KeyManager from "@restormel/keys-svelte";
  import { ModelSelector, CostEstimator } from "@restormel/keys-svelte";
  import { createKeys, openaiProvider, anthropicProvider } from "@restormel/keys";
  import type { KeyConfig, ProviderDefinition } from "@restormel/keys";

  const providers = [openaiProvider, anthropicProvider];
  const PROVIDER_MAP: Record<string, ProviderDefinition> = {
    openai: openaiProvider,
    anthropic: anthropicProvider,
  };

  /** In-memory key list for this sandbox session; never persisted. */
  let keysList: (KeyConfig & { id?: string })[] = [];
  $: keys = createKeys(
    { keys: keysList, routing: { defaultProvider: "openai" } },
    { providers }
  );
  /** Raw credentials in memory only, for running validate in-browser; never displayed or sent. */
  let sandboxRawByKeyId: Record<string, string> = {};

  function addKey(provider: "openai" | "anthropic", rawCredential: string) {
    const raw = rawCredential.trim();
    if (!raw) return;
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `key-${Date.now()}`;
    const keyWithId: KeyConfig & { id?: string } = { provider, id };
    keysList = [...keysList, keyWithId];
    sandboxRawByKeyId = { ...sandboxRawByKeyId, [id]: raw };
  }

  function removeKey(keyId: string) {
    keysList = keysList.filter((k) => (k as KeyConfig & { id?: string }).id !== keyId);
    const next = { ...sandboxRawByKeyId };
    delete next[keyId];
    sandboxRawByKeyId = next;
  }

  // —— Add-key form (minimal, no KeyManager to avoid Svelte 5 runes dependency)
  let addProvider: "openai" | "anthropic" = "openai";
  let addRaw = "";
  function submitAddKey() {
    addKey(addProvider, addRaw);
    addRaw = "";
  }

  // —— Doctor panel: copy command
  const doctorCommand = "npx @restormel/keys-cli doctor";
  let doctorCopied = false;
  async function copyDoctorCommand() {
    try {
      await navigator.clipboard.writeText(doctorCommand);
      doctorCopied = true;
      setTimeout(() => (doctorCopied = false), 2000);
    } catch {
      doctorCopied = false;
    }
  }

  let doctorFramework: "sveltekit" | "next" = "sveltekit";
  const doctorSnippets: Record<string, { install: string; note: string }> = {
    sveltekit: {
      install: "pnpm add @restormel/keys   # headless Phases 1–4; add @restormel/keys-svelte for Phase 5 when on npm",
      note: "Then add KeyManager and ModelSelector to a settings or sandbox page; keys can be stored via your API.",
    },
    next: {
      install: "pnpm add @restormel/keys @restormel/keys-react",
      note: "Use a client component for KeyManager; keep KeysProvider and key UI inside \"use client\".",
    },
  };

  // —— Validate panel
  type ValidateResult = { keyId: string; provider: string; valid: boolean; error?: string };
  let validateResults: ValidateResult[] | null = null;
  let validateRunning = false;
  async function runValidate() {
    validateRunning = true;
    validateResults = null;
    const results: ValidateResult[] = [];
    for (const k of keysList) {
      const id = (k as KeyConfig & { id?: string }).id ?? k.provider;
      const raw = sandboxRawByKeyId[id];
      const def = PROVIDER_MAP[k.provider];
      if (!raw || !def) {
        results.push({ keyId: id, provider: k.provider, valid: false, error: "No credential in this session" });
        continue;
      }
      try {
        const r = await def.validateKey(raw);
        results.push({
          keyId: id,
          provider: k.provider,
          valid: r.valid,
          error: r.errors?.[0],
        });
      } catch (e) {
        results.push({
          keyId: id,
          provider: k.provider,
          valid: false,
          error: e instanceof Error ? e.message : "Validation failed",
        });
      }
    }
    validateResults = results;
    validateRunning = false;
  }
  $: validateAllValid =
    validateResults !== null && validateResults.length > 0 && validateResults.every((r) => r.valid);
  $: validateAnyInvalid = validateResults !== null && validateResults.some((r) => !r.valid);
  $: hasAddedKeys = keysList.length > 0;
  $: hasRunValidate = validateResults !== null;
  $: validateWizardStep = !hasAddedKeys
    ? "add"
    : !hasRunValidate
      ? "run"
      : !validateAllValid
        ? "fix"
        : "done";

  function maskId(id: string): string {
    if (id.length <= 6) return "••••";
    return "…" + id.slice(-4);
  }

  // ---- Tabs
  let activeTab: "validate" | "preview" = "validate";
  let frameworkTab: "react" | "sveltekit" | "web-components" = "sveltekit";

  // ---- Active project context + preview data
  let activeSelection: ActiveProjectSelection | null = null;
  const unsubscribeActiveProject = activeProject.subscribe((value) => {
    activeSelection = value;
  });

  let previewRouteModels: string[] = [];
  let previewRouteCount = 0;
  let previewPolicyCount = 0;
  let previewLoading = false;
  let previewError = "";
  let reactRuntimeAvailable = false;
  let webComponentsAvailable = false;

  const previewKeys = createKeys(
    { keys: [], routing: { defaultProvider: "openai" } },
    { providers: [openaiProvider, anthropicProvider] }
  );
  let previewSelectedModel = "";
  let previewSelectedProvider = "";

  $: previewCost = previewSelectedModel
    ? previewKeys.estimateCost(previewSelectedModel)
    : null;

  async function loadPreviewData() {
    previewError = "";
    if (!activeSelection?.projectId) {
      previewRouteModels = [];
      previewRouteCount = 0;
      previewPolicyCount = 0;
      return;
    }
    previewLoading = true;
    try {
      const routesRes = await fetch(`/keys/dashboard/api/projects/${activeSelection.projectId}/routes`);
      const routesJson = await routesRes.json().catch(() => ({}));
      const routes = Array.isArray((routesJson as { data?: unknown[] }).data)
        ? ((routesJson as { data: Array<Record<string, unknown>> }).data ?? [])
        : [];
      previewRouteCount = routes.length;
      previewRouteModels = routes
        .map((route) => (typeof route.defaultModelId === "string" ? route.defaultModelId : null))
        .filter((modelId): modelId is string => Boolean(modelId));

      const policyRes = await fetch("/keys/dashboard/api/policies");
      const policyJson = await policyRes.json().catch(() => ({}));
      previewPolicyCount = Array.isArray((policyJson as { data?: unknown[] }).data)
        ? ((policyJson as { data: unknown[] }).data ?? []).length
        : 0;
    } catch (error) {
      previewError = error instanceof Error ? error.message : "Unable to load active project configuration.";
    } finally {
      previewLoading = false;
    }
  }

  function applyTabToUrl(tab: "validate" | "preview") {
    const params = new URLSearchParams($page.url.searchParams);
    if (tab === "preview") params.set("tab", "preview");
    else params.delete("tab");
    goto(`${$page.url.pathname}${params.toString() ? `?${params.toString()}` : ""}`, { replaceState: true });
  }

  function selectMainTab(tab: "validate" | "preview") {
    activeTab = tab;
    applyTabToUrl(tab);
  }

  const codeSnippets = {
    react: `import { KeyManager, ModelSelector, CostEstimator } from "@restormel/keys-react";
// Render in your settings page with your active project route/policy data.`,
    sveltekit: `import KeyManager, { ModelSelector, CostEstimator } from "@restormel/keys-svelte";
<!-- Render in your +page.svelte settings screen using active project config -->`,
    "web-components": `import "@restormel/keys-elements";
<!-- Use <rk-key-manager>, <rk-model-selector>, <rk-cost-estimator> in your settings page -->`,
  } as const;

  const installSnippets = {
    react: "pnpm add @restormel/keys @restormel/keys-react react react-dom",
    sveltekit: "pnpm add @restormel/keys @restormel/keys-svelte",
    "web-components": "pnpm add @restormel/keys @restormel/keys-elements",
  } as const;

  $: hasProjectContext = Boolean(activeSelection?.projectId);
  $: hasProjectConfig = hasProjectContext && previewRouteCount > 0 && previewPolicyCount > 0;
  $: frameworkRuntimeReady =
    frameworkTab === "sveltekit"
      ? true
      : frameworkTab === "react"
        ? reactRuntimeAvailable
        : webComponentsAvailable;
  $: hasPreviewInteraction = frameworkTab === "sveltekit" ? Boolean(previewSelectedModel) : frameworkRuntimeReady;

  onMount(async () => {
    syncActiveProjectFromSession();
    activeTab = $page.url.searchParams.get("tab") === "preview" ? "preview" : "validate";
    reactRuntimeAvailable = false;
    webComponentsAvailable = false;
    await loadPreviewData();
  });

  $: if (activeSelection?.projectId) {
    loadPreviewData();
  }

  onDestroy(() => {
    unsubscribeActiveProject();
  });
</script>

<main class="sandbox" aria-labelledby="sandbox-heading">
  <h1 id="sandbox-heading" class="page-title">Test & Preview</h1>
  <p class="page-desc">
    Validate keys quickly or preview embeddable components in a mock settings page.
  </p>
  <div class="tab-row" role="tablist" aria-label="Test and preview tabs">
    <button
      type="button"
      role="tab"
      class="tab-btn"
      class:is-active={activeTab === "validate"}
      aria-selected={activeTab === "validate"}
      onclick={() => selectMainTab("validate")}
    >
      Validate
    </button>
    <button
      type="button"
      role="tab"
      class="tab-btn"
      class:is-active={activeTab === "preview"}
      aria-selected={activeTab === "preview"}
      onclick={() => selectMainTab("preview")}
    >
      Preview
    </button>
  </div>

  {#if activeTab === "validate"}
    <section class="panel" aria-labelledby="keys-heading">
      <h2 id="keys-heading" class="section-title">Step 1: Add keys (in-memory)</h2>
      <p class="section-desc">
        Add keys to test validation. Credentials are not stored or displayed; only masked IDs are shown.
      </p>
      <div class="embed-preview">
        <form class="add-key-form" onsubmit={(e) => { e.preventDefault(); submitAddKey(); }}>
          <label for="add-provider" class="snippet-label">Provider</label>
          <select id="add-provider" class="input" bind:value={addProvider} aria-label="Provider">
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
          <label for="add-raw" class="snippet-label">API key (not stored, used only for Validate)</label>
          <input
            id="add-raw"
            type="password"
            class="input"
            bind:value={addRaw}
            placeholder="sk-… or sk-ant-…"
            autocomplete="off"
            aria-label="API key"
          />
          <button type="submit" class="btn btn-primary" disabled={!addRaw.trim()}>
            Add key
          </button>
        </form>
        {#if keysList.length > 0}
          <ul class="key-list" aria-label="Added keys">
            {#each keysList as k (k.id ?? k.provider)}
              {@const id = (k as KeyConfig & { id?: string }).id ?? k.provider}
              <li class="key-item">
                <span class="validate-provider">{k.provider}</span>
                <span class="validate-mask" aria-hidden="true">{maskId(id)}</span>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  onclick={() => removeKey(id)}
                  aria-label="Remove key"
                >
                  Remove
                </button>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="empty-hint">No keys yet. Add one above to run Validate.</p>
        {/if}
      </div>
    </section>

    <section class="panel" aria-labelledby="doctor-heading">
      <h2 id="doctor-heading" class="section-title">Doctor</h2>
      <p class="section-desc">
        <code>keys doctor</code> checks framework detection, config file, suggested packages, and stored keys. Run it in your project root.
      </p>
      <div class="copy-row">
        <code class="code-block">{doctorCommand}</code>
        <button
          type="button"
          class="btn btn-secondary"
          onclick={copyDoctorCommand}
          aria-label="Copy doctor command"
        >
          {doctorCopied ? "Copied" : "Copy"}
        </button>
      </div>
      <div class="doctor-snippet">
        <label for="doctor-framework" class="snippet-label">Framework</label>
        <select id="doctor-framework" class="input" bind:value={doctorFramework} aria-label="Select framework">
          <option value="sveltekit">SvelteKit</option>
          <option value="next">Next.js</option>
        </select>
        <p class="snippet-install"><code>{doctorSnippets[doctorFramework].install}</code></p>
        <p class="snippet-note">{doctorSnippets[doctorFramework].note}</p>
      </div>
    </section>

    <section class="panel" aria-labelledby="validate-heading">
      <h2 id="validate-heading" class="section-title">Step 2: Validate</h2>
      <p class="section-desc">
        Re-validate the keys you added above. Same semantics as <code>keys validate</code> (exit 0 if all valid, 1 if any invalid). Results use masked identifiers only.
      </p>
      {#if keysList.length === 0}
        <p class="empty-hint">Add keys in the Keys section above, then run Validate.</p>
      {:else}
        <button
          type="button"
          class="btn btn-primary"
          onclick={runValidate}
          disabled={validateRunning}
          aria-busy={validateRunning}
        >
          {validateRunning ? "Validating…" : "Validate keys"}
        </button>
        {#if validateResults !== null}
          <div class="validate-results" role="status" aria-live="polite">
            {#if validateAllValid}
              <p class="validate-summary validate-ok">All keys valid (exit 0).</p>
            {:else if validateAnyInvalid}
              <p class="validate-summary validate-fail">Some keys invalid (exit 1).</p>
            {/if}
            <ul class="validate-list">
              {#each validateResults as r}
                <li>
                  <span class="validate-provider">{r.provider}</span>
                  <span class="validate-mask" aria-hidden="true">{maskId(r.keyId)}</span>
                  {#if r.valid}
                    <span class="validate-status validate-ok">OK</span>
                  {:else}
                    <span class="validate-status validate-fail">INVALID</span>
                    {#if r.error}
                      <span class="validate-error">{r.error}</span>
                    {/if}
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      {/if}
    </section>
    {#if validateWizardStep === "fix"}
      <section class="panel">
        <h2 class="section-title">Step 3: Fix and re-run</h2>
        <p class="validate-fail">
          One or more keys failed. Remove or replace invalid entries above, then run Validate again.
        </p>
      </section>
    {:else if validateWizardStep === "done"}
      <section class="panel">
        <h2 class="section-title">Step 3: Ready</h2>
        <p class="validate-ok">
          All keys are valid. Continue to Preview to test model selection and cost estimation flow.
        </p>
        <div class="wizard-actions">
          <button type="button" class="btn btn-secondary" onclick={() => selectMainTab("preview")}>
            Continue to Preview
          </button>
        </div>
      </section>
    {/if}
  {:else}
    <section class="panel" aria-labelledby="preview-heading">
      <h2 id="preview-heading" class="section-title">Preview</h2>
      <p class="section-desc">
        Guided setup from zero to ready: complete each step and unlock the next one.
      </p>
      <section class="wizard-step-block">
        <h3 class="section-title">Step 1: Choose active project and environment</h3>
        <div class="preview-meta">
          <span>Project: {activeSelection?.projectId ? maskId(activeSelection.projectId) : "None selected"}</span>
          <span>Environment: {activeSelection?.environmentId ? maskId(activeSelection.environmentId) : "None selected"}</span>
        </div>
        {#if hasProjectContext}
          <p class="validate-ok">Ready. Active context selected.</p>
        {:else}
          <p class="empty-hint">
            Use the project switcher in the left sidebar to select both a project and environment.
          </p>
        {/if}
      </section>

      <section class="wizard-step-block">
        <h3 class="section-title">Step 2: Confirm route + policy baseline</h3>
        {#if !hasProjectContext}
          <p class="empty-hint">Locked until Step 1 is complete.</p>
        {:else if previewLoading}
          <p class="empty-hint">Loading route and policy configuration…</p>
        {:else if previewError}
          <p class="validate-fail">Could not load configuration: {previewError}</p>
        {:else}
          <div class="preview-meta">
            <span>Routes: {previewRouteCount}</span>
            <span>Policies: {previewPolicyCount}</span>
          </div>
          {#if hasProjectConfig}
            <p class="validate-ok">Ready. Baseline config found.</p>
          {:else}
            <p class="empty-hint">You need at least one route and one policy before preview is meaningful.</p>
            <div class="wizard-actions">
              <a class="wizard-link" href="/keys/dashboard/routes">Create route</a>
              <a class="wizard-link" href="/keys/dashboard/policies">Create policy</a>
            </div>
          {/if}
        {/if}
      </section>

      <section class="wizard-step-block">
        <h3 class="section-title">Step 3: Select framework</h3>
        {#if !hasProjectConfig}
          <p class="empty-hint">Locked until Step 2 is complete.</p>
        {:else}
          <div class="preview-toolbar">
            <label for="framework-tab" class="snippet-label">Framework</label>
            <select id="framework-tab" class="input" bind:value={frameworkTab}>
              <option value="react">React</option>
              <option value="sveltekit">SvelteKit</option>
              <option value="web-components">Web Components</option>
            </select>
          </div>
          {#if frameworkRuntimeReady}
            <p class="validate-ok">Ready. Framework runtime is available for this step.</p>
          {:else}
            <p class="empty-hint">
              Runtime for {frameworkTab} is not available in this page. Install the package below or switch to SvelteKit.
            </p>
            <p class="snippet-install"><code>{installSnippets[frameworkTab]}</code></p>
          {/if}
        {/if}
      </section>

      <section class="wizard-step-block">
        <h3 class="section-title">Step 4: Run live preview</h3>
        {#if !frameworkRuntimeReady}
          <p class="empty-hint">Locked until Step 3 is complete.</p>
        {:else}
          <div class="preview-shell">
            {#if frameworkTab === "sveltekit"}
              <div class="preview-components">
                <KeyManager
                  keys={previewKeys}
                  userId={activeSelection?.projectId ?? "sandbox-user"}
                  providers={[openaiProvider, anthropicProvider]}
                  onKeyAdded={() => ({ ok: true })}
                  onKeyRemoved={() => ({ ok: true })}
                />
                <ModelSelector
                  keys={previewKeys}
                  providers={[openaiProvider, anthropicProvider]}
                  onSelect={(modelId: string, providerId: string) => {
                    previewSelectedModel = modelId;
                    previewSelectedProvider = providerId;
                  }}
                />
                <CostEstimator cost={previewCost} budget={2} estimatedCost={previewCost?.inputPerMillion} />
              </div>
              {#if hasPreviewInteraction}
                <p class="validate-ok">Ready to ship. You completed a model-selection interaction.</p>
              {:else}
                <p class="empty-hint">Select a model above to complete this step.</p>
              {/if}
            {:else}
              <p class="empty-hint">
                Live render for {frameworkTab} is handled in your host app. Use the snippet below for integration.
              </p>
            {/if}
          </div>
          <p class="snippet-label">Host code snippet</p>
          <pre class="preview-code"><code>{codeSnippets[frameworkTab]}</code></pre>
          {#if hasPreviewInteraction}
            <div class="wizard-actions">
              <a class="wizard-link" href="/keys/dashboard/copy-for-ci">Open GitHub Setup</a>
              <a class="wizard-link" href="/keys/dashboard/dev-tools">Open Dev Tools</a>
            </div>
          {/if}
        {/if}
      </section>
    </section>
  {/if}
</main>

<style>
  .sandbox {
    max-width: 44rem;
  }
  .page-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .page-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-6);
  }
  .tab-row {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-5);
  }
  .tab-btn {
    border: 1px solid var(--rm-border);
    background: var(--rm-surface);
    color: var(--rm-text);
    border-radius: var(--rm-radius);
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    cursor: pointer;
  }
  .tab-btn.is-active {
    background: var(--color-yellow);
    color: var(--color-ink);
    border-color: var(--rm-sage);
  }
  .panel {
    margin-bottom: var(--space-6);
  }
  .section-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-1);
  }
  .section-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-3);
  }
  .embed-preview {
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-4);
  }
  .add-key-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-width: 24rem;
    margin-bottom: var(--space-4);
  }
  .key-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .key-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-bottom: var(--space-2);
  }
  .btn-sm {
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-xs);
  }
  .copy-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-bottom: var(--space-3);
  }
  .code-block {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: var(--text-sm);
    padding: var(--space-2) var(--space-3);
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
  }
  .btn {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    font-weight: 500;
    border: none;
    cursor: pointer;
  }
  .btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .btn-secondary {
    background: var(--rm-surface-raised);
    color: var(--rm-text);
    border: 1px solid var(--rm-border);
  }
  .doctor-snippet {
    margin-top: var(--space-3);
  }
  .snippet-label {
    display: block;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--rm-text);
    margin-bottom: var(--space-1);
  }
  .input {
    width: 100%;
    max-width: 16rem;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--rm-radius);
    border: 1px solid var(--rm-border);
    font-size: var(--text-sm);
    background: var(--rm-bg);
    color: var(--rm-text);
    margin-bottom: var(--space-2);
  }
  .snippet-install {
    margin: var(--space-2) 0;
    font-size: var(--text-sm);
  }
  .snippet-install code {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    padding: 0.15em 0.4em;
    background: var(--rm-surface);
    border-radius: var(--rm-radius);
  }
  .snippet-note {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0;
  }
  .empty-hint {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-3);
  }
  .validate-results {
    margin-top: var(--space-4);
  }
  .validate-summary {
    font-weight: 600;
    font-size: var(--text-sm);
    margin: 0 0 var(--space-2);
  }
  .validate-ok {
    color: var(--rm-sage);
  }
  .validate-fail {
    color: var(--coral-alert, #c95c5c);
  }
  .validate-list {
    list-style: none;
    padding: 0;
    margin: 0;
    font-size: var(--text-sm);
  }
  .validate-list li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-bottom: var(--space-1);
  }
  .validate-provider {
    font-weight: 500;
    min-width: 5rem;
  }
  .validate-mask {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    color: var(--rm-muted);
  }
  .validate-status {
    font-weight: 500;
  }
  .validate-error {
    color: var(--rm-muted);
    font-size: var(--text-xs);
  }
  .preview-toolbar {
    margin-bottom: var(--space-3);
    max-width: 16rem;
  }
  .wizard-step-block {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: color-mix(in oklab, var(--rm-surface-raised) 70%, transparent);
    padding: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .wizard-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  .wizard-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--rm-radius);
    border: 1px solid var(--rm-border);
    color: var(--rm-text);
    text-decoration: none;
    font-size: var(--text-xs);
    background: var(--rm-surface);
  }
  .wizard-link:hover {
    border-color: var(--rm-sage);
  }
  .preview-shell {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    padding: var(--space-4);
    margin-bottom: var(--space-3);
  }
  .preview-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: var(--rm-muted);
    margin-bottom: var(--space-3);
  }
  .preview-meta span {
    background: color-mix(in oklab, var(--rm-surface-raised) 80%, transparent);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: 0.2rem 0.45rem;
  }
  .preview-components {
    display: grid;
    gap: var(--space-3);
  }
  .preview-code {
    margin: 0;
    font-size: var(--text-xs);
    overflow-x: auto;
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-3);
  }
</style>
