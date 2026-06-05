<script lang="ts">
  import { createEventDispatcher, onMount, tick } from "svelte";
  import { page } from "$app/stores";
  import {
    CONNECT_TEMPLATE_PILLS_DISMISSED_KEY,
    PENDING_TEMPLATE_STORAGE_KEY,
    USE_CASES,
    getUseCaseById,
    isUseCaseId,
    type UseCase,
  } from "$lib/content/use-cases";

  export let currentValue = "";
  /** Bound from parent designer textarea for scroll-into-view on template apply. */
  export let intentAnchor: HTMLTextAreaElement | null = null;

  const dispatch = createEventDispatcher<{ select: UseCase }>();

  let dismissed = false;
  let activeTemplateId: string | null = null;

  function readDismissed(): boolean {
    if (typeof sessionStorage === "undefined") return false;
    return sessionStorage.getItem(CONNECT_TEMPLATE_PILLS_DISMISSED_KEY) === "1";
  }

  function dismiss() {
    dismissed = true;
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(CONNECT_TEMPLATE_PILLS_DISMISSED_KEY, "1");
    }
  }

  function applyTemplate(template: UseCase, scroll = false) {
    activeTemplateId = template.id;
    dispatch("select", template);
    if (scroll && intentAnchor) {
      intentAnchor.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function selectPill(template: UseCase) {
    applyTemplate(template, true);
  }

  function resolveTemplateId(raw: string | null): string | null {
    if (!raw || !isUseCaseId(raw)) return null;
    return raw;
  }

  function clearPendingTemplate() {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.removeItem(PENDING_TEMPLATE_STORAGE_KEY);
  }

  onMount(async () => {
    dismissed = readDismissed();

    const urlTemplate = resolveTemplateId($page.url.searchParams.get("template"));
    const storedTemplate = resolveTemplateId(
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem(PENDING_TEMPLATE_STORAGE_KEY)
        : null,
    );
    const templateId = urlTemplate ?? storedTemplate;

    if (templateId) {
      const template = getUseCaseById(templateId);
      if (template) {
        applyTemplate(template, false);
        clearPendingTemplate();
        await tick();
        if (intentAnchor) {
          intentAnchor.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }
  });

  $: if (activeTemplateId) {
    const template = getUseCaseById(activeTemplateId);
    if (template && currentValue.trim() !== template.starterPrompt.trim()) {
      activeTemplateId = null;
    }
  }

</script>

{#if !dismissed}
  <div class="template-selector" aria-labelledby="template-selector-heading">
    <div class="template-selector-head">
      <h3 id="template-selector-heading" class="template-selector-title">Start from a template</h3>
      <button type="button" class="template-skip" on:click={dismiss}>Skip</button>
    </div>
    <div class="template-pills" role="group" aria-label="Domain templates">
      {#each USE_CASES as template (template.id)}
        <button
          type="button"
          class="template-pill"
          class:template-pill--active={activeTemplateId === template.id}
          aria-pressed={activeTemplateId === template.id}
          on:click={() => selectPill(template)}
        >
          {template.title}
        </button>
      {/each}
    </div>
    <p class="template-hint">Select a template to pre-fill the designer intent below. You can edit before generating.</p>
  </div>
{/if}

<style>
  .template-selector {
    margin-bottom: var(--space-5);
    padding: var(--space-4);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-2, var(--rm-surface));
  }
  .template-selector-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .template-selector-title {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--rm-text);
  }
  .template-skip {
    border: none;
    background: transparent;
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--rm-muted);
    cursor: pointer;
    text-decoration: underline;
  }
  .template-pills {
    display: flex;
    flex-wrap: nowrap;
    gap: var(--space-2);
    overflow-x: auto;
    padding-bottom: var(--space-2);
    margin: 0;
    list-style: none;
  }
  .template-pill {
    flex-shrink: 0;
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-xs);
    font-weight: 700;
    border: 1px solid var(--rm-border);
    border-radius: 999px;
    background: var(--rm-bg);
    color: var(--rm-text);
    cursor: pointer;
  }
  .template-pill--active {
    border-color: var(--rm-sage, var(--brut-blue));
    background: color-mix(in srgb, var(--rm-sage, #0d9488) 12%, var(--rm-bg));
  }
  .template-hint {
    margin: var(--space-2) 0 0;
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
</style>
