<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { invalidateAll } from "$app/navigation";
  import type { IntegrationSummary, ProviderSuggestion } from "./+page.server";

  export let data: {
    integrations: IntegrationSummary[];
    providerSuggestions: ProviderSuggestion[];
    error: string | null;
  };

  // Provider suggestions are DERIVED FROM THE MODEL CATALOGUE (server load) — every provider with
  // models, offered equally. No vendor is featured; the field is free-text, so anything can be typed.
  $: providerSuggestions = data.providerSuggestions ?? [];

  let connecting = false;
  let connectError = "";
  /** Free-text provider type; suggestions are advisory only. */
  let providerInput = "";
  let displayName = "";
  let credentialRef = "";
  /** One-time hosted API key; encrypted at rest when server is configured. Cleared after successful submit. */
  let apiKey = "";

  $: effectiveProviderType = providerInput.trim();
  $: providerReady = Boolean(effectiveProviderType);
  $: selectedProviderLabel =
    providerSuggestions.find((p) => p.value === effectiveProviderType.toLowerCase())?.label ||
    effectiveProviderType;
  $: canConnect = Boolean(
    effectiveProviderType &&
      displayName.trim() &&
      (credentialRef.trim() || apiKey.trim())
  );

  function jumpToForm() {
    document.getElementById("connect-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetConnectForm() {
    providerInput = "";
    displayName = "";
    credentialRef = "";
    apiKey = "";
    connectError = "";
  }

  /** Browsers ignore autocomplete=off on password fields; readonly-until-focus blocks silent autofill. */
  function unlockAutofillGuard(e: FocusEvent) {
    const el = e.currentTarget;
    if (el instanceof HTMLInputElement) el.removeAttribute("readonly");
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

<!-- F-P1-3 (UXC §2 Connections): the section heading is "Connections" — the nav
     label, not the "Connect a Provider" verb phrase (that register belongs on a CTA). -->
<h1 class="page-title">Connections</h1>
<p class="page-desc">
  Connect your provider so Restormel Testing and routing can resolve models. Use <strong>Hosted API key</strong> for a key encrypted at rest (recommended for judge flows), or <strong>Credential reference</strong> for a non-secret vault label only — not both required.
</p>
<p class="page-desc">
  After you save a connection, open <a href={DASHBOARD_BASE + "/testing"}>Restormel Testing</a> for project and environment IDs and env snippets.
</p>

{#if data.error}
  <p class="error-msg" role="alert">{data.error}</p>
{:else}
  <!-- Provider-neutral access-mode explainer. Replaces the former per-vendor "journey"
       cards (OpenRouter / Vercel / Portkey) that funneled specific providers down their
       own branded paths — Restormel treats every provider equally (provider-equality
       principle), so connection guidance is framed by ACCESS MODE, not by vendor. -->
  {#if data.integrations.length > 0}
    <details class="section access-modes-details">
      <summary>How connections work →</summary>
      <div class="access-modes-body">
        <p class="section-desc">
          Connect any provider below — Restormel treats every provider equally for routing, rules, and
          fallbacks. Two access modes are supported, and you can mix them per connection:
        </p>
        <ul class="access-modes">
          <li><strong>Direct provider key</strong> — paste a hosted API key (encrypted at rest) or reference a non-secret label from your own secrets manager.</li>
          <li><strong>Through a gateway you already run</strong> — keep your existing gateway for execution, auth, and observability; Restormel applies rule and fallback governance on top.</li>
        </ul>
        <p class="section-desc">
          See <a class="btn-link" href="/keys/docs/guides/provider-access-modes" target="_blank" rel="noopener noreferrer">access modes →</a> for details.
        </p>
      </div>
    </details>
  {:else}
    <section class="section" aria-labelledby="access-modes-heading">
      <h2 id="access-modes-heading" class="section-title">How connections work</h2>
      <p class="section-desc">
        Connect any provider below — Restormel treats every provider equally for routing, rules, and
        fallbacks. Two access modes are supported, and you can mix them per connection:
      </p>
      <ul class="access-modes">
        <li><strong>Direct provider key</strong> — paste a hosted API key (encrypted at rest) or reference a non-secret label from your own secrets manager.</li>
        <li><strong>Through a gateway you already run</strong> — keep your existing gateway for execution, auth, and observability; Restormel applies rule and fallback governance on top.</li>
      </ul>
      <p class="section-desc">
        Pick a provider under <strong>Add a connection</strong> below to get started, or read the
        <a class="btn-link" href="/keys/docs/guides/provider-access-modes" target="_blank" rel="noopener noreferrer">access modes guide →</a>.
      </p>
    </section>
  {/if}

  <section class="section" aria-labelledby="connect-heading">
    <h2 id="connect-heading" class="section-title">Add a connection</h2>
    <p class="section-desc">
      Pick a provider first — name and credential fields appear after that.
    </p>
    {#if connectError}
      <p class="error-msg" role="alert">{connectError}</p>
    {/if}
    <form
      class="connect-form"
      autocomplete="off"
      data-1p-ignore
      data-lpignore="true"
      onsubmit={(e) => { e.preventDefault(); connectProvider(); }}
    >
      <div class="wizard-row" id="connect-step-1">
        <p class="wizard-step">Step 1</p>
        <p class="wizard-title">Provider</p>
        <p class="provider-selection-hint" aria-live="polite">
          {#if !providerReady}
            Type or pick any provider — suggestions are the providers in the model catalogue.
          {:else}
            Selected: <strong>{selectedProviderLabel}</strong> — add a display name and credential below.
          {/if}
        </p>
        <div class="form-row">
          <input
            id="integration-provider"
            name="integration-provider"
            type="text"
            class="input"
            list="provider-suggestions"
            placeholder="e.g. openai, cohere, groq…"
            aria-label="Provider type"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            bind:value={providerInput}
          />
          <datalist id="provider-suggestions">
            {#each providerSuggestions as p (p.value)}
              <option value={p.value}>{p.label}</option>
            {/each}
          </datalist>
          <p class="helper">
            Any provider works — Restormel treats them equally. The {providerSuggestions.length} providers
            in the model catalogue are suggested as you type; type any other to connect it.
          </p>
        </div>
      </div>
      {#if providerReady}
      {#key effectiveProviderType}
      <div class="wizard-row" id="connect-step-2">
        <p class="wizard-step">Step 2</p>
        <div class="form-row">
          <label for="integration-label" class="wizard-title">Display name for {selectedProviderLabel}</label>
          <input
            id="integration-label"
            name="integration-label"
            type="text"
            bind:value={displayName}
            class="input"
            placeholder="e.g. Production OpenAI"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            readonly
            onfocus={unlockAutofillGuard}
          />
        </div>
      </div>
      <div class="wizard-row">
        <p class="wizard-step">Step 3a</p>
        <div class="form-row">
          <label for="integration-api-key" class="wizard-title">Hosted API key (optional)</label>
          <input
            id="integration-api-key"
            name="integration-api-key"
            type="password"
            bind:value={apiKey}
            class="input"
            placeholder="Paste once — never shown again after save"
            autocomplete="new-password"
            autocapitalize="off"
            spellcheck="false"
            readonly
            onfocus={unlockAutofillGuard}
          />
          <p class="helper">Encrypted at rest when the deployment is configured. Leave blank if you only use a vault reference below.</p>
        </div>
      </div>
      <div class="wizard-row">
        <p class="wizard-step">Step 3b</p>
        <div class="form-row">
          <label for="integration-credential-ref" class="wizard-title">Credential reference (optional)</label>
          <input
            id="integration-credential-ref"
            name="integration-credential-ref"
            type="text"
            bind:value={credentialRef}
            class="input"
            placeholder="e.g. sm://prod/openai"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            readonly
            onfocus={unlockAutofillGuard}
          />
          <p class="helper">Non-secret label from your secrets manager. Use when you are not storing a hosted key in Restormel.</p>
        </div>
      </div>
      {#if canConnect}
        <button type="submit" class="btn btn-primary" disabled={connecting}>
          {connecting ? "Connecting…" : "Connect"}
        </button>
      {/if}
      {/key}
      {/if}
    </form>
  </section>

  {#if data.integrations.length > 0}
    <section class="section" aria-labelledby="list-heading">
      <div class="list-head">
        <h2 id="list-heading" class="section-title">Your connections</h2>
        <button type="button" class="btn btn-primary" onclick={() => { resetConnectForm(); jumpToForm(); }}>+ Add connection</button>
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
                  · {int.verificationStatus === "reference_only" ? "reference only" : int.verificationStatus}
                {/if}
                {#if int.credentialMasked}
                  · {int.credentialMasked}
                {:else if int.referenceOnly}
                  · reference only — not verifiable
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
    border: var(--border-thin);
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
  .provider-selection-hint {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .provider-selection-hint strong {
    color: var(--rm-text);
    font-weight: 600;
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
    border: var(--border-thin);
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
    border: var(--border-thin);
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
    border-bottom: var(--border-thin);
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

  .access-modes-details summary {
    cursor: pointer;
    color: var(--rm-sage);
    font-size: var(--text-sm);
  }
  .access-modes-body {
    margin-top: var(--space-3);
  }
  .access-modes {
    margin: var(--space-2) 0;
    padding-left: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .access-modes li {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .access-modes li strong {
    color: var(--rm-text);
  }
  .list-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-2);
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
