<script lang="ts">
  /**
   * Homepage centerpiece — "Don't trust it. Check it."
   *
   * Interactive proof of the verified-context contract. The visitor reads an
   * agent answer, clicks a claim, and watches Restormel either bind it to the
   * exact verbatim span in the source (supported) or show that it has no span
   * and was excluded (unsupported).
   *
   * Illustrative example only — clearly labelled, not live data. The data and
   * the span offsets live in ./verify-it-yourself-data.ts.
   *
   * Verification phrasing maps to the claims ledger
   * (docs/verified-context-claims-ledger.md):
   *   - "bound to a verbatim quote, re-checkable" → rows #2, #9
   *   - "view trace" / provenance trace            → row #7
   *   - "no source span — excluded, never shown"   → rows #1, #4
   */
  import { VERIFY_SCENARIO, type VerifyClaim } from "./verify-it-yourself-data";

  const scenario = VERIFY_SCENARIO;

  // The supported claim is selected first so the highlight is visible on load.
  let selectedId: string =
    scenario.claims.find((c) => c.state === "supported")?.id ?? scenario.claims[0].id;

  $: selected = scenario.claims.find((c) => c.id === selectedId) ?? scenario.claims[0];

  /** Split the source body into [before, quote, after] for the active span. */
  $: sourceParts = (() => {
    const body = scenario.source.body;
    if (selected.state !== "supported" || !selected.span) {
      return { before: body, quote: "", after: "" };
    }
    const [start, end] = selected.span;
    return {
      before: body.slice(0, start),
      quote: body.slice(start, end),
      after: body.slice(end),
    };
  })();

  function selectClaim(id: string) {
    selectedId = id;
  }

  function claimStateLabel(claim: VerifyClaim): string {
    return claim.state === "supported" ? "Supported" : "Unsupported";
  }
</script>

