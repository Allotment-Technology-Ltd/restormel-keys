<script lang="ts">
  import type { KeysInstance } from "@restormel/keys";
  import type { KeyConfig, KeyRecord, KeyAddResult, KeyRemoveResult } from "@restormel/keys";
  import type { ProviderDefinition, ProviderValidationResult } from "@restormel/keys";
  import { getProviderIcon } from "./icons.js";

  interface Props {
    keys: KeysInstance;
    userId: string;
    /**
     * Called when a key is added. Return a promise to enable async persistence:
     * the component shows a saving state and only closes on success.
     * Return { ok: true, savedKey? } on success, { ok: false, error } on failure.
     * For backwards compat, returning void is treated as success.
     */
    onKeyAdded?: (key: KeyConfig, rawCredential?: string) => void | KeyAddResult | Promise<void | KeyAddResult>;
    /**
     * Called when a key is removed. Return a promise for async persistence.
     * Return { ok: true } on success, { ok: false, error } on failure.
     * Returning void is treated as success.
     */
    onKeyRemoved?: (keyId: string) => void | KeyRemoveResult | Promise<void | KeyRemoveResult>;
    /**
     * Host-driven validation. If provided, the component calls this instead of
     * provider.validateKey. Use for server-side validation where raw credentials
     * should not be sent directly from the browser to providers.
     * Return { valid: true } or { valid: false, errors: [...] }.
     */
    onValidate?: (provider: string, rawCredential: string) => Promise<ProviderValidationResult>;
    providers?: ProviderDefinition[];
  }

  let {
    keys,
    userId,
    onKeyAdded,
    onKeyRemoved,
    onValidate,
    providers = [],
  }: Props = $props();

  type View = "empty" | "list" | "entry" | "detail";
  type EntryStep = "provider" | "test" | "saving";

  const keysList = $derived((keys.config?.keys ?? []) as KeyRecord[]);
  let view = $state<View>("list");
  let expandedId = $state<string | null>(null);
  let entryProvider = $state<string>("");
  let entryStep = $state<EntryStep>("provider");
  let entryError = $state<string | null>(null);
  let entryBusy = $state(false);
  let announceLive = $state("");

  let removingId = $state<string | null>(null);
  let removeError = $state<string | null>(null);
  let revalidatingId = $state<string | null>(null);

  const showEmpty = $derived(keysList.length === 0 && view !== "entry");
  const showEntry = $derived(view === "entry");
  const showList = $derived(keysList.length > 0 && view !== "entry");

  function maskKey(label?: string): string {
    if (label && /^[\w-]+$/.test(label)) return label;
    return "••••••••";
  }

  function getStatusLabel(status?: string): string {
    switch (status) {
      case "pending_validation": return "Pending";
      case "invalid": return "Invalid";
      case "revoked": return "Revoked";
      case "active": return "Active";
      default: return "Active";
    }
  }

  function getStatusClass(status?: string): string {
    switch (status) {
      case "pending_validation": return "rk-status-pending";
      case "invalid": return "rk-status-invalid";
      case "revoked": return "rk-status-revoked";
      case "active": return "rk-status-active";
      default: return "rk-status-active";
    }
  }

  function formatTime(iso?: string): string {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  }

  function openEntry() {
    view = "entry";
    entryStep = "provider";
    entryProvider = providers.length ? providers[0].id : "";
    entryError = null;
    announceLive = "";
  }

  function closeEntry() {
    view = "list";
    entryStep = "provider";
    entryError = null;
    entryBusy = false;
  }

  function getProviderDef(id: string): ProviderDefinition | undefined {
    return providers.find((p) => p.id === id || p.aliases?.includes(id));
  }

  async function validateAndSave() {
    const raw = (document.getElementById("rk-key-input") as HTMLInputElement | null)?.value?.trim();
    if (!raw || !entryProvider) {
      entryError = "Enter your provider credential and select a provider.";
      return;
    }
    const def = getProviderDef(entryProvider);
    if (!def && !onValidate) {
      entryError = "Unknown provider. Supply a custom provider definition or use onValidate for host-driven validation.";
      return;
    }
    entryBusy = true;
    entryError = null;
    announceLive = "Validating your credential…";
    try {
      const result: ProviderValidationResult = onValidate
        ? await onValidate(entryProvider, raw)
        : await def!.validateKey(raw);

      if (!result.valid) {
        entryError = result.errors?.join(" ") ?? "Credential validation failed.";
        announceLive = entryError;
        entryBusy = false;
        return;
      }

      announceLive = "Credential validated. Saving…";
      entryStep = "saving";
      const id = crypto.randomUUID?.() ?? `key-${Date.now()}`;
      const keyConfig: KeyConfig & { id?: string } = {
        id,
        provider: entryProvider,
        label: maskKey(),
      };

      const hostResult = await onKeyAdded?.(keyConfig, raw);
      if (hostResult && typeof hostResult === "object" && "ok" in hostResult) {
        if (!hostResult.ok) {
          entryError = hostResult.error ?? "Failed to save credential.";
          entryStep = "provider";
          announceLive = entryError;
          entryBusy = false;
          return;
        }
      }

      announceLive = "Credential added.";
      closeEntry();
    } catch (e) {
      entryError = e instanceof Error ? e.message : "Validation failed.";
      entryStep = "provider";
      announceLive = entryError;
    } finally {
      entryBusy = false;
    }
  }

  async function removeKey(keyId: string) {
    removingId = keyId;
    removeError = null;
    announceLive = "Removing credential…";
    try {
      const hostResult = await onKeyRemoved?.(keyId);
      if (hostResult && typeof hostResult === "object" && "ok" in hostResult) {
        if (!hostResult.ok) {
          removeError = hostResult.error ?? "Failed to remove credential.";
          announceLive = removeError;
          removingId = null;
          return;
        }
      }
      expandedId = null;
      announceLive = "Credential removed.";
    } catch (e) {
      removeError = e instanceof Error ? e.message : "Remove failed.";
      announceLive = removeError;
    } finally {
      removingId = null;
    }
  }

  async function revalidateKey(keyId: string, provider: string) {
    if (!onValidate) return;
    revalidatingId = keyId;
    announceLive = "Revalidating credential…";
    try {
      await onValidate(provider, "");
      announceLive = "Revalidation requested.";
    } catch {
      announceLive = "Revalidation failed.";
    } finally {
      revalidatingId = null;
    }
  }

  function toggleDetail(id: string) {
    expandedId = expandedId === id ? null : id;
    removeError = null;
  }

