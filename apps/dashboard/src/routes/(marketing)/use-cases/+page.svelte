<script lang="ts">
  /**
   * Use cases — templates + real proof, reframed around grounding agents
   * with provenance.
   *
   * Marketing claims ledger citations (docs/verified-context-claims-ledger.md):
   * - "Every supported claim is backed by a verbatim quote" → row #2 (proven)
   * - "A different model family checks the extraction" → row #5 (proven)
   * - "Every claim carries a provenance trace" → row #7 (proven)
   * - "Published quality bar: ≥90% supported, ≤2% unsupported" → row #8 (proven)
   *
   * The "In production" section is condensed from the retired /keys/use-cases
   * page (PLOT, Sophia, regulated-domain verified-context block).
   *
   * TODO(analytics): wire CTA intent tracking once the shared trackSuiteIntent
   * helper lands on this branch (currently on another W-series branch).
   */
  import "$lib/styles/suite-landing.css";
  import "$lib/styles/use-cases-brutal.css";
  import { professionalUseCases, hobbyUseCases, USE_CASES } from "$lib/content/use-cases";
  import UseCaseCard from "$lib/components/marketing/UseCaseCard.svelte";
  import SophiaShowcaseCard from "$lib/components/marketing/SophiaShowcaseCard.svelte";

  const templateCount = USE_CASES.length;

  // Lead with regulated / professional corpora where provenance is the product.
  const LEAD_IDS: string[] = [
    "compliance-corpus",
    "research-literature",
    "product-support-knowledge",
    "engineering-knowledge",
    "competitive-intelligence",
  ];
  const leadOrder = new Map<string, number>(LEAD_IDS.map((id, i) => [id, i]));
  const orderedProfessional = [...professionalUseCases].sort(
    (a, b) => (leadOrder.get(a.id) ?? 99) - (leadOrder.get(b.id) ?? 99),
  );

  // Condensed regulated-domain patterns (lifted from /keys/use-cases verified block).
  const regulatedPatterns = [
    {
      tag: "Legal",
      body: "Case law and regulatory corpus with claim-level provenance. Cited passages carry the exact source version — counsel verifies a quote in seconds.",
    },
    {
      tag: "Pharma / Clinical",
      body: "Trial data and guidelines with per-claim verification state. Contradicted or unsupported statements are excluded from agent context; the exclusion log is part of the trace.",
    },
    {
      tag: "Finance",
      body: "Earnings, filings, and research gated to the published quality bar. The scorecard shows current verification coverage at any time, not only after an ingest run.",
    },
  ];

  // Condensed shipped cases (lifted + trimmed from /keys/use-cases).
  const productionCases = [
    {
      id: "plot",
      label: "Privacy-first extraction",
      name: "PLOT — Household Operating System",
      oneLiner:
        "Vault document extraction where traceability and consent matter. Keys routes the extraction path by policy; results carry routing metadata for audit, never exposing secrets to the client.",
      handles: [
        "Policy evaluate → chosen extraction route",
        "Automatic fallback when a model call fails",
        "Server-only gateway and control-plane credentials",
      ],
      links: [
        { href: "https://plotbudget.com", label: "plotbudget.com" },
        { href: "https://app.plotbudget.com", label: "app.plotbudget.com" },
      ],
    },
    {
      id: "sophia",
      label: "Complexity & combined mode",
      name: "Sophia — structured analysis & multi-pass reasoning",
      oneLiner:
        "Interactive analysis, ingestion pipelines, user BYOK, and operator surfaces share one control plane — so how it's configured and what runs stay aligned across many routes.",
      handles: [
        "Shared resolve across analysis and ingestion workloads",
        "Policy before expensive work; operator-clear errors when blocked",
        "Allowed-models merges BYOK availability with live allowlists",
      ],
      links: [
        { href: "https://usesophia.app", label: "usesophia.app" },
        { href: "https://docs.usesophia.app", label: "docs.usesophia.app" },
      ],
    },
  ];
</script>

<svelte:head>
  <title>Use cases — ground your agents with provenance</title>
  <meta
    name="description"
    content="Ground AI agents in verified context: starter templates for compliance, research, product-support, and engineering corpora — plus PLOT and Sophia in production. Provenance-traced, evidence-bound, quality-gated knowledge."
  />
</svelte:head>

