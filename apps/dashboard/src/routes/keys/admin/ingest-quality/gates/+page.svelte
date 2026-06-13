<script lang="ts">
  import { INGEST_QUALITY_GATES } from "$lib/connect/ingest-quality-gate-defs";
  import { ADMIN_BASE, DASHBOARD_BASE } from "$lib/dashboard-base";
  import type { GateStatusRow, ProductionG2SampleJob } from "$lib/server/connect/ingest-quality-gates-data";

  export let data: {
    g2Sample: ProductionG2SampleJob[];
    gateStatuses: GateStatusRow[];
    posthogDashboardUrl: string;
    loadError: string | null;
  };

  const CONNECT_INGEST_BASE = `${DASHBOARD_BASE}/runs`;
  const GRAPH_EXPLORER_HREF = `${DASHBOARD_BASE}/claims`;
  const ENGINEERING_DOC_HREF =
    "https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/product/CONNECT-INGEST-QUALITY-BAR.md";

  function statusForGate(gateId: string): GateStatusRow | undefined {
    return data.gateStatuses.find((row) => row.gateId === gateId);
  }

  function statusLabel(status: GateStatusRow["status"]): string {
    switch (status) {
      case "pass":
        return "Pass";
      case "fail":
        return "Blocked";
      case "awaiting":
        return "Awaiting data";
      default:
        return "Manual / offline";
    }
  }

  function formatDate(ms: number): string {
    return new Date(ms).toLocaleString();
  }

  function jobHref(jobId: string): string {
    return `${CONNECT_INGEST_BASE}/${jobId}`;
  }
</script>

<svelte:head>
  <title>Ingest quality gates – Restormel Admin</title>
</svelte:head>

<p class="iq-gates-back">
  <a href="{ADMIN_BASE}/ingest-quality">← Ingest quality loop</a>
</p>

<h1 class="admin-h1">Connect ingest quality gates</h1>
<p class="admin-lead">
  Canonical reference for G1–G7: what we measure, the targets, live status where available, and
  what to do when a gate blocks. Service admins only. Use
  <a href="{ADMIN_BASE}/ingest-quality">Ingest quality</a> to evaluate thresholds and apply
  calibrations once G2 passes.
</p>