<section class="viy" aria-labelledby="viy-heading">
  <div class="viy-inner">
    <header class="viy-head">
      <span class="suite-section-tag">See it verify</span>
      <h2 id="viy-heading" class="suite-section-title">Don't trust it.<br />Check it.</h2>
      <p class="suite-section-sub">
        An agent answers a question. Every claim is either bound to a verbatim span in your source — or
        it never reaches the agent. Click a claim to trace it back.
      </p>
    </header>

    <div class="viy-stage">
      <!-- Agent answer + claim picker -->
      <div class="viy-panel viy-answer">
        <div class="viy-panel-chrome">
          <span class="viy-chrome-dot" aria-hidden="true"></span>
          <span class="viy-chrome-label">Agent answer</span>
        </div>
        <div class="viy-panel-body">
          <p class="viy-question">
            <span class="viy-question-tag">Q</span>
            {scenario.question}
          </p>
          <ul class="viy-claims" aria-label="Claims in the agent answer">
            {#each scenario.claims as claim (claim.id)}
              <li>
                <button
                  type="button"
                  class="viy-claim"
                  class:is-selected={claim.id === selectedId}
                  class:is-supported={claim.state === "supported"}
                  class:is-unsupported={claim.state === "unsupported"}
                  aria-pressed={claim.id === selectedId}
                  on:click={() => selectClaim(claim.id)}
                >
                  <span class="viy-claim-mark" aria-hidden="true">
                    {claim.state === "supported" ? "■" : "□"}
                  </span>
                  <span class="viy-claim-text">{claim.text}</span>
                  <span class="viy-claim-state" data-state={claim.state}>
                    {claimStateLabel(claim)}
                  </span>
                </button>
              </li>
            {/each}
          </ul>
        </div>
      </div>

      <!-- Source + verification verdict -->
      <div class="viy-panel viy-source">
        <div class="viy-panel-chrome">
          <span class="viy-chrome-dot" aria-hidden="true"></span>
          <span class="viy-chrome-label">Source · {scenario.source.id}</span>
        </div>
        <div class="viy-panel-body">
          <p class="viy-source-title">{scenario.source.title}</p>
          <pre class="viy-source-body" aria-live="polite"><span class="viy-source-before"
              >{sourceParts.before}</span
            >{#if sourceParts.quote}<mark class="viy-source-quote">{sourceParts.quote}</mark>{/if}<span
              class="viy-source-after">{sourceParts.after}</span
            ></pre>

          <div
            class="viy-verdict"
            class:is-supported={selected.state === "supported"}
            class:is-unsupported={selected.state === "unsupported"}
          >
            <p class="viy-verdict-state">
              <span class="viy-verdict-glyph" aria-hidden="true">
                {selected.state === "supported" ? "✓" : "✗"}
              </span>
              {claimStateLabel(selected)}
            </p>
            <p class="viy-verdict-line">{selected.verdict}</p>
            {#if selected.state === "supported" && selected.traceRef}
              <p class="viy-verdict-trace">
                <span class="viy-trace-ref">{selected.traceRef}</span>
                <button type="button" class="viy-trace-link" disabled aria-disabled="true">
                  View trace →
                </button>
              </p>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <p class="viy-disclaimer">
      Illustrative example — not live data. Spans, sources, and trace refs above are hand-authored to
      show the contract.
    </p>
  </div>
</section>

<style>
  .viy {
    background: var(--color-bg-deep);
  }

  .viy-inner {
    max-width: 75rem;
    margin: 0 auto;
    padding: var(--space-12) var(--space-6);
  }

  .viy-head {
    margin-bottom: var(--space-10);
  }

  .viy-head .suite-section-sub {
    max-width: 38rem;
  }

  .viy-stage {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    align-items: stretch;
  }

  /* ── Panels ── */
  .viy-panel {
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border: var(--border);
    box-shadow: var(--shadow-md);
  }

  .viy-panel-chrome {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    border-bottom: var(--border);
    background: var(--color-ink);
  }

  .viy-chrome-dot {
    width: 10px;
    height: 10px;
    background: var(--color-yellow);
    border: 1.5px solid var(--color-yellow);
    border-radius: 0;
  }

  .viy-chrome-label {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-surface);
  }

  .viy-panel-body {
    padding: 1.25rem;
    flex: 1;
  }

  /* ── Question ── */
  .viy-question {
    display: flex;
    gap: 0.625rem;
    align-items: baseline;
    font-size: var(--text-body-md);
    line-height: var(--text-body-line-height);
    color: var(--color-ink);
    margin: 0 0 1.25rem;
    font-weight: 600;
  }

  .viy-question-tag {
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    color: var(--color-ink);
    background: var(--color-yellow);
    border: var(--border-thin);
    padding: 1px 7px;
  }

  /* ── Claims ── */
  .viy-claims {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .viy-claim {
    width: 100%;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.625rem;
    align-items: start;
    text-align: left;
    background: var(--color-bg);
    border: var(--border);
    border-radius: 0;
    padding: 0.75rem 0.875rem;
    cursor: pointer;
    transition: transform 100ms ease, box-shadow 100ms ease, background 100ms ease;
    min-height: 44px;
  }

  .viy-claim:hover {
    transform: translate(-2px, -2px);
    box-shadow: var(--shadow-sm);
  }

  .viy-claim.is-selected {
    background: var(--color-surface);
    box-shadow: var(--shadow-sm);
    transform: translate(-2px, -2px);
  }

  .viy-claim.is-selected.is-supported {
    border-left: 5px solid var(--state-ok-fg);
  }

  .viy-claim.is-selected.is-unsupported {
    border-left: 5px solid var(--state-fail-fg);
  }

  .viy-claim:focus-visible {
    outline: 3px solid var(--color-yellow);
    outline-offset: 2px;
  }

  .viy-claim-mark {
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.5;
  }

  .viy-claim.is-supported .viy-claim-mark {
    color: var(--state-ok-fg);
  }

  .viy-claim.is-unsupported .viy-claim-mark {
    color: var(--state-fail-fg);
  }

  .viy-claim-text {
    font-size: var(--text-body-sm);
    line-height: 1.5;
    color: var(--color-ink);
  }

  .viy-claim.is-unsupported .viy-claim-text {
    color: var(--color-ink-muted);
    text-decoration: line-through;
    text-decoration-color: var(--state-fail-fg);
    text-decoration-thickness: 1.5px;
  }

  .viy-claim-state {
    align-self: start;
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 2px 6px;
    border: 1.5px solid var(--color-ink);
    white-space: nowrap;
  }

  .viy-claim-state[data-state="supported"] {
    background: var(--state-ok-bg);
    color: var(--state-ok-fg);
    border-color: var(--state-ok-fg);
  }

  .viy-claim-state[data-state="unsupported"] {
    background: var(--state-fail-bg);
    color: var(--state-fail-fg);
    border-color: var(--state-fail-fg);
  }

  /* ── Source ── */
  .viy-source-title {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--color-ink-faint);
    margin: 0 0 0.75rem;
  }

  .viy-source-body {
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.7;
    color: var(--color-ink);
    background: var(--color-bg);
    border: var(--border-thin);
    border-left: 3px solid var(--color-ink);
    padding: 0.875rem 1rem;
    margin: 0 0 1.25rem;
    white-space: pre-line;
    overflow-wrap: break-word;
  }

  .viy-source-quote {
    background: var(--color-yellow);
    color: var(--color-ink);
    box-shadow: 0 0 0 2px var(--color-ink);
    border-radius: 0;
    padding: 0 1px;
  }

  /* ── Verdict ── */
  .viy-verdict {
    border: var(--border);
    border-radius: 0;
    padding: 0.875rem 1rem;
    box-shadow: var(--shadow-sm);
  }

  .viy-verdict.is-supported {
    background: var(--state-ok-bg);
    border-color: var(--state-ok-fg);
    box-shadow: 3px 3px 0 var(--state-ok-fg);
  }

  .viy-verdict.is-unsupported {
    background: var(--state-fail-bg);
    border-color: var(--state-fail-fg);
    box-shadow: 3px 3px 0 var(--state-fail-fg);
  }

  .viy-verdict-state {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.01em;
    margin: 0 0 0.375rem;
  }

  .viy-verdict.is-supported .viy-verdict-state {
    color: var(--state-ok-fg);
  }

  .viy-verdict.is-unsupported .viy-verdict-state {
    color: var(--state-fail-fg);
  }

  .viy-verdict-glyph {
    font-size: 16px;
    line-height: 1;
  }

  .viy-verdict-line {
    font-size: var(--text-body-sm);
    line-height: 1.5;
    color: var(--color-ink);
    margin: 0;
  }

  .viy-verdict-trace {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex-wrap: wrap;
    margin: 0.75rem 0 0;
    padding-top: 0.75rem;
    border-top: 1.5px solid color-mix(in oklab, var(--state-ok-fg) 35%, transparent);
  }

  .viy-trace-ref {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--state-ok-fg);
    letter-spacing: 0.02em;
  }

  /* The live trace viewer ships with the dashboard; disabled here on marketing. */
  .viy-trace-link {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--state-ok-fg);
    background: transparent;
    border: 1.5px solid var(--state-ok-fg);
    padding: 3px 8px;
    cursor: not-allowed;
    opacity: 0.85;
  }

  .viy-disclaimer {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.04em;
    color: var(--color-ink-faint);
    margin: 1.25rem 0 0;
    text-align: center;
  }

  @media (max-width: 900px) {
    .viy-stage {
      grid-template-columns: 1fr;
    }

    .viy-claim {
      grid-template-columns: auto 1fr;
    }

    .viy-claim-state {
      grid-column: 2;
      justify-self: start;
      margin-top: 0.25rem;
    }
  }
</style>