</script>

<div class="rk-keys rk-dark" role="region" aria-label="Provider credentials">
  <div aria-live="polite" aria-atomic="true" class="rk-sr-only">{announceLive}</div>

  {#if showEmpty}
    <div class="rk-empty">
      <p class="rk-empty-text">No provider credentials yet. Add your first credential to get started.</p>
      <button
        type="button"
        class="rk-btn rk-btn-primary"
        onclick={openEntry}
        aria-label="Add your first provider credential"
      >
        Add credential
      </button>
    </div>
  {:else if showEntry}
    <div
      class="rk-entry"
      role="dialog"
      aria-labelledby="rk-entry-heading"
      aria-modal="true"
      tabindex="-1"
      onkeydown={(e) => e.key === "Escape" && !entryBusy && (e.preventDefault(), closeEntry())}
    >
      <h2 id="rk-entry-heading" class="rk-heading">Add provider credential</h2>
      {#if entryStep === "provider" || entryStep === "saving"}
        <div class="rk-form">
          {#if providers.length > 0}
            <label for="rk-provider-select" class="rk-label">Provider</label>
            <select
              id="rk-provider-select"
              class="rk-select"
              bind:value={entryProvider}
              aria-label="Select provider"
              disabled={entryBusy}
            >
              {#each providers as p}
                <option value={p.id}>{p.name}</option>
              {/each}
            </select>
          {/if}
          <label for="rk-key-input" class="rk-label">Your provider credential</label>
          <input
            id="rk-key-input"
            type="password"
            class="rk-input"
            placeholder="sk-…"
            aria-label="Provider credential (never shown in full)"
            autocomplete="off"
            disabled={entryBusy}
          />
          {#if entryError}
            <p class="rk-error" role="alert">{entryError}</p>
          {/if}
          <div class="rk-actions">
            <button
              type="button"
              class="rk-btn rk-btn-secondary"
              onclick={closeEntry}
              disabled={entryBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              class="rk-btn rk-btn-primary"
              onclick={validateAndSave}
              disabled={entryBusy}
              aria-busy={entryBusy}
              aria-label={entryBusy ? (entryStep === "saving" ? "Saving…" : "Validating…") : "Validate and save credential"}
            >
              {#if entryBusy}
                {entryStep === "saving" ? "Saving…" : "Validating…"}
              {:else}
                Validate and save
              {/if}
            </button>
          </div>
        </div>
      {/if}
    </div>
  {:else if showList}
    <div class="rk-list">
      <div class="rk-list-header">
        <h2 class="rk-heading">Your credentials</h2>
        <button
          type="button"
          class="rk-btn rk-btn-primary"
          onclick={openEntry}
          aria-label="Add another provider credential"
        >
          Add credential
        </button>
      </div>
      <ul class="rk-list-ul" role="list">
        {#each keysList as key (key.id ?? key.provider)}
          {@const id = key.id ?? key.provider}
          {@const isExpanded = expandedId === id}
          {@const def = getProviderDef(key.provider)}
          {@const isRemoving = removingId === id}
          <li class="rk-list-item">
            <div
              class="rk-list-row"
              role="button"
              tabindex="0"
              aria-expanded={isExpanded}
              aria-controls="rk-detail-{id}"
              id="rk-row-{id}"
              onclick={() => toggleDetail(id)}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleDetail(id);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  expandedId = null;
                }
              }}
            >
              <span class="rk-list-icon" aria-hidden="true">{@html getProviderIcon(key.provider, def?.icon)}</span>
              <span class="rk-list-provider">{def?.name ?? key.provider}</span>
              <span class="rk-list-masked">{maskKey(key.label)}</span>
              <span class="rk-list-status {getStatusClass(key.status)}">{getStatusLabel(key.status)}</span>
              <span class="rk-list-chevron" aria-hidden="true">{isExpanded ? "▼" : "▶"}</span>
            </div>
            {#if isExpanded}
              <div
                id="rk-detail-{id}"
                class="rk-detail"
                role="region"
                aria-labelledby="rk-row-{id}"
              >
                <dl class="rk-detail-meta">
                  <div class="rk-detail-row"><dt>Provider</dt><dd>{def?.name ?? key.provider}</dd></div>
                  <div class="rk-detail-row"><dt>Status</dt><dd class={getStatusClass(key.status)}>{getStatusLabel(key.status)}</dd></div>
                  {#if key.fingerprint}
                    <div class="rk-detail-row"><dt>Fingerprint</dt><dd class="rk-mono">{key.fingerprint}</dd></div>
                  {/if}
                  {#if key.validatedAt}
                    <div class="rk-detail-row"><dt>Last validated</dt><dd>{formatTime(key.validatedAt)}</dd></div>
                  {/if}
                  {#if key.lastError}
                    <div class="rk-detail-row rk-detail-error"><dt>Last error</dt><dd>{key.lastError}</dd></div>
                  {/if}
                </dl>
                {#if removeError && removingId === null}
                  <p class="rk-error" role="alert">{removeError}</p>
                {/if}
                <div class="rk-detail-actions">
                  {#if onValidate}
                    <button
                      type="button"
                      class="rk-btn rk-btn-secondary"
                      onclick={() => revalidateKey(id, key.provider)}
                      disabled={revalidatingId === id || isRemoving}
                      aria-busy={revalidatingId === id}
                    >
                      {revalidatingId === id ? "Revalidating…" : "Revalidate"}
                    </button>
                  {/if}
                  <button
                    type="button"
                    class="rk-btn rk-btn-danger"
                    onclick={() => removeKey(id)}
                    disabled={isRemoving}
                    aria-busy={isRemoving}
                    aria-label="Remove this provider credential"
                  >
                    {isRemoving ? "Removing…" : "Remove credential"}
                  </button>
                </div>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .rk-keys {
    font-family: var(--rk-font);
    background: var(--rk-bg);
    color: var(--rk-text);
    padding: 1rem;
    border-radius: var(--rk-radius);
    border: 1px solid var(--rk-border);
  }

  .rk-sr-only {
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

  .rk-empty {
    text-align: center;
    padding: 1.5rem;
  }

  .rk-empty-text {
    margin: 0 0 1rem;
    color: var(--rk-text-muted);
  }

  .rk-heading {
    margin: 0 0 1rem;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .rk-entry,
  .rk-list {
    margin: 0;
  }

  .rk-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 24rem;
  }

  .rk-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--rk-text-muted);
  }

  .rk-input,
  .rk-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--rk-border);
    border-radius: var(--rk-radius);
    background: var(--rk-bg-elevated);
    color: var(--rk-text);
    font: inherit;
  }

  .rk-input:focus,
  .rk-select:focus {
    outline: none;
    box-shadow: var(--rk-focus-ring);
  }

  .rk-error {
    margin: 0;
    font-size: 0.875rem;
    color: var(--rk-danger);
  }

  .rk-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .rk-btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: var(--rk-radius);
    font: inherit;
    cursor: pointer;
    font-weight: 500;
  }

  .rk-btn:focus-visible {
    outline: none;
    box-shadow: var(--rk-focus-ring);
  }

  .rk-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .rk-btn-primary {
    background: var(--rk-accent);
    color: var(--rk-bg);
  }

  .rk-btn-primary:hover:not(:disabled) {
    background: var(--rk-accent-hover);
  }

  .rk-btn-secondary {
    background: var(--rk-bg-elevated);
    color: var(--rk-text);
    border: 1px solid var(--rk-border);
  }

  .rk-btn-secondary:hover:not(:disabled) {
    background: var(--rk-bg-hover);
  }

  .rk-btn-danger {
    background: transparent;
    color: var(--rk-danger);
    border: 1px solid var(--rk-danger);
  }

  .rk-btn-danger:hover:not(:disabled) {
    background: var(--rk-danger);
    color: var(--rk-bg);
  }

  .rk-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .rk-list-ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .rk-list-item {
    margin-bottom: 0.25rem;
    border: 1px solid var(--rk-border);
    border-radius: var(--rk-radius);
    background: var(--rk-bg-elevated);
  }

  .rk-list-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    cursor: pointer;
  }

  .rk-list-row:hover {
    background: var(--rk-bg-hover);
  }

  .rk-list-row:focus-visible {
    outline: none;
    box-shadow: var(--rk-focus-ring);
  }

  .rk-list-icon {
    width: 1.25rem;
    height: 1.25rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .rk-list-icon :global(svg) {
    width: 100%;
    height: 100%;
  }

  .rk-list-provider {
    font-weight: 500;
    min-width: 5rem;
  }

  .rk-list-masked {
    color: var(--rk-text-muted);
    font-family: ui-monospace, monospace;
  }

  .rk-list-status {
    font-size: 0.75rem;
    margin-left: auto;
  }

  .rk-status-active { color: var(--rk-success); }
  .rk-status-pending { color: var(--rk-amber); }
  .rk-status-invalid { color: var(--rk-danger); }
  .rk-status-revoked { color: var(--rk-text-muted); text-decoration: line-through; }

  .rk-list-chevron {
    color: var(--rk-text-muted);
    font-size: 0.75rem;
  }

  .rk-detail {
    padding: 0 1rem 1rem;
    border-top: 1px solid var(--rk-border);
    padding-top: 0.75rem;
  }

  .rk-detail-meta {
    margin: 0 0 0.75rem;
    font-size: 0.875rem;
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }

  .rk-detail-row {
    display: flex;
    gap: 0.5rem;
  }

  .rk-detail-row dt {
    color: var(--rk-text-muted);
    min-width: 7rem;
    flex-shrink: 0;
  }

  .rk-detail-row dd {
    margin: 0;
    color: var(--rk-text);
  }

  .rk-detail-error dd {
    color: var(--rk-danger);
  }

  .rk-mono {
    font-family: ui-monospace, monospace;
    font-size: 0.8em;
  }

  .rk-detail-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
</style>
