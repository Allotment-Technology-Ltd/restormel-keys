<script lang="ts">
  /**
   * Capabilities page — "the capabilities behind verified context".
   * Audience: an evaluator asking "what does Restormel actually do?".
   * Purpose: a concise, scannable capability overview — not a proof dump.
   *
   * Claims discipline: the only verification phrasing here is the published
   * quality bar (ledger row #8, proven) and a link to the verified-context
   * contract for the full evidence. No internal jargon (ledger ids, model
   * names) on this marketing surface.
   *
   * TODO(analytics): wire CTA intent tracking once the shared trackSuiteIntent
   * helper lands on this branch.
   */
  import EcosystemStrip from "$lib/components/integrations/EcosystemStrip.svelte";
  import { page } from "$app/stores";
  import { dashboardEntryHref } from "$lib/dashboard-entry";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

  $: flags = $page.data.moduleFlags ?? MVP_MODULE_DEFAULTS;
  $: runRestormelHref = dashboardEntryHref($page.data.user);

  const capabilities = [
    {
      id: "keys",
      kind: "Control plane",
      name: "Keys",
      colorVar: "--brut-module-keys",
      line: "Governs which model runs, under which policy, with whose credentials — so every step is routed deliberately, and an independent model family is always on the line to check the work.",
      pills: ["BYOK custody", "Resolve + routing", "Policy before spend", "Fallback chains"],
      href: "/keys",
      cta: "Keys overview",
    },
    {
      id: "connect",
      kind: "Ingest · Verify · Retrieve",
      name: "Connect",
      colorVar: "--brut-module-connect",
      line: "Turns a corpus into verified context: ingest sources, verify every claim against a bound quote with a cross-model check, then retrieve only what survived — with the trace attached.",
      pills: ["Evidence binding", "Cross-model check", "Quality gate", "Provenance trace"],
      href: "/connect",
      cta: "Restormel Connect",
    },
  ];

  const phases = [
    { step: "01", verb: "Ingest", line: "Sources become discrete, checkable claims — nothing is summarised away before it can be verified." },
    { step: "02", verb: "Verify", line: "Each claim is bound to a verbatim quote and judged by a different model family. No bound, entailed span → never “supported”." },
    { step: "03", verb: "Retrieve", line: "Strict retrieval returns only supported claims; excluded and uncertain ones are omitted, never blended — every query keeps the trail." },
  ];

  const coming = [
    { name: "Testing", kind: "Assure", line: "Goal-based acceptance tests for AI behaviour in CI — a verified-context regression fails the build, not production." },
    { name: "Graph", kind: "Visualise", line: "An embeddable canvas that renders the verified graph — provenance and verification state visible in your own app." },
  ];
</script>

<svelte:head>
  <title>Capabilities — the layer behind verified context</title>
  <meta
    name="description"
    content="Two capabilities produce verified context: Keys is the control plane; Connect ingests, verifies, and retrieves provenance-traced, evidence-bound knowledge an agent can trace to the source. Testing and Graph are coming."
  />
</svelte:head>

