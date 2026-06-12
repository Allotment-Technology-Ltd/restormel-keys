<!--
  W2.4 — Memory-writes inbox.
  Shows agent-written claims (provenance "agent_observation") with verification outcome,
  submitting key identity, and revoke action (reversible soft-exclude).

  Copy-registry noun: "Memory" (ux-contracts.md §2, Connect hub tab label).
-->
<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import BrutalPageHeader from "$lib/components/brutalist/BrutalPageHeader.svelte";
  import BrutalCard from "$lib/components/brutalist/BrutalCard.svelte";
  import BrutalLoadingState from "$lib/components/brutalist/BrutalLoadingState.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import type { MemoryInboxData } from "./+page.server";
  import type { AgentObservationRow } from "$lib/server/neon";

  export let data: { inbox: Promise<MemoryInboxData | null> };

  // Revoke state: unitId → 'pending' | 'done' | 'error'
  let revokeState: Record<string, "pending" | "done" | "error"> = {};
  let revokeError: Record<string, string> = {};

  async function revokeObservation(unitId: string): Promise<void> {
    const confirmed = window.confirm(
      "Revoke this observation? It will be soft-excluded and removed from retrieval. This action is reversible by contacting support or re-ingesting.",
    );
    if (!confirmed) return;

    revokeState = { ...revokeState, [unitId]: "pending" };
    revokeError = { ...revokeError };
    delete revokeError[unitId];

    let attempts = 0;
    while (attempts < 3) {
      attempts += 1;
      try {
        const res = await fetch(
          `/keys/dashboard/api/connect/memory/${encodeURIComponent(unitId)}/revoke`,
          { method: "POST" },
        );
        if (res.ok) {
          revokeState = { ...revokeState, [unitId]: "done" };
          await invalidateAll();
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        if (res.status < 500 || attempts >= 3) {
          revokeState = { ...revokeState, [unitId]: "error" };
          revokeError = {
            ...revokeError,
            [unitId]: body.message ?? `Revoke failed (HTTP ${res.status}).`,
          };
          return;
        }
        // 5xx: retry
        await new Promise((r) => setTimeout(r, 600 * attempts));
      } catch {
        if (attempts >= 3) {
          revokeState = { ...revokeState, [unitId]: "error" };
          revokeError = {
            ...revokeError,
            [unitId]: "Network error — check your connection and try again.",
          };
          return;
        }
        await new Promise((r) => setTimeout(r, 600 * attempts));
      }
    }
  }

  function outcomeLabel(outcome: AgentObservationRow["outcome"]): string {
    if (outcome === "accepted") return "ACCEPTED";
    if (outcome === "rejected") return "REJECTED";
    return "PENDING REVIEW";
  }

  function outcomeClass(outcome: AgentObservationRow["outcome"]): string {
    if (outcome === "accepted") return "chip-accepted";
    if (outcome === "rejected") return "chip-rejected";
    return "chip-review";
  }

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }
</script>

<svelte:head>
  <title>Memory inbox – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<BrutalPageHeader
  title="Memory"
  description="Agent-written claims submitted via connect.memory.write. Every observation runs the same EBV quality gate as document ingest before it is persisted."
/>

