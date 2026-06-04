<svelte:head>
  <title>Connect first graph onboarding — Restormel Keys</title>
  <meta
    name="description"
    content="Connect Surreal Cloud, wire chat and embedding routes, load the starter philosophy corpus, describe your graph schema, and run your first Connect ingest."
  />
</svelte:head>

<div class="doc-content">
  <h1>Connect first graph onboarding</h1>
  <p class="doc-intro">
    <strong>Canonical repo copy:</strong>
    <code class="inline-code">docs/connect-first-graph-onboarding.md</code> — same operational steps; update that file first, then keep this page aligned.
  </p>

  <div class="callout callout-tip">
    <strong>Goal:</strong> Build your first knowledge graph in Restormel Connect using Surreal Cloud, two model capabilities (chat + embedding), the starter philosophy corpus, and Graph Designer — then run ingest and browse the result at
    <code class="inline-code">/keys/dashboard/connect/graph</code>.
  </div>

  <p>
    Start from the expandable guide on
    <a href="/keys/dashboard/connect">Connect home</a> or follow the phases below.
  </p>

  <h2>Phases</h2>
  <ol class="doc-ol">
    <li>
      <strong>Surreal Cloud</strong> — create an instance, paste your connection string on
      <a href="/keys/dashboard/connect/pipeline?step=store">Pipeline → Graph store</a>.
    </li>
    <li>
      <strong>AI keys & routes</strong> — add Connections, then publish chat and embedding ingestion routes on
      <a href="/keys/dashboard/connect/models">Models & keys</a>.
    </li>
    <li>
      <strong>Starter corpus</strong> — load three demo documents on
      <a href="/keys/dashboard/connect/pipeline?step=sources">Pipeline → Sources</a>.
    </li>
    <li>
      <strong>Describe schema</strong> — use Graph Designer on
      <a href="/keys/dashboard/connect/pipeline?step=domain">Pipeline → Domain</a> with the suggested first-graph intent.
    </li>
    <li>
      <strong>First ingest</strong> — start a run on
      <a href="/keys/dashboard/connect/pipeline?step=run">Pipeline → Run</a> (requires
      <code class="inline-code">CONNECT_INGEST_WORKER_MODE=full</code> on the worker).
    </li>
    <li>
      <strong>Explore</strong> — browse
      <a href="/keys/dashboard/connect/graph">your knowledge graph</a>.
    </li>
  </ol>

  <h2>Suggested Graph Designer intent</h2>
  <blockquote>
    Extract philosophical claims and argument structure from short ethics and epistemology passages—premises, conclusions, objections, and discourse relations like supports, contradicts, and responds_to.
  </blockquote>

  <h2>Embedding providers (first run)</h2>
  <p>
    Use OpenAI, Together, Voyage, or Vercel AI Gateway for the embedding route. Domain packs may reference other models in metadata — bind a supported provider in your published embedding route.
  </p>

  <h2>Related</h2>
  <ul class="doc-ul">
    <li><a href="/connect/docs">Connect API docs</a></li>
    <li><a href="/keys/docs/guides/keys-testing-onboarding">Keys + Testing onboarding</a></li>
    <li><a href="/keys/docs/guides/environment-vocabulary">Environment vocabulary</a></li>
  </ul>
</div>

<style>
  .doc-content {
    max-width: 42rem;
    padding: var(--space-6) var(--space-4);
  }
  .doc-intro {
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin-bottom: var(--space-4);
  }
  .callout {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-4);
    margin-bottom: var(--space-5);
    line-height: var(--leading-relaxed);
  }
  .callout-tip {
    background: color-mix(in oklab, var(--rm-sage) 8%, var(--rm-surface));
    border-color: color-mix(in oklab, var(--rm-sage) 35%, var(--rm-border));
  }
  .doc-ol,
  .doc-ul {
    padding-left: 1.25rem;
    line-height: var(--leading-relaxed);
  }
  .doc-ol li + li,
  .doc-ul li + li {
    margin-top: var(--space-2);
  }
  blockquote {
    margin: var(--space-4) 0;
    padding: var(--space-3) var(--space-4);
    border-left: 3px solid var(--rm-sage);
    color: var(--rm-muted);
    background: var(--rm-surface-raised);
  }
  .inline-code {
    font-family: var(--font-mono);
    font-size: 0.9em;
  }
</style>
