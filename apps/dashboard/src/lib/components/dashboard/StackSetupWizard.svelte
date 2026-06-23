<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import type { DispatchIntegrationStack } from "@restormel/dispatch";
  import {
    INTEGRATION_STACK_SCHEMA_VERSION,
    isDispatchRequest,
  } from "@restormel/dispatch";
  import { integrationCatalogForFlags, integrationStackTemplatesForFlags } from "$lib/integration-catalog-for-flags";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

  export let workspaceId: string;
  /** When true (e.g. Overview “More setup”), hide duplicate title and flatten chrome. */
  export let embedded = false;

  $: flags = $page.data.moduleFlags ?? MVP_MODULE_DEFAULTS;
  $: templatesForUi = integrationStackTemplatesForFlags(flags);
  $: showIntegrationCatalog = integrationCatalogForFlags(flags).length > 0;
  $: guardrailsOn = flags.guardrails;

  function templateIcon(id: string): string {
    if (id === "sveltekit-neon-keys") return "◆";
    if (id === "next-vercel-ai-keys") return "▲";
    if (id === "github-actions-testing") return "↻";
    if (id === "openrouter-portkey-keys") return "◇";
    return "□";
  }

  const storageKey = () => `rk_integration_stack_v1_${workspaceId}`;

  let step: 1 | 2 | 3 = 1;
  let selectedTemplateId: string | null = null;
  let copyMsg = "";
  let loadError = "";

  function stackForTemplate(id: string): DispatchIntegrationStack {
    const t = templatesForUi.find((x) => x.id === id);
    if (!t) throw new Error("unknown template");
    return {
      schemaVersion: INTEGRATION_STACK_SCHEMA_VERSION,
      templateId: t.id,
      components: t.componentIds.map((cid) => ({ id: cid })),
    };
  }

  $: if (selectedTemplateId && !templatesForUi.some((t) => t.id === selectedTemplateId)) {
    selectedTemplateId = null;
    step = 1;
  }

  $: stackObj = selectedTemplateId == null ? null : stackForTemplate(selectedTemplateId);
  $: stackJson = stackObj == null ? "" : JSON.stringify(stackObj, null, 2);
  $: stackValid = stackObj !== null && isDispatchRequest({ input: "x", integrationStack: stackObj });

  onMount(() => {
    try {
      const raw = localStorage.getItem(storageKey());
      if (!raw) return;
      const parsed = JSON.parse(raw) as { templateId?: string };
      if (parsed?.templateId && templatesForUi.some((t) => t.id === parsed.templateId)) {
        selectedTemplateId = parsed.templateId;
        step = 2;
      }
    } catch {
      loadError = "Could not read saved stack choice.";
    }
  });

  function selectTemplate(id: string) {
    selectedTemplateId = id;
    try {
      localStorage.setItem(storageKey(), JSON.stringify({ templateId: id }));
    } catch {
      /* ignore quota */
    }
    step = 2;
  }

  function goCopyStep() {
    step = 3;
  }

  async function copyJson() {
    if (!stackJson) return;
    try {
      await navigator.clipboard.writeText(stackJson);
      copyMsg = "Copied.";
      setTimeout(() => (copyMsg = ""), 2000);
    } catch {
      copyMsg = "Copy failed — select the text manually.";
    }
  }

  function reset() {
    selectedTemplateId = null;
    step = 1;
    try {
      localStorage.removeItem(storageKey());
    } catch {
      /* ignore */
    }
  }
</script>

<section
  class="stack-wiz"
  class:panel={!embedded}
  class:stack-wiz--embedded={embedded}
  aria-labelledby={embedded ? undefined : "stack-wiz-h"}
  aria-label={embedded ? "Stack template, checklist, and integrationStack export" : undefined}
