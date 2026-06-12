<script lang="ts">
  /**
   * W3.2 — Route resolution preview panel.
   *
   * Calls simulate (with includeRoutingAttempts + includeStepDiagnostics) and
   * explain-chain for the given route, then renders the result as a receipt:
   * matched step, provider chain, policy outcomes, diagnostics.
   *
   * NO provider calls — all dry-run (keyless). Per ux-contracts §3 live-key boundary.
   */
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import BrutalLoadingState from "$lib/components/brutalist/BrutalLoadingState.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import {
    TESTER_IDLE,
    testerRunning,
    testerResult,
    testerError,
    mapExplainChain,
    mapSimulateToExplainResult,
    formatOutcomeLabel,
    formatCostUsd,
    type TesterState,
    type ExplainResult,
  } from "$lib/request-tester";

  export let projectId: string;
  export let routeId: string;
  export let environmentId: string;

  let state: TesterState = TESTER_IDLE;

  async function runPreview() {
    state = testerRunning();
    try {
      const base = `${DASHBOARD_BASE}/api/projects/${projectId}/routes/${routeId}`;

      // Run explain-chain and simulate in parallel — both are read-only/keyless.
      const [explainRes, simulateRes] = await Promise.all([
        fetch(`${base}/explain-chain`, { credentials: "include" }),
        fetch(`${base}/simulate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            environmentId,
            includeStepDiagnostics: true,
            includeRoutingAttempts: true,
          }),
        }),
      ]);

      const [explainBody, simulateBody] = await Promise.all([
        explainRes.json().catch(() => ({})),
        simulateRes.json().catch(() => ({})),
      ]);

      if (!simulateRes.ok) {
        const msg =
          (simulateBody as { message?: string }).message ??
          (simulateBody as { error?: string }).error ??
          `Simulate failed (${simulateRes.status})`;
        state = testerError(msg);
        return;
      }

      const explainChain = mapExplainChain(explainBody);
      const result = mapSimulateToExplainResult({
        routeId,
        environmentId,
        raw: simulateBody as Record<string, unknown>,
        explainChain,
      });

      state = testerResult(result);
    } catch (e) {
      state = testerError(e instanceof Error ? e.message : "Preview failed");
    }
  }

  function reset() {
    state = TESTER_IDLE;
  }

  $: explainResult = state.phase === "result" && state.result?.kind === "explain"
    ? (state.result as ExplainResult)
    : null;
</script>

<section class="preview-section" aria-labelledby="preview-heading">
  <div class="preview-head">
    <h2 id="preview-heading" class="preview-title">RESOLUTION PREVIEW</h2>
    <p class="preview-desc">
      Dry-run — no provider calls. Resolves your REAL routes, policies, and key config.
    </p>
  </div>

  {#if state.phase === "idle"}
    <button type="button" class="btn btn-primary" onclick={runPreview}>
      Run resolution preview
    </button>

  {:else if state.phase === "running"}
    <BrutalLoadingState message="Resolving…" rows={3} />

  {:else if state.phase === "error"}
    <BrutalErrorBanner message={state.errorMessage ?? "Preview failed"}>
      {#snippet actions()}
        <button type="button" class="btn btn-secondary" onclick={reset}>Try again</button>
      {/snippet}
    </BrutalErrorBanner>

  {:else if explainResult}
    {@const r = explainResult}
    <div class="result-receipt" role="status" aria-label="Resolution preview result">

      <!-- Route matched -->
      <div class="receipt-block">
        <h3 class="receipt-label">ROUTE MATCHED</h3>
        <div class="receipt-row">
          <span class="receipt-mono">{r.explainChain?.routeName ?? r.routeId}</span>
          {#if r.explainChain?.isPublished === false}
            <span class="badge badge-warn" title="Unpublished routes do not receive discovery traffic">UNPUBLISHED</span>
          {/if}
          <a
            class="receipt-link"
            href="{DASHBOARD_BASE}/projects/{r.routeId.startsWith('/') ? r.routeId : ''}"
            aria-label="Open route builder"
          >↗ builder</a>
        </div>
        {#if r.explainChain}
          <p class="receipt-meta">
            {r.explainChain.enabledStepCount} enabled step{r.explainChain.enabledStepCount !== 1 ? "s" : ""}
            {#if r.explainChain.policyNames.length > 0}
              · {r.explainChain.policyNames.length} guard rail{r.explainChain.policyNames.length !== 1 ? "s" : ""}: {r.explainChain.policyNames.slice(0, 3).join(", ")}{r.explainChain.policyNames.length > 3 ? "…" : ""}
            {/if}
          </p>
        {/if}
      </div>

      <!-- Decision -->
      <div class="receipt-block">
        <h3 class="receipt-label">DECISION</h3>
        {#if r.wouldRun && r.providerType}
          <div class="receipt-row">
            <span class="badge badge-ok">WOULD RUN</span>
            <span class="receipt-mono">{r.providerType}</span>
            {#if r.modelId}<span class="receipt-mono sep">›</span><span class="receipt-mono">{r.modelId}</span>{/if}
          </div>
          {#if r.explanation}
            <p class="receipt-meta">{r.explanation}</p>
          {/if}
        {:else if r.policyViolations.length > 0}
          <div class="receipt-row">
            <span class="badge badge-fail">BLOCKED BY POLICY</span>
          </div>
          <ul class="violation-list" aria-label="Policy violations">
            {#each r.policyViolations as v}
              <li class="violation-item">
                <span class="receipt-mono">{v.policyName || v.policyId}</span>
                <span class="violation-msg">{v.message}</span>
              </li>
            {/each}
          </ul>
        {:else}
          <div class="receipt-row">
            <span class="badge badge-fail">NO STEP EXECUTABLE</span>
          </div>
          {#if r.explanation}
            <p class="receipt-meta">{r.explanation}</p>
          {/if}
        {/if}
      </div>

      <!-- Provider chain (routingAttempts) -->
      {#if r.routingAttempts.length > 0}
        <div class="receipt-block">
          <h3 class="receipt-label">PROVIDER CHAIN</h3>
          <table class="chain-table" aria-label="Provider chain step outcomes">
            <thead>
              <tr>
                <th class="col-idx" scope="col">#</th>
                <th scope="col">Provider · Model</th>
                <th scope="col">Outcome</th>
                <th scope="col">Est. cost</th>
              </tr>
            </thead>
            <tbody>
              {#each r.routingAttempts as attempt}
                {@const estimate = r.perStepEstimates.find((e) => e.stepId === attempt.stepId)}
                <tr class="chain-row" class:chain-row--selected={attempt.hypotheticalOutcome === "selected"}>
                  <td class="col-idx receipt-mono">{attempt.orderIndex}</td>
                  <td>
                    <span class="receipt-mono">{attempt.providerType ?? "—"}</span>
                    {#if attempt.modelId}
                      <span class="sep">›</span>
                      <span class="receipt-mono">{attempt.modelId}</span>
                    {/if}
                  </td>
                  <td>
                    <span
                      class="badge"
                      class:badge-ok={attempt.hypotheticalOutcome === "selected"}
                      class:badge-warn={attempt.hypotheticalOutcome === "not_selected"}
                      class:badge-fail={attempt.hypotheticalOutcome === "blocked_by_policy" || attempt.hypotheticalOutcome === "not_executable"}
                    >
                      {formatOutcomeLabel(attempt.hypotheticalOutcome)}
                    </span>
                  </td>
                  <td class="receipt-mono">{formatCostUsd(estimate?.estimatedCostUsd ?? null)}</td>
                </tr>
                <!-- Policy violations for this step -->
                {#if r.stepDiagnostics.find((d) => d.stepId === attempt.stepId)?.policyViolations.length}
                  {@const diag = r.stepDiagnostics.find((d) => d.stepId === attempt.stepId)}
                  {#if diag}
                    {#each diag.policyViolations as v}
                      <tr class="chain-row chain-row--violation">
                        <td></td>
                        <td colspan="3" class="violation-msg receipt-xs">
                          ↳ {v.policyName || v.policyId}: {v.message}
                        </td>
                      </tr>
                    {/each}
                  {/if}
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      <!-- Explain chain — step list -->
      {#if r.explainChain?.steps.length}
        <details class="receipt-details">
          <summary class="receipt-label">EXPLAIN CHAIN — {r.explainChain.steps.length} step{r.explainChain.steps.length !== 1 ? "s" : ""}</summary>
          <ul class="step-list" aria-label="Route step chain">
            {#each r.explainChain.steps as step}
              <li class="step-item" class:step-disabled={!step.enabled}>
                <span class="receipt-mono col-idx">{step.orderIndex}</span>
                <span class="receipt-mono">{step.providerPreference ?? "—"}</span>
                {#if step.modelId}<span class="sep">›</span><span class="receipt-mono">{step.modelId}</span>{/if}
                {#if step.label}<span class="step-label"> — {step.label}</span>{/if}
                {#if !step.enabled}<span class="badge badge-muted">DISABLED</span>{/if}
              </li>
            {/each}
          </ul>
        </details>
      {/if}

      <!-- Footer actions -->
      <div class="receipt-actions">
        <button type="button" class="btn btn-secondary btn-sm" onclick={reset}>Reset</button>
        <a class="btn btn-secondary btn-sm" href="{DASHBOARD_BASE}/logs?route={routeId}" aria-label="View logs for this route">
          View logs ↗
        </a>
      </div>
    </div>
  {/if}
</section>

<style>
  .preview-section {
    padding: var(--space-4);
    border: var(--brut-border-width, 2px) solid var(--brut-ink, #1a1a1a);
    background: var(--brut-white, #fff);
    box-shadow: var(--brut-shadow, 3px 3px 0 #1a1a1a);
    margin-bottom: var(--space-6);
  }

  .preview-head {
    margin-bottom: var(--space-4);
  }

  .preview-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-base);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0 0 var(--space-1);
  }

  .preview-desc {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-3);
  }

  /* Result receipt */
  .result-receipt {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .receipt-block {
    border-top: 1px solid var(--brut-ink, #1a1a1a);
    padding-top: var(--space-3);
  }

  .receipt-label {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 var(--space-2);
    color: var(--rm-muted);
  }

  .receipt-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-1);
  }

  .receipt-mono {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: var(--text-sm);
  }

  .receipt-xs {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: var(--text-xs);
  }

  .receipt-meta {
    font-size: var(--text-xs);
    color: var(--rm-muted);
    margin: var(--space-1) 0 0;
  }

  .receipt-link {
    font-size: var(--text-xs);
    color: var(--rm-sage, #2d6a4f);
    text-decoration: underline;
  }

  .sep {
    color: var(--rm-muted);
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: var(--text-sm);
  }

  /* Badges */
  .badge {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0.1em 0.5em;
    border: 1px solid var(--brut-ink, #1a1a1a);
  }

  .badge-ok {
    background: var(--brut-neon, #d4fc3e);
    color: var(--brut-ink, #1a1a1a);
  }

  .badge-warn {
    background: var(--color-yellow, #f5de0a);
    color: var(--brut-ink, #1a1a1a);
  }

  .badge-fail {
    background: var(--brut-coral, #ff6b55);
    color: var(--brut-ink, #1a1a1a);
  }

  .badge-muted {
    background: var(--rm-surface-raised, #f5f5f5);
    color: var(--rm-muted);
    border-color: var(--rm-border);
  }

  /* Chain table */
  .chain-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-xs);
  }

  .chain-table th {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    text-align: left;
    padding: var(--space-1) var(--space-2);
    border-bottom: 2px solid var(--brut-ink, #1a1a1a);
    background: var(--rm-surface, #f9f9f9);
  }

  .chain-table td {
    padding: var(--space-1) var(--space-2);
    border-bottom: 1px solid var(--rm-border, #e5e5e5);
    vertical-align: middle;
  }

  .chain-row--selected td {
    background: color-mix(in oklab, var(--brut-neon, #d4fc3e) 15%, transparent);
  }

  .chain-row--violation td {
    background: color-mix(in oklab, var(--brut-coral, #ff6b55) 8%, transparent);
  }

  .col-idx {
    width: 2rem;
    color: var(--rm-muted);
  }

  /* Violation list */
  .violation-list {
    list-style: none;
    padding: 0;
    margin: var(--space-2) 0 0;
  }

  .violation-item {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    font-size: var(--text-xs);
    margin-bottom: var(--space-1);
    align-items: baseline;
  }

  .violation-msg {
    color: var(--rm-muted);
    font-size: var(--text-xs);
  }

  /* Step list */
  .receipt-details {
    border-top: 1px solid var(--rm-border, #e5e5e5);
    padding-top: var(--space-3);
  }

  .receipt-details > summary {
    cursor: pointer;
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--rm-muted);
    margin-bottom: var(--space-2);
  }

  .step-list {
    list-style: none;
    padding: 0;
    margin: var(--space-2) 0 0;
  }

  .step-item {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: var(--space-1) 0;
    border-bottom: 1px solid var(--rm-border, #e5e5e5);
    font-size: var(--text-xs);
  }

  .step-disabled {
    opacity: 0.5;
  }

  .step-label {
    color: var(--rm-muted);
    font-size: var(--text-xs);
  }

  /* Actions */
  .receipt-actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    border-top: 1px solid var(--rm-border, #e5e5e5);
    padding-top: var(--space-3);
  }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border: var(--brut-border-width, 2px) solid var(--brut-ink, #1a1a1a);
    cursor: pointer;
    text-decoration: none;
    border-radius: 0;
    background: var(--rm-surface, #fff);
    color: var(--brut-ink, #1a1a1a);
    box-shadow: 2px 2px 0 var(--brut-ink, #1a1a1a);
    transition: box-shadow 0.07s, transform 0.07s;
  }

  .btn:active {
    box-shadow: none;
    transform: translate(2px, 2px);
  }

  .btn-primary {
    background: var(--brut-neon, #d4fc3e);
    color: var(--brut-ink, #1a1a1a);
  }

  .btn-secondary {
    background: var(--rm-surface, #fff);
    color: var(--brut-ink, #1a1a1a);
  }

  .btn-sm {
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-xs);
  }
</style>
