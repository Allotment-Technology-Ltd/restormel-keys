<script lang="ts">
  import { untrack } from "svelte";
  import type { KeysInstance } from "@restormel/keys";
  import type { ProviderDefinition } from "@restormel/keys";
  import { NO_KEY_AVAILABLE } from "@restormel/keys";
  import { getProviderIcon } from "./icons.js";
  import { RESTORMEL_BACKEND_ERROR_MESSAGE, type ModelSelectorHostStatus } from "./types.js";

  interface Props {
    keys: KeysInstance;
    providers: ProviderDefinition[];
    onSelect?: (modelId: string, providerId: string) => void;
    /**
     * Surface state for host banners and retry UX.
     * `degraded` = loaded but no model is available (policy + credentials).
     */
    onStatusChange?: (status: ModelSelectorHostStatus, message?: string) => void;
    errorMessage?: string;
    emptyMessage?: string;
    /**
     * Optional server-built map (`providerId:modelId` → availability).
     * When set, policy-blocked rows skip resolve; allowed rows still resolve for BYOK.
     */
    policyAvailability?: Record<
      string,
      { available: boolean; reason?: string; enforcement?: "hard" | "soft" }
    > | null;
    /** Bump to reload availability from the host (e.g. after policy refresh). */
    retryNonce?: number;
    /** Called when the user activates in-component Retry (after internal reload). */
    onRetry?: () => void;
  }

  let {
    keys,
    providers,
    onSelect,
    onStatusChange,
    errorMessage,
    emptyMessage,
    policyAvailability = null,
    retryNonce = 0,
    onRetry,
  }: Props = $props();

  interface ModelAvailability {
    modelId: string;
    available: boolean;
    reason?: string;
  }

  interface Group {
    providerId: string;
    providerName: string;
    models: ModelAvailability[];
  }

  let availabilityMap = $state<Record<string, { available: boolean; reason?: string }>>({});
  let loading = $state(true);
  let error = $state<string | null>(null);
  let internalRetry = $state(0);
  let lastStatus = $state<ModelSelectorHostStatus | null>(null);

  function notifyStatus(status: ModelSelectorHostStatus, message?: string) {
    untrack(() => {
      if (lastStatus !== status || message !== undefined) {
        lastStatus = status;
        onStatusChange?.(status, message);
      }
    });
  }

  const isEmpty = $derived(
    providers.length === 0 || providers.every((p) => !p.models?.length)
  );

  const groups = $derived((): Group[] => {
    return providers.map((p) => ({
      providerId: p.id,
      providerName: p.name,
      models: p.models.map((modelId) => {
        const key = `${p.id}:${modelId}`;
        const a = availabilityMap[key];
        return {
          modelId,
          available: a?.available ?? false,
          reason: a?.reason,
        };
      }),
    }));
  });

  $effect(() => {
    const k = keys;
    const pr = providers;
    const pol = policyAvailability;
    const _nonce = retryNonce;
    const _internal = internalRetry;

    let cancelled = false;
    loading = true;
    error = null;

    const entries: Array<{ key: string; p: ProviderDefinition; modelId: string }> = [];
    for (const p of pr) {
      for (const modelId of p.models) {
        entries.push({ key: `${p.id}:${modelId}`, p, modelId });
      }
    }

    if (entries.length === 0) {
      availabilityMap = {};
      loading = false;
      notifyStatus("empty", emptyMessage);
      return () => {
        cancelled = true;
      };
    }

    notifyStatus("loading");

    const map: Record<string, { available: boolean; reason?: string }> = {};
    const toResolve: typeof entries = [];

    for (const e of entries) {
      const row = pol?.[e.key];
      if (row && row.available === false) {
        if (row.enforcement === "soft") {
          // Soft policy states (e.g. transient degraded/unknown checks) still attempt local resolve.
          toResolve.push(e);
        } else {
          map[e.key] = { available: false, reason: row.reason };
        }
      } else {
        toResolve.push(e);
      }
    }

    Promise.all(
      toResolve.map(({ key, p, modelId }) =>
        k
          .resolve(p.id, modelId)
          .then(() => ({ key, available: true as const, reason: undefined as string | undefined }))
          .catch((err: Error) => ({
            key,
            available: false as const,
            reason:
              err?.message === NO_KEY_AVAILABLE ? "No provider credential" : "Unavailable",
          }))
      )
    )
      .then((results) => {
        if (cancelled) return;
        for (const r of results) {
          map[r.key] = { available: r.available, reason: r.reason };
        }
        availabilityMap = map;
        loading = false;
        const anyAvailable = Object.values(map).some((v) => v.available);
        if (anyAvailable) {
          notifyStatus("ready");
        } else {
          notifyStatus(
            "degraded",
            "No models are available with current policy or credentials."
          );
        }
      })
      .catch((err) => {
        if (cancelled) return;
        loading = false;
        const msg = errorMessage ?? RESTORMEL_BACKEND_ERROR_MESSAGE;
        error = err instanceof Error ? err.message : msg;
        notifyStatus("error", error ?? msg);
      });

    return () => {
      cancelled = true;
    };
  });

  function handleSelect(modelId: string, providerId: string) {
    onSelect?.(modelId, providerId);
  }

  function handleRetry() {
    internalRetry += 1;
    onRetry?.();
  }
