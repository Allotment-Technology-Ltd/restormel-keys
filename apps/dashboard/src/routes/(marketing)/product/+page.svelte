<script lang="ts">
  /**
   * Capabilities page — "the capabilities behind verified context".
   *
   * Marketing claims ledger citations (docs/verified-context-claims-ledger.md):
   * - "Every supported claim is backed by a verbatim quote you can check" → row #2 (proven)
   * - "Misattributed claims are caught structurally" → row #3 (proven)
   * - "Unsupported claims are excluded, not blended" → row #4 (proven)
   * - "A different model family checks the extraction" → row #5 (proven)
   * - "Every claim carries a provenance trace" → row #7 (proven)
   * - "Published quality bar: ≥90% supported, ≤2% unsupported" → row #8 (proven)
   * - "Uncertainty goes to human review, not into the graph" → row #10 (proven)
   *
   * TODO(analytics): wire CTA intent tracking once the shared trackSuiteIntent
   * helper lands on this branch (currently on another W-series branch).
   */
  import SuiteProofGallery from "$lib/components/suite/SuiteProofGallery.svelte";
  import EcosystemStrip from "$lib/components/integrations/EcosystemStrip.svelte";
  import { page } from "$app/stores";
  import { dashboardEntryHref } from "$lib/dashboard-entry";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

  $: flags = $page.data.moduleFlags ?? MVP_MODULE_DEFAULTS;
  $: runRestormelHref = dashboardEntryHref($page.data.user);

  /** The two MVP capabilities that PRODUCE verified context. */
  const mvpCapabilities = [
    {
      id: "keys",
      kind: "Control plane",
      name: "Keys",
      colorVar: "--brut-module-keys",
      thesis:
        "The control plane for verified context. Keys governs which model runs, under which policy, with whose credentials — so every extraction and validation step is routed deliberately, not hard-coded per handler.",
      outcome:
        "Verified context can't be produced without a control plane: cross-model validation needs an independent family on the line, and BYOK custody keeps raw provider keys off client surfaces.",
      plumbing: ["BYOK key custody", "Resolve + routing", "Policy before spend", "Fallback chains"],
      href: "/keys",
      cta: "Keys overview",
    },
    {
      id: "connect",
      kind: "Ingest · Verify · Retrieve",
      name: "Connect",
      colorVar: "--brut-module-connect",
      thesis:
        "The pipeline that turns a corpus into verified context. Connect ingests sources, verifies every claim against a bound quote with a cross-model check, then retrieves only what survived — with the trace attached.",
      outcome:
        "This is verified context itself: provenance-traced, evidence-bound, quality-gated knowledge an agent or auditor can trace to the exact source span.",
      plumbing: ["Evidence binding", "Cross-model validation", "Quality gate (G2)", "Provenance trace"],
      href: "/connect",
      cta: "Restormel Connect",
    },
  ];

  /** Connect's three phases, each mapped to its verified-context outcome. */
  const connectPhases = [
    {
      step: "01",
      verb: "Ingest",
      line: "Sources land in the pipeline and every assertion is extracted as a discrete claim — nothing is summarised away before it can be checked.",
      outcome: "A corpus becomes a set of checkable claims, not a blob.",
    },
    {
      step: "02",
      verb: "Verify",
      line: "Each claim is bound to a verbatim quote, character offsets, and a hash of the source version. A different model family then judges that span — the extractor never grades its own work.",
      outcome: "A claim with no bound, entailed span can never be marked supported.",
    },
    {
      step: "03",
      verb: "Retrieve",
      line: "Strict retrieval returns only supported claims; excluded, contradicted, inferred, and unverified claims are omitted, never blended in. Every query records which claims were considered and why anything was dropped.",
      outcome: "Agents read knowledge they can be held to — with the audit trail.",
    },
  ];

  /** Capability → verified-context outcome, the spine of the page. */
  const outcomeMap = [
    {
      capability: "Evidence binding (Connect · Verify)",
      outcome: "Every supported claim is backed by a verbatim quote you can re-check — offsets + source hash, no model needed to re-verify.",
      ledger: "#2",
    },
    {
      capability: "Structural misattribution check (Connect · Verify)",
      outcome: "A quote cited against the wrong source fails binding deterministically — misattribution is caught by structure, not model opinion.",
      ledger: "#3",
    },
    {
      capability: "Strict retrieval (Connect · Retrieve)",
      outcome: "Unsupported claims are excluded, not blended — strict mode returns only supported claims to the agent.",
      ledger: "#4",
    },
    {
      capability: "Cross-model validation (Keys routing → Connect · Verify)",
      outcome: "A different model family checks the extraction by default — same-family judges affirmed unseen claims 66.7% of the time; cross-family, 0%.",
      ledger: "#5",
    },
    {
      capability: "Provenance trace (Connect · Retrieve)",
      outcome: "Every claim carries a provenance trace — verification state, citation, and trace ref, exportable for your compliance file.",
      ledger: "#7",
    },
    {
      capability: "Quality gate (Connect · pipeline)",
      outcome: "Published quality bar: ≥90% supported, ≤2% unsupported — graphs that miss the bar fail the gate.",
      ledger: "#8",
    },
    {
      capability: "Review routing (Connect · Verify)",
      outcome: "Uncertainty goes to human review, not into the graph — abstentions and disagreement land in a review queue, never a passing state.",
      ledger: "#10",
    },
  ];

  /** Flag-off modules — clearly "coming", not co-equal. */
  const comingCapabilities = [
    {
      name: "Testing",
      kind: "Assure",
      line: "Goal-based acceptance tests for AI behaviour in CI — so a verified-context regression fails the build, not production.",
    },
    {
      name: "Graph",
      kind: "Visualise",
      line: "An embeddable canvas to render the verified graph — provenance and verification state visible in your own app.",
    },
  ];
