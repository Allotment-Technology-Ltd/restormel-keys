<script lang="ts">
  import { onMount } from "svelte";
  import { createKeys, openaiProvider, anthropicProvider } from "@restormel/keys";
  import { KeyManager, ModelSelector } from "@restormel/keys-svelte";
  import "@restormel/keys-svelte/theme.css";

  const providers = [openaiProvider, anthropicProvider];
  const API = "/api/keys";
  const userId = "demo-user";

  let keys = $state(createKeys({ keys: [], routing: { defaultProvider: "openai" } }, { providers }));
  let keysList = $state<{ id?: string; provider: string; label?: string }[]>([]);

  async function loadKeys() {
    try {
      const r = await fetch(API, { headers: { "x-user-id": userId } });
      const d = await r.json();
      keysList = Array.isArray(d.keys) ? d.keys : [];
      keys = createKeys(
        { keys: keysList, routing: { defaultProvider: "openai" } },
        { providers }
      );
    } catch {
      keysList = [];
    }
  }

  onMount(() => {
    loadKeys();
  });

  async function onKeyAdded(key: { id?: string; provider: string; label?: string }, apiKey?: string) {
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify({
        provider: key.provider,
        apiKey,
        id: key.id,
      }),
    });
    await loadKeys();
  }

  async function onKeyRemoved(keyId: string) {
    await fetch(`${API}/${keyId}`, { method: "DELETE", headers: { "x-user-id": userId } });
    await loadKeys();
  }
</script>

<main class="rm-settings">
  <h1 class="rm-page-title">Settings</h1>
  <section class="rm-section">
    <KeyManager
      {keys}
      {userId}
      {providers}
      onKeyAdded={onKeyAdded}
      onKeyRemoved={onKeyRemoved}
    />
  </section>
  <section class="rm-section">
    <h2 class="rm-heading">Models</h2>
    <ModelSelector {keys} {providers} onSelect={(modelId, providerId) => console.log("Selected", modelId, providerId)} />
  </section>
</main>

<style>
  .rm-settings {
    max-width: 40rem;
    margin: 0 auto;
    padding: 2rem 1.5rem;
  }
  .rm-page-title {
    margin: 0 0 1.5rem;
    font-size: 1.5rem;
    color: var(--rm-text);
  }
  .rm-section {
    margin-bottom: 2rem;
  }
  .rm-heading {
    margin: 0 0 0.75rem;
    font-size: 1.125rem;
    color: var(--rm-text-muted);
  }
</style>
