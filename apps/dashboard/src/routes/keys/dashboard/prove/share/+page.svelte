<svelte:head>
  <title>Prove — Share – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<!--
  R5 + W4.3: Prove / Share tab — honestly gated.
  W4.3 shipped the INTERNAL "Prove it" gesture in full (any trust number links to
  its evidence). The PUBLIC, unauthenticated share URL stays deferred behind the
  D7 security decision (STOP gate): the redesign records D7's direction but states
  the security review is MANDATORY before build, and no signed unauthenticated-
  exposure design exists yet. We do not ship a half-secured public surface.
  No mock preview, no fake URL. Honest copy only.
-->

<div class="share-gate">
  <h1 class="page-title">Share</h1>
  <p class="page-desc">
    The Share tab will let you generate a public-facing proof URL — a scorecard that shows your knowledge
    graph's verification state, trace summary, and audit status to an outside reviewer without requiring
    them to log in.
  </p>

  <div class="gate-split">
    <div class="gate-col gate-col--ready" aria-label="Ready now">
      <p class="gate-title gate-title--ready">Ready now — proof inside the dashboard</p>
      <p class="gate-body">
        <!-- These are plain navigation links, NOT prove-it gestures: the prove-it
             affordance is reserved for a trust NUMBER opening its receipt, so applying
             it to ordinary section links would dilute the grammar (W4.3 review minor). -->
        The "Prove it" gesture is live everywhere a trust number appears. Any score factor, verification
        count, regression, or injected claim is a dotted link to its evidence — the trust score on
        <a href="/keys/dashboard/home" class="nav-link">Home</a>
        decomposes into receipts, and every claim in a graph answer opens its
        <a href="/keys/dashboard/claims" class="nav-link">Evidence Dossier</a>.
        For an external auditor today, export a signed trace from the
        <a href="/keys/dashboard/prove/traces" class="nav-link">Traces tab</a>.
      </p>
    </div>

    <div class="gate-col gate-col--gated" role="note" aria-label="Awaiting the D7 security decision">
      <p class="gate-title">Awaiting a security decision (W4.3 STOP gate · D7)</p>
      <p class="gate-body">
        A <strong>public, unauthenticated</strong> share URL needs the team to first decide and sign off
        what is safe to expose without a login — which fields, an expiring signed-URL model, and the rule
        that no claim text is shared without opt-in. That security review is mandatory before this is
        built. Until it lands, this tab stays a placeholder rather than a half-secured public surface.
      </p>
    </div>
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
  .gate-split {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-4);
  }
  @media (min-width: 720px) {
    .gate-split {
      grid-template-columns: 1fr 1fr;
    }
  }
  .gate-col {
    border: var(--border);
    padding: var(--space-4);
    background: var(--rm-surface);
  }
  .gate-col--ready {
    border-left: 4px solid var(--rm-sage, var(--color-ink));
  }
  .gate-col--gated {
    border-left: 4px solid var(--color-ink);
  }
  .gate-title {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    color: var(--color-ink);
    margin: 0 0 var(--space-3);
  }
  .gate-title--ready {
    color: var(--rm-sage, var(--color-ink));
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
  /* Plain nav links (solid underline) — deliberately NOT the dotted prove-it
     affordance, which is reserved for trust numbers opening their receipts. */
  .nav-link {
    color: var(--color-ink);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
</style>
