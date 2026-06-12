<script lang="ts">
  import IngestQualityCallout from "$lib/components/admin/IngestQualityCallout.svelte";
  import PostHogDashboardEmbed from "$lib/components/admin/PostHogDashboardEmbed.svelte";
  import {
    describeApplyDisabled,
    describeG2Gate,
    describeNoReviewSignals,
    describeNoThresholdsFired,
    isG2AwaitingData,
  } from "$lib/connect/ingest-quality-messages";
  import { ADMIN_BASE } from "$lib/dashboard-base";
  import type { FiredThreshold } from "$lib/server/connect/ingest-quality-thresholds";
  import type { IngestQualityRunRecord } from "$lib/server/neon";

  export let data: {
    days: number;
    summary: {
      windowDays: number;
      signalCount: number;
      agreementPct: number;
      topOverrides: { delta: string; count: number }[];
      aggregatesByArchetype: { archetype: string; total: number }[];
    };
    runs: IngestQualityRunRecord[];
    g2: {
      pass: boolean;
      reasons: string[];
      ok_pct: number;
      unsupported_pct: number;
      sample_jobs: number;
    };
    posthogDashboardUrl: string;
    posthogEmbedUrl: string | null;
    loadError: string | null;
  };

  let days = data.days;
  let summary = data.summary;
  let runs = data.runs;
  let g2 = data.g2;
  let loadError = data.loadError;

  let evaluating = false;
  let applying = false;
  let errorMessage: string | null = null;
  let successMessage: string | null = null;
  let latestEval: {
    runId: string;
    fired: FiredThreshold[];
    briefMarkdown: string;
  } | null = null;
  let showApplyConfirm = false;

  $: latestRun = runs[0] ?? null;
  $: firedRows = latestEval?.fired ?? parseFired(latestRun);
  $: applyRunId =
    latestEval?.runId ?? (latestRun?.status === "evaluated" ? latestRun.id : null);
  $: canApply = applyRunId != null && firedRows.length > 0 && g2.pass;
  $: g2AwaitingData = isG2AwaitingData(g2);
  $: g2Callout = describeG2Gate(g2);
  $: applyDisabledCallout = describeApplyDisabled({
    canApply,
    firedCount: firedRows.length,
    g2Pass: g2.pass,
    g2AwaitingData,
    latestRunApplied: latestRun?.status === "applied",
    hasFreshEval: latestEval != null,
  });

  function parseFired(run: IngestQualityRunRecord | null): FiredThreshold[] {
    if (!run || !Array.isArray(run.fired)) return [];
    return run.fired as FiredThreshold[];
  }

  async function refreshSummary() {
    const res = await fetch(`${ADMIN_BASE}/api/ingest-quality/summary?days=${days}`, {
      credentials: "same-origin",
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload.error ?? `Summary failed (${res.status})`);
    }
    summary = payload.summary;
    runs = payload.runs ?? runs;
    g2 = payload.g2 ?? g2;
  }

  async function evaluateNow() {
    errorMessage = null;
    successMessage = null;
    evaluating = true;
    try {
      const res = await fetch(`${ADMIN_BASE}/api/ingest-quality/evaluate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ days }),
        credentials: "same-origin",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        errorMessage = payload.error ?? `Evaluate failed (${res.status})`;
        return;
      }
      latestEval = {
        runId: payload.runId,
        fired: payload.fired ?? [],
        briefMarkdown: payload.briefMarkdown ?? "",
      };
      successMessage =
        payload.fired?.length > 0
          ? `Evaluation complete — ${payload.fired.length} threshold(s) fired.`
          : "Evaluation complete — no thresholds fired.";
      await refreshSummary();
    } catch {
      errorMessage = "Network error during evaluation.";
    } finally {
      evaluating = false;
    }
  }

  async function applyCalibration() {
    if (!applyRunId) return;
    const runId = applyRunId;
    errorMessage = null;
    successMessage = null;
    applying = true;
    showApplyConfirm = false;
    try {
      const res = await fetch(`${ADMIN_BASE}/api/ingest-quality/apply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId, confirm: true }),
        credentials: "same-origin",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        errorMessage = payload.error ?? payload.message ?? `Apply failed (${res.status})`;
        if (payload.g2) g2 = payload.g2;
        return;
      }
      const bumped = payload.result?.bumpedPacks?.length ?? 0;
      successMessage = `Calibration applied — bumped ${bumped} builtin pack(s).`;
      latestEval = null;
      await refreshSummary();
    } catch {
      errorMessage = "Network error during apply.";
    } finally {
      applying = false;
    }
  }

  function formatDate(ms: number): string {
    return new Date(ms).toLocaleString();
  }
</script>

<svelte:head>
  <title>Ingest quality – Restormel Admin</title>
</svelte:head>

<h1 class="admin-h1">Connect ingest quality</h1>
<p class="admin-lead">
  Operator loop: review signals → evaluate thresholds → apply builtin prompt calibrations when G2
  passes. Aggregates only — no graph unit bodies.
  <a href="{ADMIN_BASE}/ingest-quality/gates">Gate definitions and live sample</a>.
