<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { invalidateAll } from "$app/navigation";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import type { IntegrationSummary } from "./+page.server";

  export let data: {
    integrations: IntegrationSummary[];
    error: string | null;
  };

  const PROVIDER_TYPES = [
    { value: "openai", label: "OpenAI" },
    { value: "anthropic", label: "Anthropic" },
    { value: "google", label: "Google" },
    { value: "other", label: "Other" },
  ];

  let connecting = false;
  let connectError = "";
  let providerType = "openai";
  let otherProviderType = "";
  let displayName = "";
  let credentialRef = "";

  $: effectiveProviderType = providerType === "other" ? otherProviderType.trim() : providerType;

  async function connectProvider() {
    const type = effectiveProviderType;
    if (!type) {
      connectError = "Select or enter a provider type.";
      return;
    }
    connecting = true;
    connectError = "";
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/integrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerType: type,
          displayName: displayName.trim() || undefined,
          credentialRef: credentialRef.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.data?.id) {
        await invalidateAll();
        window.location.href = `${DASHBOARD_BASE}/integrations/${body.data.id}`;
      } else {
        connectError = (body as { error?: string }).error ?? `Request failed (${res.status})`;
      }
    } catch (e) {
      connectError = e instanceof Error ? e.message : "Request failed";
    } finally {
      connecting = false;
    }
  }

  function formatLastVerified(ts: number | null): string {
    if (ts == null) return "Never";
    return new Date(ts).toLocaleString();
  }
</script>

<h1 class="page-title">Provider Integrations</h1>
<p class="page-desc">
  Connect provider credentials (e.g. OpenAI, Anthropic) to your workspace. Each integration stores a credential reference only; secrets stay in your own store. Bind integrations to projects so routes can use them.
</p>

{#if data.error}
  <p class="error-msg" role="alert">{data.error}</p>
{:else}
  <section class="section" aria-labelledby="connect-heading">
    <h2 id="connect-heading" class="section-title">Connect a provider</h2>
    <p class="section-desc">
      Add a new provider integration. You can set a display name and an optional credential reference (e.g. secret manager key). Do not paste raw API keys here.
    </p>
    {#if connectError}
      <p class="error-msg" role="alert">{connectError}</p>
    {/if}
    <form class="connect-form" onsubmit={(e) => { e.preventDefault(); connectProvider(); }}>
      <div class="form-row">
        <label for="provider-type">Provider type</label>
        <select id="provider-type" bind:value={providerType} class="input">
          {#each PROVIDER_TYPES as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>
      {#if providerType === "other"}
        <div class="form-row">
          <label for="other-type">Provider name (e.g. openai, anthropic)</label>
          <input id="other-type" type="text" bind:value={otherProviderType} class="input" placeholder="e.g. openai" />
        </div>
      {/if}
      <div class="form-row">
        <label for="display-name">Display name (optional)</label>
        <input id="display-name" type="text" bind:value={displayName} class="input" placeholder="e.g. Production OpenAI" />
      </div>
      <div class="form-row">
        <label for="credential-ref">Credential reference (optional)</label>
        <input id="credential-ref" type="text" bind:value={credentialRef} class="input" placeholder="e.g. secret key id — never paste raw keys" autocomplete="off" />
      </div>
      <button type="submit" class="btn btn-primary" disabled={connecting}>
        {connecting ? "Connecting…" : "Connect provider"}
      </button>
    </form>
  </section>

  <section class="section" aria-labelledby="list-heading">
    <h2 id="list-heading" class="section-title">Your integrations</h2>
    {#if data.integrations.length === 0}
      <EmptyState
        title="No provider integrations yet"
        description="Connect a provider above. Each integration is a credential reference (no raw keys stored here)."
      >
        <a href="#connect-heading" class="btn btn-primary">Connect a provider</a>
      </EmptyState>
    {:else}
      <ul class="integration-list">
        {#each data.integrations as int}
          <li class="integration-row">
            <a href={DASHBOARD_BASE + "/integrations/" + int.id} class="integration-link">
              <span class="int-name">{int.displayName || int.providerType}</span>
              <span class="int-type">{int.providerType}</span>
              <span class="int-status">
                {int.status}
                {#if int.verificationStatus}
                  · {int.verificationStatus}
                {/if}
                {#if int.hasCredential}
                  · credential set
                {:else}
                  · no credential ref
                {/if}
              </span>
              <span class="int-verified">Last verified: {formatLastVerified(int.lastVerifiedAt)}</span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}

<style>
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
    margin: 0 0 var(--space-4);
  }
  .section {
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
  .connect-form {
    max-width: 28rem;
  }
  .form-row {
    margin-bottom: var(--space-3);
  }
  .form-row label {
    display: block;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--rm-text);
    margin-bottom: var(--space-1);
  }
  .input {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--rm-radius);
    border: 1px solid var(--rm-border);
    font-size: var(--text-sm);
    background: var(--rm-bg);
    color: var(--rm-text);
  }
  .btn {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    font-weight: 500;
    border: none;
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
  }
  .btn-primary {
    background: var(--rm-sage);
    color: var(--rm-bg);
  }
  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .error-msg {
    color: var(--coral-alert);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-2);
  }
  .integration-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .integration-row {
    border-bottom: 1px solid var(--rm-border);
  }
  .integration-link {
    display: block;
    padding: var(--space-3) 0;
    text-decoration: none;
    color: inherit;
  }
  .integration-link:hover {
    background: var(--rm-surface-raised);
  }
  .int-name {
    font-weight: 600;
    font-size: var(--text-sm);
    color: var(--rm-text);
    display: block;
  }
  .int-type {
    font-size: var(--text-xs);
    color: var(--rm-muted);
    text-transform: lowercase;
  }
  .int-status, .int-verified {
    font-size: var(--text-xs);
    color: var(--rm-dim);
    display: block;
    margin-top: var(--space-1);
  }
</style>
