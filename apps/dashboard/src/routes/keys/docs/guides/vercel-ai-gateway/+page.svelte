<svelte:head>
  <title>Vercel AI Gateway integration — Restormel Keys</title>
  <meta name="description" content="Use Restormel Keys alongside Vercel AI Gateway: keep Vercel gateway auth/observability, add Restormel routing/policies/health and progressive adoption." />
</svelte:head>

<div class="doc-content">
  <h1>Using Restormel with Vercel AI Gateway</h1>
  <p class="doc-intro">
    If you’re already using Vercel AI Gateway, keep it as your <strong>provider access layer</strong>. Restormel Keys integrates as a <strong>control layer</strong> for routing policies, fallbacks, health checks, cost logic, and embeddable UX.
  </p>

  <h2>What stays where</h2>
  <ul>
    <li><strong>Vercel AI Gateway owns:</strong> gateway authentication, gateway endpoint, Vercel-side usage/observability</li>
    <li><strong>You own:</strong> where gateway credentials live (env/secrets manager), your app’s call sites</li>
    <li><strong>Restormel owns:</strong> routes/policies/health config and the control-plane dashboard</li>
  </ul>

  <h2>Adoption path</h2>
  <ol>
    <li><strong>Inventory your current setup.</strong> Identify models, fallbacks, and where gateway keys are configured.</li>
    <li><strong>Model Restormel routes/policies.</strong> Capture your desired behavior in Restormel without changing execution yet.</li>
    <li><strong>Resolve then execute via Vercel.</strong> Ask Restormel for the decision; send the request via Vercel AI Gateway.</li>
    <li><strong>Progressively enforce.</strong> Turn on policies and fallbacks step-by-step.</li>
  </ol>

  <div class="callout callout-note">
    <strong>Key principle</strong> — Restormel doesn’t need to store Vercel gateway credentials. Keep them where they already live; Restormel focuses on governance.
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

