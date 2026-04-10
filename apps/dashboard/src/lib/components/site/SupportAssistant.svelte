<script lang="ts">
  import { page } from "$app/stores";
  import { onMount, tick } from "svelte";
  import { env } from "$env/dynamic/public";
  import { openFeedbackWidget } from "$lib/stores/feedback-widget";
  import {
    closeSupportAssistant,
    openSupportAssistant,
    supportAssistantOpen,
  } from "$lib/stores/support-assistant";

  type Role = "user" | "assistant";
  type Msg = { role: Role; content: string };

  let drawerEl: HTMLElement | null = null;
  let inputEl: HTMLTextAreaElement | null = null;
  let messages: Msg[] = [];
  let input = "";
  let streaming = false;
  let error: string | null = null;

  $: sessionUser =
    $page.data.user &&
    ($page.data.user as { authType?: string }).authType === "session"
      ? $page.data.user
      : null;

  $: uiEnabled = (env.PUBLIC_RESTORMEL_SUPPORT_UI ?? "").trim().toLowerCase() !== "false";

  $: showShell = !!sessionUser && uiEnabled;

  $: if ($supportAssistantOpen) {
    void focusInput();
  }

  async function focusInput(): Promise<void> {
    await tick();
    inputEl?.focus();
  }

  function focusableElements(): HTMLElement[] {
    if (!drawerEl) return [];
    const all = drawerEl.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    return [...all].filter((el) => !el.hasAttribute("disabled"));
  }

  function onDocumentKeydown(event: KeyboardEvent): void {
    if (!$supportAssistantOpen) return;
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

  function closeDrawer(): void {
    closeSupportAssistant();
    messages = [];
    input = "";
    error = null;
    streaming = false;
  }

  function openFeedbackFromSupport(): void {
    closeDrawer();
    openFeedbackWidget();
  }

  async function send(): Promise<void> {
    const text = input.trim();
    if (!text || streaming) return;
    error = null;
    const prior = [...messages, { role: "user" as const, content: text }];
    messages = prior;
    input = "";
    streaming = true;
    const assistantIdx = prior.length;
    messages = [...prior, { role: "assistant", content: "" }];

    try {
      const res = await fetch("/keys/dashboard/api/support-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: prior.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        let msg = "Something went wrong.";
        try {
          const errBody = (await res.json()) as { error?: unknown; message?: unknown };
          if (typeof errBody.message === "string" && errBody.message.trim()) {
            msg = errBody.message;
          } else if (typeof errBody.error === "string") {
            msg = errBody.error;
          }
        } catch {
          if (res.status === 503) msg = "Support is not available right now.";
          if (res.status === 429) msg = "Too many requests. Try again later.";
          if (res.status === 401) msg = "Sign in to use support.";
        }
        error = msg;
        messages = prior;
        streaming = false;
        return;
      }

      if (!res.body) {
        error = "No response.";
        messages = prior;
        streaming = false;
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        messages = messages.map((m, i) => (i === assistantIdx ? { ...m, content: acc } : m));
      }
    } catch {
      error = "Network error.";
      messages = prior;
    } finally {
      streaming = false;
    }
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }
</script>

{#if showShell}
  <button
    type="button"
    class="support-fab"
    aria-label="Open Restormel Support"
    aria-expanded={$supportAssistantOpen}
    on:click={() => {
      openSupportAssistant();
    }}
  >
    Support
  </button>
{/if}

{#if showShell && $supportAssistantOpen}
  <div class="support-backdrop" aria-hidden="true"></div>
  <div
    class="support-drawer"
    role="dialog"
    aria-label="Restormel Support"
    aria-modal="true"
    bind:this={drawerEl}
  >
    <button type="button" class="close-btn" aria-label="Close support" on:click={closeDrawer}>×</button>
    <h2 class="title">Restormel Support</h2>
    <p class="disclaimer">
      Guidance from docs only — not human support. Do not paste API or Gateway keys here. For bugs, use
      <button type="button" class="linkish" on:click={openFeedbackFromSupport}>Send feedback</button>
      (dashboard) or GitHub issues.
    </p>

    <div class="thread" role="log" aria-live="polite" aria-relevant="additions text">
      {#if messages.length === 0}
        <p class="empty">Ask how to use Keys, Testing, Graph, or find the right doc.</p>
      {:else}
        {#each messages as m, i (i)}
          <div class="bubble" class:bubble-user={m.role === "user"} class:bubble-assistant={m.role === "assistant"}>
            <span class="bubble-label">{m.role === "user" ? "You" : "Restormel"}</span>
            <pre class="bubble-text">{m.content || (streaming && i === messages.length - 1 ? "…" : "")}</pre>
          </div>
        {/each}
      {/if}
    </div>

    {#if error}
      <p class="error-copy" role="alert">{error}</p>
    {/if}

    <div class="composer">
      <label class="sr-only" for="support-input">Your message</label>
      <textarea
        id="support-input"
        class="input"
        rows="2"
        placeholder="e.g. Where do I configure MCP?"
        bind:value={input}
        bind:this={inputEl}
        disabled={streaming}
        on:keydown={onKeydown}
      ></textarea>
      <button type="button" class="btn btn-primary" disabled={streaming || !input.trim()} on:click={() => void send()}>
        {streaming ? "Thinking…" : "Send"}
      </button>
    </div>
  </div>
{/if}

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .support-fab {
    position: fixed;
    right: var(--space-4);
    bottom: var(--space-4);
    z-index: calc(var(--z-modal) - 2);
    border: 1px solid var(--rm-border);
    border-radius: 999px;
    padding: var(--space-2) var(--space-4);
    background: var(--rm-surface);
    color: var(--rm-text);
    font-size: var(--text-sm);
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }
  .support-fab:hover {
    background: var(--rm-surface-raised);
  }

  .support-backdrop {
    position: fixed;
    inset: 0;
    background: color-mix(in oklab, var(--rm-bg) 65%, transparent);
    z-index: calc(var(--z-modal) - 1);
  }

  .support-drawer {
    position: fixed;
    right: var(--space-4);
    bottom: var(--space-4);
    width: min(28rem, calc(100vw - var(--space-8)));
    max-height: min(32rem, calc(100vh - var(--space-8)));
    display: flex;
    flex-direction: column;
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
    margin: 0 0 var(--space-2);
    font-size: var(--text-lg);
    color: var(--rm-text);
    font-family: var(--rm-font-display);
    padding-right: 2rem;
  }

  .disclaimer {
    margin: 0 0 var(--space-3);
    font-size: var(--text-xs);
    color: var(--rm-muted);
    line-height: 1.4;
  }

  .linkish {
    border: 0;
    background: none;
    padding: 0;
    color: var(--path-blue);
    text-decoration: underline;
    cursor: pointer;
    font: inherit;
  }

  .thread {
    flex: 1;
    overflow-y: auto;
    margin-bottom: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-height: 6rem;
  }

  .empty {
    margin: 0;
    color: var(--rm-dim);
    font-size: var(--text-sm);
  }

  .bubble {
    border-radius: var(--rm-radius);
    padding: var(--space-2);
    font-size: var(--text-sm);
  }
  .bubble-user {
    background: var(--rm-surface-raised);
    align-self: flex-end;
    max-width: 95%;
  }
  .bubble-assistant {
    background: color-mix(in oklab, var(--rm-sage-bg) 40%, var(--rm-surface));
    align-self: flex-start;
    max-width: 100%;
  }
  .bubble-label {
    display: block;
    font-size: var(--text-xs);
    color: var(--rm-dim);
    margin-bottom: var(--space-1);
  }
  .bubble-text {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: var(--rm-font-body, inherit);
    font-size: var(--text-sm);
    color: var(--rm-text);
  }

  .composer {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .input {
    width: 100%;
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-bg);
    color: var(--rm-text);
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    resize: vertical;
    min-height: 2.75rem;
  }

  .btn {
    border: 0;
    border-radius: var(--rm-radius);
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-sm);
    cursor: pointer;
    align-self: flex-start;
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
    margin: 0 0 var(--space-2);
    color: var(--coral-alert);
    font-size: var(--text-sm);
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
