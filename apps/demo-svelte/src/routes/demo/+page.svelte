<script lang="ts">
  import { onMount } from "svelte";
  import { createKeys, openaiProvider, anthropicProvider } from "@restormel/keys";

  const providers = [openaiProvider, anthropicProvider];
  const API_KEYS = "/api/keys";
  const userId = "demo-user";

  let keysList = $state<{ id?: string; provider: string }[]>([]);
  let keys = $state(createKeys({ keys: [], routing: { defaultProvider: "openai" } }, { providers }));
  let selectedModel = $state("");
  let messages = $state<{ role: "user" | "assistant"; text: string }[]>([]);
  let input = $state("");

  async function loadKeys() {
    try {
      const r = await fetch(API_KEYS, { headers: { "x-user-id": userId } });
      const d = await r.json();
      const list = Array.isArray(d.keys) ? d.keys : [];
      keysList = list;
      keys = createKeys(
        { keys: list, routing: { defaultProvider: "openai" } },
        { providers }
      );
    } catch {
      keysList = [];
    }
  }

  onMount(() => {
    loadKeys();
  });

  function sendMessage() {
    const text = input.trim();
    if (!text) return;
    messages = [...messages, { role: "user", text }];
    input = "";
    const resolved = selectedModel
      ? { provider: selectedModel.split(":")[0] ?? "openai", model: selectedModel.split(":")[1] ?? "gpt-4o" }
      : null;
    const mockReply =
      resolved != null
        ? `Mock reply (resolved: ${resolved.provider} / ${resolved.model}). No external API called.`
        : "Add a key in Settings and select a model to use the resolved provider.";
    messages = [...messages, { role: "assistant", text: mockReply }];
  }
</script>

<main class="rm-demo">
  <h1 class="rm-page-title">Demo chat</h1>
  <p class="rm-muted">Uses resolved provider (mock responses only). Add keys in <a href="/settings">Settings</a>.</p>

  <div class="rm-chat">
    <div class="rm-messages">
      {#each messages as msg}
        <div class="rm-msg" data-role={msg.role}>
          <span class="rm-msg-role">{msg.role}</span>
          <span class="rm-msg-text">{msg.text}</span>
        </div>
      {:else}
        <p class="rm-muted">No messages yet. Type below and send.</p>
      {/each}
    </div>
    <form
      class="rm-form"
      onsubmit={(e) => {
        e.preventDefault();
        sendMessage();
      }}
    >
      <input
        type="text"
        class="rm-input"
        bind:value={input}
        placeholder="Type a message…"
        aria-label="Chat message"
      />
      <button type="submit" class="rm-btn">Send</button>
    </form>
  </div>
</main>

<style>
  .rm-demo {
    max-width: 36rem;
    margin: 0 auto;
    padding: 2rem 1.5rem;
  }
  .rm-page-title {
    margin: 0 0 0.5rem;
    font-size: 1.5rem;
    color: var(--rm-text);
  }
  .rm-muted {
    margin: 0 0 1.5rem;
    font-size: 0.875rem;
    color: var(--rm-text-muted);
  }
  .rm-chat {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-bg-elevated);
    overflow: hidden;
  }
  .rm-messages {
    min-height: 12rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .rm-msg {
    padding: 0.5rem 0.75rem;
    border-radius: var(--rm-radius);
    background: var(--rm-bg);
  }
  .rm-msg[data-role="assistant"] {
    background: var(--rm-border);
  }
  .rm-msg-role {
    font-size: 0.75rem;
    color: var(--rm-text-muted);
    display: block;
    margin-bottom: 0.25rem;
  }
  .rm-form {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem;
    border-top: 1px solid var(--rm-border);
  }
  .rm-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-bg);
    color: var(--rm-text);
    font: inherit;
  }
  .rm-btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: var(--rm-radius);
    background: var(--rm-accent);
    color: var(--rm-bg);
    font: inherit;
    font-weight: 500;
    cursor: pointer;
  }
  .rm-btn:hover {
    background: var(--rm-accent-hover);
  }
</style>