{#if data.loadError}
  <p class="admin-error" role="alert">{data.loadError}</p>
{/if}

<section class="admin-section" aria-labelledby="iq-gates-glance-heading">
  <h2 id="iq-gates-glance-heading" class="admin-h2">At a glance</h2>
  <p class="admin-muted iq-gates-prose">
    A release is <strong>best-in-class aligned</strong> when all gates pass on the reference
    philosophy pack and at least one non-philosophy template pack. Until G1–G4 pass in staging, do
    not claim best-in-class externally.
  </p>
  <div class="iq-glance-scroll">
    <table class="admin-table iq-glance-table">
      <thead>
        <tr>
          <th scope="col">Gate</th>
          <th scope="col">Target</th>
          <th scope="col">Status</th>
          <th scope="col">Current</th>
        </tr>
      </thead>
      <tbody>
        {#each INGEST_QUALITY_GATES as gate (gate.id)}
          {@const live = statusForGate(gate.id)}
          <tr>
            <th scope="row">
              <a href="#{gate.id}" class="iq-gate-anchor">{gate.shortName}</a>
            </th>
            <td>{gate.target}</td>
            <td>
              {#if live}
                <span
                  class="iq-gate-badge iq-gate-badge-inline"
                  class:iq-gate-badge-pass={live.status === "pass"}
                  class:iq-gate-badge-fail={live.status === "fail"}
                  class:iq-gate-badge-await={live.status === "awaiting"}
                  class:iq-gate-badge-manual={live.status === "manual"}
                >
                  {statusLabel(live.status)}
                </span>
              {:else}
                —
              {/if}
            </td>
            <td>{live?.metricLine ?? "—"}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<section class="admin-section" aria-labelledby="iq-gates-loop-heading">
  <h2 id="iq-gates-loop-heading" class="admin-h2">How this fits the operator loop</h2>
  <ol class="iq-loop-steps">
    <li>
      <strong>Run production ingests</strong> — <code>quality_preset: production</code> on domain
      packs; starter is explicit opt-down only. G6 confirms the full worker ran and units were
      written.
    </li>
    <li>
      <strong>Review in Claims</strong> — operator overrides become review signals (G5
      latency tracked in PostHog).
    </li>
    <li>
      <strong>Check gates here</strong> — G2 faithfulness and G3 trust score aggregate from the
      production sample below. G2 must pass before Apply unlocks.
    </li>
    <li>
      <strong>Evaluate and apply</strong> on
      <a href="{ADMIN_BASE}/ingest-quality">Ingest quality</a> — fired thresholds bump builtin
      <code>prompt_template_version</code> (G7 audited in run history).
    </li>
  </ol>
</section>

<section class="admin-section" aria-labelledby="iq-gates-ref-heading">
  <h2 id="iq-gates-ref-heading" class="admin-h2">Gate reference</h2>
  <div class="iq-gates-grid">
    {#each INGEST_QUALITY_GATES as gate (gate.id)}
      {@const live = statusForGate(gate.id)}
      <article class="iq-gate-card" id={gate.id} aria-labelledby="{gate.id}-title">
        <header class="iq-gate-card-head">
          <h3 id="{gate.id}-title" class="iq-gate-title">{gate.shortName}</h3>
          {#if live}
            <span
              class="iq-gate-badge"
              class:iq-gate-badge-pass={live.status === "pass"}
              class:iq-gate-badge-fail={live.status === "fail"}
              class:iq-gate-badge-await={live.status === "awaiting"}
              class:iq-gate-badge-manual={live.status === "manual"}
            >
              {statusLabel(live.status)}
            </span>
          {/if}
        </header>
        <p class="iq-gate-target">
          <span class="iq-gate-target-label">Target</span>
          {gate.target}
        </p>
        <p class="iq-gate-body">{gate.body}</p>
        {#if live && (live.status === "fail" || live.status === "awaiting")}
          <div class="iq-gate-blocked">
            <p class="iq-gate-blocked-label">If blocked or awaiting data</p>
            <p class="iq-gate-blocked-text">{gate.whenBlocked}</p>
            {#if live.metricLine}
              <p class="iq-gate-metric">
                <span class="iq-gate-metric-label">Current</span>
                {live.metricLine}
              </p>
            {/if}
          </div>
        {/if}
      </article>
    {/each}
  </div>
</section>

<section class="admin-section" id="g2-sample" aria-labelledby="iq-g2-sample-heading">
  <h2 id="iq-g2-sample-heading" class="admin-h2">Production sample (G2 · G3 · G6)</h2>
  <p class="admin-muted iq-gates-prose">
    Latest completed ingests with <code>quality_preset: production</code> and a stored
    <code>quality_report</code> (up to 10 jobs). This sample drives live G2, G3, and G6 status in
    the table above and gates Apply calibration on the ingest-quality loop.
  </p>
  <dl class="iq-glossary">
    <div>
      <dt>Ok %</dt>
      <dd>Share of units marked ok after remediation (G2).</dd>
    </div>
    <div>
      <dt>Unsupported %</dt>
      <dd>Units lacking adequate source grounding — must stay ≤2% averaged (G2).</dd>
    </div>
    <div>
      <dt>Trust</dt>
      <dd>kg_audit trust score v1 when graph stats exist (G3).</dd>
    </div>
    <div>
      <dt>Mode</dt>
      <dd><code>full</code> worker pipeline required; <code>stub</code> fails G6.</dd>
    </div>
    <div>
      <dt>Units</dt>
      <dd>Graph units written; zero fails G6.</dd>
    </div>
  </dl>
  {#if data.g2Sample.length === 0}
    <p class="admin-muted" role="status">
      No production sample jobs yet. Start a Connect ingest with production quality preset and wait
      for completion — see <a href={CONNECT_INGEST_BASE}>all ingest runs</a>.
    </p>
  {:else}
    <div class="iq-sample-scroll">
      <table class="admin-table iq-sample-table">
        <thead>
          <tr>
            <th scope="col">Completed</th>
            <th scope="col">Run</th>
            <th scope="col">Mode</th>
            <th scope="col">Units</th>
            <th scope="col">Ok %</th>
            <th scope="col">Unsupported %</th>
            <th scope="col">Trust</th>
            <th scope="col">G2</th>
          </tr>
        </thead>
        <tbody>
          {#each data.g2Sample as job}
            <tr>
              <td>{formatDate(job.updatedAt)}</td>
              <td>
                <a href={jobHref(job.id)}>{job.label?.trim() || job.id.slice(0, 8)}</a>
              </td>
              <td>{job.report.executionMode ?? "—"}</td>
              <td>{job.report.units ?? "—"}</td>
              <td>{job.report.okPct}%</td>
              <td>{job.report.unsupportedPct}%</td>
              <td>
                {job.report.trustScore != null ? job.report.trustScore : "—"}
              </td>
              <td>
                <span
                  class="iq-sample-g2"
                  class:iq-pass={job.g2Pass}
                  class:iq-fail={!job.g2Pass}
                  title={job.g2Reasons.join("; ")}
                >
                  {job.g2Pass ? "Pass" : "Fail"}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<section class="admin-section iq-actions-section" aria-labelledby="iq-actions-heading">
  <h2 id="iq-actions-heading" class="admin-h2">Related actions</h2>
  <ul class="iq-actions-list">
    <li>
      <a href="{ADMIN_BASE}/ingest-quality">Ingest quality loop</a> — evaluate thresholds, apply
      calibration (G2 must pass).
    </li>
    <li>
      <a href={CONNECT_INGEST_BASE}>Connect ingest runs</a> — start or inspect production jobs.
    </li>
    <li>
      <a href={GRAPH_EXPLORER_HREF}>Claims</a> — triage units and review signals (G5).
    </li>
    <li>
      <a href={data.posthogDashboardUrl} target="_blank" rel="noopener noreferrer"
        >PostHog — Connect Ingest Quality</a
      > — operator latency and ingest events (G5).
    </li>
    <li>
      <a href="/graph/docs">Graph retrieval docs</a> — context for G4 offline benchmarks.
    </li>
    <li>
      <a href={ENGINEERING_DOC_HREF} target="_blank" rel="noopener noreferrer"
        >CONNECT-INGEST-QUALITY-BAR.md</a
      > — engineering changelog of targets and artifacts.
    </li>
  </ul>
</section>

<style>
  .iq-gates-back {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
  }
  .admin-h1 {
    margin: 0 0 var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-mono-xl);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .admin-lead {
    margin: 0 0 var(--space-5);
    color: var(--color-ink-muted);
    max-width: 46rem;
    line-height: 1.55;
  }
  .admin-h2 {
    margin: 0 0 var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .admin-section {
    margin-bottom: var(--space-6);
    padding-bottom: var(--space-5);
    border-bottom: var(--border-thin);
  }
  .iq-actions-section {
    border-bottom: none;
  }
  .admin-muted {
    color: var(--color-ink-muted);
    font-size: var(--text-sm);
  }
  .admin-error {
    padding: var(--space-3);
    border: var(--border);
    background: var(--state-fail-bg);
    margin-bottom: var(--space-4);
  }
  .iq-gates-prose {
    max-width: 46rem;
    line-height: 1.55;
    margin-bottom: var(--space-3);
  }
  .iq-glance-scroll,
  .iq-sample-scroll {
    overflow-x: auto;
  }
  .admin-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }
  .admin-table th,
  .admin-table td {
    border: var(--border-thin);
    padding: var(--space-2) var(--space-3);
    text-align: left;
    vertical-align: top;
  }
  .admin-table th {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    text-transform: uppercase;
  }
  .iq-glance-table th[scope="row"] {
    text-transform: none;
    font-family: inherit;
    font-size: var(--text-sm);
    font-weight: 600;
    white-space: nowrap;
  }
  .iq-gate-anchor {
    color: inherit;
    text-decoration: none;
    font-weight: 600;
  }
  .iq-gate-anchor:hover {
    text-decoration: underline;
  }
  .iq-loop-steps {
    margin: 0;
    padding-left: 1.25rem;
    max-width: 46rem;
    line-height: 1.55;
    font-size: var(--text-sm);
  }
  .iq-loop-steps li + li {
    margin-top: var(--space-2);
  }
  .iq-gates-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .iq-gate-card {
    border: var(--border);
    padding: var(--space-4);
    background: var(--color-surface);
    scroll-margin-top: var(--space-4);
  }
  .iq-gate-card-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }
  .iq-gate-title {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .iq-gate-badge {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    padding: 2px 8px;
    border: var(--border-thin);
    white-space: nowrap;
  }
  .iq-gate-badge-inline {
    display: inline-block;
  }
  .iq-gate-badge-pass {
    background: var(--state-ok-bg);
  }
  .iq-gate-badge-fail {
    background: var(--state-fail-bg);
  }
  .iq-gate-badge-await,
  .iq-gate-badge-manual {
    background: var(--color-bg-deep);
    color: var(--color-ink-muted);
  }
  .iq-gate-target {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    line-height: 1.5;
    padding: var(--space-2) var(--space-3);
    border: var(--border-thin);
    background: var(--color-bg-deep);
  }
  .iq-gate-target-label,
  .iq-gate-metric-label,
  .iq-gate-blocked-label {
    display: block;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    text-transform: uppercase;
    color: var(--color-ink-muted);
    margin-bottom: var(--space-1);
  }
  .iq-gate-body {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.55;
    max-width: 46rem;
  }
  .iq-gate-blocked {
    margin-top: var(--space-3);
    padding: var(--space-3);
    border: var(--border-thin);
    border-left: 3px solid var(--color-ink-muted);
    background: var(--color-bg);
  }
  .iq-gate-blocked-text,
  .iq-gate-metric {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.5;
  }
  .iq-gate-metric {
    margin-top: var(--space-2);
  }
  .iq-glossary {
    margin: 0 0 var(--space-4);
    display: grid;
    gap: var(--space-2);
    max-width: 46rem;
    font-size: var(--text-sm);
  }
  .iq-glossary dt {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    text-transform: uppercase;
    color: var(--color-ink-muted);
  }
  .iq-glossary dd {
    margin: 0 0 var(--space-1);
    line-height: 1.45;
  }
  .iq-sample-g2 {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: var(--text-mono-sm);
    text-transform: uppercase;
  }
  .iq-pass {
    color: var(--color-green, #2e7d32);
  }
  .iq-fail {
    color: var(--color-red, #c62828);
  }
  .iq-actions-list {
    margin: 0;
    padding-left: 1.25rem;
    max-width: 46rem;
    font-size: var(--text-sm);
    line-height: 1.55;
  }
  .iq-actions-list li + li {
    margin-top: var(--space-2);
  }
</style>
