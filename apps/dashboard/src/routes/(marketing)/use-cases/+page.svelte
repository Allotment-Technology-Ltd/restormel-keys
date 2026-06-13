<script lang="ts">
  /**
   * Use cases — what you can build, who's already running it.
   * Audience: a prospect asking "is this for my situation / what could I build?".
   * Purpose: inspire + qualify. Lead with professional/regulated corpora; keep a
   * slim "in production" proof; hobby graphs are a light secondary band.
   *
   * Verification depth (the stat bars, model names, ledger ids) lives on the
   * homepage proof + the verified-context contract — this page links there
   * rather than repeating it.
   *
   * TODO(analytics): wire CTA intent tracking once the shared trackSuiteIntent
   * helper lands on this branch.
   */
  import "$lib/styles/suite-landing.css";
  import "$lib/styles/use-cases-brutal.css";
  import { professionalUseCases, hobbyUseCases, USE_CASES } from "$lib/content/use-cases";
  import UseCaseCard from "$lib/components/marketing/UseCaseCard.svelte";
  import SophiaShowcaseCard from "$lib/components/marketing/SophiaShowcaseCard.svelte";

  const templateCount = USE_CASES.length;

  // Lead with regulated / professional corpora where provenance is the product.
  const LEAD_IDS = [
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

  // Slim shipped cases (one line each; deep dives live on /keys + /connect).
  const productionCases = [
    {
      id: "plot",
      label: "Privacy-first extraction",
      name: "PLOT — Household Operating System",
      oneLiner:
        "Vault document extraction where traceability and consent matter — the extraction path is chosen by policy, and results carry routing metadata for audit without exposing secrets to the client.",
      links: [{ href: "https://plotbudget.com", label: "plotbudget.com" }],
    },
    {
      id: "sophia",
      label: "Complex, combined mode",
      name: "Sophia — structured analysis & ingestion",
      oneLiner:
        "Interactive analysis, ingestion pipelines, user BYOK, and operator surfaces share one control plane — so configuration and what actually runs stay aligned across many routes.",
      links: [{ href: "https://usesophia.app", label: "usesophia.app" }],
    },
  ];
</script>

<svelte:head>
  <title>Use cases — ground your agents with provenance</title>
  <meta
    name="description"
    content="Ground AI agents in verified context: starter templates for compliance, research, product-support, and engineering corpora — plus PLOT and Sophia in production."
  />
</svelte:head>

<div class="use-cases-landing">
  <section class="uc-hero" aria-labelledby="uc-hero-heading">
    <div class="suite-section-inner">
      <span class="suite-section-tag suite-section-tag--inverted">Use cases</span>
      <h1 id="uc-hero-heading" class="suite-section-title">Ground your agents with provenance</h1>
      <p class="suite-section-sub">
        Restormel turns a corpus into verified context — knowledge an agent can trace to the exact source
        span. Pick a starter template, or see it running in production.
      </p>
      <p class="uc-hero-count suite-stat-chip" aria-label="{templateCount} starter templates">
        <span>{templateCount} templates</span>
        <span aria-hidden="true">·</span>
        <span>Pre-filled domain config</span>
      </p>
    </div>
  </section>

  <!-- What you can build: professional / regulated corpora lead -->
  <section class="uc-section" aria-labelledby="build-heading">
    <div class="suite-section-inner">
      <span class="suite-section-tag">What you can build</span>
      <h2 id="build-heading" class="suite-section-title">Professional &amp; regulated corpora</h2>
      <p class="suite-section-sub">
        High-stakes domains where “the AI said so” is not an acceptable citation. Every answer ties back to a
        source span you can check.
      </p>
      <ul class="uc-grid" role="list">
        {#each orderedProfessional as useCase, i (useCase.id)}
          <li><UseCaseCard {useCase} index={i + 1} /></li>
        {/each}
      </ul>
    </div>
  </section>

  <!-- In production: slim proof -->
  <section class="uc-section uc-proof" aria-labelledby="proof-heading">
    <div class="suite-section-inner">
      <span class="suite-section-tag">In production</span>
      <h2 id="proof-heading" class="suite-section-title">Already running this way</h2>
      <p class="suite-section-sub">
        Two shipped products built on the same control plane. The verification depth behind them — the
        published quality bars and how each claim is checked — lives on the
        <a href="/keys/docs/guides/verified-context">verified-context contract</a>.
      </p>
      <div class="uc-case-grid">
        {#each productionCases as c}
          <article id={c.id} class="uc-case" aria-labelledby="{c.id}-title">
            <p class="uc-case-label">{c.label}</p>
            <h3 id="{c.id}-title" class="uc-case-name">{c.name}</h3>
            <p class="uc-case-one-liner">{c.oneLiner}</p>
            <p class="uc-case-links">
              {#each c.links as link}<a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>{/each}
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
        The same provenance-first pipeline that grounds your agents at work is just as good at building a
        living, queryable version of whatever you're obsessed with.
      </p>
      <ul class="uc-grid uc-grid--hobby" role="list">
        <li class="uc-grid-span-full"><SophiaShowcaseCard featured stacked /></li>
        {#each hobbyUseCases as useCase, i (useCase.id)}
          <li><UseCaseCard {useCase} index={orderedProfessional.length + i + 1} /></li>
        {/each}
      </ul>
    </div>
  </section>
</div>

<style>
  .use-cases-landing {
    padding-bottom: var(--space-12);
  }
  .uc-hero,
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

  /* In-production: slim cases */
  .uc-proof .suite-section-sub a,
  .uc-proof-more a,
  .uc-case-links a {
    color: var(--brut-blue, var(--rm-sage));
    font-weight: 600;
  }
  .uc-case-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-5);
    margin: var(--space-6) 0;
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
  .uc-case-links {
    margin: auto 0 0;
    font-size: var(--text-sm);
  }
  .uc-proof-more {
    margin: 0;
    font-size: var(--text-sm);
  }
  @media (max-width: 760px) {
    .uc-case-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
