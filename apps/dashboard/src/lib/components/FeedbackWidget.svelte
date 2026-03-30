<script lang="ts">
  import { onMount, tick } from "svelte";
  import { closeFeedbackWidget, feedbackWidgetOpen } from "$lib/stores/feedback-widget";

  type Category = "bug" | "question" | "feature";

  let drawerEl: HTMLElement | null = null;
  let titleEl: HTMLInputElement | null = null;
  let title = "";
  let description = "";
  let category: Category = "bug";
  let isSending = false;
  let sendError = false;
  let success = false;

  function closeDrawer(): void {
    closeFeedbackWidget();
    isSending = false;
    sendError = false;
    success = false;
    title = "";
    description = "";
    category = "bug";
  }

  async function focusFirstField(): Promise<void> {
    await tick();
    titleEl?.focus();
  }

  $: if ($feedbackWidgetOpen) {
    void focusFirstField();
  }

  function focusableElements(): HTMLElement[] {
    if (!drawerEl) return [];
    const all = drawerEl.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    return [...all].filter((el) => !el.hasAttribute("disabled"));
  }

  function onDocumentKeydown(event: KeyboardEvent): void {
    if (!$feedbackWidgetOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeDrawer();
      return;
    }
    if (event.key !== "Tab") return;
    const focusables = focusableElements();
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  onMount(() => {
    document.addEventListener("keydown", onDocumentKeydown);
    return () => document.removeEventListener("keydown", onDocumentKeydown);
  });

  async function submitFeedback(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (isSending) return;
    isSending = true;
    sendError = false;

    try {
      const res = await fetch("/keys/dashboard/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
        }),
      });
      if (!res.ok) {
        sendError = true;
        return;
      }
      success = true;
    } catch {
      sendError = true;
    } finally {
      isSending = false;
    }
  }
</script>

{#if $feedbackWidgetOpen}
  <div class="feedback-backdrop" aria-hidden="true"></div>
  <div class="feedback-drawer" role="dialog" aria-label="Send feedback" bind:this={drawerEl}>
    <button type="button" class="close-btn" aria-label="Close feedback drawer" on:click={closeDrawer}>×</button>
    <h2 class="title">Send feedback</h2>

    {#if success}
      <p class="success-copy">Thanks — we'll look into it.</p>
      <button type="button" class="btn btn-primary" on:click={closeDrawer}>Close</button>
    {:else}
      <form on:submit={submitFeedback} class="form">
        <fieldset disabled={isSending} class="fieldset">
          <div class="category-row" aria-label="Feedback category">
            <button
              type="button"
              class="pill"
              class:pill-active={category === "bug"}
              on:click={() => (category = "bug")}
            >
              Bug
            </button>
            <button
              type="button"
              class="pill"
              class:pill-active={category === "question"}
              on:click={() => (category = "question")}
            >
              Question
            </button>
            <button
              type="button"
              class="pill"
              class:pill-active={category === "feature"}
              on:click={() => (category = "feature")}
            >
              Feature request
            </button>
          </div>

          <label class="label" for="feedback-title">Title</label>
          <input
            id="feedback-title"
            class="input"
            type="text"
            maxlength="200"
            placeholder="Short summary"
            bind:value={title}
            bind:this={titleEl}
            required
          />

          <label class="label" for="feedback-description">Description</label>
          <textarea
            id="feedback-description"
            class="input textarea"
            rows="4"
            maxlength="2000"
            placeholder="What happened? What did you expect?"
            bind:value={description}
            required
          ></textarea>
        </fieldset>

        {#if sendError}
          <p class="error-copy">Something went wrong. Try again.</p>
        {/if}

        <button type="submit" class="btn btn-primary" disabled={isSending || !title.trim() || !description.trim()}>
          {isSending ? "Sending…" : "Send"}
        </button>
      </form>
    {/if}
  </div>
{/if}

<style>
  .feedback-backdrop {
    position: fixed;
    inset: 0;
    background: color-mix(in oklab, var(--rm-bg) 65%, transparent);
    z-index: calc(var(--z-modal) - 1);
  }
  .feedback-drawer {
    position: fixed;
    left: var(--space-4);
    bottom: var(--space-4);
    width: min(26rem, calc(100vw - var(--space-8)));
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.36);
    z-index: var(--z-modal);
    animation: drawer-in 160ms ease-out;
  }
  .close-btn {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    border: 0;
    background: transparent;
    color: var(--rm-muted);
    width: 2rem;
    height: 2rem;
    border-radius: var(--rm-radius);
    font-size: 1.25rem;
    cursor: pointer;
  }
  .close-btn:hover {
    background: var(--rm-surface-raised);
    color: var(--rm-text);
  }
  .title {
    margin: 0 0 var(--space-3);
    font-size: var(--text-lg);
    color: var(--rm-text);
    font-family: var(--rm-font-display);
  }
  .form {
    display: grid;
    gap: var(--space-3);
  }
  .fieldset {
    border: 0;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }
  .category-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-1);
  }
  .pill {
    border: 1px solid var(--rm-border);
    border-radius: 999px;
    padding: 0.35rem 0.7rem;
    font-size: var(--text-xs);
    color: var(--rm-muted);
    background: var(--rm-surface-raised);
    cursor: pointer;
  }
  .pill-active {
    background: var(--rm-sage-bg);
    border-color: var(--rm-sage);
    color: var(--rm-sage);
  }
  .label {
    font-size: var(--text-xs);
    color: var(--rm-dim);
  }
  .input {
    width: 100%;
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-bg);
    color: var(--rm-text);
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
  }
  .textarea {
    resize: vertical;
    min-height: 6rem;
  }
  .btn {
    border: 0;
    border-radius: var(--rm-radius);
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-sm);
    cursor: pointer;
  }
  .btn-primary {
    background: var(--path-blue);
    color: var(--rm-bg);
  }
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .error-copy {
    margin: 0;
    color: var(--coral-alert);
    font-size: var(--text-sm);
  }
  .success-copy {
    margin: 0 0 var(--space-3);
    color: var(--rm-muted);
  }
  @keyframes drawer-in {
    from {
      transform: translateY(0.5rem);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
</style>
