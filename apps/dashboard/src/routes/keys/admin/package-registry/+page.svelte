<script lang="ts">
  import { ADMIN_BASE, DASHBOARD_BASE } from "$lib/dashboard-base";
  import type {
    LibrariesIoDependentsLoad,
    NpmVersionDownloadsLoad,
  } from "$lib/server/npm-package-insights";

  export let data: {
    packageName: string;
    githubRepoFullName: string;
    versionDownloads: NpmVersionDownloadsLoad;
    dependents: LibrariesIoDependentsLoad;
    links: {
      npm: string;
      githubDependents: string;
      depsDev: string;
      librariesIo: string;
    };
  };
</script>

<h1 class="page-title">Package registry insights</h1>
<p class="page-desc">
  Public registry signals for <strong>{data.packageName}</strong>. Download breakdown uses npm’s
  <strong>last-week per-version</strong> API (UTC window; includes CI and mirrors — directional only). Declared dependents come from
  <a href="https://libraries.io" target="_blank" rel="noopener noreferrer">Libraries.io</a> and may lag or omit private repos; GitHub’s
  dependency graph is the canonical view for repository links.
</p>

<section class="panel" aria-labelledby="links-heading">
  <h2 id="links-heading" class="section-title">Open in registry &amp; graphs</h2>
  <ul class="link-grid">
    <li>
      <a class="card-link" href={data.links.npm} target="_blank" rel="noopener noreferrer">npm package page</a>
      <span class="card-hint">Published versions and maintainer view</span>
    </li>
    <li>
      <a class="card-link" href={data.links.githubDependents} target="_blank" rel="noopener noreferrer">GitHub Dependents</a>
      <span class="card-hint">Repositories GitHub links to this project</span>
    </li>
    <li>
      <a class="card-link" href={data.links.depsDev} target="_blank" rel="noopener noreferrer">deps.dev</a>
      <span class="card-hint">Open Source Insights dependency view</span>
    </li>
    <li>
      <a class="card-link" href={data.links.librariesIo} target="_blank" rel="noopener noreferrer">Libraries.io</a>
      <span class="card-hint">Third-party crawl (API powers the list below)</span>
    </li>
  </ul>
</section>

