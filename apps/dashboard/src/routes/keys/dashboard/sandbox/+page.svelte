<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { activeProject, syncActiveProjectFromSession, type ActiveProjectSelection } from "$lib/stores/active-project";
  import KeyManager from "@restormel/keys-svelte";
  import { ModelSelector, CostEstimator } from "@restormel/keys-svelte";
  import { createKeys, openaiProvider, anthropicProvider } from "@restormel/keys";
  import type { KeyConfig, ProviderDefinition } from "@restormel/keys";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import BrutalLoadingState from "$lib/components/brutalist/BrutalLoadingState.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import {
    TESTER_IDLE,
    testerRunning,
    testerResult,
    testerError,
    mapExplainChain,
    mapSimulateToExplainResult,
    mapInvokeToResult,
    formatOutcomeLabel,
    formatCostUsd,
    type TesterState,
    type ExplainResult,
    type InvokeResult,
  } from "$lib/request-tester";

  // ────────────────────────────────────────────────────────────────────────
  // BYOK: provider + key validation (existing validate tab)
  // ────────────────────────────────────────────────────────────────────────

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

  let addProvider: "openai" | "anthropic" = "openai";
  let addRaw = "";
  function submitAddKey() {
    addKey(addProvider, addRaw);
    addRaw = "";
  }

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
        results.push({ keyId: id, provider: k.provider, valid: r.valid, error: r.errors?.[0] });
      } catch (e) {
        results.push({ keyId: id, provider: k.provider, valid: false, error: e instanceof Error ? e.message : "Validation failed" });
      }
    }
    validateResults = results;
    validateRunning = false;
  }
  $: validateAllValid = validateResults !== null && validateResults.length > 0 && validateResults.every((r) => r.valid);
  $: validateAnyInvalid = validateResults !== null && validateResults.some((r) => !r.valid);
  $: hasAddedKeys = keysList.length > 0;
  $: hasRunValidate = validateResults !== null;
  $: validateWizardStep = !hasAddedKeys ? "add" : !hasRunValidate ? "run" : !validateAllValid ? "fix" : "done";

  function maskId(id: string): string {
    if (id.length <= 6) return "••••";
    return "…" + id.slice(-4);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Preview tab (BYOK component preview)
  // ────────────────────────────────────────────────────────────────────────

  let frameworkTab: "react" | "sveltekit" | "web-components" = "sveltekit";
  let activeSelection: ActiveProjectSelection | null = null;
  const unsubscribeActiveProject = activeProject.subscribe((value) => { activeSelection = value; });

  let previewRouteModels: string[] = [];
  let previewRouteCount = 0;
  let previewPolicyCount = 0;
  let previewLoading = false;
  let previewError = "";
  let reactRuntimeAvailable = false;
  let webComponentsAvailable = false;

  const previewKeys = createKeys({ keys: [], routing: { defaultProvider: "openai" } }, { providers: [openaiProvider, anthropicProvider] });
  let previewSelectedModel = "";
  let previewSelectedProvider = "";
  $: previewCost = previewSelectedModel ? previewKeys.estimateCost(previewSelectedModel) : null;

  async function loadPreviewData() {
    previewError = "";
    if (!activeSelection?.projectId) { previewRouteModels = []; previewRouteCount = 0; previewPolicyCount = 0; return; }
    previewLoading = true;
    try {
      const routesRes = await fetch(`${DASHBOARD_BASE}/api/projects/${activeSelection.projectId}/routes`);
      const routesJson = await routesRes.json().catch(() => ({}));
      const routes = Array.isArray((routesJson as { data?: unknown[] }).data)
        ? ((routesJson as { data: Array<Record<string, unknown>> }).data ?? []) : [];
      previewRouteCount = routes.length;
      previewRouteModels = routes.map((route) => (typeof route.defaultModelId === "string" ? route.defaultModelId : null)).filter((m): m is string => Boolean(m));
      const policyRes = await fetch(`${DASHBOARD_BASE}/api/policies`);
      const policyJson = await policyRes.json().catch(() => ({}));
      previewPolicyCount = Array.isArray((policyJson as { data?: unknown[] }).data) ? ((policyJson as { data: unknown[] }).data ?? []).length : 0;
    } catch (error) {
      previewError = error instanceof Error ? error.message : "Unable to load active project configuration.";
    } finally { previewLoading = false; }
  }

  const codeSnippets = {
    react: `import { KeyManager, ModelSelector, CostEstimator } from "@restormel/keys-react";\n// Render in your settings page with your active project route/policy data.`,
    sveltekit: `import KeyManager, { ModelSelector, CostEstimator } from "@restormel/keys-svelte";\n<!-- Render in your +page.svelte settings screen using active project config -->`,
    "web-components": `import "@restormel/keys-elements";\n<!-- Use <rk-key-manager>, <rk-model-selector>, <rk-cost-estimator> in your settings page -->`,
  } as const;

  const installSnippets = {
    react: "pnpm add @restormel/keys @restormel/keys-react react react-dom",
    sveltekit: "pnpm add @restormel/keys @restormel/keys-svelte",
    "web-components": "pnpm add @restormel/keys @restormel/keys-elements",
  } as const;

  $: hasProjectContext = Boolean(activeSelection?.projectId);
  $: hasProjectConfig = hasProjectContext && previewRouteCount > 0 && previewPolicyCount > 0;
  $: frameworkRuntimeReady = frameworkTab === "sveltekit" ? true : frameworkTab === "react" ? reactRuntimeAvailable : webComponentsAvailable;
  $: hasPreviewInteraction = frameworkTab === "sveltekit" ? Boolean(previewSelectedModel) : frameworkRuntimeReady;

  // ────────────────────────────────────────────────────────────────────────
  // Workspace mode (W3.2) — wires to real config
  // ────────────────────────────────────────────────────────────────────────

  type ProjectRow = { id: string; name: string };
  type RouteRow = { id: string; name: string; environmentId: string; isPublished?: boolean };

  let wsProjectsLoading = false;
  let wsProjectsError = "";
  let wsProjects: ProjectRow[] = [];
  let wsSelectedProjectId = "";
  let wsRoutesLoading = false;
  let wsRoutesError = "";
  let wsRoutes: RouteRow[] = [];
  let wsSelectedRouteId = "";
  let wsPrompt = "";
  let wsTesterState: TesterState = TESTER_IDLE;
  /** Used to track if we need to show the invoke confirm dialog */
  let wsInvokeConfirmPending = false;

  let confirmBoxEl: HTMLElement | null = null;
  let promptTextareaEl: HTMLTextAreaElement | null = null;

  function confirmBoxFocusables(): HTMLElement[] {
    if (!confirmBoxEl) return [];
    const all = confirmBoxEl.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    return [...all].filter((el) => !el.hasAttribute("disabled"));
  }

  function onConfirmBoxKeydown(event: KeyboardEvent): void {
    if (!wsInvokeConfirmPending) return;
    if (event.key === "Escape") {
      event.preventDefault();
      cancelRealSend();
      void tick().then(() => promptTextareaEl?.focus());
      return;
    }
    if (event.key !== "Tab") return;
    const items = confirmBoxFocusables();
    if (items.length === 0) { event.preventDefault(); confirmBoxEl?.focus(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  }

  $: if (wsInvokeConfirmPending) {
    void tick().then(() => {
      const items = confirmBoxFocusables();
      if (items.length > 0) items[0].focus();
    });
  }

  async function loadWsProjects() {
    wsProjectsLoading = true;
    wsProjectsError = "";
    wsProjects = [];
    wsSelectedProjectId = "";
    wsRoutes = [];
    wsSelectedRouteId = "";
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects`, { credentials: "include" });
      if (res.status === 401) { wsProjectsError = "Sign in to use workspace mode."; return; }
      if (!res.ok) { wsProjectsError = `Could not load projects (${res.status})`; return; }
      const body = await res.json().catch(() => ({}));
      wsProjects = Array.isArray((body as { data?: unknown[] }).data)
        ? ((body as { data: Array<Record<string, unknown>> }).data ?? []).map((p) => ({
            id: String(p.id ?? ""),
            name: String(p.name ?? p.id ?? "Unnamed"),
          })).filter((p) => p.id)
        : [];
      if (wsProjects.length === 1) wsSelectedProjectId = wsProjects[0].id;
    } catch (e) {
      wsProjectsError = e instanceof Error ? e.message : "Could not load projects";
    } finally { wsProjectsLoading = false; }
  }

  async function loadWsRoutes(projectId: string) {
    wsRoutesLoading = true;
    wsRoutesError = "";
    wsRoutes = [];
    wsSelectedRouteId = "";
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${projectId}/routes`, { credentials: "include" });
      if (!res.ok) { wsRoutesError = `Could not load routes (${res.status})`; return; }
      const body = await res.json().catch(() => ({}));
      wsRoutes = Array.isArray((body as { data?: unknown[] }).data)
        ? ((body as { data: Array<Record<string, unknown>> }).data ?? []).map((r) => ({
            id: String(r.id ?? ""),
            name: String(r.name ?? r.id ?? "Unnamed route"),
            environmentId: String(r.environmentId ?? ""),
            isPublished: r.isPublished === true,
          })).filter((r) => r.id)
        : [];
      if (wsRoutes.length === 1) wsSelectedRouteId = wsRoutes[0].id;
    } catch (e) {
      wsRoutesError = e instanceof Error ? e.message : "Could not load routes";
    } finally { wsRoutesLoading = false; }
  }

  $: wsSelectedRoute = wsRoutes.find((r) => r.id === wsSelectedRouteId) ?? null;

  async function runExplain() {
    if (!wsSelectedProjectId || !wsSelectedRouteId || !wsSelectedRoute) return;
    wsTesterState = testerRunning();
    wsInvokeConfirmPending = false;
    try {
      const base = `${DASHBOARD_BASE}/api/projects/${wsSelectedProjectId}/routes/${wsSelectedRouteId}`;
      const [explainRes, simulateRes] = await Promise.all([
        fetch(`${base}/explain-chain`, { credentials: "include" }),
        fetch(`${base}/simulate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            environmentId: wsSelectedRoute.environmentId,
            includeStepDiagnostics: true,
            includeRoutingAttempts: true,
          }),
        }),
      ]);
      const [explainBody, simulateBody] = await Promise.all([
        explainRes.json().catch(() => ({})),
        simulateRes.json().catch(() => ({})),
      ]);
      if (!simulateRes.ok) {
        if (simulateRes.status === 403 && (simulateBody as { error?: string }).error === "policy_blocked") {
          const explainChain = mapExplainChain(explainBody);
          const result = mapSimulateToExplainResult({
            routeId: wsSelectedRouteId,
            environmentId: wsSelectedRoute.environmentId,
            raw: simulateBody as Record<string, unknown>,
            explainChain,
          });
          wsTesterState = testerResult(result);
          return;
        }
        const msg = (simulateBody as { message?: string }).message ?? (simulateBody as { error?: string }).error ?? `Simulate failed (${simulateRes.status})`;
        wsTesterState = testerError(msg);
        return;
      }
      const explainChain = mapExplainChain(explainBody);
      const result = mapSimulateToExplainResult({
        routeId: wsSelectedRouteId,
        environmentId: wsSelectedRoute.environmentId,
        raw: simulateBody as Record<string, unknown>,
        explainChain,
      });
      wsTesterState = testerResult(result);
    } catch (e) {
      wsTesterState = testerError(e instanceof Error ? e.message : "Explain failed");
    }
  }

  function requestRealSend() {
    if (!wsPrompt.trim()) return;
    wsInvokeConfirmPending = true;
  }

  function cancelRealSend() {
    wsInvokeConfirmPending = false;
  }

  async function confirmRealSend() {
    if (!wsSelectedProjectId || !wsSelectedRouteId || !wsSelectedRoute || !wsPrompt.trim()) return;
    wsInvokeConfirmPending = false;
    wsTesterState = testerRunning();
    const start = Date.now();
    try {
      const res = await fetch(
        `${DASHBOARD_BASE}/api/projects/${wsSelectedProjectId}/routes/${wsSelectedRouteId}/runtime/invoke`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            environmentId: wsSelectedRoute.environmentId,
            messages: [{ role: "user", content: wsPrompt.trim() }],
          }),
        }
      );
      const body = await res.json().catch(() => ({}));
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        const msg = (body as { detail?: string }).detail ?? (body as { message?: string }).message ?? (body as { error?: string }).error ?? `Request failed (${res.status})`;
        wsTesterState = testerError(msg);
        return;
      }
      const result = mapInvokeToResult({
        routeId: wsSelectedRouteId,
        environmentId: wsSelectedRoute.environmentId,
        raw: body as Record<string, unknown>,
        latencyMs,
        logsHref: `${DASHBOARD_BASE}/logs?routeId=${wsSelectedRouteId}`,
      });
      wsTesterState = testerResult(result);
    } catch (e) {
      wsTesterState = testerError(e instanceof Error ? e.message : "Request failed");
    }
  }

  function wsReset() {
    wsTesterState = TESTER_IDLE;
    wsInvokeConfirmPending = false;
  }

  $: wsExplainResult = wsTesterState.phase === "result" && wsTesterState.result?.kind === "explain"
    ? (wsTesterState.result as ExplainResult) : null;
  $: wsInvokeResult = wsTesterState.phase === "result" && wsTesterState.result?.kind === "invoke"
    ? (wsTesterState.result as InvokeResult) : null;

  // ────────────────────────────────────────────────────────────────────────
  // Tab management
  // ────────────────────────────────────────────────────────────────────────

  let activeTab: "workspace" | "validate" | "preview" = "workspace";

  function applyTabToUrl(tab: "workspace" | "validate" | "preview") {
    const params = new URLSearchParams($page.url.searchParams);
    if (tab === "workspace") params.delete("tab");
    else params.set("tab", tab);
    goto(`${$page.url.pathname}${params.toString() ? `?${params.toString()}` : ""}`, { replaceState: true });
  }

  function selectMainTab(tab: "workspace" | "validate" | "preview") {
    activeTab = tab;
    applyTabToUrl(tab);
    if (tab === "workspace" && wsProjects.length === 0 && !wsProjectsLoading && !wsProjectsError) {
      loadWsProjects();
    }
    if (tab === "preview" && activeSelection?.projectId) loadPreviewData();
  }

  $: if (wsSelectedProjectId) { loadWsRoutes(wsSelectedProjectId); }

  onMount(async () => {
    syncActiveProjectFromSession();
    const tabParam = $page.url.searchParams.get("tab");
    activeTab = tabParam === "validate" ? "validate" : tabParam === "preview" ? "preview" : "workspace";
    reactRuntimeAvailable = false;
    webComponentsAvailable = false;
    document.addEventListener("keydown", onConfirmBoxKeydown);
    if (activeTab === "workspace") await loadWsProjects();
    else if (activeTab === "preview" && activeSelection?.projectId) await loadPreviewData();
  });

  $: if (activeSelection?.projectId && activeTab === "preview") { loadPreviewData(); }

  onDestroy(() => {
    document.removeEventListener("keydown", onConfirmBoxKeydown);
    unsubscribeActiveProject();
  });
</script>

<main class="sandbox" aria-labelledby="sandbox-heading">
  <h1 id="sandbox-heading" class="page-title">REQUEST TESTER</h1>
  <p class="page-desc">
    Try your routes against real config or validate BYOK keys.
  </p>
  <div class="tab-row" role="tablist" aria-label="Request tester tabs">
    <button
      type="button"
      role="tab"
      class="tab-btn"
      class:is-active={activeTab === "workspace"}
      aria-selected={activeTab === "workspace"}
      aria-controls="panel-workspace"
      id="tab-workspace"
      onclick={() => selectMainTab("workspace")}
    >
      Workspace
    </button>
    <button
      type="button"
      role="tab"
      class="tab-btn"
      class:is-active={activeTab === "validate"}
      aria-selected={activeTab === "validate"}
      aria-controls="panel-validate"
      id="tab-validate"
      onclick={() => selectMainTab("validate")}
    >
      Validate BYOK
    </button>
    <button
      type="button"
      role="tab"
      class="tab-btn"
      class:is-active={activeTab === "preview"}
      aria-selected={activeTab === "preview"}
      aria-controls="panel-preview"
      id="tab-preview"
      onclick={() => selectMainTab("preview")}
    >
      Preview components
    </button>
  </div>

  <!-- ──────────────────────────────────────────────────────────────────
       WORKSPACE TAB — wired to real routes / policies / keys config
  ─────────────────────────────────────────────────────────────────── -->
  {#if activeTab === "workspace"}
    <div id="panel-workspace" role="tabpanel" aria-labelledby="tab-workspace">

      <!-- Project + route pickers -->
      <section class="panel" aria-labelledby="ws-picker-heading">
        <h2 id="ws-picker-heading" class="section-title">Select route</h2>
        <p class="section-desc">
          Pick a project and route from your workspace. The resolver uses your real config — no fabrication.
        </p>

        {#if wsProjectsLoading}
          <BrutalLoadingState message="Loading projects…" rows={2} />
        {:else if wsProjectsError}
          <BrutalErrorBanner message={wsProjectsError}>
            {#snippet actions()}
              {#if wsProjectsError.includes("Sign in")}
                <a class="btn btn-secondary btn-sm" href="{DASHBOARD_BASE}/login">Sign in</a>
              {:else}
                <button type="button" class="btn btn-secondary btn-sm" onclick={loadWsProjects}>Try again</button>
              {/if}
            {/snippet}
          </BrutalErrorBanner>
        {:else if wsProjects.length === 0}
          <EmptyState title="No projects yet" description="Create a project to start testing your routes against real config.">
            {#snippet children()}
              <a class="btn btn-secondary btn-sm" href="{DASHBOARD_BASE}/projects">Create a project</a>
            {/snippet}
          </EmptyState>
        {:else}
          <div class="picker-row">
            <div class="field">
              <label for="ws-project" class="field-label">Project</label>
              <select id="ws-project" class="input" bind:value={wsSelectedProjectId} aria-label="Select project">
                <option value="">— choose project —</option>
                {#each wsProjects as p}
                  <option value={p.id}>{p.name}</option>
                {/each}
              </select>
            </div>

            {#if wsSelectedProjectId}
              <div class="field">
                <label for="ws-route" class="field-label">Route</label>
                {#if wsRoutesLoading}
                  <p class="field-hint">Loading routes…</p>
                {:else if wsRoutesError}
                  <p class="field-error">{wsRoutesError}</p>
                {:else if wsRoutes.length === 0}
                  <p class="field-hint">
                    No routes in this project.
                    <a href="{DASHBOARD_BASE}/projects/{wsSelectedProjectId}/routes" class="inline-link">Create one ↗</a>
                  </p>
                {:else}
                  <select id="ws-route" class="input" bind:value={wsSelectedRouteId} aria-label="Select route">
                    <option value="">— choose route —</option>
                    {#each wsRoutes as r}
                      <option value={r.id}>{r.name}{r.isPublished === false ? " (unpublished)" : ""}</option>
                    {/each}
                  </select>
                {/if}
              </div>
            {/if}
          </div>

          {#if wsSelectedRoute && wsSelectedRoute.isPublished === false}
            <p class="warn-hint" role="status">
              ⚠ This route is not published — it will not receive discovery traffic. Publish it first to use it in production.
              <a class="inline-link" href="{DASHBOARD_BASE}/projects/{wsSelectedProjectId}/routes/{wsSelectedRouteId}?tab=versions">Publish ↗</a>
            </p>
          {/if}
        {/if}
      </section>

      <!-- Prompt + actions -->
      {#if wsSelectedProjectId && wsSelectedRouteId && wsSelectedRoute}
        <section class="panel" aria-labelledby="ws-prompt-heading">
          <h2 id="ws-prompt-heading" class="section-title">Prompt</h2>
          <p class="section-desc">
            <strong>Explain</strong> resolves your route dry-run — no provider call, no cost.
            <strong>Send real request</strong> invokes the route with your stored provider keys — costs apply.
          </p>
          <div class="prompt-field">
            <label for="ws-prompt" class="field-label">Message</label>
            <textarea
              id="ws-prompt"
              class="prompt-textarea"
              bind:this={promptTextareaEl}
              bind:value={wsPrompt}
              placeholder="Enter a prompt to send…"
              rows={4}
              aria-label="Prompt to send"
            ></textarea>
          </div>

          {#if wsInvokeConfirmPending}
            <div class="confirm-box" role="alertdialog" aria-labelledby="confirm-title" aria-modal="true" bind:this={confirmBoxEl}>
              <p id="confirm-title" class="confirm-title">SEND REAL REQUEST?</p>
              <p class="confirm-body">
                This calls your provider using stored credentials for route
                <strong>{wsSelectedRoute.name}</strong>.
                Tokens will be consumed and usage will be billed by your provider.
                The request will appear in Logs.
              </p>
              <div class="confirm-actions">
                <button type="button" class="btn btn-primary btn-sm" onclick={confirmRealSend}>
                  Confirm — send request
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick={cancelRealSend}>Cancel</button>
              </div>
            </div>
          {:else}
            <div class="action-row">
              <button
                type="button"
                class="btn btn-primary"
                onclick={runExplain}
                disabled={wsTesterState.phase === "running"}
                aria-busy={wsTesterState.phase === "running"}
              >
                {wsTesterState.phase === "running" ? "Running…" : "Explain (dry-run)"}
              </button>
              <button
                type="button"
                class="btn btn-secondary"
                onclick={requestRealSend}
                disabled={wsTesterState.phase === "running" || !wsPrompt.trim()}
                title="Sends a real request — consumes provider tokens"
              >
                Send real request ↗
              </button>
            </div>
          {/if}
        </section>

        <!-- Result -->
        <section class="panel" aria-labelledby="ws-result-heading">
          <h2 id="ws-result-heading" class="section-title">Result</h2>

          {#if wsTesterState.phase === "idle"}
            <p class="empty-hint">Run Explain or Send real request above to see a receipt.</p>

          {:else if wsTesterState.phase === "running"}
            <BrutalLoadingState message="Running…" rows={3} />

          {:else if wsTesterState.phase === "error"}
            <BrutalErrorBanner message={wsTesterState.errorMessage ?? "Request failed"}>
              {#snippet actions()}
                <button type="button" class="btn btn-secondary btn-sm" onclick={wsReset}>Try again</button>
              {/snippet}
            </BrutalErrorBanner>

          {:else if wsExplainResult}
            {@const r = wsExplainResult}
            <div class="result-receipt" role="status" aria-label="Explain result receipt">
              <!-- Route matched -->
              <div class="receipt-block">
                <h3 class="receipt-label">ROUTE MATCHED</h3>
                <div class="receipt-row">
                  <span class="receipt-mono">{r.explainChain?.routeName ?? r.routeId}</span>
                  {#if r.explainChain?.isPublished === false}
                    <span class="badge badge-warn">UNPUBLISHED</span>
                  {/if}
                  <a class="receipt-link" href="{DASHBOARD_BASE}/projects/{wsSelectedProjectId}/routes/{r.routeId}" aria-label="Open route builder">↗ builder</a>
                </div>
                {#if r.explainChain}
                  <p class="receipt-meta">
                    {r.explainChain.enabledStepCount} enabled step{r.explainChain.enabledStepCount !== 1 ? "s" : ""}
                    {#if r.explainChain.policyNames.length > 0}
                      · guard rails: {r.explainChain.policyNames.slice(0, 3).join(", ")}{r.explainChain.policyNames.length > 3 ? "…" : ""}
                    {/if}
                  </p>
                {/if}
              </div>

              <!-- Decision -->
              <div class="receipt-block">
                <h3 class="receipt-label">DECISION</h3>
                {#if r.wouldRun && r.providerType}
                  <div class="receipt-row">
                    <span class="badge badge-ok">WOULD RUN</span>
                    <span class="receipt-mono">{r.providerType}</span>
                    {#if r.modelId}<span class="sep">›</span><span class="receipt-mono">{r.modelId}</span>{/if}
                  </div>
                  {#if r.explanation}<p class="receipt-meta">{r.explanation}</p>{/if}
                {:else if r.policyViolations.length > 0}
                  <div class="receipt-row"><span class="badge badge-fail">BLOCKED BY POLICY</span></div>
                  <ul class="violation-list" aria-label="Policy violations">
                    {#each r.policyViolations as v}
                      <li class="violation-item">
                        <span class="receipt-mono">{v.policyName || v.policyId}</span>
                        <span class="violation-msg">{v.message}</span>
                      </li>
                    {/each}
                  </ul>
                {:else}
                  <div class="receipt-row"><span class="badge badge-fail">NO STEP EXECUTABLE</span></div>
                  {#if r.explanation}<p class="receipt-meta">{r.explanation}</p>{/if}
                {/if}
              </div>

              <!-- Provider chain -->
              {#if r.routingAttempts.length > 0}
                <div class="receipt-block">
                  <h3 class="receipt-label">PROVIDER CHAIN</h3>
                  <table class="chain-table" aria-label="Provider chain step outcomes">
                    <thead>
                      <tr>
                        <th class="col-idx" scope="col">#</th>
                        <th scope="col">Provider · Model</th>
                        <th scope="col">Outcome</th>
                        <th scope="col">Est. cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each r.routingAttempts as attempt}
                        {@const estimate = r.perStepEstimates.find((e) => e.stepId === attempt.stepId)}
                        <tr class="chain-row" class:chain-row--selected={attempt.hypotheticalOutcome === "selected"}>
                          <td class="col-idx receipt-mono">{attempt.orderIndex}</td>
                          <td>
                            <span class="receipt-mono">{attempt.providerType ?? "—"}</span>
                            {#if attempt.modelId}<span class="sep">›</span><span class="receipt-mono">{attempt.modelId}</span>{/if}
                          </td>
                          <td>
                            <span
                              class="badge"
                              class:badge-ok={attempt.hypotheticalOutcome === "selected"}
                              class:badge-warn={attempt.hypotheticalOutcome === "not_selected"}
                              class:badge-fail={attempt.hypotheticalOutcome === "blocked_by_policy" || attempt.hypotheticalOutcome === "not_executable"}
                            >{formatOutcomeLabel(attempt.hypotheticalOutcome)}</span>
                          </td>
                          <td class="receipt-mono">{formatCostUsd(estimate?.estimatedCostUsd ?? null)}</td>
                        </tr>
                        {#if r.stepDiagnostics.find((d) => d.stepId === attempt.stepId)?.policyViolations.length}
                          {@const diag = r.stepDiagnostics.find((d) => d.stepId === attempt.stepId)}
                          {#if diag}
                            {#each diag.policyViolations as v}
                              <tr class="chain-row chain-row--violation">
                                <td></td>
                                <td colspan="3" class="violation-msg receipt-xs">↳ {v.policyName || v.policyId}: {v.message}</td>
                              </tr>
                            {/each}
                          {/if}
                        {/if}
                      {/each}
                    </tbody>
                  </table>
                </div>
              {/if}

              <!-- Step chain -->
              {#if r.explainChain?.steps.length}
                <details class="receipt-details">
                  <summary class="receipt-label">EXPLAIN CHAIN — {r.explainChain.steps.length} step{r.explainChain.steps.length !== 1 ? "s" : ""}</summary>
                  <ul class="step-list" aria-label="Route step chain">
                    {#each r.explainChain.steps as step}
                      <li class="step-item" class:step-disabled={!step.enabled}>
                        <span class="receipt-mono col-idx">{step.orderIndex}</span>
                        <span class="receipt-mono">{step.providerPreference ?? "—"}</span>
                        {#if step.modelId}<span class="sep">›</span><span class="receipt-mono">{step.modelId}</span>{/if}
                        {#if step.label}<span class="step-label"> — {step.label}</span>{/if}
                        {#if !step.enabled}<span class="badge badge-muted">DISABLED</span>{/if}
                      </li>
                    {/each}
                  </ul>
                </details>
              {/if}

              <!-- Footer -->
              <div class="receipt-actions">
                <button type="button" class="btn btn-secondary btn-sm" onclick={wsReset}>Reset</button>
                <a class="btn btn-secondary btn-sm" href="{DASHBOARD_BASE}/logs?routeId={r.routeId}">View logs ↗</a>
                <a class="btn btn-secondary btn-sm" href="{DASHBOARD_BASE}/projects/{wsSelectedProjectId}/routes/{r.routeId}">Open builder ↗</a>
              </div>
            </div>

          {:else if wsInvokeResult}
            {@const r = wsInvokeResult}
            <div class="result-receipt" role="status" aria-label="Invoke result receipt">
              <div class="receipt-block">
                <h3 class="receipt-label">REQUEST COMPLETED</h3>
                <div class="receipt-row">
                  <span class="badge badge-ok">OK</span>
                  {#if r.providerType}<span class="receipt-mono">{r.providerType}</span>{/if}
                  {#if r.modelId}<span class="sep">›</span><span class="receipt-mono">{r.modelId}</span>{/if}
                  <span class="receipt-mono badge-meta">{r.latencyMs}ms</span>
                  {#if r.estimatedCostUsd != null}
                    <span class="receipt-mono badge-meta">{formatCostUsd(r.estimatedCostUsd)}</span>
                  {/if}
                </div>
              </div>

              <div class="receipt-block">
                <h3 class="receipt-label">RESPONSE</h3>
                <pre class="response-pre">{r.content}</pre>
              </div>

              {#if r.usage.totalTokens != null}
                <div class="receipt-block">
                  <h3 class="receipt-label">USAGE</h3>
                  <p class="receipt-meta receipt-mono">
                    in: {r.usage.promptTokens ?? "—"} · out: {r.usage.completionTokens ?? "—"} · total: {r.usage.totalTokens ?? "—"} tokens
                  </p>
                </div>
              {/if}

              {#if r.runtimeSteps.length > 1}
                <div class="receipt-block">
                  <h3 class="receipt-label">PIPELINE STEPS</h3>
                  <ul class="step-list" aria-label="Runtime pipeline steps">
                    {#each r.runtimeSteps as s}
                      <li class="step-item" class:step-disabled={s.skipped}>
                        <span class="receipt-mono col-idx">{s.orderIndex}</span>
                        <span class="receipt-mono">{s.providerType ?? "—"}</span>
                        {#if s.modelId}<span class="sep">›</span><span class="receipt-mono">{s.modelId}</span>{/if}
                        {#if s.skipped}<span class="badge badge-muted">SKIPPED{#if s.skipReason} — {s.skipReason}{/if}</span>{/if}
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}

              <div class="receipt-actions">
                <button type="button" class="btn btn-secondary btn-sm" onclick={wsReset}>Reset</button>
                {#if r.requestLogHref}
                  <a class="btn btn-secondary btn-sm" href={r.requestLogHref}>View in Logs ↗</a>
                {/if}
              </div>
            </div>
          {/if}
        </section>
      {/if}

    </div>

  <!-- ──────────────────────────────────────────────────────────────────
       VALIDATE TAB (BYOK)
  ─────────────────────────────────────────────────────────────────── -->
  {:else if activeTab === "validate"}
    <div id="panel-validate" role="tabpanel" aria-labelledby="tab-validate">
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
                  <button type="button" class="btn btn-secondary btn-sm" onclick={() => removeKey(id)} aria-label="Remove key">Remove</button>
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
          <code>keys doctor</code> checks framework detection, config file, suggested packages, and stored keys.
        </p>
        <div class="copy-row">
          <code class="code-block">{doctorCommand}</code>
          <button type="button" class="btn btn-secondary" onclick={copyDoctorCommand} aria-label="Copy doctor command">
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
          Re-validate the keys you added above.
        </p>
        {#if keysList.length === 0}
          <p class="empty-hint">Add keys in the Keys section above, then run Validate.</p>
        {:else}
          <button type="button" class="btn btn-primary" onclick={runValidate} disabled={validateRunning} aria-busy={validateRunning}>
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
                      {#if r.error}<span class="validate-error">{r.error}</span>{/if}
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
          <p class="validate-fail">One or more keys failed. Remove or replace invalid entries above, then run Validate again.</p>
        </section>
      {:else if validateWizardStep === "done"}
        <section class="panel">
          <h2 class="section-title">Step 3: Ready</h2>
          <p class="validate-ok">All keys are valid. Use Workspace mode to test routing with your real config.</p>
          <div class="wizard-actions">
            <button type="button" class="btn btn-secondary" onclick={() => selectMainTab("workspace")}>Go to Workspace mode</button>
          </div>
        </section>
      {/if}
    </div>

  <!-- ──────────────────────────────────────────────────────────────────
       PREVIEW TAB (component preview)
  ─────────────────────────────────────────────────────────────────── -->
  {:else}
    <div id="panel-preview" role="tabpanel" aria-labelledby="tab-preview">
      <section class="panel" aria-labelledby="preview-heading">
        <h2 id="preview-heading" class="section-title">Preview</h2>
        <p class="section-desc">Guided setup from zero to ready: complete each step and unlock the next one.</p>

        <section class="wizard-step-block">
          <h3 class="section-title">Step 1: Choose active project and environment</h3>
          <div class="preview-meta">
            <span>Project: {activeSelection?.projectId ? maskId(activeSelection.projectId) : "None selected"}</span>
            <span>Environment: {activeSelection?.environmentId ? maskId(activeSelection.environmentId) : "None selected"}</span>
          </div>
          {#if hasProjectContext}
            <p class="validate-ok">Ready. Active context selected.</p>
          {:else}
            <p class="empty-hint">Use the project switcher in the left sidebar to select both a project and environment.</p>
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
                <a class="wizard-link" href="{DASHBOARD_BASE}/routes">Create route</a>
                <a class="wizard-link" href="{DASHBOARD_BASE}/policies">Create policy</a>
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
              <p class="empty-hint">Runtime for {frameworkTab} is not available in this page. Install the package below or switch to SvelteKit.</p>
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
                    onSelect={(modelId: string, providerId: string) => { previewSelectedModel = modelId; previewSelectedProvider = providerId; }}
                  />
                  <CostEstimator cost={previewCost} budget={2} estimatedCost={previewCost?.inputPerMillion} />
                </div>
                {#if hasPreviewInteraction}
                  <p class="validate-ok">Ready to ship. You completed a model-selection interaction.</p>
                {:else}
                  <p class="empty-hint">Select a model above to complete this step.</p>
                {/if}
              {:else}
                <p class="empty-hint">Live render for {frameworkTab} is handled in your host app. Use the snippet below for integration.</p>
              {/if}
            </div>
            <p class="snippet-label">Host code snippet</p>
            <pre class="preview-code"><code>{codeSnippets[frameworkTab]}</code></pre>
            {#if hasPreviewInteraction}
              <div class="wizard-actions">
                <a class="wizard-link" href="{DASHBOARD_BASE}/copy-for-ci">Open GitHub Setup</a>
              </div>
            {/if}
          {/if}
        </section>
      </section>
    </div>
  {/if}
</main>

<style>
  .sandbox {
    max-width: 52rem;
  }

  .page-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--rm-text);
    margin: 0 0 var(--space-1);
  }

  .page-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-6);
  }

  /* Tab strip */
  .tab-row {
    display: flex;
    gap: 0;
    margin-bottom: var(--space-6);
    border-bottom: var(--brut-border-width, 2px) solid var(--brut-ink, #1a1a1a);
  }

  .tab-btn {
    border: var(--brut-border-width, 2px) solid var(--brut-ink, #1a1a1a);
    border-bottom: none;
    background: var(--rm-surface);
    color: var(--rm-text);
    border-radius: 0;
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: pointer;
    margin-right: -2px;
    position: relative;
    z-index: 1;
  }

  .tab-btn.is-active {
    background: var(--brut-neon, #d4fc3e);
    color: var(--brut-ink, #1a1a1a);
    z-index: 2;
  }

  /* Panels */
  .panel {
    margin-bottom: var(--space-6);
    padding: var(--space-4);
    border: var(--brut-border-width, 2px) solid var(--brut-ink, #1a1a1a);
    background: var(--brut-white, #fff);
    box-shadow: 3px 3px 0 var(--brut-ink, #1a1a1a);
  }

  .section-title {
    font-size: var(--text-base);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--rm-text);
    margin: 0 0 var(--space-1);
  }

  .section-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-3);
  }

  /* Fields */
  .picker-row {
    display: flex;
    gap: var(--space-4);
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 14rem;
  }

  .field-label {
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--rm-muted);
  }

  .field-hint {
    font-size: var(--text-xs);
    color: var(--rm-muted);
    margin: 0;
  }

  .field-error {
    font-size: var(--text-xs);
    color: var(--brut-coral, #ff6b55);
    margin: 0;
  }

  .input {
    padding: var(--space-2) var(--space-3);
    border: var(--brut-border-width, 2px) solid var(--brut-ink, #1a1a1a);
    border-radius: 0;
    font-size: var(--text-sm);
    background: var(--rm-bg);
    color: var(--rm-text);
    min-width: 12rem;
    max-width: 20rem;
  }

  .warn-hint {
    font-size: var(--text-xs);
    color: var(--rm-muted);
    margin: var(--space-3) 0 0;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-yellow, #f5de0a);
    background: color-mix(in oklab, var(--color-yellow, #f5de0a) 20%, transparent);
  }

  /* Prompt */
  .prompt-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-bottom: var(--space-3);
  }

  .prompt-textarea {
    padding: var(--space-2) var(--space-3);
    border: var(--brut-border-width, 2px) solid var(--brut-ink, #1a1a1a);
    border-radius: 0;
    font-size: var(--text-sm);
    background: var(--rm-bg);
    color: var(--rm-text);
    resize: vertical;
    width: 100%;
    min-height: 5rem;
    font-family: inherit;
  }

  .action-row {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
    align-items: center;
  }

  /* Confirm box */
  .confirm-box {
    border: var(--brut-border-width, 2px) solid var(--brut-ink, #1a1a1a);
    background: color-mix(in oklab, var(--color-yellow, #f5de0a) 25%, var(--brut-white, #fff));
    padding: var(--space-4);
    box-shadow: 3px 3px 0 var(--brut-ink, #1a1a1a);
    margin-bottom: var(--space-3);
  }

  .confirm-title {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-weight: 900;
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 var(--space-2);
  }

  .confirm-body {
    font-size: var(--text-sm);
    color: var(--rm-text);
    margin: 0 0 var(--space-3);
  }

  .confirm-actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  /* Result receipt */
  .result-receipt {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .receipt-block {
    border-top: 1px solid var(--brut-ink, #1a1a1a);
    padding-top: var(--space-3);
  }

  .receipt-label {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 var(--space-2);
    color: var(--rm-muted);
  }

  .receipt-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-1);
  }

  .receipt-mono {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: var(--text-sm);
  }

  .receipt-xs {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: var(--text-xs);
  }

  .receipt-meta {
    font-size: var(--text-xs);
    color: var(--rm-muted);
    margin: var(--space-1) 0 0;
  }

  .receipt-link {
    font-size: var(--text-xs);
    color: var(--rm-sage, #2d6a4f);
    text-decoration: underline;
  }

  .sep {
    color: var(--rm-muted);
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: var(--text-sm);
  }

  .badge-meta {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }

  /* Badges */
  .badge {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0.1em 0.5em;
    border: 1px solid var(--brut-ink, #1a1a1a);
  }

  .badge-ok { background: var(--brut-neon, #d4fc3e); color: var(--brut-ink, #1a1a1a); }
  .badge-warn { background: var(--color-yellow, #f5de0a); color: var(--brut-ink, #1a1a1a); }
  .badge-fail { background: var(--brut-coral, #ff6b55); color: var(--brut-ink, #1a1a1a); }
  .badge-muted { background: var(--rm-surface-raised, #f5f5f5); color: var(--rm-muted); border-color: var(--rm-border); }

  /* Chain table */
  .chain-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-xs);
  }

  .chain-table th {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    text-align: left;
    padding: var(--space-1) var(--space-2);
    border-bottom: 2px solid var(--brut-ink, #1a1a1a);
    background: var(--rm-surface, #f9f9f9);
  }

  .chain-table td {
    padding: var(--space-1) var(--space-2);
    border-bottom: 1px solid var(--rm-border, #e5e5e5);
    vertical-align: middle;
  }

  .chain-row--selected td { background: color-mix(in oklab, var(--brut-neon, #d4fc3e) 15%, transparent); }
  .chain-row--violation td { background: color-mix(in oklab, var(--brut-coral, #ff6b55) 8%, transparent); }

  .col-idx { width: 2rem; color: var(--rm-muted); }

  /* Violation list */
  .violation-list { list-style: none; padding: 0; margin: var(--space-2) 0 0; }
  .violation-item { display: flex; flex-wrap: wrap; gap: var(--space-2); font-size: var(--text-xs); margin-bottom: var(--space-1); align-items: baseline; }
  .violation-msg { color: var(--rm-muted); font-size: var(--text-xs); }

  /* Step list */
  .receipt-details { border-top: 1px solid var(--rm-border, #e5e5e5); padding-top: var(--space-3); }
  .receipt-details > summary { cursor: pointer; font-family: var(--rm-font-mono, ui-monospace, monospace); font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--rm-muted); margin-bottom: var(--space-2); }
  .step-list { list-style: none; padding: 0; margin: var(--space-2) 0 0; }
  .step-item { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2); padding: var(--space-1) 0; border-bottom: 1px solid var(--rm-border, #e5e5e5); font-size: var(--text-xs); }
  .step-disabled { opacity: 0.5; }
  .step-label { color: var(--rm-muted); font-size: var(--text-xs); }

  /* Response */
  .response-pre {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: var(--text-xs);
    white-space: pre-wrap;
    word-break: break-word;
    background: var(--rm-surface, #f9f9f9);
    border: 1px solid var(--rm-border, #e5e5e5);
    padding: var(--space-3);
    margin: 0;
    max-height: 20rem;
    overflow: auto;
  }

  /* Receipt actions */
  .receipt-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; border-top: 1px solid var(--rm-border, #e5e5e5); padding-top: var(--space-3); }


  /* Buttons */
  .btn {
    display: inline-flex; align-items: center; justify-content: center;
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-sm); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
    border: var(--brut-border-width, 2px) solid var(--brut-ink, #1a1a1a);
    cursor: pointer; text-decoration: none; border-radius: 0;
    background: var(--rm-surface, #fff); color: var(--brut-ink, #1a1a1a);
    box-shadow: 2px 2px 0 var(--brut-ink, #1a1a1a);
    transition: box-shadow 0.07s, transform 0.07s;
  }
  .btn:active { box-shadow: none; transform: translate(2px, 2px); }
  .btn:disabled { opacity: 0.6; cursor: not-allowed; box-shadow: none; }
  .btn-primary { background: var(--brut-neon, #d4fc3e); color: var(--brut-ink, #1a1a1a); }
  .btn-secondary { background: var(--rm-surface, #fff); color: var(--brut-ink, #1a1a1a); }
  .btn-sm { padding: var(--space-1) var(--space-3); font-size: var(--text-xs); box-shadow: 1px 1px 0 var(--brut-ink, #1a1a1a); }

  .inline-link { color: var(--rm-sage, #2d6a4f); text-decoration: underline; font-size: var(--text-xs); }

  /* BYOK validate section (preserved) */
  .embed-preview { background: var(--rm-surface); border: 1px solid var(--rm-border); padding: var(--space-4); }
  .add-key-form { display: flex; flex-direction: column; gap: var(--space-2); max-width: 24rem; margin-bottom: var(--space-4); }
  .key-list { list-style: none; padding: 0; margin: 0; }
  .key-item { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; margin-bottom: var(--space-2); }
  .copy-row { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; margin-bottom: var(--space-3); }
  .code-block { font-family: var(--rm-font-mono, ui-monospace, monospace); font-size: var(--text-sm); padding: var(--space-2) var(--space-3); background: var(--rm-surface); border: 1px solid var(--rm-border); }
  .doctor-snippet { margin-top: var(--space-3); }
  .snippet-label { display: block; font-size: var(--text-sm); font-weight: 500; color: var(--rm-text); margin-bottom: var(--space-1); }
  .snippet-install { margin: var(--space-2) 0; font-size: var(--text-sm); }
  .snippet-install code { font-family: var(--rm-font-mono, ui-monospace, monospace); padding: 0.15em 0.4em; background: var(--rm-surface); }
  .snippet-note { font-size: var(--text-sm); color: var(--rm-muted); margin: 0; }
  .empty-hint { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-3); }
  .validate-results { margin-top: var(--space-4); }
  .validate-summary { font-weight: 600; font-size: var(--text-sm); margin: 0 0 var(--space-2); }
  .validate-ok { color: var(--rm-sage); }
  .validate-fail { color: var(--brut-coral, #c95c5c); }
  .validate-list { list-style: none; padding: 0; margin: 0; font-size: var(--text-sm); }
  .validate-list li { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; margin-bottom: var(--space-1); }
  .validate-provider { font-weight: 500; min-width: 5rem; }
  .validate-mask { font-family: var(--rm-font-mono, ui-monospace, monospace); color: var(--rm-muted); }
  .validate-status { font-weight: 500; }
  .validate-error { color: var(--rm-muted); font-size: var(--text-xs); }

  /* Preview tab */
  .preview-toolbar { margin-bottom: var(--space-3); max-width: 16rem; }
  .wizard-step-block { border: 1px solid var(--rm-border); padding: var(--space-3); margin-bottom: var(--space-3); background: color-mix(in oklab, var(--rm-surface-raised) 70%, transparent); }
  .wizard-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-2); }
  .wizard-link { display: inline-flex; align-items: center; justify-content: center; padding: var(--space-1) var(--space-2); border: 1px solid var(--rm-border); color: var(--rm-text); text-decoration: none; font-size: var(--text-xs); background: var(--rm-surface); }
  .preview-shell { border: 1px solid var(--rm-border); background: var(--rm-surface); padding: var(--space-4); margin-bottom: var(--space-3); }
  .preview-meta { display: flex; flex-wrap: wrap; gap: var(--space-2); font-size: var(--text-xs); color: var(--rm-muted); margin-bottom: var(--space-3); }
  .preview-meta span { background: color-mix(in oklab, var(--rm-surface-raised) 80%, transparent); border: 1px solid var(--rm-border); padding: 0.2rem 0.45rem; }
  .preview-components { display: grid; gap: var(--space-3); }
  .preview-code { margin: 0; font-size: var(--text-xs); overflow-x: auto; background: var(--rm-surface); border: 1px solid var(--rm-border); padding: var(--space-3); }
</style>
