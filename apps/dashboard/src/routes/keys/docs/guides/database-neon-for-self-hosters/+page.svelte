<svelte:head>
  <title>Database for self-hosters: Neon — Restormel Keys</title>
  <meta
    name="description"
    content="Restormel recommends Neon Postgres and Neon Auth for self-hosted Keys. Setup branches, DATABASE_URL, migrations, CI previews, and how Neon fits ingestion and graph products."
  />
</svelte:head>

<div class="doc-content">
  <h1>Database for self-hosters: Neon (recommended)</h1>
  <p class="doc-intro">
    <strong>Canonical repo copy:</strong>
    <code class="inline-code">docs/guides/database-neon-for-self-hosters.md</code> — update that file first, then keep this page aligned. This URL is the public guide:
    <a href="https://restormel.dev/keys/docs/guides/database-neon-for-self-hosters">restormel.dev/keys/docs/guides/database-neon-for-self-hosters</a>.
  </p>

  <div class="callout callout-tip">
    <strong>Restormel already recommends Neon.</strong> Use
    <a href="https://neon.tech/" rel="noopener noreferrer" target="_blank">Neon serverless Postgres</a>
    as the default for operators self-hosting the <strong>Restormel Keys</strong> dashboard, and
    <strong>Neon Auth</strong> for GitHub sign-in. Eligible open-source projects can also apply to the
    <a href="https://neon.com/programs/open-source" rel="noopener noreferrer" target="_blank">Neon Open Source Program</a>
    for credits and partnership benefits.
  </div>

  <h2>Official Neon links</h2>
  <ul class="doc-ul">
    <li>
      <a href="https://neon.tech/" rel="noopener noreferrer" target="_blank">Neon</a> — product home.
    </li>
    <li>
      <a href="https://neon.com/docs/llms.txt" rel="noopener noreferrer" target="_blank">Neon documentation index</a> — entry point into guides and API references.
    </li>
    <li>
      <a href="https://neon.com/programs/open-source" rel="noopener noreferrer" target="_blank">Neon Open Source Program</a> — credits and support for qualifying OSS.
    </li>
    <li>
      <a href="https://console.neon.tech" rel="noopener noreferrer" target="_blank">Neon Console</a> — projects, branches, connection strings, Auth.
    </li>
  </ul>

  <h2>When you need a database</h2>
  <div class="doc-table-wrap">
    <table class="doc-table">
      <thead>
        <tr>
          <th>Surface</th>
          <th>Database required?</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Restormel Keys dashboard</strong> (BYOK, workspaces, Testing hub)</td>
          <td><strong>Yes</strong></td>
          <td>Postgres + Neon Auth for the documented self-host experience.</td>
        </tr>
        <tr>
          <td><strong>Restormel Testing CLI</strong> (deterministic suites against your app)</td>
          <td><strong>No</strong></td>
          <td>GA quickstart can run without self-hosting Keys or any database.</td>
        </tr>
        <tr>
          <td><strong>Testing run jobs API</strong> (durable job history)</td>
          <td><strong>Optional</strong></td>
          <td>In-memory without a URL; Postgres when you configure a runs database URL.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <h2>Restormel Keys dashboard: Neon checklist</h2>
  <ol class="doc-ol">
    <li>Create a <strong>Neon project</strong> in a region close to your app.</li>
    <li>
      Use a <strong>production branch</strong> for live traffic; use <strong>child or preview branches</strong> for development and CI so schema changes are validated safely.
    </li>
    <li>
      Set the <strong>pooled</strong> connection string as <code class="inline-code">DATABASE_URL</code> on the dashboard runtime (never commit it).
    </li>
    <li>
      Enable <strong>Neon Auth</strong>, add <strong>GitHub</strong> as an OAuth provider in the Neon Console, and set <code class="inline-code">NEON_AUTH_BASE_URL</code> to Neon’s Auth base URL for that branch. Point your GitHub OAuth App callback at your deployment’s dashboard auth callback path.
    </li>
    <li>
      Apply the versioned SQL migrations from the open-source
      <a
        href="https://github.com/Allotment-Technology-Ltd/restormel-keys/tree/main/apps/dashboard/migrations"
        rel="noopener noreferrer"
        target="_blank"><code>apps/dashboard/migrations/</code></a
      >
      directory in sorted filename order.
    </li>
  </ol>

  <h2>CI and preview databases</h2>
  <p>
    The <strong>restormel-keys</strong> repository includes GitHub Actions workflows that can create or reuse <strong>Neon preview branches</strong> for pull requests, run the same migration script against a preview
    <code class="inline-code">DATABASE_URL</code>, and expire branches when PRs close. Store <code class="inline-code">NEON_API_KEY</code> and project identifiers only in GitHub Actions secrets and variables.
  </p>
  <p>
    <strong>Cost control:</strong> A <strong>Neon ↔ Vercel Marketplace integration</strong> can create <code class="inline-code">preview/…</code> branches (Neon metadata: <code class="inline-code">creation_source: vercel</code>); that is not set in repo <code class="inline-code">vercel.json</code>. Neon’s docs: managed integrations enable preview branching; a
    <a href="https://neon.com/docs/guides/vercel-manual" rel="noopener noreferrer" target="_blank">manual Vercel connection</a>
    does not. <strong>Dependabot previews do not need Neon</strong>—disconnect integration + manual env, or prune/retention (see runbook). The repo ships a
    <strong>Prune stale Neon preview branches</strong> workflow (weekly live prune; manual runs default to dry-run). Maintainer detail:
    <a
      href="https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/runbooks/dashboard-postgres-migrations.md"
      rel="noopener noreferrer"
      target="_blank">dashboard-postgres-migrations.md</a
    >
    (section <em>Neon compute: preview branches and cost</em>).
  </p>

  <h2>Ingestion, knowledge graphs, and Restormel Graph</h2>
  <p>
    Example applications such as <strong>SOPHIA</strong> (<a href="https://github.com/Allotment-Technology-Ltd/sophia" rel="noopener noreferrer" target="_blank">open repository</a>) use Neon Postgres as a
    <strong>durable layer</strong> for long-running ingestion: orchestration, staging, checkpoints, and document storage. A <strong>graph database</strong> (for example SurrealDB) may hold the knowledge graph used for retrieval and exploration; Neon remains the reliability spine for state that must survive restarts and coordinate workers.
  </p>
  <p>
    For graph UI and types, Restormel publishes <code class="inline-code">@restormel/graph-core</code> and <code class="inline-code">@restormel/ui-graph-svelte</code>. SvelteKit integrators should follow
    <a href="https://restormel.dev/graph/docs/integration/sveltekit">Restormel Graph — SvelteKit integration</a>.
  </p>

  <h2>Optional: Postgres for Testing run persistence</h2>
  <p>
    If you run the Testing runs HTTP API with durable storage, supply a Postgres URL and apply the run-jobs migration set documented in the repository’s Testing runs server docs. Prefer a dedicated env var when you want isolation from the dashboard database.
  </p>

  <h2>Other Postgres providers</h2>
  <p>
    Other Postgres-compatible hosts may work if you run the same migrations and accept differences in branching, Auth, and drivers. <strong>Neon is the tested default</strong> for Restormel Keys and the path we document for self-hosters.
  </p>

  <h2>Related on restormel.dev</h2>
  <ul class="doc-ul">
    <li><a href="/keys/docs/guides/keys-testing-onboarding">Keys + Restormel Testing onboarding</a></li>
    <li><a href="/keys/docs/guides/environment-vocabulary">Environment vocabulary</a></li>
    <li><a href="/keys/docs">Docs overview</a></li>
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
  .doc-content p {
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-4);
  }
  .inline-code {
    font-family: var(--rm-font-ui);
    font-size: 0.9em;
    padding: 0.1em 0.3em;
    border-radius: 4px;
    background: var(--rm-bg);
    border: 1px solid var(--rm-border);
  }
  .callout {
    padding: var(--space-4);
    border-radius: var(--rm-radius);
    margin-bottom: var(--space-6);
    border: 1px solid var(--rm-border);
  }
  .callout-tip {
    border-left: 4px solid var(--rm-sage);
    background: color-mix(in oklab, var(--rm-sage) 8%, var(--rm-surface));
  }
  .callout a {
    color: var(--rm-sage);
  }
  .doc-ol,
  .doc-ul {
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    margin: 0 0 var(--space-4);
    padding-left: var(--space-6);
  }
  .doc-ol li,
  .doc-ul li {
    margin-bottom: var(--space-2);
  }
  .doc-ol a,
  .doc-ul a {
    color: var(--rm-sage);
  }
  .doc-table-wrap {
    overflow-x: auto;
    margin-bottom: var(--space-6);
  }
  .doc-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }
  .doc-table th,
  .doc-table td {
    border: 1px solid var(--rm-border);
    padding: var(--space-2) var(--space-3);
    text-align: left;
    vertical-align: top;
  }
  .doc-table th {
    background: var(--rm-surface-raised);
    color: var(--rm-text);
  }
  .doc-table td {
    color: var(--rm-muted);
  }
</style>
