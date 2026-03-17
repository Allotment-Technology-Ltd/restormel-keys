<script lang="ts">
  import { createKeys, openaiProvider, anthropicProvider } from "@restormel/keys";
  import type { KeyConfig, ProviderDefinition } from "@restormel/keys";
  import { KeyManager, ModelSelector } from "@restormel/keys-svelte";
  import "@restormel/keys-svelte/theme.css";

  const providers = [openaiProvider, anthropicProvider];
  const PROVIDER_MAP: Record<string, ProviderDefinition> = {
    openai: openaiProvider,
    anthropic: anthropicProvider,
  };

  /** In-memory key list for this sandbox session; never persisted. */
  let keysList = $state<(KeyConfig & { id?: string })[]>([]);
  let keys = $state(
    createKeys(
      { keys: keysList, routing: { defaultProvider: "openai" } },
      { providers }
    )
  );
  /** Raw credentials in memory only, for running validate in-browser; never displayed or sent. */
  let sandboxRawByKeyId = $state<Record<string, string>>({});
  /** Sandbox user id for labels only; keys are in-memory. */
  const sandboxUserId = "sandbox-user";

  function syncKeysFromList(list: (KeyConfig & { id?: string })[]) {
    keysList = list;
    keys = createKeys(
      { keys: list, routing: { defaultProvider: "openai" } },
      { providers }
    );
  }

  function onKeyAdded(key: KeyConfig & { id?: string }, rawCredential?: string) {
    const id = key.id ?? crypto.randomUUID?.() ?? `key-${Date.now()}`;
    const keyWithId = { ...key, id };
    const next = [...keysList, keyWithId];
    syncKeysFromList(next);
    if (typeof rawCredential === "string" && rawCredential.trim()) {
      sandboxRawByKeyId = { ...sandboxRawByKeyId, [id]: rawCredential };
    }
  }

  function onKeyRemoved(keyId: string) {
    syncKeysFromList(keysList.filter((k) => (k as KeyConfig & { id?: string }).id !== keyId));
    const next = { ...sandboxRawByKeyId };
    delete next[keyId];
    sandboxRawByKeyId = next;
  }

  function onModelSelect(modelId: string, providerId: string) {
    selectedModel = { modelId, providerId };
  }

  let selectedModel = $state<{ modelId: string; providerId: string } | null>(null);

  // —— Doctor panel: copy command
  const doctorCommand = "npx @restormel/keys-cli doctor";
  let doctorCopied = $state(false);
  async function copyDoctorCommand() {
    try {
      await navigator.clipboard.writeText(doctorCommand);
      doctorCopied = true;
      setTimeout(() => (doctorCopied = false), 2000);
    } catch {
      doctorCopied = false;
    }
  }

  // —— Framework snippet for Doctor
  let doctorFramework = $state<"sveltekit" | "next">("sveltekit");
  const doctorSnippets: Record<string, { install: string; note: string }> = {
    sveltekit: {
      install: "pnpm add @restormel/keys @restormel/keys-svelte",
      note: "Then add KeyManager and ModelSelector to a settings or sandbox page; keys can be stored via your API.",
    },
    next: {
      install: "pnpm add @restormel/keys @restormel/keys-react",
      note: "Use a client component for KeyManager; keep KeysProvider and key UI inside \"use client\".",
    },
  };

  // —— Validate panel: run validation on in-memory keys
  type ValidateResult = { keyId: string; provider: string; valid: boolean; error?: string };
  let validateResults = $state<ValidateResult[] | null>(null);
  let validateRunning = $state(false);
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
        results.push({
          keyId: id,
          provider: k.provider,
          valid: r.valid,
          error: r.errors?.[0],
        });
      } catch (e) {
        results.push({
          keyId: id,
          provider: k.provider,
          valid: false,
          error: e instanceof Error ? e.message : "Validation failed",
        });
      }
    }
    validateResults = results;
    validateRunning = false;
  }
  const validateAllValid = $derived(
    validateResults !== null && validateResults.length > 0 && validateResults.every((r) => r.valid)
  );
  const validateAnyInvalid = $derived(
    validateResults !== null && validateResults.some((r) => !r.valid)
  );

  /** Mask key id for display (e.g. key-1234 → …1234). */
  function maskId(id: string): string {
    if (id.length <= 6) return "••••";
    return "…" + id.slice(-4);
  }
</script>

