<svelte:head>
  <title>Self-serve before enterprise — Restormel Keys</title>
  <meta
    name="description"
    content="Go-to-market sequencing: PLG and self-serve first; defer procurement-heavy SKUs until a buyer sponsors them."
  />
</svelte:head>

<div class="doc-content">
  <h1>Self-serve before enterprise procurement</h1>
  <p class="doc-intro">
    Enterprise adoption often means long security reviews, DPAs, and vendor onboarding—before revenue.
    Prefer <strong>PLG</strong> wins (npm, dashboard, BYO-GPU guides, customer-funded CI) first.
  </p>
  <p>
    Canonical reference (same content, repo path):
    <a href="https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/restormel/gtm-plg-enterprise-sequencing.md"
      >docs/restormel/gtm-plg-enterprise-sequencing.md</a
    >.
  </p>
  <h2>Summary</h2>
  <ul>
    <li><strong>Land</strong> with packages, docs, and BYO compute—no Restormel-hosted GPU by default.</li>
    <li><strong>Expand</strong> with sales-assist when teams outgrow self-serve.</li>
    <li><strong>Attach</strong> webhooks, SIEM-shaped exports, and strict SSO when a <strong>named</strong> customer sponsors the work.</li>
  </ul>
</div>

<style>
  .doc-content {
    max-width: var(--rm-container-narrow);
  }
  .doc-intro {
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
    line-height: var(--leading-relaxed);
  }
  .doc-content h1 {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    margin: 0 0 var(--space-4);
  }
  .doc-content h2 {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    margin: var(--space-8) 0 var(--space-3);
  }
  .doc-content p,
  .doc-content li {
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-3);
  }
  .doc-content ul {
    margin: 0 0 var(--space-4);
    padding-left: var(--space-5);
  }
</style>
