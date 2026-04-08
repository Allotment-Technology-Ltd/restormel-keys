<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import ModeSelector from "$lib/components/dashboard/ModeSelector.svelte";
  import { isDashboardHrefUiHidden } from "$lib/dashboard-ui-path-match";
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

  type ChecklistItem = { label: string; href: string };

  const stackOptions: { value: UserStackChoice; label: string }[] = [
    { value: "openrouter", label: "OpenRouter" },
    { value: "vercel_ai_gateway", label: "Vercel AI Gateway" },
    { value: "portkey", label: "Portkey" },
    { value: "direct_env_secrets", label: "Direct (env/secrets)" },
    { value: "not_sure_yet", label: "Not sure yet" },
  ];

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
    syncUserModeFromStorage();
    syncUserStackChoiceFromStorage();
    visible = localStorage.getItem(ONBOARDING_COMPLETE_STORAGE_KEY) !== "true";
    return () => {
      unsubscribeMode();
      unsubscribeStack();
    };
  });

  function requiresStackQuestion(mode: UserMode | null): boolean {
    return mode === "existing_stack" || mode === "byok_saas";
  }

  function markCompleteAndHide() {
    localStorage.setItem(ONBOARDING_COMPLETE_STORAGE_KEY, "true");
    visible = false;
  }

  function closeOverlay() {
    markCompleteAndHide();
  }

  function next() {
    if (currentStep === 1) {
      if (!selectedMode) return;
      currentStep = requiresStackQuestion(selectedMode) ? 2 : 3;
      return;
    }
    if (currentStep === 2) {
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
    if (mode === "existing_stack") {
      return [
        { label: `Connect your ${stackLabel(choice)} integration`, href: "/keys/dashboard/integrations" },
        { label: "Create a route", href: "/keys/dashboard/routes" },
        { label: "Check your logs", href: "/keys/dashboard/logs" },
      ];
    }
    if (mode === "byok_saas") {
      return [
        { label: "Connect a provider", href: "/keys/dashboard/integrations" },
        { label: "Preview the KeyManager component", href: "/keys/dashboard/sandbox" },
        { label: "Create a route", href: "/keys/dashboard/routes" },
      ];
    }
    if (mode === "cli_agent") {
      return [
        { label: "Install the CLI", href: "/keys/docs/integrations/cli" },
        { label: "Set up MCP", href: "/keys/docs/integrations/mcp" },
        { label: "Copy CI secrets", href: "/keys/dashboard/copy-for-ci" },
      ];
    }
    if (mode === "ops") {
      return [
        { label: "View your logs", href: "/keys/dashboard/logs" },
        { label: "Check healthcheck", href: "/keys/dashboard/healthcheck" },
        { label: "Review your policies", href: "/keys/dashboard/policies" },
      ];
    }
    return [
      { label: "Connect a provider", href: "/keys/dashboard/integrations" },
      { label: "Create your first route", href: "/keys/dashboard/routes" },
      { label: "Make your first request", href: "/keys/docs" },
    ];
  }

  $: uiHidden = $page.data.dashboardUiHidden ?? [];
  $: checklist = checklistForMode(selectedMode, selectedStackChoice).filter(
    (item) => !isDashboardHrefUiHidden(item.href, uiHidden)
  );

  async function startHere() {
    markCompleteAndHide();
    await goto(checklist[0]?.href ?? "/keys/docs");
  }
</script>

{#if visible}
  <div class="onboarding-overlay" role="presentation">
    <div
      class="onboarding-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <button type="button" class="close-btn" on:click={closeOverlay} aria-label="Dismiss onboarding">
        ×
      </button>

      {#if currentStep === 1}
        <h2 id="onboarding-title" class="title">What brings you here?</h2>
        <ModeSelector showSkip={true} />
      {:else if currentStep === 2}
        <h2 id="onboarding-title" class="title">How does your app reach AI providers today?</h2>
        <div class="stack-options">
          {#each stackOptions as option}
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
            <strong>Restormel Testing in CI?</strong> Use
            <a href="/keys/dashboard/integrations">Connections</a> →
            <a href="/keys/dashboard/access">Gateway keys</a> →
            <a href="/keys/dashboard/testing">Restormel Testing hub</a> (copy <code>RESTORMEL_KEYS_BASE</code>,
            <code>RESTORMEL_GATEWAY_KEY</code>,
            <code>RESTORMEL_PROJECT_ID</code>). Then <code>pnpm exec testing doctor</code>.
            <a href="/keys/docs/guides/keys-testing-onboarding">Full guide</a>
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

  .btn-primary {
    background: var(--rm-sage);
    color: var(--rm-bg);
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