<div class="use-cases-landing">
  <section class="uc-hero" aria-labelledby="uc-hero-heading">
    <div class="suite-section-inner">
      <span class="suite-section-tag suite-section-tag--inverted">Use cases</span>
      <h1 id="uc-hero-heading" class="suite-section-title">Ground your agents with provenance</h1>
      <p class="suite-section-sub">
        Restormel turns a corpus into verified context — provenance-traced, evidence-bound, quality-gated
        knowledge an agent can trace to the exact source span. Start from a template below, then see it running
        in production.
      </p>
      <p class="uc-hero-count suite-stat-chip" aria-label="{templateCount} starter templates">
        <span>{templateCount} templates</span>
        <span aria-hidden="true">·</span>
        <span>Pre-filled domain config</span>
      </p>
    </div>
  </section>

  <!-- Professional / regulated corpora lead -->
  <section class="uc-section" aria-labelledby="professional-heading">
    <div class="suite-section-inner">
      <span class="suite-section-tag">Where provenance is the product</span>
      <h2 id="professional-heading" class="suite-section-title">Professional &amp; regulated corpora</h2>
      <p class="suite-section-sub">
        High-stakes domains where "the AI said so" is not an acceptable citation. Every answer ties back to a
        source span you can check.
      </p>
      <ul class="uc-grid" role="list">
        {#each orderedProfessional as useCase, i (useCase.id)}
          <li>
            <UseCaseCard {useCase} index={i + 1} />
          </li>
        {/each}
      </ul>
    </div>
  </section>

  <!-- In production: condensed real proof -->
  <section class="uc-section uc-proof" aria-labelledby="proof-heading">
    <div class="suite-section-inner">
      <span class="suite-section-tag">In production</span>
      <h2 id="proof-heading" class="suite-section-title">Already running this way</h2>
      <p class="suite-section-sub">
        Two shipped products and the verified-context bars behind them. Numbers are bound to the
        <a href="/keys/docs/guides/verified-context">claims ledger</a>; copy only states what a proven row backs.
      </p>

      <!-- Verified-context proof bars (regulated domains) -->
      <div id="verified-context" class="uc-verified">
        <p class="uc-verified-eyebrow">Verified context · regulated domains</p>
        <h3 class="uc-verified-title">Provenance-traced knowledge your auditors can check</h3>
        <div class="uc-stat-strip" aria-label="Published quality bars">
          <div class="uc-stat-item">
            <span class="uc-stat">≥ 90%</span>
            <span class="uc-stat-label">supported-claims bar (G2 gate)</span>
          </div>
          <div class="uc-stat-item">
            <span class="uc-stat">100%</span>
            <span class="uc-stat-label">fabricated-claim recall<br /><span class="uc-stat-meta">2026-06-10 · cross-model · re-run weekly in CI</span></span>
          </div>
          <div class="uc-stat-item">
            <span class="uc-stat">0%</span>
            <span class="uc-stat-label">affirm-unseen under cross-model routing</span>
          </div>
        </div>
        <p class="uc-verified-note">
          Bound to: extractor <code class="uc-code">openai:gpt-4o-mini</code>, validator
          <code class="uc-code">together:meta-llama/Llama-3.3-70B-Instruct-Turbo</code>. Every supported claim
          carries a verbatim quote, character offsets, and a source-version hash; a cross-model validator judges
          each span, and every retrieval records an exportable provenance trace.
        </p>
        <div class="uc-regulated-grid">
          {#each regulatedPatterns as pattern}
            <div class="uc-regulated-card">
              <span class="uc-regulated-tag">{pattern.tag}</span>
              <p>{pattern.body}</p>
            </div>
          {/each}
        </div>
      </div>

      <!-- Shipped product cases -->
      <div class="uc-case-grid">
        {#each productionCases as c}
          <article id={c.id} class="uc-case" aria-labelledby="{c.id}-title">
            <p class="uc-case-label">{c.label}</p>
            <h3 id="{c.id}-title" class="uc-case-name">{c.name}</h3>
            <p class="uc-case-one-liner">{c.oneLiner}</p>
            <p class="uc-case-h4">What Keys handles here</p>
            <ul class="uc-case-ul">
              {#each c.handles as h}
                <li>{h}</li>
              {/each}
            </ul>
            <p class="uc-case-links">
              {#each c.links as link, li}
                {#if li > 0}<span aria-hidden="true"> · </span>{/if}<a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>
              {/each}
            </p>
          </article>
        {/each}
      </div>

      <p class="uc-proof-more">
        <a href="/keys">How Keys sits inside your app →</a>
        <span aria-hidden="true"> · </span>
        <a href="/connect">Restormel Connect →</a>
      </p>
    </div>
  </section>

  <!-- Hobby graphs: clearly secondary -->
  <section class="uc-section uc-section--hobby suite-section--hatch" aria-labelledby="hobby-heading">
    <div class="suite-section-inner">
      <span class="suite-section-tag">Also fun</span>
      <h2 id="hobby-heading" class="suite-section-title">Hobby &amp; obsession graphs</h2>
      <p class="uc-hobby-intro suite-callout-frame">
        Secondary, but the point still holds: the same provenance-first pipeline that grounds your agents at work
        is just as good at building a living, queryable version of whatever you're obsessed with.
      </p>
      <ul class="uc-grid uc-grid--hobby" role="list">
        <li class="uc-grid-span-full">
          <SophiaShowcaseCard featured stacked />
        </li>
        {#each hobbyUseCases as useCase, i (useCase.id)}
          <li>
            <UseCaseCard {useCase} index={orderedProfessional.length + i + 1} />
          </li>
        {/each}
      </ul>
    </div>
  </section>
</div>

<style>
  .use-cases-landing {
    padding-bottom: var(--space-12);
  }
  .uc-hero {
    padding: 0;
  }
  .uc-section {
    padding: 0;
  }
  .uc-section .suite-section-inner {
    padding-top: var(--space-10);
    padding-bottom: var(--space-10);
  }
  .uc-hobby-intro {
    margin: 0 0 var(--space-6);
  }
  .uc-grid {
    margin: var(--space-6) 0 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: var(--space-4);
    grid-template-columns: 1fr;
    align-items: stretch;
  }
  @media (min-width: 48rem) {
    .uc-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (min-width: 72rem) {
    .uc-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  .uc-grid > li {
    display: flex;
    min-height: 0;
  }
  .uc-grid-span-full {
    grid-column: 1 / -1;
  }

  /* In-production proof */
  .uc-proof .suite-section-sub a {
    color: var(--brut-blue, var(--rm-sage));
    font-weight: 600;
  }

  .uc-verified {
    margin: var(--space-6) 0 var(--space-8);
    padding: var(--space-6);
    border: var(--brut-border-width, 2px) solid var(--brut-ink, var(--rm-text));
    border-left-width: 6px;
    border-left-color: var(--brut-neon, #f5c518);
    background: var(--brut-white, var(--rm-surface));
    box-shadow: var(--brut-shadow, 4px 4px 0 var(--brut-ink, #0c0c0c));
  }
  .uc-verified-eyebrow {
    margin: 0 0 var(--space-1);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--rm-dim);
  }
  .uc-verified-title {
    margin: 0 0 var(--space-4);
    font-family: var(--rm-font-display);
    font-size: clamp(1.4rem, 3vw, 1.85rem);
    color: var(--brut-ink, var(--rm-text));
  }
  .uc-stat-strip {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-4);
    margin: 0 0 var(--space-4);
    padding: var(--space-4) 0;
    border-top: 1px solid var(--rm-border);
    border-bottom: 1px solid var(--rm-border);
  }
  .uc-stat-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .uc-stat {
    font-family: var(--rm-font-display);
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    font-weight: 900;
    line-height: 1;
    color: var(--brut-ink, var(--rm-text));
  }
  .uc-stat-label {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
    color: var(--rm-muted);
    line-height: 1.4;
  }
  .uc-stat-meta {
    display: block;
    font-size: 0.9em;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    color: var(--rm-dim);
    margin-top: 2px;
  }
  .uc-verified-note {
    margin: 0 0 var(--space-5);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .uc-code {
    font-family: var(--font-mono, monospace);
    font-size: 0.9em;
    padding: 0.1em 0.35em;
    background: var(--rm-bg);
    border: 1px solid var(--rm-border);
  }
  .uc-regulated-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
  }
  .uc-regulated-card {
    padding: var(--space-4);
    border: 1px solid var(--rm-border);
    background: var(--rm-bg);
  }
  .uc-regulated-tag {
    display: inline-block;
    margin-bottom: var(--space-2);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--brut-ink, var(--rm-text));
  }
  .uc-regulated-card p {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: 1.55;
  }

  .uc-case-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-5);
    margin-bottom: var(--space-6);
  }
  .uc-case {
    display: flex;
    flex-direction: column;
    padding: var(--space-5);
    border: var(--brut-border-width, 2px) solid var(--brut-ink, var(--rm-text));
    background: var(--rm-surface);
    box-shadow: var(--brut-shadow, 4px 4px 0 var(--brut-ink, #0c0c0c));
  }
  .uc-case-label {
    margin: 0 0 var(--space-1);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--rm-dim);
  }
  .uc-case-name {
    margin: 0 0 var(--space-2);
    font-family: var(--rm-font-display);
    font-size: clamp(1.2rem, 2.4vw, 1.5rem);
    color: var(--brut-ink, var(--rm-text));
  }
  .uc-case-one-liner {
    margin: 0 0 var(--space-4);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .uc-case-h4 {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--rm-text);
  }
  .uc-case-ul {
    margin: 0 0 var(--space-4);
    padding-left: 1.1rem;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: 1.55;
  }
  .uc-case-ul li + li {
    margin-top: var(--space-1);
  }
  .uc-case-links {
    margin: auto 0 0;
    font-size: var(--text-sm);
  }
  .uc-case-links a {
    color: var(--brut-blue, var(--rm-sage));
    font-weight: 600;
  }
  .uc-proof-more {
    margin: 0;
    font-size: var(--text-sm);
  }
  .uc-proof-more a {
    color: var(--brut-blue, var(--rm-sage));
    font-weight: 600;
  }

  @media (max-width: 980px) {
    .uc-stat-strip {
      grid-template-columns: 1fr 1fr;
    }
    .uc-regulated-grid {
      grid-template-columns: 1fr;
    }
    .uc-case-grid {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 760px) {
    .uc-stat-strip {
      grid-template-columns: 1fr;
    }
    .uc-verified {
      padding: var(--space-5) var(--space-4);
    }
  }
</style>