</p>

{#if loadError}
  <p class="admin-error" role="alert">{loadError}</p>
{/if}

{#if errorMessage}
  <p class="admin-error" role="alert">{errorMessage}</p>
{/if}

{#if successMessage}
  <p class="admin-success" role="status">{successMessage}</p>
{/if}

<section class="admin-section" aria-labelledby="iq-posthog-heading">
  <div class="iq-posthog-header">
    <h2 id="iq-posthog-heading" class="admin-h2">PostHog mirror</h2>
    <a
      class="iq-posthog-link"
      href={data.posthogDashboardUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      Open in PostHog
    </a>
  </div>
  {#if data.posthogEmbedUrl}
    <PostHogDashboardEmbed
      src={data.posthogEmbedUrl}
      title="Connect ingest quality — PostHog dashboard"
    />
  {:else}
    <p class="admin-muted" role="status">
      Embed unavailable. Enable public sharing on the Connect Ingest Quality dashboard in PostHog
      (Share → public link), copy the embed URL, and set
      <code>POSTHOG_INGEST_QUALITY_DASHBOARD_EMBED_URL</code>
      — or configure <code>POSTHOG_API_KEY</code> with sharing scopes so the server can resolve it
      automatically.
    </p>
  {/if}
</section>

<section class="admin-section" aria-labelledby="iq-summary-heading">
  <h2 id="iq-summary-heading" class="admin-h2">Summary ({days}d)</h2>
  {#if summary.signalCount === 0}
    <IngestQualityCallout callout={describeNoReviewSignals(days)} />
  {:else}
    <div class="iq-tiles">
      <div class="iq-tile">
        <span class="iq-tile-label">Signals</span>
        <strong class="iq-tile-value">{summary.signalCount}</strong>
      </div>
      <div class="iq-tile">
        <span class="iq-tile-label">Agreement</span>
        <strong class="iq-tile-value">{summary.agreementPct}%</strong>
      </div>
      <div class="iq-tile">
        <span class="iq-tile-label">G2 ok (avg)</span>
        <strong class="iq-tile-value">{g2.ok_pct}%</strong>
      </div>
      <div class="iq-tile">
        <span class="iq-tile-label">G2 gate</span>
        <strong
          class="iq-tile-value"
          class:iq-pass={g2.pass}
          class:iq-fail={!g2.pass && !g2AwaitingData}
          class:iq-wait={g2AwaitingData}
        >
          {g2.pass ? "Pass" : g2AwaitingData ? "Awaiting data" : "Blocked"}
        </strong>
      </div>
    </div>
    {#if summary.topOverrides.length > 0}
      <p class="admin-muted">
        Top overrides:
        {#each summary.topOverrides as o, i}
          {o.delta} ({o.count}){i < summary.topOverrides.length - 1 ? ", " : ""}
        {/each}
      </p>
    {/if}
  {/if}
  <p class="admin-muted">{g2.sample_jobs} production job(s) in G2 sample</p>
</section>

<section class="admin-section" aria-labelledby="iq-eval-heading">
  <h2 id="iq-eval-heading" class="admin-h2">Evaluate thresholds</h2>
  <div class="iq-actions">
    <label class="iq-label">
      Window (days)
      <input type="number" min="1" max="90" bind:value={days} class="iq-input" />
    </label>
    <button
      type="button"
      class="admin-btn"
      disabled={evaluating}
      on:click={evaluateNow}
    >
      {evaluating ? "Evaluating…" : "Evaluate now"}
    </button>
  </div>

  {#if firedRows.length > 0}
    <table class="admin-table">
      <thead>
        <tr>
          <th scope="col">Archetype</th>
          <th scope="col">Signal</th>
          <th scope="col">Rate</th>
          <th scope="col">Action</th>
        </tr>
      </thead>
      <tbody>
        {#each firedRows as row}
          <tr>
            <td>{row.archetype}</td>
            <td><code>{row.threshold}</code></td>
            <td>{row.rate}% ({row.count}/{row.total})</td>
            <td>{row.action}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else if firedRows.length === 0 && (latestEval || latestRun?.status === "evaluated")}
    <IngestQualityCallout callout={describeNoThresholdsFired(days)} />
  {/if}

  {#if latestEval?.briefMarkdown}
    <details class="iq-brief">
      <summary>Brief preview</summary>
      <pre class="iq-pre">{latestEval.briefMarkdown}</pre>
    </details>
  {:else if latestRun?.briefMarkdown}
    <details class="iq-brief">
      <summary>Latest brief</summary>
      <pre class="iq-pre">{latestRun.briefMarkdown}</pre>
    </details>
  {/if}
</section>

<section class="admin-section" aria-labelledby="iq-apply-heading">
  <h2 id="iq-apply-heading" class="admin-h2">Apply calibration</h2>
  <p class="admin-muted iq-apply-intro">
    When thresholds fire, this step bumps <code>prompt_template_version</code> on matching
    <strong>builtin</strong> domain packs only. G2 must pass first so prompts are not tuned while
    production extraction is unhealthy.
  </p>
  {#if g2Callout}
    <IngestQualityCallout callout={g2Callout} />
  {/if}
  {#if showApplyConfirm}
    <div class="iq-confirm" role="alertdialog" aria-labelledby="iq-confirm-title">
      <p id="iq-confirm-title">
        Bump <code>prompt_template_version</code> on builtin packs for
        {firedRows.length} fired threshold(s)? Custom packs are never changed.
      </p>
      <div class="iq-actions">
        <button type="button" class="admin-btn admin-btn-danger" disabled={applying} on:click={applyCalibration}>
          {applying ? "Applying…" : "Confirm apply"}
        </button>
        <button type="button" class="admin-btn admin-btn-ghost" disabled={applying} on:click={() => (showApplyConfirm = false)}>
          Cancel
        </button>
      </div>
    </div>
  {:else}
    <button
      type="button"
      class="admin-btn"
      disabled={!canApply || applying}
      on:click={() => (showApplyConfirm = true)}
    >
      Apply calibration
    </button>
    {#if applyDisabledCallout}
      <IngestQualityCallout callout={applyDisabledCallout} />
    {/if}
  {/if}
</section>

<section class="admin-section" aria-labelledby="iq-history-heading">
  <h2 id="iq-history-heading" class="admin-h2">Run history</h2>
  {#if runs.length === 0}
    <p class="admin-muted" role="status">No evaluation runs yet.</p>
  {:else}
    <table class="admin-table">
      <thead>
        <tr>
          <th scope="col">Created</th>
          <th scope="col">Window</th>
          <th scope="col">Status</th>
          <th scope="col">Fired</th>
        </tr>
      </thead>
      <tbody>
        {#each runs as run}
          <tr>
            <td>{formatDate(run.createdAt)}</td>
            <td>{run.windowDays}d</td>
            <td>{run.status}</td>
            <td>{Array.isArray(run.fired) ? run.fired.length : 0}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>

<style>
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
    max-width: 42rem;
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
  .admin-muted {
    color: var(--color-ink-muted);
    font-size: var(--text-sm);
  }
  .admin-error {
    padding: var(--space-3);
    border: var(--border);
    background: var(--state-fail-bg);
    color: var(--color-ink);
    margin-bottom: var(--space-4);
  }
  .admin-success {
    padding: var(--space-3);
    border: var(--border);
    background: var(--state-ok-bg);
    margin-bottom: var(--space-4);
  }
  .admin-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
    margin-top: var(--space-3);
  }
  .admin-table th,
  .admin-table td {
    border: var(--border-thin);
    padding: var(--space-2) var(--space-3);
    text-align: left;
  }
  .admin-table th {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    text-transform: uppercase;
  }
  .admin-btn {
    min-height: 44px;
    padding: var(--space-2) var(--space-4);
    border: var(--border);
    background: var(--color-yellow);
    font-family: var(--font-mono);
    font-weight: 700;
    text-transform: uppercase;
    cursor: pointer;
  }
  .admin-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .admin-btn-danger {
    background: var(--color-red, #e53935);
    color: #fff;
  }
  .admin-btn-ghost {
    background: transparent;
  }
  .iq-tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .iq-tile {
    border: var(--border);
    padding: var(--space-3);
    background: var(--color-surface);
  }
  .iq-tile-label {
    display: block;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    text-transform: uppercase;
    color: var(--color-ink-muted);
  }
  .iq-tile-value {
    font-size: var(--text-xl);
  }
  .iq-pass {
    color: var(--color-green, #2e7d32);
  }
  .iq-fail {
    color: var(--color-red, #c62828);
  }
  .iq-wait {
    color: var(--color-ink-muted);
  }
  .iq-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: flex-end;
    margin-bottom: var(--space-3);
  }
  .iq-label {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    text-transform: uppercase;
  }
  .iq-input {
    min-height: 44px;
    padding: var(--space-2);
    border: var(--border);
    width: 6rem;
  }
  .iq-brief {
    margin-top: var(--space-3);
  }
  .iq-pre {
    white-space: pre-wrap;
    font-size: var(--text-sm);
    padding: var(--space-3);
    border: var(--border-thin);
    background: var(--color-bg-deep);
    overflow-x: auto;
  }
  .iq-confirm {
    padding: var(--space-4);
    border: var(--border);
    background: var(--color-bg-deep);
  }
  .iq-posthog-header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2) var(--space-4);
    margin-bottom: var(--space-3);
  }
  .iq-posthog-header .admin-h2 {
    margin: 0;
  }
  .iq-posthog-link {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    text-transform: uppercase;
    font-weight: 700;
    color: var(--color-ink);
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
  .iq-apply-intro {
    max-width: 42rem;
    margin-bottom: var(--space-3);
    line-height: 1.5;
  }
</style>
