<svelte:head>
  <title>Prove — Share – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<!--
  R5: Prove / Share tab — placeholder.
  The public scorecard / shareable proof URL is gated on W4.3 (STOP decision).
  No mock preview, no fake URL. Honest copy only.
-->

<div class="share-gate">
  <h1 class="page-title">Share</h1>
  <p class="page-desc">
    The Share tab will let you generate a public-facing proof URL — a scorecard that shows your knowledge
    graph's verification state, trace summary, and audit status to an outside reviewer without requiring
    them to log in.
  </p>
  <div class="gate-notice" role="note" aria-label="Feature gate notice">
    <p class="gate-title">Pending a security review decision (W4.3)</p>
    <p class="gate-body">
      Before a proof URL can be exposed publicly, the team needs to decide what data is safe to include
      in an unauthenticated response (W4.3 STOP gate). This tab is reserved for that feature.
      It will be built once the decision is made and will not be exposed prematurely.
    </p>
    <p class="gate-body">
      If you need to share evidence with an external auditor right now, export from the
      <a href="/keys/dashboard/prove/traces" class="btn-link">Traces tab</a> or share
      a screenshot of the <a href="/keys/dashboard/prove/proof" class="btn-link">Proof tab</a>.
    </p>
  </div>
</div>

<style>
  .share-gate {
    max-width: 46rem;
  }
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
    margin: 0 0 var(--space-4);
    line-height: 1.6;
  }
  .gate-notice {
    border: var(--border);
    border-left: 4px solid var(--color-ink);
    padding: var(--space-4);
    background: var(--rm-surface);
  }
  .gate-title {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    color: var(--color-ink);
    margin: 0 0 var(--space-3);
  }
  .gate-body {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-3);
    line-height: 1.6;
  }
  .gate-body:last-child {
    margin-bottom: 0;
  }
  .btn-link {
    color: var(--rm-sage);
    text-decoration: none;
    font-weight: 500;
  }
  .btn-link:hover {
    text-decoration: underline;
  }
</style>
