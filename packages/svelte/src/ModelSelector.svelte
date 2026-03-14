<script lang="ts">
  import type { KeysInstance } from "@restormel/keys";
  import type { ProviderDefinition } from "@restormel/keys";
  import { NO_KEY_AVAILABLE } from "@restormel/keys";
  import { getProviderIcon } from "./icons.js";

  interface Props {
    keys: KeysInstance;
    providers: ProviderDefinition[];
    onSelect?: (modelId: string, providerId: string) => void;
  }

  let { keys, providers, onSelect }: Props = $props();

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
    loading = true;
    const entries: Array<{ key: string; p: ProviderDefinition; modelId: string }> = [];
    for (const p of pr) {
      for (const modelId of p.models) {
        entries.push({ key: `${p.id}:${modelId}`, p, modelId });
      }
    }
    if (entries.length === 0) {
      availabilityMap = {};
      loading = false;
      return;
    }
    Promise.all(
      entries.map(({ key, p, modelId }) =>
        k.resolve(p.id, modelId)
          .then(() => ({ key, available: true as const, reason: undefined }))
          .catch((err: Error) => ({
            key,
            available: false as const,
            reason: err?.message === NO_KEY_AVAILABLE ? "No API key" : "Unavailable",
          }))
      )
    ).then((results) => {
      const map: Record<string, { available: boolean; reason?: string }> = {};
      for (const r of results) {
        map[r.key] = { available: r.available, reason: r.reason };
      }
      availabilityMap = map;
      loading = false;
    });
  });

  function handleSelect(modelId: string, providerId: string) {
    onSelect?.(modelId, providerId);
  }
</script>

<div class="rk-model-selector rk-dark" role="region" aria-label="Model selection">
  {#if loading}
    <p class="rk-model-loading" aria-live="polite">Loading availability…</p>
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
              {@const key = `${group.providerId}:${m.modelId}`}
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
