<script lang="ts">
  import "$lib/styles/suite-landing.css";
  import { page } from "$app/stores";
  import { dashboardEntryHref } from "$lib/dashboard-entry";
  import { trackSuiteIntent } from "$lib/posthog";
  import VerifyItYourself from "$lib/components/suite/VerifyItYourself.svelte";
  import SuiteProductCards from "$lib/components/suite/SuiteProductCards.svelte";
  import EcosystemStrip from "$lib/components/integrations/EcosystemStrip.svelte";
  import { isSuiteMarketingExpanded } from "$lib/integration-catalog-for-flags";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
  import { SUITE_MODULES, type SuiteModule } from "$lib/suite/suite-modules";
  import { HOMEPAGE_USE_CASE_IDS, useCasesByIds } from "$lib/content/use-cases";
  import UseCaseTeaserGrid from "$lib/components/marketing/UseCaseTeaserGrid.svelte";
  import { onMount } from "svelte";
  import { agentLog } from "$lib/debug/agent-log";

  const homepageUseCases = useCasesByIds(HOMEPAGE_USE_CASE_IDS);

  onMount(() => {
    // #region agent log
    agentLog("(marketing)/+page.svelte:onMount", "homepage hydrated", {}, "H1", "post-fix");
    // #endregion
  });

  $: suiteModules = ($page.data.suiteModulesForUi ?? SUITE_MODULES) as SuiteModule[];
  $: flags = $page.data.moduleFlags ?? MVP_MODULE_DEFAULTS;
  $: suiteExpanded = isSuiteMarketingExpanded(flags);

  $: productModules = suiteExpanded
    ? suiteModules
    : suiteModules.filter((m) => m.id === "keys" || m.id === "connect");
  $: runRestormelHref = dashboardEntryHref($page.data.user);
</script>

<svelte:head>
  <title>Restormel — Knowledge your agent can trace back to the source</title>
  <meta
    name="description"
    content="Restormel is the verified-context layer for AI products. Every claim an agent uses is bound to a verbatim quote in your source — provenance-traced, quality-gated, and re-checkable. Keys is the control plane; Connect is ingest, retrieve, verify."
  />
</svelte:head>

