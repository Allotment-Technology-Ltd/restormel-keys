<script lang="ts">
  import SuiteProofGallery from "$lib/components/suite/SuiteProofGallery.svelte";
  import EcosystemStrip from "$lib/components/integrations/EcosystemStrip.svelte";
  import { page } from "$app/stores";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { moduleById } from "$lib/suite/suite-modules";

  const connectMod = moduleById("connect");

  $: flags = $page.data.moduleFlags ?? MVP_MODULE_DEFAULTS;

  /**
   * Marketing claims ledger citations (docs/verified-context-claims-ledger.md):
   * - "Every claim carries a provenance trace" → row #7 (proven)
   * - "Published quality bar: ≥90% supported, ≤2% unsupported" → row #8 (proven)
   * - "The validator catches fabricated claims" → row #6 (proven, continuously enforced)
   * - "A different model family checks the extraction" → row #5 (proven)
   * - "Every claim is validated against its source" → row #1 (proven)
   * - "Misattributed claims are caught structurally, not by model opinion" → row #3 (proven)
   */

  const proofPoints = [
    {
      stat: "≥ 90%",
      label: "supported claims bar",
      detail: "The published G2 gate. Every ingest run is held to it — your agents only receive context that cleared the bar.",
    },
    {
      stat: "100%",
      label: "fabricated-claim recall",
      detail: "Measured 2026-06-10, cross-model routing (extractor: gpt-4o-mini · validator: Llama-3.3-70B). Re-run weekly in CI.",
    },
    {
      stat: "0%",
      label: "affirm-unseen under cross-model",
      detail: "The direct test that the fail-open gate holds: the validator was never shown a claim, and it never passed it.",
    },
  ];

  const outcomeCards = [
    {
      title: "Provenance-traced context",
      body: "Every claim served to an agent carries verification state, bound evidence quotes with character offsets and source-version hash, judge attribution, and a trace link. An auditor can walk from an AI output back to the exact source passage in four steps.",
    },
    {
      title: "Quality-gated knowledge graph",
      body: "The ingest pipeline runs extraction → validation → remediation with fail-safe gates at every step. Omitted verdicts default to the review queue — never to a pass. The graph clears a published bar (≥ 90% supported, ≤ 2% unsupported) or it surfaces the shortfall.",
    },
    {
      title: "Cross-model verification",
      body: "The model family that validates a claim is deliberately different from the one that extracted it. The same-model control affirmed unseen claims 66.7% of the time; the cross-model configuration: 0%. That asymmetry is why cross-model routing is the product default.",
    },
  ];
</script>

<svelte:head>
  <title>Restormel Connect — verified context for agents in regulated domains</title>
  <meta
    name="description"
    content="Provenance-traced, quality-gated knowledge for AI agents. Connect is the control plane for verified context: every claim carries evidence bindings, a cross-model validation record, and an audit trace your compliance team can read."
  />
</svelte:head>

