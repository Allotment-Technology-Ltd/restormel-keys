<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
  import { DIRECT_PROVIDER_CONNECT_CARDS } from "$lib/route-step-providers";
  import type { IntegrationSummary } from "./+page.server";

  export let data: { integrations: IntegrationSummary[]; error: string | null };

  const GATEWAY_PROVIDER_VALUES = new Set(["openrouter", "portkey", "vercel_ai_gateway"]);

  const ALL_PROVIDER_CARDS = [
    ...DIRECT_PROVIDER_CONNECT_CARDS,
    { value: "openrouter", label: "OpenRouter" },
    { value: "portkey", label: "Portkey" },
    { value: "vercel_ai_gateway", label: "Vercel AI" },
    { value: "other", label: "Other" },
  ];

  $: gatewayProvidersOn = ($page.data.moduleFlags ?? MVP_MODULE_DEFAULTS).gatewayProviders;
  $: PROVIDER_CARDS = ALL_PROVIDER_CARDS.filter(
    (card) => gatewayProvidersOn || !GATEWAY_PROVIDER_VALUES.has(card.value)
  );
  $: showGatewayJourneys = gatewayProvidersOn;

  let connecting = false;
  let connectError = "";
  let providerType = "openai";
  let otherProviderType = "";
  let displayName = "";
  let credentialRef = "";
  /** One-time hosted API key; encrypted at rest when server is configured. Cleared after successful submit. */
  let apiKey = "";

  $: effectiveProviderType = providerType === "other" ? otherProviderType.trim() : providerType;
  $: canConnect = Boolean(
    effectiveProviderType &&
      displayName.trim() &&
      (credentialRef.trim() || apiKey.trim())
  );

  function jumpToForm() {
    document.getElementById("connect-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function selectProvider(value: string) {
    providerType = value;
    if (value !== "other") otherProviderType = "";
  }

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
      displayName = "Direct providers";
      credentialRef = "";
    }
    jumpToForm();
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
          apiKey: apiKey.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.data?.id) {
        apiKey = "";
        await invalidateAll();
        window.location.href = `${DASHBOARD_BASE}/integrations/${body.data.id}`;
      } else if ((body as { error?: string }).error === "server_misconfigured") {
        connectError =
          (body as { message?: string }).message ??
          "Hosted API key storage is not configured on this deployment. Use a credential reference or contact your admin.";
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

  function integrationTone(status: string): "success" | "warning" | "error" | "muted" {
    if (status === "active") return "success";
    if (status === "paused") return "warning";
    if (status === "revoked") return "error";
    return "muted";
  }
</script>

<h1 class="page-title">Connect a Provider</h1>
<p class="page-desc">
  Connect your provider so Restormel Testing and routing can resolve models. Use <strong>Hosted API key</strong> for a key encrypted at rest (recommended for judge flows), or <strong>Credential reference</strong> for a non-secret vault label only — not both required.
</p>
<p class="page-desc">
  After you save a connection, open <a href={DASHBOARD_BASE + "/testing"}>Restormel Testing</a> for project and environment IDs and env snippets.
</p>

{#if data.error}
  <p class="error-msg" role="alert">{data.error}</p>
{:else}
  {#if data.integrations.length > 0}
    <details class="section journey-details">
      <summary>How does this work? →</summary>
      <div class="journeys-grid">
        {#if showGatewayJourneys}
        <div class="journey-card">
          <h3 class="journey-title">OpenRouter</h3>
          <p class="journey-desc">Keep OpenRouter as execution. Use Restormel for rules, guard rails, and fallbacks.</p>
          <div class="journey-actions">
            <button type="button" class="btn btn-secondary" onclick={() => startJourney("openrouter")}>Start</button>
            <a class="btn-link" href="/keys/docs/guides/openrouter" target="_blank" rel="noopener noreferrer">Guide →</a>
          </div>
        </div>
        <div class="journey-card">
          <h3 class="journey-title">Vercel AI Gateway</h3>
          <p class="journey-desc">Keep Vercel gateway auth/observability. Let Restormel handle rule governance.</p>
          <div class="journey-actions">
            <button type="button" class="btn btn-secondary" onclick={() => startJourney("vercel_ai_gateway")}>Start</button>
            <a class="btn-link" href="/keys/docs/guides/vercel-ai-gateway" target="_blank" rel="noopener noreferrer">Guide →</a>
          </div>
        </div>
        <div class="journey-card">
          <h3 class="journey-title">Portkey</h3>
          <p class="journey-desc">Keep Portkey as the gateway. Use Restormel for explicit rule and fallback governance.</p>
          <div class="journey-actions">
            <button type="button" class="btn btn-secondary" onclick={() => startJourney("portkey")}>Start</button>
            <a class="btn-link" href="/keys/docs/guides/portkey" target="_blank" rel="noopener noreferrer">Guide →</a>
          </div>
        </div>
        {/if}
        <div class="journey-card">
          <h3 class="journey-title">Direct providers</h3>
          <p class="journey-desc">Keep provider keys in your own secret manager. Restormel applies routing decisions.</p>
          <div class="journey-actions">
            <button type="button" class="btn btn-secondary" onclick={() => startJourney("direct")}>Start</button>
            <a class="btn-link" href="/keys/docs/guides/provider-access-modes" target="_blank" rel="noopener noreferrer">Modes →</a>
          </div>
        </div>
      </div>
    </details>
  {:else}
    <section class="section" aria-labelledby="journeys-heading">
      <h2 id="journeys-heading" class="section-title">How do you connect?</h2>
      <p class="section-desc">Pick the journey that matches your stack. This is the first step when no connections exist.</p>
      <div class="journeys-grid">
        {#if showGatewayJourneys}
        <div class="journey-card">
          <h3 class="journey-title">OpenRouter</h3>
          <p class="journey-desc">Keep OpenRouter as execution. Use Restormel for rules, guard rails, and fallbacks.</p>
          <div class="journey-actions">
            <button type="button" class="btn btn-secondary" onclick={() => startJourney("openrouter")}>Start</button>
            <a class="btn-link" href="/keys/docs/guides/openrouter" target="_blank" rel="noopener noreferrer">Guide →</a>
          </div>
        </div>
        <div class="journey-card">
          <h3 class="journey-title">Vercel AI Gateway</h3>
          <p class="journey-desc">Keep Vercel gateway auth/observability. Let Restormel handle rule governance.</p>
          <div class="journey-actions">
            <button type="button" class="btn btn-secondary" onclick={() => startJourney("vercel_ai_gateway")}>Start</button>
            <a class="btn-link" href="/keys/docs/guides/vercel-ai-gateway" target="_blank" rel="noopener noreferrer">Guide →</a>
          </div>
        </div>
        <div class="journey-card">
          <h3 class="journey-title">Portkey</h3>
          <p class="journey-desc">Keep Portkey as the gateway. Use Restormel for explicit rule and fallback governance.</p>
          <div class="journey-actions">
            <button type="button" class="btn btn-secondary" onclick={() => startJourney("portkey")}>Start</button>
            <a class="btn-link" href="/keys/docs/guides/portkey" target="_blank" rel="noopener noreferrer">Guide →</a>
          </div>
        </div>
        {/if}
        <div class="journey-card">
          <h3 class="journey-title">Direct providers</h3>
          <p class="journey-desc">Keep provider keys in your own secret manager. Restormel applies routing decisions.</p>
          <div class="journey-actions">
            <button type="button" class="btn btn-secondary" onclick={() => startJourney("direct")}>Start</button>
            <a class="btn-link" href="/keys/docs/guides/provider-access-modes" target="_blank" rel="noopener noreferrer">Modes →</a>
          </div>
        </div>
      </div>
    </section>
  {/if}

  <section class="section" aria-labelledby="connect-heading">
    <h2 id="connect-heading" class="section-title">Add a connection</h2>
    <p class="section-desc">
      Step 1 pick provider, Step 2 name it, Step 3 paste a hosted API key <em>or</em> a vault reference (non-secret label).
    </p>
    {#if connectError}
      <p class="error-msg" role="alert">{connectError}</p>
    {/if}
    <form class="connect-form" onsubmit={(e) => { e.preventDefault(); connectProvider(); }}>
      <div class="wizard-row">
        <p class="wizard-step">Step 1</p>
        <p class="wizard-title">Provider</p>
        <div class="provider-grid">
          {#each PROVIDER_CARDS as opt}
            <button type="button" class="provider-btn" class:provider-btn-active={providerType === opt.value} onclick={() => selectProvider(opt.value)}>
              {opt.label}
            </button>
          {/each}
        </div>
      </div>
      {#if providerType === "other"}
        <div class="form-row">
          <label for="other-type">Integration type value</label>
          <input id="other-type" type="text" bind:value={otherProviderType} class="input" placeholder="e.g. custom_provider" />
        </div>
      {/if}
      <div class="wizard-row">
        <p class="wizard-step">Step 2</p>
        <div class="form-row">
          <label for="display-name" class="wizard-title">Display name</label>
          <input id="display-name" type="text" bind:value={displayName} class="input" placeholder="e.g. Production OpenAI" />
        </div>
      </div>
      <div class="wizard-row">
        <p class="wizard-step">Step 3a</p>
        <div class="form-row">
          <label for="api-key" class="wizard-title">Hosted API key (optional)</label>
          <input
            id="api-key"
            type="password"
            bind:value={apiKey}
            class="input"
            placeholder="Paste once — never shown again after save"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
          />
          <p class="helper">Encrypted at rest when the deployment is configured. Leave blank if you only use a vault reference below.</p>
        </div>
      </div>
      <div class="wizard-row">
        <p class="wizard-step">Step 3b</p>
        <div class="form-row">
          <label for="credential-ref" class="wizard-title">Credential reference (optional)</label>
          <input id="credential-ref" type="text" bind:value={credentialRef} class="input" placeholder="e.g. sm://prod/openai" autocomplete="off" />
          <p class="helper">Non-secret label from your secrets manager. Use when you are not storing a hosted key in Restormel.</p>
        </div>
      </div>
      {#if canConnect}
        <button type="submit" class="btn btn-primary" disabled={connecting}>
          {connecting ? "Connecting…" : "Connect"}
        </button>
      {/if}
    </form>
  </section>

  {#if data.integrations.length > 0}
    <section class="section" aria-labelledby="list-heading">
      <div class="list-head">
        <h2 id="list-heading" class="section-title">Your connections</h2>
        <button type="button" class="btn btn-primary" onclick={jumpToForm}>+ Add connection</button>
      </div>
      <ul class="integration-list">
        {#each data.integrations as int}
          <li class="integration-row">
            <a href={DASHBOARD_BASE + "/integrations/" + int.id} class="integration-link">
              <span class="int-name">{int.displayName || int.providerType}</span>
              <span class="int-type">{int.providerType}</span>
              <span class={`int-status status-${integrationTone(int.status)}`}>
                {int.status}
                {#if int.verificationStatus}
                  · {int.verificationStatus}
                {/if}
                {#if int.credentialMasked}
                  · {int.credentialMasked}
                {:else if int.hasCredential}
                  · credential set
                {:else}
                  · no credential
                {/if}
              </span>
              <span class="int-verified">Last verified: {formatLastVerified(int.lastVerifiedAt)}</span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
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
  .connect-form { max-width: 34rem; }
  .form-row {
    margin-bottom: var(--space-3);
  }
  .wizard-row {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    padding: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .wizard-step {
    margin: 0;
    color: var(--rm-dim);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .wizard-title {
    margin: var(--space-1) 0 var(--space-2);
    color: var(--rm-text);
    font-size: var(--text-sm);
    font-weight: 600;
  }
  label.wizard-title {
    display: block;
    cursor: pointer;
  }
  .provider-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
  }
  .provider-btn {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
    color: var(--rm-muted);
    padding: var(--space-2);
    font-size: var(--text-sm);
  }
  .provider-btn-active {
    border-color: var(--rm-sage);
    color: var(--rm-text);
  }
  .helper {
    margin: var(--space-1) 0 0;
    font-size: var(--text-xs);
    color: var(--rm-dim);
  }
  .form-row label:not(.wizard-title) {
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
  .journey-details summary {
    cursor: pointer;
    color: var(--rm-sage);
    font-size: var(--text-sm);
  }
  .list-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-2);
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
