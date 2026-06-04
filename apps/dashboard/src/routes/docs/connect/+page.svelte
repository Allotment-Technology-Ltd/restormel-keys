<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { moduleById } from "$lib/suite/suite-modules";

  const connectMod = moduleById("connect");
</script>

<div class="doc-content">
  <h1>{connectMod.capability} — {connectMod.product}</h1>
  <p class="lede">
    Connect is how you stand up <strong>agent-ready knowledge infrastructure</strong> without building a bespoke RAG
    stack. Ingest documents into a structured graph, then expose that graph to copilots and agents through retrieve
    and verify APIs — all scoped to your Keys workspace and BYOK on every LLM stage.
  </p>

  <h2>What you build</h2>
  <ul class="build-list">
    <li>
      <strong>Knowledge graph</strong> — extracted ideas, relationships, groups, and embeddings validated against
      your sources (not flat chunk stores).
    </li>
    <li>
      <strong>Retrieval layer</strong> — depth-controlled context for agents via <code>POST /connect/v1/retrieve</code>
      or MCP <code>connect.retrieve</code>.
    </li>
    <li>
      <strong>Grounding layer</strong> — claim verification before answers ship via
      <code>POST /connect/v1/verify</code> or MCP <code>connect.verify</code>.
    </li>
  </ul>

  <h2>Where to start</h2>
  <p>
    Operators: guided setup in the
    <a href={DASHBOARD_BASE + "/connect"}>Connect hub</a> — graph store, keys, domain design, documents, ingest runs.
    Integrators: <a href="/connect/docs">API &amp; MCP reference</a> when wiring agents.
  </p>
  <p><a class="btn btn-primary" href={DASHBOARD_BASE + "/connect"}>Open Connect hub</a></p>
  <p class="related">
    <a href="/connect">Connect marketing overview</a>
    ·
    <a href="/docs/how-it-fits-together">How the suite fits together</a>
    ·
    <a href="/graph">Visualise graphs in your app</a>
  </p>
</div>

<style>
  .doc-content {
    max-width: 42rem;
    line-height: 1.6;
  }
  .lede {
    font-size: 1.05rem;
    color: var(--rm-muted);
  }
  .build-list {
    padding-left: 1.25rem;
    margin: 0 0 1.5rem;
  }
  .build-list li {
    margin-bottom: 0.75rem;
  }
  .build-list strong {
    color: var(--rm-text);
  }
  .related {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
</style>