<div class="suite-landing">
  <!-- §1 — Hero -->
  <section class="suite-hero suite-hero-slab vc-hero" aria-labelledby="suite-hero-heading">
    <div class="suite-hero-inner">
      <div class="suite-hero-copy">
        <p class="suite-hero-eyebrow">The verified-context layer</p>
        <h1 id="suite-hero-heading" class="suite-hero-title">
          Knowledge<br />your agent<br />can trace<br />back to the<br /><em>source</em>
        </h1>
        <p class="suite-hero-lead">
          Restormel is the <strong>verified-context layer</strong> for AI products. Every claim an agent
          uses is <strong>bound to a verbatim quote</strong> in your source — provenance-traced,
          quality-gated, and re-checkable by you or your auditor.
        </p>
        <div class="suite-hero-ctas">
          <!-- TODO(analytics, W5): richer hero-CTA event helper lives on another branch; using existing trackSuiteIntent for now. -->
          <a class="btn btn-primary" href={runRestormelHref} on:click={() => trackSuiteIntent("run")}>
            Run Restormel →
          </a>
          <a class="btn btn-outline" href="#viy-heading">See it verify ↓</a>
        </div>
        <p class="suite-hero-meta">
          <a href="/connect">Connect</a>
          <span class="suite-hero-meta-sep" aria-hidden="true">·</span>
          <a href="/keys">Keys</a>
          <span class="suite-hero-meta-sep" aria-hidden="true">·</span>
          Invite-only while we learn
        </p>
      </div>

      <figure class="vc-hero-visual" aria-labelledby="vc-hero-visual-cap">
        <figcaption id="vc-hero-visual-cap" class="vc-hero-visual-cap">Claim → bound quote → source</figcaption>
        <div class="vc-hero-trace" aria-hidden="true">
          <div class="vc-trace-node vc-trace-claim">
            <span class="vc-trace-label">Agent claim</span>
            <span class="vc-trace-body">“Records kept ≥ 6 years.”</span>
          </div>
          <div class="vc-trace-link-row">
            <span class="vc-trace-link-mark">bound to ↓</span>
          </div>
          <div class="vc-trace-node vc-trace-quote">
            <span class="vc-trace-label">Verbatim quote</span>
            <span class="vc-trace-body"><mark>retained for a minimum of six (6) years</mark></span>
          </div>
          <div class="vc-trace-link-row">
            <span class="vc-trace-link-mark">in ↓</span>
          </div>
          <div class="vc-trace-node vc-trace-source">
            <span class="vc-trace-label">Source · Policy 7.2</span>
            <span class="vc-trace-body vc-trace-hash">hash ✓ · re-checkable</span>
          </div>
        </div>
      </figure>
    </div>
  </section>

  <!-- §2 — Centerpiece: Verify it yourself -->
  <VerifyItYourself />

  <!-- §3 — The gap -->
  <section class="suite-gap" aria-labelledby="gap-heading">
    <div class="suite-section-inner">
      <span class="suite-section-tag">The gap</span>
      <h2 id="gap-heading" class="suite-section-title">A confident answer<br />isn't a checkable one.</h2>
      <p class="suite-section-sub">
        Most AI stacks hand your agent context and hope for the best. When an answer is wrong, there's
        nothing to trace — no span, no source, no way to tell a grounded claim from a fluent guess.
      </p>
      <div class="suite-gap-grid">
        <div class="suite-gap-card suite-gap-card--problem">
          <span class="suite-gap-tag">Without Restormel</span>
          <p class="suite-gap-line">Context goes in. Answers come out. Nobody can point to where a claim came from.</p>
        </div>
        <div class="suite-gap-card suite-gap-card--answer">
          <span class="suite-gap-tag">With Restormel</span>
          <p class="suite-gap-line">
            Every supported claim carries a verbatim quote, a source, and a trace — re-checkable
            without a model.
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- §4 — How it works -->
  <section class="suite-how" aria-labelledby="how-heading">
    <div class="suite-section-inner">
      <span class="suite-section-tag">How it works</span>
      <h2 id="how-heading" class="suite-section-title">Ingest. Verify.<br />Retrieve.</h2>
      <p class="suite-section-sub">
        Knowledge passes a published quality bar before any agent can read it — and stays re-checkable
        after.
      </p>

      <ol class="suite-how-steps">
        <li class="suite-how-step">
          <span class="suite-how-num">01</span>
          <h3 class="suite-how-step-title">Ingest</h3>
          <p class="suite-how-step-body">
            Bring your sources. Restormel extracts claims and binds each one to the exact span it came
            from — quote, offsets, and source hash.
          </p>
        </li>
        <li class="suite-how-step">
          <span class="suite-how-num">02</span>
          <h3 class="suite-how-step-title">Verify</h3>
          <p class="suite-how-step-body">
            Each claim is checked against its bound span, and an independent model family re-checks the
            extraction. Claims that don't bind are excluded, not blended in.
          </p>
        </li>
        <li class="suite-how-step">
          <span class="suite-how-num">03</span>
          <h3 class="suite-how-step-title">Retrieve</h3>
          <p class="suite-how-step-body">
            Agents read only verified context — every claim carrying its verification state, citation,
            and an exportable provenance trace.
          </p>
        </li>
      </ol>

      <div class="suite-how-bar">
        <span class="suite-how-bar-tag">Published quality bar</span>
        <p class="suite-how-bar-stat">≥ 90% supported · ≤ 2% unsupported</p>
        <p class="suite-how-bar-note">
          A testable bar, not a slogan — <code>keys connect eval</code> exits non-zero when a graph
          misses it.
        </p>
      </div>
    </div>
  </section>

  <!-- §5 — Two products -->
  <section class="suite-products" aria-labelledby="products-heading">
    <div class="suite-section-inner">
      <span class="suite-section-tag">Two products, one layer</span>
      <h2 id="products-heading" class="suite-section-title">The control plane<br />and the context.</h2>
      <p class="suite-section-sub">
        Keys is the control plane for your AI traffic. Connect turns your sources into verified context.
        Both sit under the same provenance frame.
      </p>
      <SuiteProductCards modules={productModules} />
    </div>
  </section>

  <!-- §6 — Who it's for -->
  <section class="suite-use-cases suite-hero-slab" aria-labelledby="use-cases-teaser-heading">
    <div class="suite-section-inner">
      <span class="suite-section-tag suite-section-tag--inverted">Who it's for</span>
      <h2 id="use-cases-teaser-heading" class="suite-section-title">Built for teams<br />who get audited.</h2>
      <p class="suite-section-sub">
        Regulated, audit-bound, and high-stakes knowledge work — where "the model said so" isn't an
        answer you can give a reviewer.
      </p>
      <UseCaseTeaserGrid useCases={homepageUseCases} />
      <p class="suite-use-cases-more">
        <a href="/use-cases">See all use cases, including starter templates →</a>
      </p>
    </div>
  </section>

  <!-- §7 — No rip-and-replace -->
  <section class="suite-stack" aria-labelledby="stack-heading">
    <div class="suite-section-inner">
      <span class="suite-section-tag">How it fits</span>
      <h2 id="stack-heading" class="suite-section-title">No rip-and-replace.</h2>
      <p class="suite-section-sub">
        Keep Neon, SurrealDB, and your existing providers. Restormel sits between your stack and your
        product as a thin verified-context layer.
      </p>
      <EcosystemStrip variant="diagram" moduleFlags={flags} />
    </div>
  </section>

  <!-- §8 — Founders Circle invite -->
  <section class="suite-invite" id="invite" aria-labelledby="invite-heading">
    <div class="suite-section-inner suite-invite-inner">
      <div>
        <h2 id="invite-heading" class="suite-section-title">Invite-only<br />while we learn</h2>
        <p class="suite-invite-lead">
          Restormel isn't on general sale yet. Join the Founders Circle — register your email, get a
          personal access link, and help us prove verified context before we set pricing.
        </p>
      </div>
      <a class="btn btn-primary btn-lg" href="/founders#apply-heading">Request early access →</a>
    </div>
  </section>
