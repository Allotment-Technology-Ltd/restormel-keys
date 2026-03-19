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
    { value: "openrouter", label: "OpenRouter (gateway)" },
    { value: "vercel_ai_gateway", label: "Vercel AI Gateway (gateway)" },
    { value: "portkey", label: "Portkey (gateway)" },
    { value: "openai", label: "OpenAI (direct)" },
    { value: "anthropic", label: "Anthropic (direct)" },
    { value: "google", label: "Google (direct)" },
    { value: "other", label: "Other" },
  ];

  let connecting = false;
  let connectError = "";
  let providerType = "openai";
  let otherProviderType = "";
  let displayName = "";
  let credentialRef = "";

  $: effectiveProviderType = providerType === "other" ? otherProviderType.trim() : providerType;

  function startJourney(kind: "openrouter" | "vercel_ai_gateway" | "portkey" | "direct") {
    connectError = "";
    if (kind === "openrouter") {
      providerType = "openrouter";
      displayName = "OpenRouter";
      credentialRef = "";
    } else if (kind === "vercel_ai_gateway") {
      providerType = "vercel_ai_gateway";
      displayName = "Vercel AI Gateway";
      credentialRef = "";
    } else if (kind === "portkey") {
      providerType = "portkey";
      displayName = "Portkey";
      credentialRef = "";
    } else {
      providerType = "openai";
      displayName = "Direct providers (env/secrets)";
      credentialRef = "";
    }
    document.getElementById("connect-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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

<h1 class="page-title">Provider Access</h1>
<p class="page-desc">
  Connect your <strong>provider access layer</strong> (gateway-backed or direct) to Restormel so routes and policies can reference it. Provider access entries store references/metadata only — don’t paste raw secrets here.
</p>

{#if data.error}
  <p class="error-msg" role="alert">{data.error}</p>
{:else}
  <section class="section" aria-labelledby="journeys-heading">
    <h2 id="journeys-heading" class="section-title">Integration journeys</h2>
    <p class="section-desc">
      Pick the journey that matches how your stack reaches providers. Each one explains what Restormel adds (routing, policies, health, analytics, UX) without forcing you to replace your gateway or secret management.
    </p>
    <div class="journeys-grid">
      <div class="journey-card">
        <h3 class="journey-title">OpenRouter</h3>
        <p class="journey-desc">Keep OpenRouter as execution. Use Restormel for routes, policies, fallbacks, health checks, and dashboard governance.</p>
        <div class="journey-actions">
          <button type="button" class="btn btn-secondary" onclick={() => startJourney("openrouter")}>Start</button>
          <a class="btn-link" href="/keys/docs/guides/openrouter" target="_blank" rel="noopener noreferrer">Guide →</a>
        </div>
      </div>
      <div class="journey-card">
        <h3 class="journey-title">Vercel AI Gateway</h3>
        <p class="journey-desc">Keep Vercel gateway auth/observability. Let Restormel control routing policies and progressive adoption.</p>
        <div class="journey-actions">
          <button type="button" class="btn btn-secondary" onclick={() => startJourney("vercel_ai_gateway")}>Start</button>
          <a class="btn-link" href="/keys/docs/guides/vercel-ai-gateway" target="_blank" rel="noopener noreferrer">Guide →</a>
        </div>
      </div>
      <div class="journey-card">
        <h3 class="journey-title">Portkey</h3>
        <p class="journey-desc">Keep Portkey as the gateway. Use Restormel for explicit routes/policies and fallback governance.</p>
        <div class="journey-actions">
          <button type="button" class="btn btn-secondary" onclick={() => startJourney("portkey")}>Start</button>
          <a class="btn-link" href="/keys/docs/guides/portkey" target="_blank" rel="noopener noreferrer">Guide →</a>
        </div>
      </div>
      <div class="journey-card">
        <h3 class="journey-title">Direct providers</h3>
        <p class="journey-desc">Keep provider keys in env/secrets manager. Restormel resolves route/provider/model decisions and enforces policies.</p>
        <div class="journey-actions">
          <button type="button" class="btn btn-secondary" onclick={() => startJourney("direct")}>Start</button>
          <a class="btn-link" href="/keys/docs/guides/provider-access-modes" target="_blank" rel="noopener noreferrer">Modes →</a>
        </div>
      </div>
    </div>
  </section>

  <section class="section" aria-labelledby="connect-heading">
    <h2 id="connect-heading" class="section-title">Connect an integration</h2>
    <p class="section-desc">
      Add a new integration. Use <strong>Credential reference</strong> for an identifier in your gateway/secrets manager (no raw keys). Then bind the integration to projects so routes can use it.
    </p>
    {#if connectError}
      <p class="error-msg" role="alert">{connectError}</p>
    {/if}
    <form class="connect-form" onsubmit={(e) => { e.preventDefault(); connectProvider(); }}>
      <div class="form-row">
        <label for="provider-type">Integration type</label>
        <select id="provider-type" bind:value={providerType} class="input">
          {#each PROVIDER_TYPES as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>
      {#if providerType === "other"}
        <div class="form-row">
          <label for="other-type">Integration name (e.g. openrouter, openai)</label>
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
        {connecting ? "Connecting…" : "Connect integration"}
      </button>
    </form>
  </section>

  <section class="section" aria-labelledby="list-heading">
    <h2 id="list-heading" class="section-title">Your integrations</h2>
    {#if data.integrations.length === 0}
      <EmptyState
        title="No integrations yet"
        description="Start with a journey above, or connect an integration below. Restormel stores references/metadata only (no raw secrets)."
      >
        <a href="#journeys-heading" class="btn btn-primary">Choose a journey</a>
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
  .btn-secondary {
    background: var(--rm-surface);
    color: var(--rm-text);
    border: 1px solid var(--rm-border);
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

  .journeys-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--space-4);
    margin-top: var(--space-3);
  }
  .journey-card {
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface-raised);
    padding: var(--space-4);
  }
  .journey-title {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--rm-text);
  }
  .journey-desc {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .journey-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .btn-link {
    font-size: var(--text-sm);
    color: var(--rm-sage);
    text-decoration: none;
    font-weight: 500;
  }
  .btn-link:hover {
    text-decoration: underline;
  }
</style>
