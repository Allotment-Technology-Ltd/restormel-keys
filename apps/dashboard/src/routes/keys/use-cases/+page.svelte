<svelte:head>
  <title>Use cases — Restormel Keys</title>
  <meta
    name="description"
    content="See how real products use Restormel Keys for policy-driven routing, fallbacks, and BYOK workflows: PLOT and Sophia."
  />
</svelte:head>

<article class="use-cases-page">
  <div class="container">
    <header class="page-header">
      <h1 class="page-title">Use cases</h1>
      <p class="page-kicker">Real products. Different constraints. One control layer.</p>
      <p class="page-intro">
        Restormel Keys helps teams ship governance for AI calls without rebuilding routing, fallback, and BYOK systems from scratch.
        These are two real implementations with different product needs and operating models.
      </p>
    </header>

    <section class="case-section" aria-labelledby="plot-title">
      <h2 id="plot-title" class="case-title">PLOT — privacy-first household finance and admin</h2>
      <p class="case-subhead">
        A household operating system for money, planning, and shared admin, built to reduce mental load without bank-link surveillance.
      </p>
      <p class="case-copy">
        PLOT uses Restormel Keys for high-trust Vault document extraction, where reliability and traceability matter as much as model quality.
        Routing decisions live in policy, not brittle app conditionals, and fallback behavior is managed centrally.
      </p>
      <ul class="case-list">
        <li>Server-side extraction calls policy evaluate (for `plot.vault.extraction`) instead of hardcoded model branching.</li>
        <li>Primary + fallback model paths help preserve the user flow when an upstream call fails.</li>
        <li>Gateway and control-plane credentials stay server-only, aligning with Plotbudget’s privacy posture.</li>
      </ul>
      <p class="case-story">
        Using Restormel guidance and MCP tooling in Cursor, the team stood up a working routing and policy management loop in roughly half an hour
        in one focused implementation session.
      </p>
      <blockquote class="case-quote">
        “We use Restormel Keys to keep model routing and fallback logic out of brittle app code. It gives us safer, policy-driven control for
        sensitive household document workflows.”
      </blockquote>
      <p class="case-attribution">— Plotbudget team</p>
      <p class="case-links">
        <a href="https://plotbudget.com" target="_blank" rel="noopener noreferrer">plotbudget.com</a>
        <span aria-hidden="true"> · </span>
        <a href="https://app.plotbudget.com" target="_blank" rel="noopener noreferrer">app.plotbudget.com</a>
      </p>
    </section>

    <section class="case-section" aria-labelledby="sophia-title">
      <h2 id="sophia-title" class="case-title">Sophia — structured analysis, multi-pass reasoning, BYOK</h2>
      <p class="case-subhead">
        Philosophical inquiry with grounded sources, optional bring-your-own provider keys, and operator-grade ingestion on SvelteKit.
      </p>
      <p class="case-copy">
        Sophia is a complex product with multiple workloads, ingestion flows, and operator controls. Restormel Keys became the shared control plane
        for resolve-time routing, policy checks, and live catalog alignment across those surfaces.
      </p>
      <ul class="case-list">
        <li>Core analysis, allowed-models, ingestion admin, and beta AAIF routes reuse the same resolve and Dashboard API patterns.</li>
        <li>Policy checks can block disallowed model combinations before work starts, with clear operator-facing error behavior.</li>
        <li>Allowed-models combines local BYOK availability with live Keys allowlists, reducing picker drift and bespoke sync logic.</li>
      </ul>
      <p class="case-story">
        Sophia took longer overall because the product itself is deep. Keys reduced implementation complexity by replacing bespoke provider routing and
        BYOK scaffolding, so engineering effort could focus on domain logic and UX quality.
      </p>
      <p class="case-highlight">
        One flagship app: analyse, allowed-models, ingestion admin, and beta AAIF all run through the same Restormel resolve and Dashboard API
        patterns validated in smoke tests.
      </p>
      <p class="case-links">
        <a href="https://usesophia.app" target="_blank" rel="noopener noreferrer">usesophia.app</a>
        <span aria-hidden="true"> · </span>
        <a href="https://docs.usesophia.app" target="_blank" rel="noopener noreferrer">docs.usesophia.app</a>
      </p>
    </section>

    <section class="page-cta" aria-labelledby="cta-title">
      <h2 id="cta-title" class="cta-title">Build your own use case</h2>
      <p class="cta-copy">
        Keep your current AI stack and add policy-driven routing, fallback resilience, and BYOK workflows without rebuilding your application layer.
      </p>
      <div class="cta-actions">
        <a href="/keys/dashboard/login" class="btn btn-primary">Start free</a>
        <a href="/keys/docs" class="btn btn-secondary">Read the docs</a>
      </div>
    </section>
  </div>
</article>

<style>
  .use-cases-page .container {
    max-width: var(--rm-container-max);
    margin: 0 auto;
    padding: 0 var(--space-6);
  }
  .page-header {
    margin-bottom: var(--space-10);
  }
  .page-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-3);
  }
  .page-kicker {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--rm-dim);
  }
  .page-intro {
    margin: 0;
    max-width: var(--rm-container-narrow);
    color: var(--rm-muted);
  }
  .case-section {
    padding: var(--space-7) 0;
    border-top: 1px solid var(--rm-border);
  }
  .case-title {
    margin: 0 0 var(--space-2);
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    color: var(--rm-text);
  }
  .case-subhead {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    color: var(--rm-dim);
  }
  .case-copy {
    margin: 0 0 var(--space-3);
    color: var(--rm-muted);
    max-width: 68ch;
  }
  .case-list {
    margin: 0 0 var(--space-4);
    padding-left: 1.2rem;
    color: var(--rm-text);
  }
  .case-list li + li {
    margin-top: var(--space-2);
  }
  .case-story {
    margin: 0 0 var(--space-3);
    color: var(--rm-muted);
  }
  .case-quote {
    margin: 0 0 var(--space-2);
    padding: var(--space-4);
    border-left: 3px solid var(--rm-sage);
    background: color-mix(in oklab, var(--rm-sage) 10%, var(--rm-surface));
    color: var(--rm-text);
  }
  .case-attribution {
    margin: 0 0 var(--space-3);
    color: var(--rm-dim);
    font-size: var(--text-sm);
  }
  .case-highlight {
    margin: 0 0 var(--space-3);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
    color: var(--rm-text);
    font-size: var(--text-sm);
  }
  .case-links {
    margin: 0;
    font-size: var(--text-sm);
  }
  .page-cta {
    margin-top: var(--space-6);
    padding: var(--space-7);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface);
  }
  .cta-title {
    margin: 0 0 var(--space-2);
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    color: var(--rm-text);
  }
  .cta-copy {
    margin: 0 0 var(--space-4);
    color: var(--rm-muted);
    max-width: 66ch;
  }
  .cta-actions {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  @media (max-width: 760px) {
    .use-cases-page .container {
      padding: 0 var(--space-4);
    }
  }
</style>