</script>

<svelte:head>
  <title>Capabilities — the capabilities behind verified context</title>
  <meta
    name="description"
    content="Restormel is the verified-context layer for AI products. Two capabilities produce it: Keys is the control plane; Connect ingests, verifies, and retrieves provenance-traced, evidence-bound, quality-gated knowledge an agent can trace to the source."
  />
</svelte:head>

<div class="cap-page">
  <!-- Hero -->
  <header class="cap-hero" aria-labelledby="cap-hero-heading">
    <p class="cap-eyebrow">Capabilities</p>
    <h1 id="cap-hero-heading" class="cap-title">The capabilities behind verified context</h1>
    <p class="cap-lead">
      Restormel is the <strong>verified-context layer for AI products</strong> — provenance-traced,
      evidence-bound, quality-gated knowledge an agent (or an auditor) can trace to the exact source span.
      Two capabilities produce it: <strong>Keys</strong> is the control plane, and <strong>Connect</strong>
      ingests, verifies, and retrieves.
    </p>
    <div class="cap-ctas">
      <a class="btn btn-primary" href={runRestormelHref}>Run Restormel</a>
      <a class="btn btn-secondary" href="/docs/quickstart">Embed in my stack</a>
    </div>
  </header>

  <EcosystemStrip variant="compact" stampEyebrow="Fits your stack" moduleFlags={flags} />

  <!-- Two MVP capabilities -->
  <section class="cap-mvp" aria-labelledby="cap-mvp-heading">
    <h2 id="cap-mvp-heading" class="cap-section-title">Two capabilities, one verified context</h2>
    <p class="cap-section-sub">
      These are the MVP capabilities you run today. Keys controls the plane; Connect is the pipeline. The
      supporting plumbing — routing, BYOK, fallbacks — exists to feed verification, not as the headline.
    </p>
    <div class="cap-mvp-grid">
      {#each mvpCapabilities as cap}
        <article class="cap-card" style="--cap-accent: var({cap.colorVar})">
          <p class="cap-card-kind">{cap.kind}</p>
          <h3 class="cap-card-name">{cap.name}</h3>
          <p class="cap-card-thesis">{cap.thesis}</p>
          <p class="cap-card-outcome"><span class="cap-card-outcome-tag">Produces verified context</span>{cap.outcome}</p>
          <ul class="cap-card-plumbing" aria-label="{cap.name} supporting plumbing">
            {#each cap.plumbing as item}
              <li>{item}</li>
            {/each}
          </ul>
          <a class="cap-card-link" href={cap.href}>{cap.cta} →</a>
        </article>
      {/each}
    </div>
  </section>

  <!-- Connect's three phases -->
  <section class="cap-phases" aria-labelledby="cap-phases-heading">
    <div class="cap-phases-head">
      <p class="cap-eyebrow">Connect</p>
      <h2 id="cap-phases-heading" class="cap-section-title">Ingest · Verify · Retrieve</h2>
      <p class="cap-section-sub">
        Verified context is not a feature you toggle — it is the output of three phases. Each one has a job, and
        each one fails safe.
      </p>
    </div>
    <ol class="cap-phase-list" aria-label="Connect pipeline phases">
      {#each connectPhases as phase}
        <li class="cap-phase">
          <span class="cap-phase-step" aria-hidden="true">{phase.step}</span>
          <div class="cap-phase-body">
            <h3 class="cap-phase-verb">{phase.verb}</h3>
            <p class="cap-phase-line">{phase.line}</p>
            <p class="cap-phase-outcome">{phase.outcome}</p>
          </div>
        </li>
      {/each}
    </ol>
  </section>

  <!-- Capability → verified-context outcome map -->
  <section class="cap-outcomes" aria-labelledby="cap-outcomes-heading">
    <div class="cap-outcomes-head">
      <h2 id="cap-outcomes-heading" class="cap-section-title">What each capability buys you</h2>
      <p class="cap-section-sub">
        Every line below maps to a measurable assertion with automated evidence in the
        <a href="/keys/docs/guides/verified-context">verified-context</a> contract — not a slogan.
      </p>
    </div>
    <ul class="cap-outcome-list" role="list">
      {#each outcomeMap as row}
        <li class="cap-outcome-row">
          <span class="cap-outcome-cap">{row.capability}</span>
          <span class="cap-outcome-text">{row.outcome}</span>
          <span class="cap-outcome-ledger" title="Claims ledger row {row.ledger}">{row.ledger}</span>
        </li>
      {/each}
    </ul>
    <p class="cap-outcome-note">
      Quality and verification claims on this page are bound to the
      <a href="/keys/docs/guides/verified-context">claims ledger</a>; every row above cites a
      <code>proven</code> entry.
    </p>
  </section>

  <SuiteProofGallery compact stampEyebrow="Capability samples" />

  <!-- Coming capabilities (flag-off, not co-equal) -->
  <section class="cap-coming" aria-labelledby="cap-coming-heading">
    <div class="cap-coming-head">
      <span class="cap-coming-badge">Coming</span>
      <h2 id="cap-coming-heading" class="cap-section-title">Rounding out the workspace</h2>
    </div>
    <p class="cap-section-sub">
      Two more capabilities are in development. They extend verified context into CI and into your UI — they are
      not yet part of the MVP you run today.
    </p>
    <ul class="cap-coming-list" role="list">
      {#each comingCapabilities as item}
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
    max-width: 64rem;
    margin: 0 auto;
  }

  /* Hero */
  .cap-hero {
    padding-bottom: var(--space-2);
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
    max-width: 18ch;
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

  /* Section primitives */
  .cap-section-title {
    margin: 0 0 var(--space-2);
    font-family: var(--rm-font-display);
    font-size: clamp(1.6rem, 3.2vw, 2.2rem);
    text-transform: uppercase;
    color: var(--brut-ink, var(--rm-text));
  }
  .cap-section-sub {
    margin: 0 0 var(--space-5);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    max-width: 60ch;
  }
  .cap-section-sub :global(a),
  .cap-outcome-note a {
    color: var(--brut-blue, var(--rm-sage));
    font-weight: 600;
  }

  :global(.proof-gallery-frame),
  :global(.stack-rail-outer-stamp) {
    margin: 0;
  }

  /* MVP capability cards */
  .cap-mvp-grid {
    display: grid;
    gap: var(--space-5);
    grid-template-columns: 1fr;
  }
  @media (min-width: 720px) {
    .cap-mvp-grid {
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
  .cap-card-thesis {
    margin: 0 0 var(--space-4);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .cap-card-outcome {
    margin: 0 0 var(--space-4);
    padding: var(--space-3);
    background: color-mix(in srgb, var(--cap-accent, var(--brut-blue)) 12%, var(--brut-white, var(--rm-surface)));
    border-left: 4px solid var(--cap-accent, var(--brut-blue));
    font-size: var(--text-sm);
    color: var(--rm-text);
    line-height: var(--leading-relaxed);
  }
  .cap-card-outcome-tag {
    display: block;
    margin-bottom: var(--space-1);
    font-family: var(--font-mono, monospace);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--rm-dim);
  }
  .cap-card-plumbing {
    list-style: none;
    margin: 0 0 var(--space-4);
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .cap-card-plumbing li {
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

  /* Connect phases */
  .cap-phases-head {
    margin-bottom: var(--space-5);
  }
  .cap-phase-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-4);
    grid-template-columns: 1fr;
  }
  @media (min-width: 880px) {
    .cap-phase-list {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  .cap-phase {
    display: flex;
    flex-direction: column;
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
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .cap-phase-outcome {
    margin: auto 0 0;
    padding-top: var(--space-3);
    border-top: 1px solid var(--rm-border);
    font-size: var(--text-xs);
    color: var(--rm-text);
    font-weight: 600;
    line-height: 1.5;
  }

  /* Outcome map */
  .cap-outcomes-head {
    margin-bottom: var(--space-4);
  }
  .cap-outcome-list {
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: var(--brut-border-width, 2px) solid var(--brut-ink, var(--rm-text));
  }
  .cap-outcome-row {
    display: grid;
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.4fr) 2.5rem;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-2);
    border-bottom: 1px solid var(--rm-border);
    align-items: baseline;
  }
  .cap-outcome-cap {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--rm-text);
  }
  .cap-outcome-text {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .cap-outcome-ledger {
    justify-self: end;
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--brut-ink, var(--rm-text));
    background: var(--brut-neon, #f5c518);
    padding: 0.15em 0.4em;
    border: 1px solid var(--brut-ink, var(--rm-text));
  }
  .cap-outcome-note {
    margin: var(--space-4) 0 0;
    font-size: var(--text-xs);
    color: var(--rm-dim);
    line-height: 1.5;
  }
  .cap-outcome-note code {
    font-family: var(--font-mono, monospace);
    font-size: 0.9em;
    padding: 0.1em 0.3em;
    background: var(--rm-bg);
    border: 1px solid var(--rm-border);
  }

  /* Coming capabilities */
  .cap-coming {
    padding: var(--space-6);
    border: 1px dashed var(--rm-border);
    background: var(--rm-bg);
  }
  .cap-coming-head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-2);
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
  .cap-coming-head .cap-section-title {
    margin: 0;
    font-size: clamp(1.3rem, 2.6vw, 1.7rem);
  }
  .cap-coming-list {
    list-style: none;
    margin: var(--space-4) 0 0;
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
    opacity: 0.92;
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

  @media (max-width: 720px) {
    .cap-outcome-row {
      grid-template-columns: 1fr;
      gap: var(--space-2);
    }
    .cap-outcome-ledger {
      justify-self: start;
    }
  }
</style>
