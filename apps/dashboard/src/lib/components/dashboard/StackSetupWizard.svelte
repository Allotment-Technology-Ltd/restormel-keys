<script lang="ts">
  import { onMount } from "svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import type { AAIFIntegrationStack } from "@restormel/aaif";
  import {
    INTEGRATION_STACK_SCHEMA_VERSION,
    INTEGRATION_STACK_TEMPLATES,
    isAAIFRequest,
  } from "@restormel/aaif";

  export let workspaceId: string;

  const storageKey = () => `rk_integration_stack_v1_${workspaceId}`;

  let step: 1 | 2 | 3 = 1;
  let selectedTemplateId: (typeof INTEGRATION_STACK_TEMPLATES)[number]["id"] | null = null;
  let copyMsg = "";
  let loadError = "";

  function stackForTemplate(
    id: (typeof INTEGRATION_STACK_TEMPLATES)[number]["id"],
  ): AAIFIntegrationStack {
    const t = INTEGRATION_STACK_TEMPLATES.find((x) => x.id === id);
    if (!t) throw new Error("unknown template");
    return {
      schemaVersion: INTEGRATION_STACK_SCHEMA_VERSION,
      templateId: t.id,
      components: t.componentIds.map((cid) => ({ id: cid })),
    };
  }

  $: stackObj = selectedTemplateId == null ? null : stackForTemplate(selectedTemplateId);
  $: stackJson = stackObj == null ? "" : JSON.stringify(stackObj, null, 2);
  $: stackValid = stackObj !== null && isAAIFRequest({ input: "x", integrationStack: stackObj });

  onMount(() => {
    try {
      const raw = localStorage.getItem(storageKey());
      if (!raw) return;
      const parsed = JSON.parse(raw) as { templateId?: string };
      if (parsed?.templateId && INTEGRATION_STACK_TEMPLATES.some((t) => t.id === parsed.templateId)) {
        selectedTemplateId = parsed.templateId as (typeof INTEGRATION_STACK_TEMPLATES)[number]["id"];
        step = 2;
      }
    } catch {
      loadError = "Could not read saved stack choice.";
    }
  });

  function selectTemplate(id: (typeof INTEGRATION_STACK_TEMPLATES)[number]["id"]) {
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

<section class="stack-wiz panel" aria-labelledby="stack-wiz-h">
  <h2 id="stack-wiz-h" class="stack-wiz-title">Connect your stack</h2>
  <p class="stack-wiz-desc">
    Pick a template, follow the checklist in the dashboard, then copy a machine-readable
    <code class="inline">integrationStack</code> for AAIF hosts and agents (
    <a href="/keys/docs/integrations/aaif">AAIF docs</a>).
  </p>
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
      {#each INTEGRATION_STACK_TEMPLATES as tpl}
        <button type="button" class="tpl-btn" on:click={() => selectTemplate(tpl.id)}>
          <span class="tpl-label">{tpl.label}</span>
        </button>
      {/each}
    </div>
  {:else if step === 2 && selectedTemplateId}
    <p class="stack-picked">
      Selected: <strong>{INTEGRATION_STACK_TEMPLATES.find((t) => t.id === selectedTemplateId)?.label}</strong>
      <button type="button" class="linkish" on:click={reset}>Change</button>
    </p>
    <ul class="checklist">
      <li>
        <a class="btn btn-secondary" href={DASHBOARD_BASE + "/integrations"}>Connections</a>
        — add provider access (hosted key, vault ref, or direct).
      </li>
      <li>
        <a class="btn btn-secondary" href={DASHBOARD_BASE + "/access"}>Gateway keys</a>
        — create a key for your app or CI.
      </li>
      <li>
        <a class="btn btn-secondary" href={DASHBOARD_BASE + "/routes"}>Rules</a>
        — route and policy basics.
      </li>
      <li>
        <a class="btn btn-ghost" href="/keys/docs/guides/integration-catalog">Integration catalog →</a>
      </li>
    </ul>
    <div class="stack-actions">
      <button type="button" class="btn btn-primary" on:click={goCopyStep}>Continue to export</button>
    </div>
  {:else if step === 3 && selectedTemplateId}
    <p class="stack-picked">
      <button type="button" class="linkish" on:click={() => (step = 2)}>Back</button>
    </p>
    <p class="stack-json-hint">Optional <code class="inline">integrationStack</code> on an <code class="inline">AAIFRequest</code>:</p>
    <pre class="stack-pre" role="region" aria-label="AAIF integrationStack JSON">{stackJson}</pre>
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
  .stack-wiz-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .stack-wiz-desc {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-4);
    line-height: var(--leading-relaxed);
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
    margin: 0 0 var(--space-4);
    padding: 0;
    font-size: var(--text-xs);
    color: var(--rm-muted);
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
    width: 1.25rem;
    height: 1.25rem;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    border: 1px solid var(--rm-border);
    font-size: 0.65rem;
  }
  .tpl-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: var(--space-2);
  }
  .tpl-btn {
    text-align: left;
    padding: var(--space-3);
    border-radius: var(--radius-md);
    border: 1px solid var(--rm-border);
    background: var(--rm-surface);
    color: var(--rm-text);
    cursor: pointer;
    font-size: var(--text-sm);
    min-height: 44px;
    transition: border-color 0.15s ease;
  }
  .tpl-btn:hover {
    border-color: var(--rm-sage);
  }
  .tpl-label {
    font-weight: 500;
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
    border: 1px solid var(--rm-border);
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
