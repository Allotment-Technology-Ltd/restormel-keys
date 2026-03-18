<svelte:head>
  <title>OpenRouter integration — Restormel Keys</title>
  <meta name="description" content="Use Restormel Keys alongside OpenRouter: keep OpenRouter as provider access, add Restormel routing/policies/health and progressive migration." />
</svelte:head>

<div class="doc-content">
  <h1>Using Restormel with OpenRouter</h1>
  <p class="doc-intro">
    If you already use OpenRouter, you don’t need to replace it. Treat OpenRouter as your <strong>provider access layer</strong>, and use Restormel Keys as the <strong>control layer</strong> for routing, policies, health checks, analytics, and progressive rollout.
  </p>

  <h2>What stays where</h2>
  <ul>
    <li><strong>OpenRouter owns:</strong> OpenRouter API key(s), provider selection behavior inside OpenRouter, OpenRouter-side analytics</li>
    <li><strong>You own:</strong> Where the OpenRouter key lives (env/secrets manager), which endpoints your app calls</li>
    <li><strong>Restormel owns:</strong> Routes/policies/health configuration, control-plane API keys, dashboard governance UX</li>
  </ul>

  <h2>Adoption path (low migration)</h2>
  <ol>
    <li><strong>Keep your existing OpenRouter calls.</strong> Don’t touch credentials or request format yet.</li>
    <li><strong>Add Restormel control plane.</strong> Create a project, routes, and policies that describe the behavior you want.</li>
    <li><strong>Use Restormel Resolve for decisions.</strong> For a given request, ask Restormel which route/provider/model should apply, then execute via OpenRouter.</li>
    <li><strong>Progressively cut over.</strong> Start with a small traffic slice, verify logs/health, then expand.</li>
  </ol>

  <div class="callout callout-note">
    <strong>Key principle</strong> — Restormel does not need to store your OpenRouter key. Keep it in your env/secrets manager and treat OpenRouter as the execution layer.
  </div>

  <h2>When to keep OpenRouter vs go direct</h2>
  <p>
    If you rely on OpenRouter-specific models or routing features, keep OpenRouter as the execution layer.
    If you want direct provider relationships (OpenAI/Anthropic accounts, direct rate limits), you can migrate execution later while keeping the same Restormel routes/policies.
  </p>
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