<div class="cap-page">
  <header class="cap-hero" aria-labelledby="cap-hero-heading">
    <p class="cap-eyebrow">Capabilities</p>
    <h1 id="cap-hero-heading" class="cap-title">The layer behind verified context</h1>
    <p class="cap-lead">
      Restormel is the <strong>verified-context layer for AI products</strong> — knowledge an agent (or an
      auditor) can trace to the exact source span. Two capabilities produce it: <strong>Keys</strong> controls
      the plane; <strong>Connect</strong> ingests, verifies, and retrieves.
    </p>
    <div class="cap-ctas">
      <a class="btn btn-primary" href={runRestormelHref}>Run Restormel</a>
      <a class="btn btn-secondary" href="/docs/quickstart">Embed in my stack</a>
    </div>
  </header>

  <section class="cap-cards" aria-label="MVP capabilities">
    {#each capabilities as cap}
      <article class="cap-card" style="--cap-accent: var({cap.colorVar})">
        <p class="cap-card-kind">{cap.kind}</p>
        <h2 class="cap-card-name">{cap.name}</h2>
        <p class="cap-card-line">{cap.line}</p>
        <ul class="cap-pills" aria-label="{cap.name} capabilities">
          {#each cap.pills as p}<li>{p}</li>{/each}
        </ul>
        <a class="cap-card-link" href={cap.href}>{cap.cta} →</a>
      </article>
    {/each}
  </section>

  <section class="cap-phases" aria-labelledby="cap-phases-heading">
    <h2 id="cap-phases-heading" class="cap-h2">How Connect produces it</h2>
    <ol class="cap-phase-list" aria-label="Connect pipeline">
      {#each phases as phase}
        <li class="cap-phase">
          <span class="cap-phase-step" aria-hidden="true">{phase.step}</span>
          <h3 class="cap-phase-verb">{phase.verb}</h3>
          <p class="cap-phase-line">{phase.line}</p>
        </li>
      {/each}
    </ol>
    <p class="cap-bar">
      Published quality bar: <strong>≥90% supported · ≤2% unsupported</strong> — graphs that miss it fail the
      gate. <a href="/keys/docs/guides/verified-context">See the verified-context contract →</a>
    </p>
  </section>

  <section class="cap-fits" aria-label="Fits your stack">
    <EcosystemStrip variant="compact" stampEyebrow="Fits your stack" moduleFlags={flags} />
  </section>

  <section class="cap-coming" aria-labelledby="cap-coming-heading">
    <div class="cap-coming-head">
      <span class="cap-coming-badge">Coming</span>
      <h2 id="cap-coming-heading" class="cap-h2 cap-h2--inline">Rounding out the workspace</h2>
    </div>
    <ul class="cap-coming-list" role="list">
      {#each coming as item}
        <li class="cap-coming-item">
          <p class="cap-coming-kind">{item.kind}</p>
          <h3 class="cap-coming-name">{item.name}</h3>
          <p class="cap-coming-line">{item.line}</p>
        </li>
      {/each}
    </ul>
  </section>

  <p class="cap-footer-link"><a href="/docs/how-it-fits-together">How the suite fits together →</a></p>
</div>

<style>
  .cap-page {
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    max-width: 60rem;
    margin: 0 auto;
  }

  .cap-eyebrow {
    margin: 0 0 var(--space-2);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--rm-dim);
  }
  .cap-title {
    margin: 0 0 var(--space-4);
    font-family: var(--rm-font-display);
    font-size: clamp(2.1rem, 5vw, 3.25rem);
    line-height: 1.05;
    text-transform: uppercase;
    color: var(--brut-ink, var(--rm-text));
    max-width: 16ch;
  }
  .cap-lead {
    margin: 0 0 var(--space-5);
    font-size: var(--text-lg);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    max-width: 56ch;
  }
  .cap-lead :global(strong) {
    color: var(--rm-text);
  }
  .cap-ctas {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .cap-h2 {
    margin: 0 0 var(--space-5);
    font-family: var(--rm-font-display);
    font-size: clamp(1.5rem, 3vw, 2rem);
    text-transform: uppercase;
    color: var(--brut-ink, var(--rm-text));
  }
  .cap-h2--inline {
    margin: 0;
  }

  /* Capability cards */
  .cap-cards {
    display: grid;
    gap: var(--space-5);
    grid-template-columns: 1fr;
  }
  @media (min-width: 720px) {
    .cap-cards {
      grid-template-columns: 1fr 1fr;
    }
  }
  .cap-card {
    display: flex;
    flex-direction: column;
    padding: var(--space-5);
    background: var(--brut-white, var(--rm-surface));
    border: var(--brut-border-width, 2px) solid var(--brut-ink, var(--rm-text));
    border-top: 8px solid var(--cap-accent, var(--brut-blue));
    box-shadow: var(--brut-shadow, 4px 4px 0 var(--brut-ink, #0c0c0c));
  }
  .cap-card-kind {
    margin: 0 0 var(--space-1);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--rm-dim);
  }
  .cap-card-name {
    margin: 0 0 var(--space-3);
    font-family: var(--rm-font-display);
    font-size: clamp(1.6rem, 3vw, 2rem);
    text-transform: uppercase;
    color: var(--brut-ink, var(--rm-text));
  }
  .cap-card-line {
    margin: 0 0 var(--space-4);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .cap-pills {
    list-style: none;
    margin: 0 0 var(--space-4);
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .cap-pills li {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    padding: 0.2em 0.55em;
    border: 1px solid var(--rm-border);
    background: var(--rm-bg);
    color: var(--rm-muted);
  }
  .cap-card-link {
    margin-top: auto;
    font-weight: 700;
    color: var(--brut-blue, var(--rm-sage));
  }

  /* Phases */
  .cap-phase-list {
    list-style: none;
    margin: 0 0 var(--space-5);
    padding: 0;
    display: grid;
    gap: var(--space-4);
    grid-template-columns: 1fr;
  }
  @media (min-width: 820px) {
    .cap-phase-list {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  .cap-phase {
    padding: var(--space-5);
    border: var(--brut-border-width, 2px) solid var(--brut-ink, var(--rm-text));
    background: var(--rm-surface);
    box-shadow: var(--brut-shadow, 4px 4px 0 var(--brut-ink, #0c0c0c));
  }
  .cap-phase-step {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--rm-dim);
  }
  .cap-phase-verb {
    margin: var(--space-1) 0 var(--space-2);
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    text-transform: uppercase;
    color: var(--brut-ink, var(--rm-text));
  }
  .cap-phase-line {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .cap-bar {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .cap-bar :global(strong) {
    color: var(--rm-text);
  }
  .cap-bar a {
    color: var(--brut-blue, var(--rm-sage));
    font-weight: 600;
  }

  .cap-fits :global(.stack-rail-outer-stamp) {
    margin: 0;
  }

  /* Coming */
  .cap-coming {
    padding: var(--space-6);
    border: 1px dashed var(--rm-border);
    background: var(--rm-bg);
  }
  .cap-coming-head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  .cap-coming-badge {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--rm-dim);
    border: 1px solid var(--rm-border);
    padding: 0.15em 0.5em;
  }
  .cap-coming-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-4);
    grid-template-columns: 1fr;
  }
  @media (min-width: 640px) {
    .cap-coming-list {
      grid-template-columns: 1fr 1fr;
    }
  }
  .cap-coming-item {
    padding: var(--space-4);
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
  }
  .cap-coming-kind {
    margin: 0 0 var(--space-1);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--rm-dim);
  }
  .cap-coming-name {
    margin: 0 0 var(--space-2);
    font-family: var(--rm-font-display);
    font-size: var(--text-lg);
    text-transform: uppercase;
    color: var(--rm-text);
  }
  .cap-coming-line {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }

  .cap-footer-link {
    margin: 0;
    font-size: var(--text-sm);
  }
  .cap-footer-link a {
    color: var(--brut-blue, var(--rm-sage));
    font-weight: 600;
  }
</style>
