<svelte:head>
  <title>Portkey integration — Restormel Keys</title>
  <meta name="description" content="Use Restormel Keys alongside Portkey: keep Portkey as your gateway/provider access layer, add Restormel routing/policies/health and progressive adoption." />
</svelte:head>

<div class="doc-content">
  <h1>Using Restormel with Portkey</h1>
  <p class="doc-intro">
    If you use Portkey today, keep it as your <strong>provider access layer</strong> (gateway execution and vendor-managed credential handling).
    Use Restormel Keys as the <strong>control layer</strong> for policy-driven routing, explicit fallback chains, health checks, cost governance, and embeddable UX.
  </p>

  <h2>What stays where</h2>
  <ul>
    <li><strong>Portkey owns:</strong> gateway endpoint and Portkey-side routing/observability features you already rely on</li>
    <li><strong>You own:</strong> where Portkey credentials/config live (env/secrets manager), your app call sites</li>
    <li><strong>Restormel owns:</strong> routes/policies/health/analytics settings as a separate governance surface</li>
  </ul>

  <h2>Adoption path</h2>
  <ol>
    <li><strong>Model your desired behavior in Restormel.</strong> Define routes and policies that reflect what you want to happen.</li>
    <li><strong>Resolve then execute via Portkey.</strong> Restormel decides; Portkey executes.</li>
    <li><strong>Use strangler rollout.</strong> Run old and new in parallel, shift traffic incrementally, verify, then retire old behavior.</li>
  </ol>

  <div class="callout callout-note">
    <strong>Key principle</strong> — Restormel doesn’t need to store Portkey credentials. Keep them in your existing secret management; Restormel stays integration-first.
  </div>
</div>

<style>
  .doc-content { max-width: var(--rm-container-narrow); }
  .doc-intro { color: var(--rm-muted); margin: 0 0 var(--space-6); line-height: var(--leading-relaxed); }
  .doc-content h1 { font-family: var(--rm-font-display); font-size: var(--text-2xl); margin: 0 0 var(--space-4); }
  .doc-content h2 { font-family: var(--rm-font-display); font-size: var(--text-xl); margin: var(--space-8) 0 var(--space-3); }
  .doc-content p, .doc-content li { color: var(--rm-muted); line-height: var(--leading-relaxed); margin: 0 0 var(--space-3); }
  .doc-content ul, .doc-content ol { margin: 0 0 var(--space-4); padding-left: var(--space-5); }
  .doc-content li { margin-bottom: var(--space-2); }
</style>

