<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { pipelineWizardHref } from "$lib/connect/pipeline-config";
  import { page } from "$app/stores";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
  import ConnectFirstGraphGuide from "$lib/components/connect/ConnectFirstGraphGuide.svelte";
  import type { FirstGraphGuideState } from "$lib/connect/first-graph-guide";

  type Step = {
    id: string;
    title: string;
    description: string;
    status: "done" | "todo";
    detail: string;
    href: string;
    cta: string;
    optional?: boolean;
  };
  type Journey = {
    steps: Step[];
    completed: number;
    total: number;
    nextStepId: string | null;
    latestJob: { id: string; status: string; label?: string | null; currentStage?: string | null; updatedAt: string } | null;
    stats: {
      units: number;
      relations: number;
      groups: number;
      embedded: number;
      validation: { ok: number; weak: number; unsupported: number; unvalidated: number };
    } | null;
    flags: { llmReady: boolean; encryptionReady: boolean };
  };

  export let data: { journey: Journey | null; firstGraphGuide: FirstGraphGuideState | null };
  const CONNECT_BASE = DASHBOARD_BASE + "/connect";

  $: journey = data.journey;
  $: nextStep = journey?.steps.find((s) => s.id === journey?.nextStepId) ?? null;
  $: pct = journey ? Math.round((journey.completed / journey.total) * 100) : 0;
  $: stats = journey?.stats ?? null;
  $: hasGraph = Boolean(stats && stats.units > 0);
  $: neonGraphStoreOn = ($page.data.moduleFlags ?? MVP_MODULE_DEFAULTS).connectNeonGraphStore;

  function statusClass(status: string): string {
    if (status === "completed") return "status-success";
    if (status === "failed") return "status-error";
    if (status === "cancelled") return "status-muted";
    if (status === "running") return "status-warning";
    return "status-muted";
  }
</script>