</div>

<style>
  /* ── §1 hero trace visual ── */
  .vc-hero-visual {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .vc-hero-visual-cap {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-ink-faint);
  }

  .vc-hero-trace {
    display: flex;
    flex-direction: column;
  }

  .vc-trace-node {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    background: var(--color-surface);
    border: var(--border);
    box-shadow: var(--shadow-sm);
    padding: 0.75rem 1rem;
  }

  .vc-trace-source {
    background: var(--color-ink);
    border-color: var(--color-ink);
  }

  .vc-trace-label {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-ink-faint);
  }

  .vc-trace-source .vc-trace-label {
    color: var(--color-yellow);
  }

  .vc-trace-body {
    font-size: var(--text-body-sm);
    color: var(--color-ink);
    line-height: 1.4;
  }

  .vc-trace-source .vc-trace-body {
    color: var(--color-surface);
  }

  .vc-trace-body mark {
    background: var(--color-yellow);
    color: var(--color-ink);
    box-shadow: 0 0 0 2px var(--color-ink);
    padding: 0 2px;
  }

  .vc-trace-hash {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.02em;
  }

  .vc-trace-link-row {
    display: flex;
    justify-content: center;
    padding: 0.375rem 0;
  }

  .vc-trace-link-mark {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-ink-muted);
  }

  /* ── §3 the gap ── */
  .suite-gap-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  .suite-gap-card {
    border: var(--border);
    box-shadow: var(--shadow-md);
    padding: 1.25rem;
    background: var(--color-surface);
  }

  .suite-gap-card--answer {
    background: var(--color-yellow);
  }

  .suite-gap-tag {
    display: block;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-ink-faint);
    margin-bottom: 0.75rem;
  }

  .suite-gap-card--answer .suite-gap-tag {
    color: var(--color-ink);
  }

  .suite-gap-line {
    font-size: var(--text-body-md);
    line-height: var(--text-body-line-height);
    color: var(--color-ink);
    margin: 0;
  }

  /* ── §4 how it works ── */
  .suite-how {
    background: var(--color-bg-deep);
  }

  .suite-how-steps {
    list-style: none;
    margin: 0 0 2rem;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }

  .suite-how-step {
    background: var(--color-surface);
    border: var(--border);
    box-shadow: var(--shadow-md);
    padding: 1.25rem;
  }

  .suite-how-num {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--color-ink-faint);
  }

  .suite-how-step-title {
    font-family: var(--font-display);
    font-size: var(--text-display-sm);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.01em;
    margin: 0.375rem 0 0.5rem;
    color: var(--color-ink);
  }

  .suite-how-step-body {
    font-size: var(--text-body-sm);
    line-height: var(--text-body-line-height);
    color: var(--color-ink-muted);
    margin: 0;
  }

  .suite-how-bar {
    background: var(--color-ink);
    border: var(--border);
    box-shadow: var(--shadow-md);
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .suite-how-bar-tag {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-yellow);
  }

  .suite-how-bar-stat {
    font-family: var(--font-display);
    font-size: clamp(24px, 3vw, 34px);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.01em;
    color: var(--color-surface);
    margin: 0;
  }

  .suite-how-bar-note {
    font-size: var(--text-body-sm);
    color: var(--color-bg);
    margin: 0;
    line-height: 1.5;
  }

  .suite-how-bar-note code {
    font-family: var(--font-mono);
    font-size: 12px;
    background: rgba(255, 255, 255, 0.12);
    padding: 1px 5px;
    color: var(--color-yellow);
  }

  /* ── §6 use cases ── */
  .suite-use-cases-more {
    margin: var(--space-8) 0 0;
    font-size: var(--text-body-md);
    font-weight: 700;
  }
  .suite-use-cases-more a {
    color: var(--color-ink);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  @media (max-width: 900px) {
    .suite-gap-grid,
    .suite-how-steps {
      grid-template-columns: 1fr;
    }
  }
</style>
