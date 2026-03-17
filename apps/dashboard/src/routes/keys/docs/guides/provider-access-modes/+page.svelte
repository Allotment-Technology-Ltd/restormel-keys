<svelte:head>
  <title>Provider access modes — Restormel Keys</title>
  <meta name="description" content="Choose between gateway-backed, builder-managed direct, and future hosted-vault provider access modes with Restormel Keys." />
</svelte:head>

<div class="doc-content">
  <h1>Provider access modes</h1>
  <p class="doc-intro">
    Restormel Keys is a <strong>control layer</strong> (routing, policies, health, cost, UX). Your stack still needs a <strong>provider access layer</strong> to actually reach OpenAI/Anthropic/etc.
    This page explains the default modes and when to choose each.
  </p>

  <h2>Mode A — Gateway-backed (recommended)</h2>
  <p>
    You keep an external gateway/key host as the provider access layer. Restormel integrates cleanly and adds governance and progressive adoption.
  </p>
  <ul>
    <li><strong>Examples:</strong> OpenRouter, Vercel AI Gateway, Portkey</li>
    <li><strong>Where credentials live:</strong> In your gateway vendor account / your infra config</li>
    <li><strong>What Restormel stores:</strong> Routing/policy config, integration metadata, references (not raw provider secrets by default)</li>
    <li><strong>Why you’d pick it:</strong> Lowest migration risk; you keep existing auth/observability surfaces</li>
  </ul>

  <h2>Mode B — Builder-managed direct providers</h2>
  <p>
    Your backend calls providers directly using their SDKs or HTTP APIs. Provider credentials live in your env vars or secret manager.
    Restormel resolves route/provider/model decisions and enforces policies in your control plane.
  </p>
  <ul>
    <li><strong>Where credentials live:</strong> Your env vars / secret manager</li>
    <li><strong>What Restormel stores:</strong> Routes, policies, health/analytics settings</li>
    <li><strong>Why you’d pick it:</strong> You want no extra hop and already have mature secret management</li>
  </ul>

  <h2>Mode C — End-user BYOK (builder-managed)</h2>
  <p>
    If your product lets end-users bring credentials, you can expose a KeyManager UI and store end-user credentials in <em>your</em> backend (or a gateway-backed scheme).
    Restormel remains the control layer; it does not need to become the custodian.
  </p>

  <h2>Mode D — Future: Restormel-hosted vault (optional)</h2>
  <p>
    A hosted provider-secret vault can be an optional future capability, but it is not the v1/default proposition.
    If you need hosted custody today, use your gateway vendor or your existing secret store.
  </p>

  <div class="callout callout-tip">
    <strong>Recommended default</strong> — Start gateway-backed or builder-managed direct, then adopt Restormel routing/policies and dashboards progressively.
  </div>
</div>

<style>
  .doc-content { max-width: var(--rm-container-narrow); }
  .doc-intro { color: var(--rm-muted); margin: 0 0 var(--space-6); line-height: var(--leading-relaxed); }
  .doc-content h1 { font-family: var(--rm-font-display); font-size: var(--text-2xl); margin: 0 0 var(--space-4); }
  .doc-content h2 { font-family: var(--rm-font-display); font-size: var(--text-xl); margin: var(--space-8) 0 var(--space-3); }
  .doc-content p, .doc-content li { color: var(--rm-muted); line-height: var(--leading-relaxed); margin: 0 0 var(--space-3); }
  .doc-content ul { margin: 0 0 var(--space-4); padding-left: var(--space-5); }
</style>

