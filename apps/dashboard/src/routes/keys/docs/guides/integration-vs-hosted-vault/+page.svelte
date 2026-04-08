<svelte:head>
  <title>Integration vs key custody — Restormel Keys</title>
  <meta
    name="description"
    content="What Restormel Keys stores (routing, policies, optional encrypted provider keys) vs gateway or your vault. BYOK-first with an optional hosted path for Testing resolve."
  />
</svelte:head>

<div class="doc-content">
  <h1>Integration vs key custody</h1>
  <p class="doc-intro">
    Restormel Keys is <strong>BYOK-first</strong>: most teams keep provider material in their gateway or secret store. You may also use
    <strong>Connections</strong> to store a <strong>hosted API key</strong> encrypted at rest (when the deployment is configured) or a
    <strong>non-secret vault reference</strong> only. This page clarifies what Restormel stores vs what stays with you.
  </p>

  <h2>What Restormel stores</h2>
  <ul>
    <li><strong>Gateway keys</strong> (<code>rk_…</code>) as prefix + hash only — not reversible</li>
    <li><strong>Routes and policies</strong> that describe how requests should be handled</li>
    <li><strong>Optional hosted provider keys</strong> under Connections — <strong>ciphertext only</strong> in Postgres when encryption is enabled; list/API/UI show <strong>masked</strong> labels; never echo full secrets after save</li>
    <li><strong>Health and analytics configuration</strong> for the control layer</li>
    <li><strong>Embeddable UX</strong> for model selection and BYOK-aligned flows</li>
  </ul>

  <h2>Where provider credentials usually live</h2>
  <ul>
    <li><strong>Gateway-backed:</strong> in OpenRouter / Vercel AI Gateway / Portkey (or your gateway vendor), with your app holding the gateway key in env/secrets manager</li>
    <li><strong>Builder-managed direct:</strong> in your env vars / secret manager; use a <strong>credential reference</strong> string in Connections if Restormel should not hold ciphertext</li>
    <li><strong>Hosted in Restormel (optional):</strong> one-time paste under Connections for encrypted storage — common for <strong>Restormel Testing</strong> resolve without duplicating secrets in CI; see <a href="/keys/docs/guides/keys-testing-onboarding">Keys + Testing onboarding</a></li>
  </ul>

  <div class="callout callout-tip">
    <strong>Practical guidance</strong> — Prefer gateway or your vault when you want zero provider material in Restormel’s database. Use hosted encrypted keys when you accept Restormel custody for that secret class and need a smooth Testing/judge path. Operators must set <code class="inline-code">RESTORMEL_CREDENTIALS_ENCRYPTION_KEY</code> for hosted key storage to work.
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