<svelte:head>
  <title>Restormel Connect – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section class="hub" aria-labelledby="connect-hub-heading">
  <p class="hub-eyebrow">Connect · Your workspace home</p>
  <h1 id="connect-hub-heading">Build the brain your agents will query</h1>
  <p class="hub-lead">
    Everything in Restormel flows through Connect: add documents, configure Keys-backed AI routes, run ingest,
    and serve verified context to agents via REST or MCP — Testing and Graph plug in when you need them.
  </p>

  <ul class="hub-outcomes" aria-label="What you get when setup is complete">
    <li>
      <strong>A queryable graph</strong>
      <span>Ideas, relationships, groups, and embeddings — not just chunked PDFs.</span>
    </li>
    <li>
      <strong>Production APIs</strong>
      <span>Retrieve depth-controlled context; verify claims before answers reach users.</span>
    </li>
    <li>
      <strong>Agent hooks</strong>
      <span>MCP tools and REST endpoints agents can call without a bespoke RAG build-out.</span>
    </li>
  </ul>

  {#if !journey}
    <p class="notice" role="status">Sign in to set up Restormel Connect.</p>
  {:else}
    {#if data.firstGraphGuide}
      <ConnectFirstGraphGuide guide={data.firstGraphGuide} />
    {/if}

    <!-- Progress + next action -->
    <div class="progress-card">
      <div class="progress-head">
        <span class="progress-label">Setup progress</span>
        <span class="progress-count">{journey.completed} of {journey.total} steps</span>
      </div>
      <div class="progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div class="progress-fill" style={`width:${pct}%`}></div>
      </div>
      {#if nextStep}
        <div class="next-action">
          <div>
            <span class="next-label">Next step</span>
            <strong class="next-title">{nextStep.title}</strong>
          </div>
          <a class="btn btn-primary" href={nextStep.href}>{nextStep.cta}</a>
        </div>
      {:else}
        <p class="next-done">All set — your pipeline is configured. Add documents any time and run ingestion.</p>
      {/if}
    </div>

    {#if !journey.flags.encryptionReady}
      <p class="warn-banner" role="status">
        Note: <code>RESTORMEL_CREDENTIALS_ENCRYPTION_KEY</code> is missing or invalid in
        <code>apps/dashboard/.env.local</code>, so saving provider keys or Surreal graph store credentials is
        disabled until you set a valid 32-byte base64 key and restart the dev server.
        {#if neonGraphStoreOn}
          The one-click Neon store still works.
        {/if}
      </p>
    {/if}

    <!-- The journey -->
    <ol class="journey" aria-label="Setup steps">
      {#each journey.steps as step, i (step.id)}
        <li class="step" class:step-done={step.status === "done"} class:step-next={step.id === journey.nextStepId}>
          <div class="step-marker" aria-hidden="true">
            {#if step.status === "done"}✓{:else}{i + 1}{/if}
          </div>
          <div class="step-body">
            <div class="step-head">
              <h2 class="step-title">{step.title}</h2>
              {#if step.optional}<span class="badge status-muted">optional</span>{/if}
              <span class="badge {step.status === 'done' ? 'status-success' : 'status-muted'}">
                {step.status === "done" ? "done" : "to do"}
              </span>
            </div>
            <p class="step-desc">{step.description}</p>
            <div class="step-foot">
              <span class="step-detail">{step.detail}</span>
              <a class="btn {step.id === journey.nextStepId ? 'btn-primary' : 'btn-secondary'}" href={step.href}>{step.cta}</a>
            </div>
          </div>
        </li>
      {/each}
    </ol>

    <!-- Payoff: your knowledge graph -->
    <section class="card" aria-labelledby="graph-stats-heading">
      <h2 id="graph-stats-heading" class="h2">Your knowledge graph</h2>
      {#if hasGraph && stats}
        <div class="stat-grid">
          <div class="stat"><span class="stat-num">{stats.units.toLocaleString()}</span><span class="stat-label">ideas</span></div>
          <div class="stat"><span class="stat-num">{stats.relations.toLocaleString()}</span><span class="stat-label">connections</span></div>
          <div class="stat"><span class="stat-num">{stats.groups.toLocaleString()}</span><span class="stat-label">groups</span></div>
          <div class="stat"><span class="stat-num">{stats.embedded.toLocaleString()}</span><span class="stat-label">embedded</span></div>
        </div>
        {#if stats.validation.ok + stats.validation.weak + stats.validation.unsupported > 0}
          <div class="validation">
            <span class="validation-label">Validation</span>
            <span class="vchip status-success">{stats.validation.ok} supported</span>
            <span class="vchip status-warning">{stats.validation.weak} weak</span>
            <span class="vchip status-error">{stats.validation.unsupported} unsupported</span>
            {#if stats.validation.unvalidated > 0}<span class="vchip status-muted">{stats.validation.unvalidated} unchecked</span>{/if}
          </div>
        {/if}
      {:else}
        <p class="muted">Nothing here yet. Once you run ingestion, your extracted ideas, connections, groups, and
          validation results appear here.</p>
      {/if}
    </section>

    <!-- Latest run monitor -->
    {#if journey.latestJob}
      <section class="card" aria-labelledby="latest-run-heading">
        <h2 id="latest-run-heading" class="h2">Latest run</h2>
        <div class="run-row">
          <div>
            <strong>{journey.latestJob.label ?? "Ingest job"}</strong>
            <span class="badge {statusClass(journey.latestJob.status)}">{journey.latestJob.status}</span>
            {#if journey.latestJob.currentStage}<span class="run-stage">{journey.latestJob.currentStage}</span>{/if}
          </div>
          <div class="run-actions">
            <a class="btn btn-secondary" href={CONNECT_BASE + "/ingest/" + journey.latestJob.id}>Monitor</a>
            {#if journey.latestJob.status === "completed"}
              <a class="btn btn-primary" href={CONNECT_BASE + "/graph"}>View graph</a>
              <a class="btn btn-secondary" href={pipelineWizardHref("sources")}>Next run</a>
            {/if}
          </div>
        </div>
        <p class="muted run-updated">Updated {new Date(journey.latestJob.updatedAt).toLocaleString()}</p>
      </section>
    {/if}

    <p class="hub-links-row">
      <a href="/keys/docs/guides/connect-first-graph-onboarding">First graph guide</a>
      <span class="sep">·</span>
      <a href="/connect/docs">Connect docs</a>
      <span class="sep">·</span>
      <a href="/docs/operator-model">Suite map</a>
    </p>
  {/if}
</section>

<style>
  .hub {
    max-width: 52rem;
    padding: 0.5rem 0 2rem;
  }
  .hub-eyebrow {
    font-size: 0.8125rem;
    color: var(--rm-dim);
    margin: 0 0 0.5rem;
  }
  .hub-lead {
    line-height: 1.55;
    margin: 0 0 1.25rem;
    color: var(--rm-muted);
  }
  .hub-lead code {
    font-size: 0.9em;
    color: var(--rm-text);
  }
  .hub-outcomes {
    list-style: none;
    margin: 0 0 1.5rem;
    padding: 0;
    display: grid;
    gap: var(--space-3);
  }
  @media (min-width: 640px) {
    .hub-outcomes {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  .hub-outcomes li {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    padding: var(--space-3) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .hub-outcomes strong {
    color: var(--rm-text);
    font-size: var(--text-sm);
  }
  .hub-outcomes span {
    color: var(--rm-muted);
    font-size: var(--text-xs);
    line-height: 1.45;
  }
  .notice,
  .warn-banner {
    border: 1px solid var(--rm-border);
    background: var(--rm-surface-raised);
    color: var(--rm-muted);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--rm-radius);
    margin: 0 0 var(--space-4);
  }
  .warn-banner {
    color: var(--amber-insight);
    border-color: color-mix(in oklab, var(--amber-insight) 40%, var(--rm-border));
  }
  .progress-card {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    padding: var(--space-4);
    margin-bottom: var(--space-5);
  }
  .progress-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: var(--space-2);
  }
  .progress-label {
    color: var(--rm-text);
    font-weight: 600;
  }
  .progress-count {
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .progress-bar {
    height: 8px;
    border-radius: 999px;
    background: var(--rm-surface-raised);
    overflow: hidden;
    border: 1px solid var(--rm-border);
  }
  .progress-fill {
    height: 100%;
    background: var(--rm-sage);
    transition: width 0.3s ease;
  }
  .next-action {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid var(--rm-border);
  }
  .next-label {
    display: block;
    font-size: var(--text-xs);
    color: var(--rm-dim);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .next-title {
    color: var(--rm-text);
    font-size: var(--text-base);
  }
  .next-done {
    margin: var(--space-4) 0 0;
    color: var(--rm-muted);
  }
  .journey {
    list-style: none;
    margin: 0 0 var(--space-5);
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .step {
    display: flex;
    gap: var(--space-3);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    padding: var(--space-4);
  }
  .step-next {
    border-color: color-mix(in oklab, var(--rm-sage) 55%, var(--rm-border));
    box-shadow: 0 0 0 1px color-mix(in oklab, var(--rm-sage) 30%, transparent);
  }
  .step-marker {
    flex: 0 0 auto;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--rm-border);
    color: var(--rm-muted);
    font-size: var(--text-sm);
    font-weight: 600;
  }
  .step-done .step-marker {
    background: var(--rm-sage);
    color: var(--rm-bg);
    border-color: var(--rm-sage);
  }
  .step-body {
    flex: 1;
    min-width: 0;
  }
  .step-head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-bottom: var(--space-1);
  }
  .step-title {
    margin: 0;
    font-size: var(--text-base);
    color: var(--rm-text);
  }
  .step-desc {
    margin: 0 0 var(--space-3);
    color: var(--rm-muted);
    font-size: var(--text-sm);
    line-height: 1.5;
  }
  .step-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .step-detail {
    color: var(--rm-dim);
    font-size: var(--text-xs);
  }
  .badge {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: 0 var(--space-2);
    font-size: var(--text-xs);
    text-transform: capitalize;
  }
  .card {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    padding: var(--space-4);
    margin-bottom: var(--space-4);
  }
  .h2 {
    margin: 0 0 var(--space-3);
    font-size: var(--text-base);
    color: var(--rm-text);
  }
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-3);
  }
  @media (max-width: 600px) {
    .stat-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .stat-num {
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--rm-text);
  }
  .stat-label {
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  .validation {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid var(--rm-border);
  }
  .validation-label {
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .vchip {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: 0 var(--space-2);
    font-size: var(--text-xs);
  }
  .muted {
    color: var(--rm-muted);
  }
  .run-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .run-row strong {
    color: var(--rm-text);
    margin-right: var(--space-2);
  }
  .run-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .run-stage {
    color: var(--rm-muted);
    font-size: var(--text-xs);
    margin-left: var(--space-2);
  }
  .run-updated {
    margin: var(--space-2) 0 0;
    font-size: var(--text-xs);
  }
  .hub-links-row {
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .sep {
    margin: 0 var(--space-2);
    color: var(--rm-dim);
  }
</style>