</script>

<div class="rk-model-selector rk-dark" role="region" aria-label="Model selection">
  {#if loading}
    <p class="rk-model-loading" aria-live="polite">Loading availability…</p>
  {:else if error}
    <div class="rk-model-error" role="alert" aria-live="assertive">
      <p class="rk-model-error-message">{errorMessage ?? RESTORMEL_BACKEND_ERROR_MESSAGE}</p>
      <p class="rk-model-error-hint">
        Check RESTORMEL_* env and Restormel backend availability.{#if error && error !== (errorMessage ?? RESTORMEL_BACKEND_ERROR_MESSAGE)}
          {error}{/if}
      </p>
      <button type="button" class="rk-model-retry" onclick={handleRetry}>Retry</button>
    </div>
  {:else if isEmpty}
    <p class="rk-model-empty" aria-live="polite">{emptyMessage ?? "No models configured."}</p>
  {:else}
    <ul class="rk-model-groups" role="list">
      {#each groups() as group}
        <li class="rk-model-group">
          <div class="rk-model-group-head">
            <span class="rk-model-group-icon" aria-hidden="true">{@html getProviderIcon(group.providerId)}</span>
            <span class="rk-model-group-name">{group.providerName}</span>
          </div>
          <ul class="rk-model-list" role="list">
            {#each group.models as m}
              <li>
                <button
                  type="button"
                  class="rk-model-item"
                  class:rk-unavailable={!m.available}
                  onclick={() => handleSelect(m.modelId, group.providerId)}
                  disabled={!m.available}
                  aria-label="{m.modelId} ({m.available ? 'available' : m.reason ?? 'unavailable'})"
                  title={m.reason ?? undefined}
                >
                  <span class="rk-model-id">{m.modelId}</span>
                  {#if !m.available && m.reason}
                    <span class="rk-model-reason">{m.reason}</span>
                  {/if}
                </button>
              </li>
            {/each}
          </ul>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .rk-model-selector {
    font-family: var(--rk-font);
    background: var(--rk-bg);
    color: var(--rk-text);
    padding: 1rem;
    border-radius: var(--rk-radius);
    border: 1px solid var(--rk-border);
  }

  .rk-model-loading {
    margin: 0;
    color: var(--rk-text-muted);
  }

  .rk-model-error {
    padding: 0.75rem;
    background: var(--rk-bg-elevated);
    border: 1px solid var(--rk-border);
    border-radius: var(--rk-radius);
  }

  .rk-model-error-message {
    margin: 0 0 0.25rem;
    color: var(--rk-text);
    font-weight: 500;
  }

  .rk-model-error-hint {
    margin: 0 0 0.75rem;
    font-size: 0.8125rem;
    color: var(--rk-text-muted);
  }

  .rk-model-retry {
    padding: 0.4rem 0.85rem;
    border-radius: var(--rk-radius);
    border: 1px solid var(--rk-border);
    background: var(--rk-accent);
    color: var(--rk-bg);
    font: inherit;
    font-weight: 500;
    cursor: pointer;
  }

  .rk-model-retry:focus-visible {
    outline: none;
    box-shadow: var(--rk-focus-ring);
  }

  .rk-model-empty {
    margin: 0;
    color: var(--rk-text-muted);
  }

  .rk-model-groups {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .rk-model-group {
    margin-bottom: 1rem;
  }

  .rk-model-group:last-child {
    margin-bottom: 0;
  }

  .rk-model-group-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .rk-model-group-icon {
    width: 1.25rem;
    height: 1.25rem;
    display: inline-flex;
  }

  .rk-model-group-icon :global(svg) {
    width: 100%;
    height: 100%;
  }

  .rk-model-group-name {
    font-weight: 600;
    font-size: 0.875rem;
  }

  .rk-model-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .rk-model-item {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--rk-border);
    border-radius: var(--rk-radius);
    background: var(--rk-bg-elevated);
    color: var(--rk-text);
    font: inherit;
    cursor: pointer;
    font-size: 0.8125rem;
  }

  .rk-model-item:hover:not(:disabled) {
    background: var(--rk-bg-hover);
    border-color: var(--rk-accent);
  }

  .rk-model-item:focus-visible {
    outline: none;
    box-shadow: var(--rk-focus-ring);
  }

  .rk-model-item:disabled,
  .rk-model-item.rk-unavailable {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .rk-model-reason {
    font-size: 0.75rem;
    color: var(--rk-text-muted);
  }
</style>