{#await data.inbox}
  <BrutalLoadingState message="Loading agent observations…" rows={4} />
{:then inbox}
  {#if !inbox}
    <div class="notice" role="status">
      <p>Sign in to view the memory inbox.</p>
      <a href="/keys/dashboard/login" class="btn btn-primary">Sign in</a>
    </div>
  {:else if inbox.observations.length === 0}
    <EmptyState
      title="No agent observations yet"
      description="Agents can write observations into your knowledge graph using the connect.memory.write MCP tool. Each observation runs the evidence-bound validation gate before it is persisted."
    >
      <a href="/keys/docs/integrations/mcp#connect-memory-write" class="btn-link">
        MCP quickstart — connect.memory.write
      </a>
    </EmptyState>
  {:else}
    <section aria-labelledby="inbox-heading">
      <h2 id="inbox-heading" class="section-title">
        Agent observations
        <span class="count-badge" aria-label="{inbox.observations.length} observations"
          >{inbox.observations.length}</span
        >
      </h2>
      <p class="section-desc">
        Newest first. Revoke removes an observation from retrieval (soft-exclude, reversible).
        Rejected observations show their rejection reasons.
      </p>

      <ul class="inbox-list" aria-label="Agent observations inbox">
        {#each inbox.observations as obs (obs.unitId)}
          <li class="inbox-item" data-unit-id={obs.unitId}>
            <BrutalCard>
              {#snippet children()}
                <div class="item-head">
                  <span
                    class="outcome-chip {outcomeClass(obs.outcome)}"
                    role="status"
                    aria-label="Verification outcome: {outcomeLabel(obs.outcome)}"
                  >
                    {outcomeLabel(obs.outcome)}
                  </span>
                  <span class="state-badge" title="Verification state: {obs.verificationState}">
                    {obs.verificationState}
                  </span>
                  <span class="meta-time">
                    {formatDate(obs.submittedAt)}
                  </span>
                </div>

                <p class="obs-text">{obs.text}</p>

                <div class="item-meta">
                  {#if obs.submittingKeyIdentity}
                    <span class="meta-key" title="Submitting key identity">
                      <span aria-hidden="true">⬡</span>
                      {obs.submittingKeyIdentity}
                    </span>
                  {/if}
                  <a
                    href="/keys/dashboard/claims?unit={encodeURIComponent(obs.unitId)}"
                    class="btn-link meta-link"
                    aria-label="View claim {obs.unitId.slice(0, 8)} in graph explorer"
                  >
                    View in graph →
                  </a>
                </div>

                {#if obs.reasons.length > 0}
                  <details class="reasons-details">
                    <summary class="reasons-summary">
                      {obs.outcome === "rejected" ? "Rejection reasons" : "Review reasons"}
                      ({obs.reasons.length})
                    </summary>
                    <ul class="reasons-list">
                      {#each obs.reasons as reason (reason)}
                        <li class="reason-item">
                          <code class="reason-code">{reason}</code>
                        </li>
                      {/each}
                    </ul>
                  </details>
                {/if}

                {#if revokeError[obs.unitId]}
                  <BrutalErrorBanner
                    title="Revoke failed"
                    message={revokeError[obs.unitId]}
                  >
                    {#snippet actions()}
                      <button
                        class="btn btn-sm"
                        onclick={() => revokeObservation(obs.unitId)}
                        disabled={revokeState[obs.unitId] === "pending"}
                      >
                        Try again
                      </button>
                    {/snippet}
                  </BrutalErrorBanner>
                {/if}

                <div class="item-actions">
                  {#if revokeState[obs.unitId] === "done" || obs.verificationState === "excluded"}
                    <span class="revoked-badge" role="status">Revoked — excluded from retrieval</span>
                  {:else}
                    <button
                      class="btn btn-sm btn-danger"
                      onclick={() => revokeObservation(obs.unitId)}
                      disabled={revokeState[obs.unitId] === "pending"}
                      aria-label="Revoke observation {obs.unitId.slice(0, 8)}"
                    >
                      {revokeState[obs.unitId] === "pending" ? "Revoking…" : "Revoke"}
                    </button>
                  {/if}
                </div>
              {/snippet}
            </BrutalCard>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
{:catch}
  <BrutalErrorBanner
    title="Could not load memory inbox"
    message="Failed to load agent observations. Check your connection and try again."
  >
    {#snippet actions()}
      <button class="btn btn-sm" onclick={() => invalidateAll()}>Try again</button>
    {/snippet}
  </BrutalErrorBanner>
{/await}

<style>
  .notice {
    padding: var(--space-4);
    border: var(--brut-border-width) solid var(--brut-ink);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    background: var(--brut-white);
    color: var(--rm-muted);
  }

  .section-title {
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
    color: var(--color-ink);
    margin: 0 0 var(--space-2);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .section-desc {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-4);
    max-width: 48rem;
  }

  .count-badge {
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    font-weight: 700;
    background: var(--brut-ink);
    color: var(--brut-canvas);
    padding: 0.1rem 0.45rem;
    border-radius: 0;
    min-width: 1.5rem;
    text-align: center;
  }

  .inbox-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .inbox-item {
    display: block;
  }

  .item-head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-bottom: var(--space-2);
  }

  .outcome-chip {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0.1rem 0.5rem;
    border: var(--brut-border-micro) solid var(--brut-ink);
    border-radius: 0;
  }

  .chip-accepted {
    background: var(--brut-neon);
    color: var(--brut-ink);
  }

  .chip-rejected {
    background: var(--brut-coral);
    color: var(--brut-ink);
  }

  .chip-review {
    background: var(--brut-canvas-deep, #f0ead6);
    color: var(--brut-ink);
  }

  .state-badge {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--rm-muted);
    padding: 0.1rem 0.3rem;
    border: 1px solid var(--rm-border);
    background: var(--rm-surface);
  }

  .meta-time {
    font-size: var(--text-xs);
    color: var(--rm-muted);
    margin-left: auto;
    white-space: nowrap;
  }

  .obs-text {
    font-size: var(--text-body-sm);
    line-height: var(--text-body-line-height);
    color: var(--color-ink);
    margin: 0 0 var(--space-2);
  }

  .item-meta {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    margin-bottom: var(--space-2);
  }

  .meta-key {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--rm-muted);
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .meta-link {
    font-size: var(--text-xs);
  }

  .btn-link {
    font-size: var(--text-sm);
    color: var(--rm-sage);
    text-decoration: none;
    font-weight: 500;
  }

  .btn-link:hover {
    text-decoration: underline;
  }

  .reasons-details {
    margin: var(--space-2) 0;
  }

  .reasons-summary {
    font-size: var(--text-xs);
    font-weight: 700;
    cursor: pointer;
    color: var(--rm-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-family: var(--font-mono);
    padding: var(--space-1) 0;
    user-select: none;
  }

  .reasons-list {
    list-style: none;
    padding: var(--space-2) 0 0 var(--space-3);
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .reason-item {
    display: flex;
    align-items: baseline;
  }

  .reason-code {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--rm-muted);
    background: var(--rm-surface);
    padding: 0.1rem 0.35rem;
    border: 1px solid var(--rm-border);
    border-radius: 0;
  }

  .item-actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-top: var(--space-3);
    padding-top: var(--space-2);
    border-top: var(--brut-border-micro) solid var(--rm-border);
  }

  .revoked-badge {
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    color: var(--rm-muted);
    font-style: italic;
  }

  .btn {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: var(--space-2) var(--space-3);
    border: var(--brut-border-width) solid var(--brut-ink);
    border-radius: 0;
    background: var(--brut-white);
    color: var(--brut-ink);
    cursor: pointer;
    box-shadow: var(--brut-shadow);
    transition: transform 0.06s ease, box-shadow 0.06s ease;
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    text-decoration: none;
  }

  .btn:hover:not(:disabled) {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0 var(--brut-ink);
  }

  .btn:active:not(:disabled) {
    transform: translate(1px, 1px);
    box-shadow: 2px 2px 0 var(--brut-ink);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--brut-ink);
    color: var(--brut-canvas);
  }

  .btn-sm {
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-xs);
  }

  .btn-danger {
    background: var(--brut-coral);
    color: var(--brut-ink);
  }

  .btn-danger:hover:not(:disabled) {
    background: var(--brut-ink);
    color: var(--brut-coral);
  }
</style>
