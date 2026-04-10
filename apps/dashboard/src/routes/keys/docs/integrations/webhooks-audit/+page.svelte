<svelte:head>
  <title>Webhooks and audit — Restormel Keys</title>
  <meta
    name="description"
    content="Workspace webhooks MVP (policy.published), HMAC signatures, and audit log API; SIEM export patterns."
  />
</svelte:head>

<div class="doc-content">
  <h1>Webhooks and audit (MVP)</h1>
  <p class="doc-intro">
    Outbound <strong>workspace webhooks</strong> complement the existing in-dashboard <strong>audit log</strong> API.
    MVP delivers signed JSON for <code>policy.published</code> when encryption is configured for signing-secret storage.
  </p>

  <h2>HTTP API (session or management key)</h2>
  <ul>
    <li><code>GET /keys/dashboard/api/webhooks</code> — list subscriptions (no secrets).</li>
    <li>
      <code>POST /keys/dashboard/api/webhooks</code> — JSON body with <code>url</code> and optional <code>event_types</code>; response includes
      <code>signing_secret</code> once.
    </li>
    <li><code>DELETE /keys/dashboard/api/webhooks?id=&lt;uuid&gt;</code> — remove subscription.</li>
  </ul>
  <p class="muted">
    Requires <code>RESTORMEL_CREDENTIALS_ENCRYPTION_KEY</code> (same as hosted provider credentials) to encrypt signing secrets at rest.
  </p>

  <h2>Payload and signature</h2>
  <p>
    POST body JSON: <code>event</code>, <code>occurred_at</code>, <code>workspace_id</code>, <code>data</code> (event-specific; no raw keys).
    Headers: <code>X-Restormel-Event</code>, <code>X-Restormel-Signature: v1=&lt;hmac-sha256-hex&gt;</code> over the raw body.
  </p>

  <h2>Audit log</h2>
  <p>
    <code>GET /keys/dashboard/api/audit</code> remains the pull-style trail for workspace actions.
    Normalise both streams in your SIEM if needed (webhook push vs audit poll).
  </p>

  <h2>Repo reference</h2>
  <p>
    <a
      href="https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/integrations/webhooks-audit-mvp.md"
      >docs/integrations/webhooks-audit-mvp.md</a
    >
  </p>
</div>

<style>
  .doc-content {
    max-width: var(--rm-container-narrow);
  }
  .doc-intro {
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
    line-height: var(--leading-relaxed);
  }
  .doc-content h1 {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    margin: 0 0 var(--space-4);
  }
  .doc-content h2 {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    margin: var(--space-8) 0 var(--space-3);
  }
  .doc-content p,
  .doc-content li {
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-3);
  }
  .doc-content ul {
    margin: 0 0 var(--space-4);
    padding-left: var(--space-5);
  }
  .muted {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
</style>