<main class="sandbox" aria-labelledby="sandbox-heading">
  <h1 id="sandbox-heading" class="page-title">Sandbox</h1>
  <p class="page-desc">
    Try the embeddable KeyManager and ModelSelector here. Keys and selections are kept in memory only and are not saved.
  </p>

  <section class="panel" aria-labelledby="embed-heading">
    <h2 id="embed-heading" class="section-title">Embeddable UI preview</h2>
    <p class="section-desc">
      This is the same KeyManager and ModelSelector you can embed in your app. Add keys below to see model availability.
    </p>
    <div class="embed-preview">
      <KeyManager
        {keys}
        userId={sandboxUserId}
        {providers}
        onKeyAdded={onKeyAdded}
        onKeyRemoved={onKeyRemoved}
      />
      <div class="rm-section">
        <h3 class="rm-heading">Models</h3>
        <ModelSelector {keys} {providers} onSelect={onModelSelect} />
        {#if selectedModel}
          <p class="selected-model" role="status">
            Selected: <strong>{selectedModel.modelId}</strong> ({selectedModel.providerId})
          </p>
        {/if}
      </div>
    </div>
  </section>

  <section class="panel" aria-labelledby="doctor-heading">
    <h2 id="doctor-heading" class="section-title">Doctor preview</h2>
    <p class="section-desc">
      <code>keys doctor</code> checks framework detection, config file, suggested packages, and stored keys. Run it in your project root.
    </p>
    <div class="copy-row">
      <code class="code-block">{doctorCommand}</code>
      <button
        type="button"
        class="btn btn-secondary"
        onclick={copyDoctorCommand}
        aria-label="Copy doctor command"
      >
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
    <h2 id="validate-heading" class="section-title">Validate preview</h2>
    <p class="section-desc">
      Re-validate the keys you added above. Same semantics as <code>keys validate</code> (exit 0 if all valid, 1 if any invalid). Results use masked identifiers only.
    </p>
    {#if keysList.length === 0}
      <p class="empty-hint">Add keys in the Embeddable UI preview above, then run Validate.</p>
    {:else}
      <button
        type="button"
        class="btn btn-primary"
        onclick={runValidate}
        disabled={validateRunning}
        aria-busy={validateRunning}
      >
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
                  {#if r.error}
                    <span class="validate-error">{r.error}</span>
                  {/if}
                {/if}
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    {/if}
  </section>
</main>

<style>
  .sandbox {
    max-width: 44rem;
  }
  .page-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .page-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-6);
  }
  .panel {
    margin-bottom: var(--space-6);
  }
  .section-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-1);
  }
  .section-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-3);
  }
  .embed-preview {
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-4);
  }
  .rm-section {
    margin-top: var(--space-4);
  }
  .rm-heading {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .selected-model {
    margin: var(--space-2) 0 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .selected-model strong {
    color: var(--rm-text);
  }
  .copy-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-bottom: var(--space-3);
  }
  .code-block {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    padding: var(--space-2) var(--space-3);
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
  }
  .btn {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    font-weight: 500;
    border: none;
    cursor: pointer;
  }
  .btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .btn-primary {
    background: var(--rm-sage);
    color: var(--rm-bg);
  }
  .btn-secondary {
    background: var(--rm-surface-raised);
    color: var(--rm-text);
    border: 1px solid var(--rm-border);
  }
  .doctor-snippet {
    margin-top: var(--space-3);
  }
  .snippet-label {
    display: block;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--rm-text);
    margin-bottom: var(--space-1);
  }
  .input {
    width: 100%;
    max-width: 16rem;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--rm-radius);
    border: 1px solid var(--rm-border);
    font-size: var(--text-sm);
    background: var(--rm-bg);
    color: var(--rm-text);
    margin-bottom: var(--space-2);
  }
  .snippet-install {
    margin: var(--space-2) 0;
    font-size: var(--text-sm);
  }
  .snippet-install code {
    font-family: var(--rm-font-ui);
    padding: 0.15em 0.4em;
    background: var(--rm-surface);
    border-radius: var(--rm-radius);
  }
  .snippet-note {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0;
  }
  .empty-hint {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-3);
  }
  .validate-results {
    margin-top: var(--space-4);
  }
  .validate-summary {
    font-weight: 600;
    font-size: var(--text-sm);
    margin: 0 0 var(--space-2);
  }
  .validate-ok {
    color: var(--rm-sage);
  }
  .validate-fail {
    color: var(--coral-alert, #c95c5c);
  }
  .validate-list {
    list-style: none;
    padding: 0;
    margin: 0;
    font-size: var(--text-sm);
  }
  .validate-list li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-bottom: var(--space-1);
  }
  .validate-provider {
    font-weight: 500;
    min-width: 5rem;
  }
  .validate-mask {
    font-family: var(--rm-font-ui);
    color: var(--rm-muted);
  }
  .validate-status {
    font-weight: 500;
  }
  .validate-error {
    color: var(--rm-muted);
    font-size: var(--text-xs);
  }
</style>