<section class="panel" aria-labelledby="versions-heading">
  <h2 id="versions-heading" class="section-title">Version downloads (npm, last week)</h2>
  {#if data.versionDownloads.ok}
    <p class="section-meta">
      Total across listed versions: <strong>{data.versionDownloads.totalDownloads.toLocaleString()}</strong>
      (sum of per-version counts from the registry).
    </p>
    <div class="table-wrap">
      <table class="data-table" aria-label="Per-version npm downloads for the last week">
        <thead>
          <tr>
            <th scope="col">Version</th>
            <th scope="col">Downloads</th>
          </tr>
        </thead>
        <tbody>
          {#each data.versionDownloads.rows as row}
            <tr>
              <td>
                <code>{row.version}</code>
                {#if row.isLatest}<span class="badge">latest</span>{/if}
              </td>
              <td>{row.downloads.toLocaleString()}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="banner-error" role="alert">Could not load version downloads: {data.versionDownloads.error}</p>
  {/if}
</section>

<section class="panel" aria-labelledby="deps-heading">
  <h2 id="deps-heading" class="section-title">Declared dependent repositories</h2>
  <p class="section-meta">
    Crawled via Libraries.io for packages that list <code>{data.packageName}</code>. This monorepo is excluded from “External” when it
    appears as <code>{data.githubRepoFullName}</code>. Set <code>LIBRARIES_IO_API_KEY</code> on the server for higher rate limits.
  </p>
  {#if data.dependents.ok}
    {#if data.dependents.truncated}
      <p class="banner-warn" role="status">
        List may be truncated (fetched up to {data.dependents.pagesFetched} API pages). Open Libraries.io or GitHub for the full graph.
      </p>
    {/if}
    <h3 class="subsection-title">External repositories</h3>
    {#if data.dependents.externalRepos.length === 0}
      <p class="empty-hint">No external dependents returned yet (indexing can lag, or consumers are private).</p>
    {:else}
      <div class="table-wrap">
        <table class="data-table" aria-label="External GitHub repositories declaring a dependency on this package">
          <thead>
            <tr>
              <th scope="col">Repository</th>
              <th scope="col">Language</th>
              <th scope="col">Stars</th>
              <th scope="col">Pushed</th>
            </tr>
          </thead>
          <tbody>
            {#each data.dependents.externalRepos as r}
              <tr>
                <td>
                  <a href={r.repoUrl} target="_blank" rel="noopener noreferrer">{r.fullName}</a>
                  {#if r.description}
                    <span class="row-desc">{r.description}</span>
                  {/if}
                </td>
                <td>{r.language ?? "—"}</td>
                <td>{r.stars.toLocaleString()}</td>
                <td>{r.pushedAt ? r.pushedAt.slice(0, 10) : "—"}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
    <h3 class="subsection-title">Including monorepo / self-reference</h3>
    <p class="section-meta">
      Full deduplicated set ({data.dependents.repos.length} {data.dependents.repos.length === 1 ? "repo" : "repos"}) may include this
      repository when Libraries.io indexes the published package from source.
    </p>
    {#if data.dependents.repos.length > 0}
      <ul class="repo-list">
        {#each data.dependents.repos as r}
          <li>
            <a href={r.repoUrl} target="_blank" rel="noopener noreferrer">{r.fullName}</a>
          </li>
        {/each}
      </ul>
    {/if}
  {:else}
    <p class="banner-error" role="alert">Could not load dependents: {data.dependents.error}</p>
  {/if}
</section>

<p class="page-foot">
  <a class="link" href={DASHBOARD_BASE + "/"}>Keys dashboard</a>
  <span class="sep" aria-hidden="true">·</span>
  <a class="link" href={ADMIN_BASE + "/users"}>User management</a>
</p>

<style>
  .page-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .page-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-5);
    max-width: 48rem;
    line-height: 1.5;
  }
  .page-desc a {
    color: var(--rm-accent, #2563eb);
    text-decoration: underline;
  }
  .panel {
    margin-bottom: var(--space-6);
  }
  .section-title {
    font-size: var(--text-lg);
    font-weight: 600;
    margin: 0 0 var(--space-3);
    color: var(--rm-text);
  }
  .subsection-title {
    font-size: var(--text-md);
    font-weight: 600;
    margin: var(--space-4) 0 var(--space-2);
    color: var(--rm-text);
  }
  .section-meta {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-3);
    max-width: 48rem;
    line-height: 1.45;
  }
  .link-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: var(--space-3);
  }
  .link-grid li {
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    background: var(--rm-surface);
  }
  .card-link {
    display: block;
    font-weight: 600;
    font-size: var(--text-sm);
    color: var(--rm-accent, #2563eb);
    text-decoration: underline;
    margin-bottom: var(--space-1);
  }
  .card-hint {
    display: block;
    font-size: var(--text-xs);
    color: var(--rm-dim);
    line-height: 1.35;
  }
  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface);
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }
  .data-table th,
  .data-table td {
    padding: var(--space-3);
    text-align: left;
    border-bottom: 1px solid var(--rm-border);
    vertical-align: top;
  }
  .data-table th {
    font-weight: 600;
    color: var(--rm-dim);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .badge {
    display: inline-block;
    margin-left: var(--space-2);
    padding: 0.1rem 0.4rem;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: 600;
    border: 1px solid color-mix(in srgb, var(--rm-accent, #2563eb) 35%, var(--rm-border));
    color: var(--rm-text);
  }
  .row-desc {
    display: block;
    font-size: var(--text-xs);
    color: var(--rm-dim);
    margin-top: var(--space-1);
  }
  .repo-list {
    margin: 0;
    padding-left: 1.25rem;
    font-size: var(--text-sm);
  }
  .repo-list a {
    color: var(--rm-accent, #2563eb);
    text-decoration: underline;
  }
  .empty-hint {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-3);
  }
  .banner-error {
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--rm-danger, #b91c1c) 12%, transparent);
    font-size: var(--text-sm);
    margin: 0;
  }
  .banner-warn {
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--rm-warn, #ca8a04) 14%, transparent);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-3);
  }
  .page-foot {
    margin-top: var(--space-8);
    font-size: var(--text-sm);
  }
  .link {
    color: var(--rm-accent, #2563eb);
    text-decoration: underline;
  }
  .sep {
    margin: 0 var(--space-2);
    color: var(--rm-dim);
  }
</style>