>
  {#if !embedded}
    <h2 id="stack-wiz-h" class="stack-wiz-title">Connect your stack</h2>
    <p class="stack-wiz-desc">
      Pick a template, follow the checklist in the dashboard, then copy a machine-readable
      <code class="inline">integrationStack</code> for Dispatch hosts and agents (
      <a href="/keys/docs/integrations/aaif">Dispatch docs</a>).
    </p>
  {:else}
    <p class="stack-wiz-desc stack-wiz-desc--compact">
      <a href="/keys/docs/integrations/aaif">Dispatch integrationStack</a> — JSON preset for your host or agent.
    </p>
  {/if}
  {#if loadError}
    <p class="stack-wiz-err" role="alert">{loadError}</p>
  {/if}

  <ol class="stack-steps" aria-label="Steps">
    <li class:active={step === 1} class:done={step > 1}>
      <span class="num">1</span> Template
    </li>
    <li class:active={step === 2} class:done={step > 2}>
      <span class="num">2</span> Checklist
    </li>
    <li class:active={step === 3}>
      <span class="num">3</span> Export
    </li>
  </ol>

  {#if step === 1}
    <div class="tpl-grid">
      {#each templatesForUi as tpl}
        <button type="button" class="tpl-btn" on:click={() => selectTemplate(tpl.id)}>
          <span class="tpl-icon" aria-hidden="true">{templateIcon(tpl.id)}</span>
          <span class="tpl-label">{tpl.label}</span>
        </button>
      {/each}
    </div>
  {:else if step === 2 && selectedTemplateId}
    <p class="stack-picked">
      Selected: <strong>{templatesForUi.find((t) => t.id === selectedTemplateId)?.label}</strong>
      <button type="button" class="linkish" on:click={reset}>Change</button>
    </p>
    <ul class="checklist checklist-cards">
      <li class="checklist-card">
        <span class="checklist-card-icon" aria-hidden="true">🔌</span>
        <div class="checklist-card-main">
          <a class="btn btn-secondary" href={DASHBOARD_BASE + "/integrations"}>Connections</a>
          <span class="checklist-card-hint">Hosted key, vault ref, or direct.</span>
        </div>
      </li>
      <li class="checklist-card">
        <span class="checklist-card-icon" aria-hidden="true">🔑</span>
        <div class="checklist-card-main">
          <a class="btn btn-secondary" href={DASHBOARD_BASE + "/access"}>Gateway keys</a>
          <span class="checklist-card-hint">Key for app or CI.</span>
        </div>
      </li>
      <li class="checklist-card">
        <span class="checklist-card-icon" aria-hidden="true">📍</span>
        <div class="checklist-card-main">
          <a class="btn btn-secondary" href={DASHBOARD_BASE + "/routes"}>Routes</a>
          <span class="checklist-card-hint"
            >{guardrailsOn ? "Models and guard rails." : "Models and resolve paths."}</span
          >
        </div>
      </li>
      {#if showIntegrationCatalog}
        <li class="checklist-card checklist-card--link">
          <span class="checklist-card-icon" aria-hidden="true">📚</span>
          <div class="checklist-card-main">
            <a class="btn btn-ghost" href="/keys/docs/guides/integration-catalog">Integration catalog →</a>
          </div>
        </li>
      {/if}
    </ul>
    <div class="stack-actions">
      <button type="button" class="btn btn-primary" on:click={goCopyStep}>Continue to export</button>
    </div>
  {:else if step === 3 && selectedTemplateId}
    <p class="stack-picked">
      <button type="button" class="linkish" on:click={() => (step = 2)}>Back</button>
    </p>
    <p class="stack-json-hint">Optional <code class="inline">integrationStack</code> on a <code class="inline">DispatchRequest</code>:</p>
    <pre class="stack-pre" role="region" aria-label="Dispatch integrationStack JSON">{stackJson}</pre>
    <div class="stack-actions">
      <button type="button" class="btn btn-primary" on:click={copyJson} disabled={!stackValid}>Copy JSON</button>
      {#if copyMsg}
        <span class="copy-msg" role="status">{copyMsg}</span>
      {/if}
    </div>
  {/if}
</section>

<style>
  .stack-wiz {
    margin-bottom: var(--space-5);
  }
  .stack-wiz--embedded {
    margin-bottom: 0;
    padding: 0;
    border: none;
    background: transparent;
    box-shadow: none;
  }
  .stack-wiz-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .stack-wiz-desc {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-5);
    line-height: var(--leading-relaxed);
  }
  .stack-wiz-desc--compact {
    margin-bottom: var(--space-4);
    font-size: var(--text-xs);
  }
  .stack-wiz-desc--compact a {
    color: var(--rm-sage);
    font-weight: 600;
    text-decoration: none;
  }
  .stack-wiz-desc--compact a:hover {
    text-decoration: underline;
  }
  .stack-wiz-err {
    color: var(--rm-coral, #e85d5d);
    font-size: var(--text-sm);
  }
  .inline {
    font-size: 0.9em;
  }
  .stack-steps {
    display: flex;
    gap: var(--space-4);
    list-style: none;
    margin: 0 0 var(--space-5);
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-xs);
    color: var(--rm-muted);
    border-radius: var(--rm-radius);
    border: var(--border-thin);
    background: color-mix(in oklab, var(--rm-sage) 5%, var(--rm-surface));
  }
  .stack-steps li {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  .stack-steps li.active {
    color: var(--rm-sage);
    font-weight: 600;
  }
  .stack-steps li.done {
    color: var(--rm-text);
  }
  .num {
    display: inline-flex;
    width: 1.35rem;
    height: 1.35rem;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    border: var(--border-thin);
    font-size: 0.65rem;
    font-weight: 700;
    background: var(--rm-surface-raised);
  }
  .stack-steps li.active .num {
    border-color: color-mix(in oklab, var(--rm-sage) 55%, var(--rm-border));
    background: color-mix(in oklab, var(--rm-sage) 16%, var(--rm-surface));
    color: var(--rm-sage);
  }
  .stack-steps li.done .num {
    color: var(--rm-sage);
    border-color: color-mix(in oklab, var(--rm-sage) 40%, var(--rm-border));
  }
  .tpl-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: var(--space-3);
  }
  .tpl-btn {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    text-align: left;
    padding: var(--space-3);
    border-radius: var(--rm-radius);
    border: var(--border-thin);
    background: var(--rm-surface);
    color: var(--rm-text);
    cursor: pointer;
    font-size: var(--text-sm);
    min-height: 3.25rem;
    transition:
      border-color 0.15s ease,
      background-color 0.15s ease;
  }
  .tpl-btn:hover {
    border-color: var(--rm-sage);
    background: color-mix(in oklab, var(--rm-sage) 7%, var(--rm-surface));
  }
  .tpl-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: var(--rm-radius);
    border: var(--border-thin);
    background: var(--rm-surface-raised);
    font-size: 0.85rem;
    line-height: 1;
    color: var(--rm-sage);
  }
  .tpl-label {
    font-weight: 600;
    line-height: 1.35;
    padding-top: 0.2rem;
  }
  .stack-picked {
    font-size: var(--text-sm);
    margin: 0 0 var(--space-3);
  }
  .linkish {
    margin-left: var(--space-2);
    background: none;
    border: none;
    color: var(--rm-sage);
    cursor: pointer;
    font-size: inherit;
    text-decoration: underline;
    padding: 0;
  }
  .checklist {
    margin: 0 0 var(--space-4);
    padding-left: var(--space-4);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .checklist-cards {
    list-style: none;
    padding: 0;
    margin: 0 0 var(--space-4);
    gap: var(--space-2);
    display: flex;
    flex-direction: column;
  }
  .checklist-card {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-3);
    border-radius: var(--rm-radius);
    border: var(--border-thin);
    background: var(--rm-surface);
  }
  .checklist-card-icon {
    flex-shrink: 0;
    font-size: 1.25rem;
    line-height: 1;
    margin-top: 0.1rem;
  }
  .checklist-card-main {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
    min-width: 0;
  }
  .checklist-card-hint {
    font-size: var(--text-xs);
    color: var(--rm-dim);
    line-height: 1.4;
  }
  .checklist-card--link .checklist-card-main {
    justify-content: center;
    padding-top: 0.15rem;
  }
  .checklist .btn {
    margin-right: var(--space-2);
    vertical-align: middle;
  }
  .stack-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .stack-json-hint {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-2);
  }
  .stack-pre {
    margin: 0 0 var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    border: var(--border-thin);
    background: var(--rm-bg);
    color: var(--rm-text);
    font-size: var(--text-xs);
    overflow: auto;
    max-height: 14rem;
  }
  .copy-msg {
    font-size: var(--text-sm);
    color: var(--rm-sage);
  }
</style>