<section class="landing container" aria-labelledby="connect-heading">

  <!-- Hero -->
  <header class="hero" aria-labelledby="connect-heading">
    <p class="eyebrow">Restormel · {connectMod.capability}</p>
    <h1 id="connect-heading" class="hero-title">
      The context layer<br />your auditors can read
    </h1>
    <p class="lead">
      Restormel Connect is the <strong>control plane for verified context</strong> — provenance-traced, quality-gated
      knowledge that agents in regulated domains can actually be held accountable to.
      Every claim your agents receive carries the evidence it was bound against,
      the verdict record, and a trace your compliance team can export.
    </p>
    <div class="ctas">
      <a class="btn btn-primary" href="{DASHBOARD_BASE}/connect">Start in the Connect hub</a>
      <a class="btn btn-secondary" href="/keys/docs/guides/verified-context">What "verified" means →</a>
    </div>
  </header>

  <!-- Proof bar -->
  <div class="proof-bar" aria-label="Published quality bars">
    {#each proofPoints as point}
      <div class="proof-item">
        <span class="proof-stat">{point.stat}</span>
        <span class="proof-label">{point.label}</span>
        <p class="proof-detail">{point.detail}</p>
      </div>
    {/each}
    <p class="proof-footnote">
      Measurement: 2026-06-10. Extractor: <code>openai:gpt-4o-mini</code> · Validator: <code>together:meta-llama/Llama-3.3-70B-Instruct-Turbo</code>.
      Re-measured weekly in CI — a red run treats the claims ledger row as broken until the bar recovers.
      Full detail: <a href="/keys/docs/guides/verified-context">Verified context guide</a>.
    </p>
  </div>

  <!-- Why did the agent say that? -->
  <section class="trace-proof" aria-labelledby="trace-heading">
    <h2 id="trace-heading" class="section-title">Why did the agent say that?</h2>
    <p class="section-lead">
      That question is the one regulators, compliance teams, and cautious buyers actually ask.
      Connect answers it structurally, not after the fact.
    </p>
    <div class="trace-flow" aria-label="Claim to citation to trace audit flow">
      <div class="trace-step">
        <span class="trace-step-label">1 · Claim</span>
        <p class="trace-step-body">
          The agent receives a <code class="inline-code">supported</code> claim in its context.
          The state is not asserted — it means Layer-1 binding passed (quote + offsets + source hash)
          and the cross-model entailment judge agreed.
        </p>
      </div>
      <div class="trace-arrow" aria-hidden="true">→</div>
      <div class="trace-step">
        <span class="trace-step-label">2 · Citation</span>
        <p class="trace-step-body">
          The claim envelope carries <code class="inline-code">evidence[]</code>: the verbatim quote,
          character offsets, and a SHA-256 of the exact source version it was bound against.
          Open the cited source and check the quote yourself.
        </p>
      </div>
      <div class="trace-arrow" aria-hidden="true">→</div>
      <div class="trace-step">
        <span class="trace-step-label">3 · Trace export</span>
        <p class="trace-step-body">
          Follow <code class="inline-code">trace_ref</code> on any claim to the retrieval's full audit
          record: the query, the verification policy in force, every considered claim with its state and
          reason for inclusion or exclusion. Export as JSON for your audit file.
        </p>
      </div>
    </div>
    <p class="trace-link">
      Full walkthrough: <a href="/keys/docs/guides/verified-context#envelope">the verified-claim envelope</a>
      and <a href="/keys/docs/guides/verified-context#audit">auditing a claim yourself</a>.
    </p>
  </section>

  <!-- Three outcome cards -->
  <ul class="outcomes" aria-label="What Connect delivers">
    {#each outcomeCards as item}
      <li class="outcome">
        <h2 class="outcome-title">{item.title}</h2>
        <p class="outcome-body">{item.body}</p>
      </li>
    {/each}
  </ul>

  <!-- Regulated-industry block (legal / pharma / finance) -->
  <section class="regulated-block" aria-labelledby="regulated-heading">
    <p class="reg-eyebrow">Use case · regulated domains</p>
    <h2 id="regulated-heading" class="reg-title">The audit trail your compliance team needs</h2>
    <p class="reg-body">
      Legal research tools, clinical decision support, and financial-analysis copilots share one
      requirement: when the AI says something, a qualified person must be able to check why it said it.
      Connect makes that check mechanical rather than aspirational.
    </p>
    <dl class="reg-items">
      <div class="reg-item">
        <dt>Legal</dt>
        <dd>
          Case law and regulatory corpus ingested with claim-level provenance traces. Every cited passage
          carries the source document version it was bound against — counsel can verify the quote in seconds,
          not hours.
        </dd>
      </div>
      <div class="reg-item">
        <dt>Pharma / clinical</dt>
        <dd>
          Trial data and clinical guidelines with verification state per claim. Unsupported or contradicted
          statements are excluded from agent context, not blended in. The exclusion log is part of the trace
          — auditors see what was withheld and why.
        </dd>
      </div>
      <div class="reg-item">
        <dt>Finance</dt>
        <dd>
          Earnings, filings, and research reports gated to the published quality bar. The trust scorecard
          (<code class="inline-code">GET /connect/v1/graph/scorecard</code>) shows the current verification
          coverage and G2 breakdown at any time — not only after an ingest run.
        </dd>
      </div>
    </dl>
    <p class="reg-cta-line">
      <a href="/keys/docs/guides/verified-context" class="btn btn-secondary">Read the verification chain →</a>
    </p>
  </section>

  <!-- Suite bridge -->
  <p class="bridge">
    Pair with <a href="/keys">Restormel Keys</a> for BYOK on every ingest stage,
    <a href="/graph">Restormel Graph</a> to visualise the knowledge graph in your app, and
    <a href="/testing">Restormel Testing</a> to assure agent behaviour in CI.
  </p>

  <EcosystemStrip variant="compact" stampEyebrow="Fits your stack" moduleFlags={flags} />

  <SuiteProofGallery compact stampEyebrow="See the stack" />

</section>

<style>
  .landing {
    padding: var(--space-8) var(--space-4) var(--space-12);
    max-width: 52rem;
    margin: 0 auto;
  }

  /* Hero */
  .hero {
    margin-bottom: var(--space-8);
  }
  .eyebrow {
    font-size: var(--text-xs);
    color: var(--rm-dim);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 var(--space-2);
  }
  .hero-title {
    margin: 0 0 var(--space-4);
    font-family: var(--brut-font);
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 900;
    line-height: 1.05;
    letter-spacing: -0.01em;
  }
  .lead {
    line-height: 1.6;
    color: var(--rm-muted);
    font-size: var(--text-lg);
    max-width: 48ch;
    margin: 0 0 var(--space-5);
  }
  .lead :global(strong) {
    color: var(--rm-text);
    font-weight: 700;
  }
  .ctas {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  /* Proof bar */
  .proof-bar {
    border: 2px solid var(--brut-ink);
    box-shadow: 4px 4px 0 var(--brut-ink);
    background: var(--brut-white);
    padding: var(--space-5) var(--space-6);
    margin: var(--space-8) 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-4);
  }
  .proof-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    border-right: 1px solid var(--rm-border);
    padding-right: var(--space-4);
  }
  .proof-item:last-of-type {
    border-right: none;
    padding-right: 0;
  }
  .proof-stat {
    font-family: var(--brut-font);
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    font-weight: 900;
    color: var(--brut-ink);
    line-height: 1;
  }
  .proof-label {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--rm-muted);
    font-weight: 600;
  }
  .proof-detail {
    margin: var(--space-1) 0 0;
    font-size: var(--text-xs);
    color: var(--rm-dim);
    line-height: 1.5;
  }
  .proof-footnote {
    grid-column: 1 / -1;
    margin: var(--space-3) 0 0;
    font-size: var(--text-xs);
    color: var(--rm-dim);
    line-height: 1.5;
    border-top: 1px solid var(--rm-border);
    padding-top: var(--space-3);
  }
  .proof-footnote a {
    color: var(--brut-blue);
  }
  .proof-footnote code {
    font-family: var(--font-mono, monospace);
    font-size: 0.9em;
  }

  /* Section headings */
  .section-title {
    margin: 0 0 var(--space-2);
    font-family: var(--brut-font);
    font-size: clamp(1.4rem, 3vw, 1.85rem);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  .section-lead {
    margin: 0 0 var(--space-5);
    color: var(--rm-muted);
    font-size: var(--text-base);
    line-height: 1.6;
    max-width: 56ch;
  }

  /* Trace proof section */
  .trace-proof {
    margin: var(--space-8) 0;
    padding: var(--space-6);
    border: 2px solid var(--brut-ink);
    box-shadow: 4px 4px 0 var(--brut-ink);
    background: var(--brut-white);
  }
  .trace-flow {
    display: grid;
    grid-template-columns: 1fr auto 1fr auto 1fr;
    gap: var(--space-3);
    align-items: start;
    margin: 0 0 var(--space-4);
  }
  .trace-arrow {
    font-size: 1.25rem;
    color: var(--rm-dim);
    padding-top: var(--space-5);
    text-align: center;
  }
  .trace-step {
    padding: var(--space-4);
    border: 1px solid var(--rm-border);
    background: var(--rm-surface);
  }
  .trace-step-label {
    display: block;
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
    color: var(--brut-ink);
    margin-bottom: var(--space-2);
  }
  .trace-step-body {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: 1.55;
  }
  .trace-step-body .inline-code {
    font-family: var(--font-mono, monospace);
    font-size: 0.85em;
    padding: 0.1em 0.3em;
    background: color-mix(in oklab, var(--rm-surface-raised) 85%, var(--rm-border));
  }
  .trace-link {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .trace-link a {
    color: var(--brut-blue);
    font-weight: 600;
  }

  /* Outcome cards */
  .outcomes {
    list-style: none;
    margin: var(--space-8) 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .outcome {
    border: 2px solid var(--brut-ink);
    border-radius: 0;
    background: var(--brut-white);
    box-shadow: 4px 4px 0 var(--brut-ink);
    padding: var(--space-4) var(--space-5);
    transition: transform 100ms ease, box-shadow 100ms ease;
  }
  .outcome:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0 var(--brut-ink);
  }
  .outcome-title {
    margin: 0 0 var(--space-2);
    font-family: var(--brut-font);
    font-size: var(--text-sm);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .outcome-body {
    margin: 0;
    line-height: 1.55;
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }

  /* Regulated-industry block */
  .regulated-block {
    margin: var(--space-8) 0;
    padding: var(--space-6);
    border: 2px solid var(--brut-ink);
    box-shadow: 4px 4px 0 var(--brut-ink);
    background: var(--brut-white);
    border-left-width: 6px;
    border-left-color: var(--brut-yellow, #F5C518);
  }
  .reg-eyebrow {
    margin: 0 0 var(--space-2);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    color: var(--rm-dim);
  }
  .reg-title {
    margin: 0 0 var(--space-3);
    font-family: var(--brut-font);
    font-size: clamp(1.3rem, 3vw, 1.75rem);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  .reg-body {
    margin: 0 0 var(--space-5);
    font-size: var(--text-base);
    color: var(--rm-muted);
    line-height: 1.6;
    max-width: 62ch;
  }
  .reg-items {
    margin: 0 0 var(--space-5);
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-4);
  }
  .reg-item {
    padding: var(--space-4);
    border: 1px solid var(--rm-border);
    background: var(--rm-surface);
  }
  .reg-item dt {
    margin: 0 0 var(--space-2);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--brut-ink);
  }
  .reg-item dd {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: 1.55;
  }
  .reg-item dd .inline-code {
    font-family: var(--font-mono, monospace);
    font-size: 0.85em;
    padding: 0.1em 0.3em;
    background: color-mix(in oklab, var(--rm-surface-raised) 85%, var(--rm-border));
  }
  .reg-cta-line {
    margin: 0;
  }

  /* Suite bridge */
  .bridge {
    line-height: 1.55;
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: var(--space-8) 0 var(--space-6);
  }
  .bridge a {
    color: var(--brut-blue);
    font-weight: 700;
  }

  :global(.proof-gallery-frame),
  :global(.stack-rail-outer-stamp) {
    margin-top: var(--space-6);
  }

  @media (max-width: 860px) {
    .proof-bar {
      grid-template-columns: 1fr;
    }
    .proof-item {
      border-right: none;
      padding-right: 0;
      border-bottom: 1px solid var(--rm-border);
      padding-bottom: var(--space-3);
    }
    .proof-item:last-of-type {
      border-bottom: none;
      padding-bottom: 0;
    }
    .trace-flow {
      grid-template-columns: 1fr;
    }
    .trace-arrow {
      padding-top: 0;
      font-size: 1rem;
    }
    .reg-items {
      grid-template-columns: 1fr;
    }
  }
</style>
