<svelte:head>
  <title>GPU route smoke (Testing) — Restormel Keys</title>
  <meta
    name="description"
    content="Restormel Testing acceptance templates and goals for smoke-testing private GPU / OpenAI-compatible routes."
  />
</svelte:head>

<div class="doc-content">
  <h1>GPU route smoke (Restormel Testing)</h1>
  <p class="doc-intro">
    Use a <strong>small</strong> suite to prove your BYO-GPU route is reachable, authorized, and returns a sane JSON shape after infra changes.
    Keep runners <strong>customer-funded</strong> (GitHub-hosted or self-hosted on your bill) to preserve margin on Testing as a product.
  </p>

  <h2>What to assert</h2>
  <ul>
    <li><strong>HTTP</strong> — 200 (or your expected status) from the resolved endpoint through your app or gateway.</li>
    <li><strong>Latency</strong> — Wall clock under a generous bound (GPU cold start may be slow).</li>
    <li><strong>Schema</strong> — Response JSON includes expected keys (e.g. <code>choices[0].message</code>).</li>
    <li><strong>Auth failure</strong> — Wrong key yields 401/403, not 500 from your proxy.</li>
  </ul>

  <h2>Starter YAML fragment</h2>
  <p>
    Repo reference: <code>docs/testing/gpu-route-smoke-template.yaml</code> — copy into your <code>restormel-testing.yaml</code> and replace URLs, goals, and AC ids.
  </p>

  <h2>Acceptance criteria</h2>
  <p>
    Give each AC a stable <code>id</code> (e.g. <code>gpu-smoke.reachable</code>) so <strong>Release pack</strong> exports tie policy + route versions to human-readable proof.
    Run with <code>testing run --ac gpu-smoke.reachable</code> when you narrow scope.
  </p>

  <h2>Related</h2>
  <ul>
    <li><a href="/keys/docs/guides/byo-gpu-vm">BYO-GPU VM path</a></li>
    <li><a href="/keys/docs/guides/byo-gpu-kubernetes">BYO-GPU Kubernetes path</a></li>
    <li><a href="/keys/docs/guides/release-pack-and-merge-gates">Release pack and CI merge gates</a></li>
  </ul>
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
</style>
