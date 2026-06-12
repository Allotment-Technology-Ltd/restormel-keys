<script lang="ts">
  import { onMount } from "svelte";
  import { trackDashboardOnboardingStep } from "$lib/posthog";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import ModeSelector from "$lib/components/dashboard/ModeSelector.svelte";
  import { isDashboardHrefUiHidden } from "$lib/dashboard-ui-path-match";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
  import {
    setUserStackChoice,
    syncUserModeFromStorage,
    syncUserStackChoiceFromStorage,
    userMode,
    userStackChoice,
    type UserMode,
    type UserStackChoice,
  } from "$lib/stores/user-mode";

  export const ONBOARDING_COMPLETE_STORAGE_KEY = "restormel_onboarding_complete";
  /** Set false to hide the modal everywhere; remount from Overview when re-enabling. */
  export const SETUP_ASSISTANT_ENABLED = false;
  /** Closing the assistant only hides it for this tab session; use "Open setup assistant" on Overview to reopen. */
  const ONBOARDING_SESSION_DISMISS_KEY = "restormel_onboarding_session_dismissed";

  type ChecklistItem = { label: string; href: string };

  const stackOptions: { value: UserStackChoice; label: string }[] = [
    { value: "openrouter", label: "OpenRouter" },
    { value: "vercel_ai_gateway", label: "Vercel AI Gateway" },
    { value: "portkey", label: "Portkey" },
    { value: "direct_env_secrets", label: "Direct (env/secrets)" },
    { value: "not_sure_yet", label: "Not sure yet" },
  ];

  const GATEWAY_STACK_CHOICES = new Set<UserStackChoice>(["openrouter", "vercel_ai_gateway", "portkey"]);

  let visible = false;
  let currentStep = 1;
  let selectedMode: UserMode | null = null;
  let selectedStackChoice: UserStackChoice | null = null;

  const unsubscribeMode = userMode.subscribe((value) => {
    selectedMode = value;
  });

  const unsubscribeStack = userStackChoice.subscribe((value) => {
    selectedStackChoice = value;
  });

  onMount(() => {
    if (!SETUP_ASSISTANT_ENABLED) return;
    syncUserModeFromStorage();
    syncUserStackChoiceFromStorage();
    const finished = localStorage.getItem(ONBOARDING_COMPLETE_STORAGE_KEY) === "true";
    const dismissedThisSession = sessionStorage.getItem(ONBOARDING_SESSION_DISMISS_KEY) === "1";
    visible = !finished && !dismissedThisSession;
    return () => {
      unsubscribeMode();
      unsubscribeStack();
    };
  });

  /** Reopens the mode / checklist assistant (Overview always exposes this). */
  export function openOnboarding() {
    if (!SETUP_ASSISTANT_ENABLED) return;
    syncUserModeFromStorage();
    syncUserStackChoiceFromStorage();
    try {
      sessionStorage.removeItem(ONBOARDING_SESSION_DISMISS_KEY);
    } catch {
      /* ignore */
    }
    visible = true;
  }

  function requiresStackQuestion(mode: UserMode | null): boolean {
    return mode === "existing_stack" || mode === "byok_saas";
  }

  function markCompleteAndHide() {
    trackDashboardOnboardingStep("complete");
    localStorage.setItem(ONBOARDING_COMPLETE_STORAGE_KEY, "true");
    try {
      sessionStorage.removeItem(ONBOARDING_SESSION_DISMISS_KEY);
    } catch {
      /* ignore */
    }
    visible = false;
  }

  function closeOverlay() {
    try {
      sessionStorage.setItem(ONBOARDING_SESSION_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    visible = false;
  }

  function next() {
    if (currentStep === 1) {
      if (!selectedMode) return;
      trackDashboardOnboardingStep("mode_selected");
      currentStep = requiresStackQuestion(selectedMode) ? 2 : 3;
      return;
    }
    if (currentStep === 2) {
      trackDashboardOnboardingStep("stack_selected");
      currentStep = 3;
    }
  }

  function back() {
    if (currentStep === 2) {
      currentStep = 1;
      return;
    }
    if (currentStep === 3) {
      currentStep = requiresStackQuestion(selectedMode) ? 2 : 1;
    }
  }

  function stackLabel(choice: UserStackChoice | null): string {
    if (choice === "openrouter") return "OpenRouter";
    if (choice === "vercel_ai_gateway") return "Vercel AI Gateway";
    if (choice === "portkey") return "Portkey";
    if (choice === "direct_env_secrets") return "Direct";
    if (choice === "not_sure_yet") return "selected";
    return "selected";
  }

  function checklistForMode(mode: UserMode | null, choice: UserStackChoice | null): ChecklistItem[] {
    const connectHome = { label: "Start in Restormel Connect", href: "/keys/dashboard/home" };
    const connectStore = {
      label: "Connect Surreal graph store",
      href: "/keys/dashboard/sources/ingest?step=store",
    };
    if (mode === "existing_stack") {
      return [
        connectHome,
        connectStore,
        { label: `Connect your ${stackLabel(choice)} integration`, href: "/keys/dashboard/integrations" },
        { label: "Configure ingest routes", href: "/keys/dashboard/routes/ingestion" },
      ];
    }
    if (mode === "byok_saas") {
      return [
        connectHome,
        connectStore,
        { label: "Connect a provider", href: "/keys/dashboard/integrations" },
        { label: "Load starter corpus in Sources", href: "/keys/dashboard/sources/ingest?step=sources" },
      ];
    }
    if (mode === "cli_agent") {
      return [
        connectHome,
        { label: "Install the CLI", href: "/keys/docs/integrations/cli" },
        { label: "Set up MCP for retrieve & verify", href: "/keys/docs/integrations/mcp" },
      ];
    }
    if (mode === "ops") {
      return [
        connectHome,
        { label: "View ingest runs", href: "/keys/dashboard/runs" },
        { label: "Check healthcheck", href: "/keys/dashboard/healthcheck" },
      ];
    }
    return [
      connectHome,
      connectStore,
      { label: "Connect a provider", href: "/keys/dashboard/integrations" },
      { label: "Configure chat and embedding routes", href: "/keys/dashboard/routes/ingestion" },
    ];
  }

  $: uiHidden = $page.data.dashboardUiHidden ?? [];
  $: gatewayProvidersOn = ($page.data.moduleFlags ?? MVP_MODULE_DEFAULTS).gatewayProviders;
  $: testingOn = ($page.data.moduleFlags ?? MVP_MODULE_DEFAULTS).testing;
  $: stackOptionsForUi = gatewayProvidersOn
    ? stackOptions
    : stackOptions.filter((o) => !GATEWAY_STACK_CHOICES.has(o.value));
  $: checklist = checklistForMode(selectedMode, selectedStackChoice).filter(
    (item) => !isDashboardHrefUiHidden(item.href, uiHidden)
  );

  async function startHere() {
    markCompleteAndHide();
    await goto(checklist[0]?.href ?? "/keys/dashboard/home");
  }
</script>

{#if SETUP_ASSISTANT_ENABLED && visible}
  <div class="onboarding-overlay" role="presentation">
    <div
      class="onboarding-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <button type="button" class="close-btn" on:click={closeOverlay} aria-label="Close for now (reopen from Overview)">
        ×
      </button>

      {#if currentStep === 1}
        <h2 id="onboarding-title" class="title">What brings you here?</h2>
        <ModeSelector showSkip={true} onSkip={markCompleteAndHide} />
      {:else if currentStep === 2}
        <h2 id="onboarding-title" class="title">How does your app reach AI providers today?</h2>
        <div class="stack-options">
          {#each stackOptionsForUi as option}
            <label class="stack-card">
              <input
                type="radio"
                name="stack-choice"
                value={option.value}
                checked={selectedStackChoice === option.value}
                on:change={() => setUserStackChoice(option.value)}
              />
              <span>{option.label}</span>
            </label>
          {/each}
        </div>
      {:else}
        <h2 id="onboarding-title" class="title">Your starting point</h2>
        {#if checklist.length === 0}
          <p class="checklist-fallback">
            Advanced dashboard steps are hidden for this deployment. Continue in
            <a href="/keys/docs">the docs</a> or use the REST API / CLI.
          </p>
        {:else}
          <ol class="checklist">
            {#each checklist as item}
              <li><a href={item.href}>{item.label}</a></li>
            {/each}
          </ol>
          <p class="testing-ci-hint">
            {#if testingOn}
            <strong>Restormel Testing in CI?</strong> Use
            <a href="/keys/dashboard/integrations">Connections</a> →
            <a href="/keys/dashboard/access">Gateway keys</a> →
            <a href="/keys/dashboard/testing">Restormel Testing hub</a> (copy <code>RESTORMEL_KEYS_BASE</code>,
            <code>RESTORMEL_GATEWAY_KEY</code>,
            <code>RESTORMEL_PROJECT_ID</code>). Then <code>pnpm exec testing doctor</code>.
            <a href="/keys/docs/guides/keys-testing-onboarding">Full guide</a>
            {:else}
            <strong>Automating with CLI or MCP?</strong> Start at
            <a href="/keys/dashboard/dev-tools">CLI &amp; agents</a> or run
            <code>pnpm exec keys login</code> after you create a Gateway key.
            {/if}
          </p>
        {/if}
      {/if}

      <footer class="actions">
        {#if currentStep > 1}
          <button type="button" class="btn btn-secondary" on:click={back}>Back</button>
        {:else}
          <span></span>
        {/if}

        {#if currentStep < 3}
          <button
            type="button"
            class="btn btn-primary"
            on:click={next}
            disabled={currentStep === 1 && !selectedMode}
          >
            Next
          </button>
        {:else}
          <button type="button" class="btn btn-primary" on:click={startHere}>Start here →</button>
        {/if}
      </footer>
    </div>
  </div>
{/if}

<style>
  .onboarding-overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal, 60);
    background: color-mix(in oklab, black 45%, transparent);
    display: grid;
    place-items: center;
    padding: var(--space-4);
  }

  .onboarding-modal {
    position: relative;
    width: min(52rem, 100%);
    max-height: calc(100vh - 2rem);
    overflow: auto;
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-5);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.32);
  }

  .close-btn {
    position: absolute;
    top: var(--space-3);
    right: var(--space-3);
    border: none;
    background: transparent;
    color: var(--rm-muted);
    font-size: 1.25rem;
    cursor: pointer;
    border-radius: var(--rm-radius);
    min-width: 2.75rem;
    min-height: 2.75rem;
    transition: background-color 0.12s ease, color 0.12s ease;
  }
  .close-btn:hover {
    color: var(--rm-text);
    background: color-mix(in oklab, var(--rm-border) 40%, transparent);
  }
  .close-btn:focus-visible {
    outline: 2px solid var(--rm-sage);
    outline-offset: 2px;
  }

  .title {
    margin: 0 0 var(--space-3);
    font-size: var(--text-lg);
    color: var(--rm-text);
  }

  .stack-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: var(--space-2);
  }

  .stack-card {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
    padding: var(--space-3);
    cursor: pointer;
    color: var(--rm-text);
    font-size: var(--text-sm);
  }

  .checklist {
    margin: 0;
    padding-left: 1.125rem;
    display: grid;
    gap: var(--space-2);
  }

  .checklist a {
    color: var(--rm-sage);
    text-decoration: none;
  }

  .checklist a:hover {
    text-decoration: underline;
  }

  .checklist-fallback {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-normal);
  }

  .checklist-fallback a {
    color: var(--rm-sage);
    text-decoration: none;
  }

  .checklist-fallback a:hover {
    text-decoration: underline;
  }

  .testing-ci-hint {
    margin: var(--space-4) 0 0;
    padding: var(--space-3);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
    font-size: var(--text-xs);
    color: var(--rm-muted);
    line-height: 1.5;
  }

  .testing-ci-hint a {
    color: var(--rm-sage);
    font-weight: 500;
    text-decoration: none;
  }

  .testing-ci-hint a:hover {
    text-decoration: underline;
  }

  .testing-ci-hint code {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: 0.9em;
  }

  .actions {
    margin-top: var(--space-5);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
  }

  .btn {
    border: none;
    border-radius: var(--rm-radius);
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .btn-secondary {
    background: transparent;
    color: var(--rm-muted);
    border: 1px solid var(--rm-border);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
