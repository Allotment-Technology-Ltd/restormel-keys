<script lang="ts">
  import DocArticle from "$lib/graph/components/docs/DocArticle.svelte";
  import { graphBase as base } from "$lib/graph/paths.js";
  import { GITHUB_REPO_URL } from "$lib/site-nav";
</script>

<DocArticle
  title="Restormel State (agent memory)"
  description="@restormel/state models append-only agent memory, deterministic projections, and correlation with context packs and observability. It publishes on platform-v* (not graph-v*): suite-wide platform, often used together with graph-aware retrieval and @restormel/context-packs."
>
  <div class="doc-prose">
    <p>
      <strong>Restormel Graph</strong> docs focus on the canvas (<code>graph-v*</code>) and optional
      <a href="{base}/docs/extensions/reasoning">reasoning extensions</a>
      (<code>platform-v*</code>). <strong>Restormel State</strong> is also on the
      <strong><code>platform-v*</code></strong> train—it is <strong>not</strong> part of Contract v0 or
      <code>@restormel/graph-core</code>. We document it here because many integrators (for example SOPHIA) combine
      <strong>retrieval → context packs → multi-pass LLM → graph UI</strong>; State closes the loop on
      <strong>what the agent remembers</strong> and how that lines up with each run.
    </p>

    <h2>What it is</h2>
    <p>
      <a href="https://www.npmjs.com/package/@restormel/state" rel="noopener noreferrer"><code>@restormel/state</code></a>
      provides:
    </p>
    <ul>
      <li>
        An append-only <strong><code>StateEvent</code></strong> stream (upsert / remove / pin / summarize-compact / scope
        clear).
      </li>
      <li>
        <strong><code>projectWorkingMemory(events, policy)</code></strong> — pure fold plus per-scope caps (cells and
        approximate tokens); unpinned cells drop before pinned when over budget.
      </li>
      <li>
        <strong>Correlation helpers</strong> — attach <code>restormel_correlation</code> onto
        <code>ContextPackRetrievalInput</code> (from <code>@restormel/context-packs</code>) and emit small structs for logs
        or traces next to <code>run_id</code> (alongside <code>@restormel/observability</code>).
      </li>
      <li>
        Optional <strong>Stoa-oriented factories</strong> (turn digest, history summarization, scope clear) for wiring SOPHIA
        without copying types by hand.
      </li>
    </ul>

    <h2>What it is not</h2>
    <ul>
      <li>Not a vector database, embedding store, or RAG product.</li>
      <li>Not a workflow or checkpoint engine (for example LangGraph-style execution state).</li>
      <li>Not a hosted memory service: <strong>you persist events</strong> (Firestore, Postgres, append-only log); this package
        only projects them.</li>
    </ul>

    <h2>How it fits next to context packs</h2>
    <p>
      <a href="{base}/docs/extensions/reasoning">Reasoning extensions</a> already points at
      <code>@restormel/context-packs</code>, which turns a retrieval-shaped payload into pass-specific LLM blocks. State
      answers a different question: <strong>over time</strong>, what memory cells were added, summarized, or removed—and
      <strong>which events</strong> explain the prompt you built for this <code>run_id</code>? Use
      <code>attachCorrelationToRetrievalInput</code> so support and operators can jump from a bad answer to both
      <strong>retrieval correlation</strong> and <strong>memory tail ids</strong>.
    </p>

    <h2>Canonical documentation (repo)</h2>
    <p>
      Maintainer-facing source of truth and SOPHIA hook checklist (Stoa <code>+server.ts</code>, escalation) live in the
      monorepo:
    </p>
    <ul>
      <li>
        <a href="{GITHUB_REPO_URL}/blob/main/docs/restormel/RESTORMEL-STATE.md" rel="noopener noreferrer"
          ><code>docs/restormel/RESTORMEL-STATE.md</code></a
        >
        — overview, non-goals, core model.
      </li>
      <li>
        <a href="{GITHUB_REPO_URL}/blob/main/docs/restormel/state-sophia-integration.md" rel="noopener noreferrer"
          ><code>docs/restormel/state-sophia-integration.md</code></a
        >
        — where to emit events in SOPHIA.
      </li>
      <li>
        Package README:
        <a href="{GITHUB_REPO_URL}/blob/main/packages/state/README.md" rel="noopener noreferrer"
          ><code>packages/state/README.md</code></a
        >.
      </li>
      <li>
        npm install path and version checks:
        <a href="{GITHUB_REPO_URL}/blob/main/docs/reference/npm-packages.md" rel="noopener noreferrer"
          ><code>docs/reference/npm-packages.md</code></a
        >.
      </li>
    </ul>

    <h2>Publish train</h2>
    <p>
      State publishes with other platform packages when maintainers push <code>platform-v*</code>. Order on the train:
      <code>@restormel/contracts</code> → <code>@restormel/context-packs</code> →
      <strong><code>@restormel/state</code></strong> (depends on context-packs for correlation types) →
      <code>@restormel/observability</code> → <code>@restormel/graph-reasoning-extensions</code>. Workflow:
      <a href="{GITHUB_REPO_URL}/blob/main/.github/workflows/publish-restormel-platform.yml" rel="noopener noreferrer"
        ><code>publish-restormel-platform.yml</code></a
      >.
    </p>

    <p>
      <a href="{base}/docs">← Docs home</a> ·
      <a href="{base}/docs/extensions/reasoning">Reasoning extensions &amp; contracts</a> ·
      <a href="{base}/docs/how-it-fits-together">How it fits together</a>
    </p>
  </div>
</DocArticle>
