<svelte:head>
  <title>Integration vs key custody — Restormel Keys</title>
  <meta name="description" content="Clarify what Restormel Keys stores (routing/policy config) vs what your gateway/provider/secret store should hold. Keys remain user-controlled." />
</svelte:head>

<div class="doc-content">
  <h1>Integration vs key custody</h1>
  <p class="doc-intro">
    Restormel Keys does not take custody of raw provider secrets as a core product feature.
    This page clarifies the boundary: what Restormel stores, and what should live in your gateway/provider account or your own secret store.
  </p>

  <h2>What Restormel owns (v1 default)</h2>
  <ul>
    <li><strong>Restormel control plane keys</strong> (Gateway/Restormel API keys) used to authenticate to Restormel APIs</li>
    <li><strong>Routes and policies</strong> that describe how requests should be handled</li>
    <li><strong>Health and analytics configuration</strong> for the control layer</li>
    <li><strong>Embeddable UX</strong> for model selection and optional BYOK flows</li>
  </ul>

  <h2>Where provider credentials should live (v1 default)</h2>
  <ul>
    <li><strong>Gateway-backed:</strong> in OpenRouter / Vercel AI Gateway / Portkey (or your gateway vendor), with your app holding the gateway key in env/secrets manager</li>
    <li><strong>Builder-managed direct:</strong> in your env vars / secret manager, never pasted into Restormel-hosted infrastructure by default</li>
  </ul>

  <div class="callout callout-tip">
    <strong>Practical guidance</strong> — If a doc or UI flow implies “paste your OpenAI key into Restormel,” treat that as legacy. Use your own storage (env, secret manager, gateway vendor) and keep keys user-controlled.
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

