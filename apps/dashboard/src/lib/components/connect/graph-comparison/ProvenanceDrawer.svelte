<script lang="ts">
  import type { ProvenanceClaim, RetrievalTrace } from "$lib/connect/graph-comparison-types";
  import { proveDossierHref } from "$lib/prove-it";
  import ProveLink from "$lib/components/connect/ProveLink.svelte";

  export let claims: ProvenanceClaim[] = [];
  export let trace: RetrievalTrace;

  let open = false;

  function truncate(text: string, max = 80): string {
    const t = text.trim();
    return t.length <= max ? t : `${t.slice(0, max).trimEnd()}…`;
  }

  /**
   * W4.3: the prove-it gesture on the MCP answer's verified-claim envelope.
   * Each injected claim links to its Evidence Dossier (W2.2 URL contract:
   * `?unit=<id>`), built through prove-it.ts so the destination is always real.
   */
  function dossierHref(claim: ProvenanceClaim): string {
    return proveDossierHref(claim.id);
  }
</script>

<div class="drawer">
  <button
    type="button"
    class="drawer-toggle brut-focus"
    aria-expanded={open}
    on:click={() => (open = !open)}
  >
    <span class="caret" class:open aria-hidden="true">▶</span>
    SOURCES ({claims.length} {claims.length === 1 ? "claim" : "claims"} used)
  </button>

  {#if open}
    <div class="drawer-body">
      {#if claims.length === 0}
        <p class="drawer-empty">No verified claims were injected for this answer.</p>
      {:else}
        <ul class="claim-list">
          {#each claims as claim (claim.id)}
            <li class="claim" class:weak={claim.verification === "weak"}>
              <p class="claim-text">
                <!-- W4.3: the shared ProveLink renders the prove-it affordance (dotted
                     underline + ↗) so the gesture is one component, not a hand-rolled <a>. -->
                <ProveLink
                  href={dossierHref(claim)}
                  class="claim-link"
                  label="Open this claim's evidence dossier in the graph explorer"
                >
                  {truncate(claim.text)}
                </ProveLink>
              </p>
              <div class="claim-meta">
                <span class="claim-source">{claim.sourceTitle}</span>
                <span class="claim-badge" class:weak={claim.verification === "weak"}>
                  {claim.verification === "supported" ? "SUPPORTED" : "WEAK"}
                </span>
                {#if claim.trustScore !== null}
                  <span class="claim-trust">trust {Math.round(claim.trustScore)}</span>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
      <p class="trace">
        Retrieved using {trace.traversalType} across {trace.hops}
        {trace.hops === 1 ? "hop" : "hops"} from {trace.seedCount}
        {trace.seedCount === 1 ? "seed node" : "seed nodes"}.
      </p>
    </div>
  {/if}
</div>

<style>
  .drawer {
    border-top: var(--border-thin);
    background: var(--color-surface);
  }

  .drawer-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: transparent;
    border: 0;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-ink);
    text-align: left;
  }

  .caret {
    display: inline-block;
    font-size: 9px;
    transition: transform 0.12s ease;
  }
  .caret.open {
    transform: rotate(90deg);
  }

  .drawer-body {
    padding: 0 var(--space-3) var(--space-3);
  }

  .drawer-empty,
  .trace {
    margin: var(--space-2) 0 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    letter-spacing: var(--text-mono-tracking);
    color: var(--color-ink-faint);
  }

  .claim-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .claim {
    padding: var(--space-2) var(--space-3);
    background: var(--color-bg);
    border-left: 3px solid var(--color-yellow);
  }
  .claim.weak {
    border-left: 3px dashed var(--color-ink);
  }

  .claim-text {
    margin: 0 0 var(--space-1);
    font-family: var(--font-body);
    font-size: var(--text-body-sm);
    line-height: 1.4;
    color: var(--color-ink);
  }

  /* The dotted-underline + ↗ + yellow hover now come from the global `.prove-it`
     rule (W4.3); nothing claim-local to add. */

  .claim-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    letter-spacing: var(--text-mono-tracking);
    color: var(--color-ink-faint);
  }

  .claim-source {
    color: var(--color-ink-muted);
  }

  .claim-badge {
    font-weight: 700;
    text-transform: uppercase;
    padding: 1px 5px;
    border: var(--border-thin);
    background: var(--color-yellow);
    color: var(--color-ink);
  }
  .claim-badge.weak {
    background: var(--color-surface);
    color: var(--color-ink);
  }

  .claim-trust {
    text-transform: uppercase;
  }
</style>
