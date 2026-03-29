<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";

  export let data: {
    pro: boolean;
    projectId: string | null;
    health: any;
  };

  let loading = false;
  let error: string | null = null;
  let selectedProjectId = data.projectId ?? "";
  let report: any = data.health?.data ?? null;

  const projects: { id: string; name: string }[] = data.health?.data?.projects ?? [];

  async function loadProject(nextProjectId: string) {
    selectedProjectId = nextProjectId;
    error = null;
    loading = true;
    try {
      const qs = nextProjectId ? `?projectId=${encodeURIComponent(nextProjectId)}` : "";
      const res = await fetch(`${DASHBOARD_BASE}/api/healthcheck${qs}`);
      const payload = await res.json();
      report = payload?.data ?? null;
      history.replaceState(null, "", nextProjectId ? `${DASHBOARD_BASE}/healthcheck?projectId=${encodeURIComponent(nextProjectId)}` : `${DASHBOARD_BASE}/healthcheck`);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  function statusLabel(s: string | null | undefined): string {
    if (!s) return "—";
    return s;
  }
</script>

<h1 class="page-title">System Health</h1>
<p class="page-desc">
  Health checks verify your providers are reachable and your configuration is valid before requests are made.
</p>

{#if !data.pro}
  <div class="pro-gate" role="note" aria-label="Pro feature">
    <p class="pro-title">Pro feature preview</p>
    <p class="pro-desc">Unlock provider reachability checks and configuration validation before production traffic.</p>
    <div class="health-preview">
      <table>
        <thead>
          <tr><th>Provider</th><th>Status</th><th>Last checked</th></tr>
        </thead>
        <tbody>
          <tr><td>OpenAI</td><td><span class="status-success">Reachable</span></td><td>2m ago</td></tr>
          <tr><td>Anthropic</td><td><span class="status-success">Reachable</span></td><td>5m ago</td></tr>
          <tr><td>Portkey</td><td><span class="status-error">Unreachable</span></td><td>1m ago</td></tr>
        </tbody>
      </table>
    </div>
    <p class="pro-actions">
      <a class="btn btn-primary" href={DASHBOARD_BASE + "/billing"}>Upgrade to Pro</a>
      <a class="btn btn-secondary" href="/keys/docs/walkthrough/verification-strategy">See verification strategy</a>
      <a class="btn btn-secondary" href="/keys/docs/integrations/cli">Run checks via CLI (free) →</a>
    </p>
  </div>
{:else}
  <section class="section">
    <div class="section-header">
      <h2 class="section-title">Workspace</h2>
      {#if loading}<span class="muted">Loading…</span>{/if}
    </div>

    {#if error}
      <p class="error-msg" role="alert">{error}</p>
    {/if}

    {#if report}
      <div class="grid">
        <div class="card">
          <div class="card-label">Integrations</div>
          <div class="card-value">{report.workspace.integrations.total}</div>
          <div class="card-meta">
            verified {report.workspace.integrations.verified} · pending {report.workspace.integrations.pending} · unverified {report.workspace.integrations.unverified}
          </div>
        </div>
        <div class="card">
          <div class="card-label">Policies</div>
          <div class="card-value">{report.workspace.policies.total}</div>
          <div class="card-meta">workspace policies</div>
        </div>
        <div class="card">
          <div class="card-label">Models</div>
          <div class="card-value">{report.workspace.models.total}</div>
          <div class="card-meta">
            latest catalog verify {report.workspace.models.latestSourceVerifiedAt ? new Date(report.workspace.models.latestSourceVerifiedAt).toLocaleDateString() : "—"}
          </div>
        </div>
      </div>
    {:else}
      <p class="muted">No health data.</p>
    {/if}
  </section>

  <section class="section">
    <div class="section-header">
      <h2 class="section-title">Project</h2>
      <div class="picker">
        <label class="sr-only" for="project">Project</label>
        <select
          id="project"
          class="select"
          bind:value={selectedProjectId}
          on:change={() => loadProject(selectedProjectId)}
        >
          <option value="">Select a project…</option>
          {#each projects as p}
            <option value={p.id}>{p.name}</option>
          {/each}
        </select>
      </div>
    </div>

    {#if report?.project}
      <p class="muted">
        Status: <strong class={"status status-" + statusLabel(report.project.status)}>{statusLabel(report.project.status)}</strong>
      </p>
      <div class="env-list">
        {#each report.project.environments as env}
          <div class="env-row">
            <div class="env-main">
              <div class="env-name">{env.name}</div>
              <div class="env-meta">
                <span class={"status status-" + statusLabel(env.status)}>{statusLabel(env.status)}</span>
                <span class="dot">·</span>
                <span>{env.routes.active} active routes</span>
                {#if env.routes.activeWithNoEnabledStep > 0}
                  <span class="dot">·</span>
                  <span class="warn">{env.routes.activeWithNoEnabledStep} route(s) with no enabled step</span>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else if selectedProjectId}
      <p class="muted">No project report available.</p>
    {:else}
      <p class="muted">Select a project to validate routes and steps.</p>
    {/if}
  </section>
{/if}

<style>
  .page-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: 600;
    margin: 0 0 var(--space-2);
    color: var(--rm-text);
  }
  .page-desc {
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
  }
  .section {
    margin: 0 0 var(--space-8);
  }
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    margin: 0 0 var(--space-3);
  }
  .section-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    margin: 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-4);
  }
  @media (max-width: 900px) {
    .grid { grid-template-columns: 1fr; }
  }
  .card {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    padding: var(--space-4);
  }
  .card-label { color: var(--rm-dim); font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em; }
  .card-value { font-size: var(--text-2xl); font-weight: 700; margin: var(--space-1) 0; }
  .card-meta { color: var(--rm-muted); font-size: var(--text-sm); }
  .picker { display: flex; align-items: center; gap: var(--space-2); }
  .select {
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: 0.45rem 0.6rem;
    color: var(--rm-text);
  }
  .env-list { display: flex; flex-direction: column; gap: var(--space-3); }
  .env-row {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    padding: var(--space-3) var(--space-4);
  }
  .env-name { font-weight: 600; color: var(--rm-text); }
  .env-meta { color: var(--rm-muted); font-size: var(--text-sm); margin-top: 0.2rem; display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
  .dot { color: var(--rm-dim); }
  .status { font-weight: 600; text-transform: uppercase; font-size: var(--text-xs); letter-spacing: 0.06em; }
  .status-ok { color: var(--rm-sage); }
  .status-warn { color: var(--rm-warning, #b45309); }
  .status-fail { color: var(--rm-danger, #b91c1c); }
  .warn { color: var(--rm-warning, #b45309); font-weight: 600; }
  .muted { color: var(--rm-muted); }
  .error-msg { color: var(--coral-alert); }

  .pro-gate {
    border: 1px solid var(--rm-border);
    border-left: 4px solid var(--rm-primary);
    border-radius: var(--rm-radius);
    background: color-mix(in oklab, var(--rm-primary) 8%, var(--rm-surface));
    padding: var(--space-4);
    margin: 0 0 var(--space-8);
  }
  .health-preview {
    opacity: 0.6;
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    margin: 0 0 var(--space-3);
    overflow: hidden;
  }
  .health-preview table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }
  .health-preview th,
  .health-preview td {
    padding: var(--space-2);
    border-bottom: 1px solid var(--rm-border);
    color: var(--rm-muted);
    text-align: left;
  }
  .health-preview th {
    color: var(--rm-dim);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .pro-title { margin: 0 0 var(--space-2); font-weight: 700; color: var(--rm-text); }
  .pro-desc { margin: 0 0 var(--space-3); color: var(--rm-muted); }
  .pro-actions { display: flex; gap: var(--space-2); margin: 0; }
  .btn { display: inline-block; padding: 0.5rem 0.9rem; border-radius: var(--rm-radius); border: 1px solid var(--rm-border); }
  .btn-primary { background: var(--rm-sage); color: var(--rm-bg); border-color: transparent; }
  .btn-secondary { background: var(--rm-surface-raised); color: var(--rm-text); }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>

