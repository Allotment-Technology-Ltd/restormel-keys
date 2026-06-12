<script lang="ts">
  import { onMount } from "svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import BrutalLoadingState from "$lib/components/brutalist/BrutalLoadingState.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import { projectReadinessIssueFix } from "$lib/connect/verified-readiness";
  import type { ConnectRunPreflightResult } from "$lib/connect/run-preflight";

  /**
   * K4 / K-P1-5: the first standing UI consumer of GET api/projects/[id]/readiness.
   * Issues render as receipts with a repair link each; Connect preflight rows
   * (K3) surface their exact per-provider fix links.
   */
  export let projectId: string;

  type ReadinessIssue = {
    severity: "low" | "medium" | "high";
    code: string;
    message: string;
    resource: string;
  };
  type ReadinessRecommendation = { priority: "low" | "medium" | "high"; action: string; reason: string };
  type ReadinessPayload = {
    status: "ok" | "warn" | "fail";
    summary: {
      providerBindingCount: number;
      routeCount: number;
      routeStepCount: number;
      projectPolicyBindingCount: number;
    };
    issues: ReadinessIssue[];
    recommendations: ReadinessRecommendation[];
    connect_run_preflight: ConnectRunPreflightResult | null;
  };

  let loading = true;
  let loadError: string | null = null;
  let readiness: ReadinessPayload | null = null;

  async function loadReadiness() {
    loading = true;
    loadError = null;
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${projectId}/readiness`, {
        credentials: "include",
      });
      if (!res.ok) {
        loadError = `Could not load project readiness (HTTP ${res.status}).`;
        return;
      }
      const body = await res.json().catch(() => null);
      if (!body?.data) {
        loadError = "Readiness response had no data.";
        return;
      }
      readiness = body.data as ReadinessPayload;
    } catch {
      loadError = "Network error while loading project readiness.";
    } finally {
      loading = false;
    }
  }

  onMount(loadReadiness);

  /** Fix link per issue: preflight rows carry exact links; project codes are mapped. */
  function issueFix(issue: ReadinessIssue): { href: string; label: string } | null {
    if (issue.code.startsWith("connect_run_") && readiness?.connect_run_preflight) {
      const provider = issue.code.startsWith("connect_run_no_stage_routes")
        ? null
        : (readiness.connect_run_preflight.providers.find(
            (row) => row.issue && `connect_run_${row.issue}` === issue.code,
          ) ?? null);
      if (provider) return { href: provider.fixHref, label: provider.fixLabel };
    }
    return projectReadinessIssueFix(issue.code, projectId, DASHBOARD_BASE);
  }

  function statusLabel(status: ReadinessPayload["status"]): string {
    return status === "ok" ? "Ready" : status === "warn" ? "Check" : "Action needed";
  }
</script>

<section class="section readiness-card" aria-labelledby="project-readiness-heading">
  <h2 id="project-readiness-heading" class="section-title">Readiness</h2>
  <p class="section-desc">
    Can this project resolve, route, and serve Connect runs? Issues below link to the exact repair.
  </p>

  {#if loading}
    <BrutalLoadingState message="Checking project readiness…" rows={3} />
  {:else if loadError || !readiness}
    <BrutalErrorBanner
      title="Readiness unavailable"
      message={loadError ?? "Could not load project readiness."}
    >
      {#snippet actions()}
        <button type="button" class="btn btn-primary btn-sm" onclick={loadReadiness}>
          Try again
        </button>
        <a class="btn btn-outline btn-sm" href={DASHBOARD_BASE + "/connect#readiness"}>
          Open Connect readiness ledger
        </a>
      {/snippet}
    </BrutalErrorBanner>
  {:else}
    <div class="readiness-head">
      <span class="readiness-status readiness-status--{readiness.status}">
        {statusLabel(readiness.status)}
      </span>
      <span class="readiness-summary">
        {readiness.summary.providerBindingCount} binding{readiness.summary.providerBindingCount === 1 ? "" : "s"}
        · {readiness.summary.routeCount} route{readiness.summary.routeCount === 1 ? "" : "s"}
        · {readiness.summary.routeStepCount} step{readiness.summary.routeStepCount === 1 ? "" : "s"}
        · {readiness.summary.projectPolicyBindingCount} polic{readiness.summary.projectPolicyBindingCount === 1 ? "y" : "ies"} bound
      </span>
    </div>

    {#if readiness.issues.length === 0}
      <p class="readiness-clear" role="status">
        No readiness issues — bindings, routes, and policies are in place.
        <a href={DASHBOARD_BASE + "/connect#readiness"}>Open the Connect readiness ledger →</a>
      </p>
    {:else}
      <ul class="readiness-issues">
        {#each readiness.issues as issue (issue.code + issue.message)}
          {@const fix = issueFix(issue)}
          <li class="readiness-issue readiness-issue--{issue.severity}">
            <span class="readiness-severity" aria-label="{issue.severity} severity">
              {issue.severity === "high" ? "High" : issue.severity === "medium" ? "Med" : "Low"}
            </span>
            <span class="readiness-message">{issue.message}</span>
            {#if fix}
              <a class="readiness-fix" href={fix.href}>{fix.label} →</a>
            {/if}
          </li>
        {/each}
      </ul>
      {#if readiness.recommendations.length > 0}
        <details class="readiness-recs">
          <summary>Recommendations ({readiness.recommendations.length})</summary>
          <ul>
            {#each readiness.recommendations as rec (rec.action)}
              <li><strong>{rec.action}</strong> <span class="readiness-rec-reason">{rec.reason}</span></li>
            {/each}
          </ul>
        </details>
      {/if}
    {/if}
  {/if}
</section>

<style>
  .readiness-card {
    margin: 0 0 var(--space-5);
  }

  .readiness-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    margin: 0 0 var(--space-3);
  }

  .readiness-status {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border: var(--border);
    padding: 2px var(--space-2);
  }

  .readiness-status--ok {
    background: var(--state-ok-bg);
    color: var(--state-ok-fg);
  }

  .readiness-status--warn {
    background: var(--state-warn-bg);
    color: var(--state-warn-fg);
  }

  .readiness-status--fail {
    background: var(--state-fail-bg);
    color: var(--state-fail-fg);
  }

  .readiness-summary {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
  }

  .readiness-clear {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-ink-muted);
  }

  .readiness-issues {
    list-style: none;
    margin: 0 0 var(--space-3);
    padding: 0;
    border: var(--border);
    background: var(--color-surface);
  }

  .readiness-issue {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-bottom: var(--border-thin);
    min-height: 44px;
  }

  .readiness-issue:last-child {
    border-bottom: none;
  }

  .readiness-issue--high {
    background: color-mix(in oklab, var(--state-fail-bg) 35%, var(--color-surface));
  }

  .readiness-issue--medium {
    background: color-mix(in oklab, var(--state-warn-bg) 30%, var(--color-surface));
  }

  .readiness-severity {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border: var(--border-thin);
    padding: 1px var(--space-2);
    white-space: nowrap;
  }

  .readiness-issue--high .readiness-severity {
    background: var(--state-fail-bg);
    color: var(--state-fail-fg);
  }

  .readiness-issue--medium .readiness-severity {
    background: var(--state-warn-bg);
    color: var(--state-warn-fg);
  }

  .readiness-message {
    font-size: var(--text-sm);
    line-height: 1.4;
    min-width: 0;
  }

  .readiness-fix {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    color: var(--color-ink);
    text-decoration: underline;
    text-underline-offset: 2px;
    white-space: nowrap;
  }

  .readiness-recs summary {
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    min-height: 44px;
    display: flex;
    align-items: center;
  }

  .readiness-recs ul {
    margin: var(--space-2) 0 0;
    padding-left: var(--space-5);
    font-size: var(--text-sm);
  }

  .readiness-rec-reason {
    color: var(--color-ink-muted);
  }
</style>
