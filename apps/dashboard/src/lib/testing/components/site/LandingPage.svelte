<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import { githubRepoUrl, keysDocsUrl, keysHomeUrl } from "$lib/testing/site.js";
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";
  import EcosystemStrip from "$lib/components/integrations/EcosystemStrip.svelte";

  const goalYamlExample = `suites:
  - id: web-critical
    environment: local
    goals:
      - id: checkout-happy-path
        type: browser
        description: User completes checkout with AI-generated copy visible.
        success_criteria:
          url_matches: "/checkout/complete"
          text_present:
            - "Order confirmed"
          dom_signals:
            - "main"
          structured_checks:
            - id: summary_line
              path: "css:[data-testid=order-summary]"
              expect: "Thank you"`;

  const testingProBullets = [
    "Hosted run history across branches and environments",
    "Regression dashboard — diffs, trends, and suite health at a glance",
    "Tighter integration with Restormel Keys usage and entitlements",
    "Included in the suite Platform plan alongside Keys Pro and Graph Pro",
  ] as const;
</script>

<div class="landing module-landing">
  <section class="section section--hero" aria-labelledby="hero-heading">
    <div class="container">
      <p class="eyebrow">Restormel Testing — open source</p>
      <h1 id="hero-heading" class="hero-title">Ship AI features without flying blind in CI</h1>
      <p class="lede">
        Restormel Testing is goal-based, workflow-aware testing infrastructure for AI-enabled software. Define what success
        looks like. Run it locally and in GitHub Actions. Get verdicts you can act on — not just green ticks on selectors.
      </p>
      <div class="hero-cta">
        <a class="btn btn-primary" href="{base}/docs/walkthrough">Get started</a>
        <a class="hero-docs-link" href="{base}/docs">Browse the docs →</a>
        <a class="btn btn-ghost" href={githubRepoUrl} rel="noopener noreferrer">Open GitHub →</a>
      </div>
    </div>
  </section>

  <div class="container">
    <EcosystemStrip variant="compact" />
  </div>

  <section class="section section-alt" aria-labelledby="yaml-heading">
    <div class="container">
      <h2 id="yaml-heading" class="section-title">What a goal looks like</h2>
      <p class="section-intro">
        Goals live in your repo as YAML: a stable id, a browser (or agent) type, human intent, and explicit success
        criteria the runner can verify — URL, copy, DOM shape, structured fields — not a pile of incidental selectors.
      </p>
      <div class="yaml-block-wrap">
        <CodeBlock language="yaml" code={goalYamlExample} />
      </div>
      <p class="yaml-foot">
        Full suite schema, environments, and Keys references: <a href="{base}/docs/guides/config">config guide</a> ·
        <a href="{base}/docs/guides/test-definition">test definition</a>
      </p>
    </div>
  </section>

  <section class="section" aria-labelledby="diff-heading">
    <div class="container">
      <h2 id="diff-heading" class="section-title">What makes this different from Playwright + evals?</h2>
      <div class="diff-grid">
        <article class="diff-card">
          <h3 class="diff-title">Goal-based verdicts</h3>
          <p class="diff-body">
            Playwright excels at reliable automation; eval suites excel at model scores. Testing ties <strong>user-visible
            outcomes</strong> to explicit pass / fail / indeterminate verdicts — so CI fails when the journey breaks, not only
            when a single selector flakes or a leaderboard shifts.
          </p>
        </article>
        <article class="diff-card">
          <h3 class="diff-title">Runs where your code runs</h3>
          <p class="diff-body">
            Same CLI contract on your laptop and in GitHub Actions. Repo-native config, artefacts under the run directory
            (summaries, JUnit, traces) — no mandatory hosted control plane for the core loop.
          </p>
        </article>
        <article class="diff-card">
          <h3 class="diff-title">Keys-backed execution</h3>
          <p class="diff-body">
            Model calls resolve through <a href={keysHomeUrl}>Restormel Keys</a> — same policies and BYOK posture as
            production, not a shadow credential system just for tests.
          </p>
        </article>
      </div>
    </div>
  </section>

  <section class="section section-alt" aria-labelledby="oss-heading">
    <div class="container oss-wrap">
      <h2 id="oss-heading" class="section-title">Open source first</h2>
      <p class="oss-lead">
        <strong>Restormel Testing is MIT licensed.</strong> Self-hostable. Forkable. PRs welcome.
      </p>
      <p class="oss-detail">
        <strong>CLI, runner, and GitHub Action</strong> — open source. <strong>Testing Pro:</strong> hosted run history,
        regression dashboard, and deeper suite integration ship as part of the <strong>Restormel Platform</strong> plan.
      </p>
      <p class="oss-links">
        <a href={githubRepoUrl} rel="noopener noreferrer">Repository →</a>
        <span class="oss-sep">·</span>
        <a href={keysDocsUrl}>Keys docs</a>
      </p>
    </div>
  </section>

  <section class="section" aria-labelledby="pro-heading">
    <div class="container pro-wrap">
      <h2 id="pro-heading" class="section-title">What Testing Pro unlocks</h2>
      <p class="section-intro">
        The open-source runner stays the source of truth for local and CI. Pro adds hosted visibility and team workflows
        for organisations standardising on the Restormel suite.
      </p>
      <ul class="pro-list">
        {#each testingProBullets as line}
          <li>{line}</li>
        {/each}
      </ul>
      <a class="btn btn-primary pro-cta" href="/keys/pricing">See pricing &amp; Platform plan →</a>
    </div>
  </section>

  <section class="section section-alt" aria-labelledby="demo-heading">
    <div class="container demo-action-wrap">
      <h2 id="demo-heading" class="section-title demo-action-title">See Testing in action</h2>
      <p class="section-intro demo-action-intro">
        Walk through install, config, and CI with the in-product docs — no placeholder recording required.
      </p>
      <div class="demo-action-buttons">
        <a class="btn btn-primary" href="/testing/docs/walkthrough/phase-1-install">Testing walkthrough →</a>
        <a class="btn btn-secondary" href="/testing/docs/getting-started/new-project">Getting started →</a>
      </div>
    </div>
  </section>

  <section class="section section--founders section-alt" aria-labelledby="founders-heading">
    <div class="container founders-inner">
      <h2 id="founders-heading" class="founders-title">Join the Founders Circle</h2>
      <p class="founders-lead">Invite-only dashboard access while we prove product–market fit. Register — we’ll email your link.</p>
      <div class="founders-actions">
        <a class="btn btn-primary founders-primary" href="/founders#apply-heading">Request early access →</a>
        <p class="founders-secondary-wrap">
          <a class="founders-secondary" href="/founders#program">Learn more about the program</a>
        </p>
      </div>
    </div>
  </section>
</div>

<style>
  .landing {
    padding-bottom: var(--space-12);
  }

  .section {
    width: 100%;
    padding: var(--space-12) 0;
    margin: 0;
  }

  .section--hero {
    padding-top: var(--space-10);
    padding-bottom: var(--space-12);
  }

  .container {
    max-width: var(--rm-container-max);
    margin: 0 auto;
    padding-left: var(--space-6);
    padding-right: var(--space-6);
  }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    background: var(--color-yellow);
    border: var(--border);
    padding: 4px 10px;
    margin-bottom: var(--space-4);
    color: var(--color-ink);
  }

  .hero-title {
    font-family: var(--font-display);
    font-size: clamp(2.5rem, 5vw, 3.5rem);
    font-weight: 900;
    text-transform: uppercase;
    line-height: var(--text-display-line-height);
    letter-spacing: var(--text-display-tracking);
    color: var(--color-ink);
    margin: 0 0 var(--space-6);
    max-width: 22ch;
  }

  @media (min-width: 40rem) {
    .hero-title {
      max-width: none;
    }
  }

  .hero-cta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    align-items: center;
  }

  .hero-docs-link:focus-visible {
    outline: 2px solid var(--color-yellow);
    outline-offset: 0;
  }

  .lede {
    font-size: var(--text-body-lg);
    line-height: var(--text-body-line-height);
    color: var(--color-ink-muted);
    margin: 0 0 var(--space-8);
    max-width: var(--rm-reading-width);
  }

  .hero-docs-link {
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-ink);
    text-decoration: none;
  }

  .hero-docs-link:hover {
    background: var(--color-yellow);
    text-decoration: none;
  }

  .section-title {
    font-family: var(--font-display);
    font-size: clamp(1.75rem, 3vw, 2.25rem);
    font-weight: 900;
    text-transform: uppercase;
    margin: 0 0 var(--space-4);
    color: var(--color-ink);
    letter-spacing: var(--text-display-tracking);
  }

  .section-intro {
    font-size: var(--text-body-md);
    line-height: var(--text-body-line-height);
    color: var(--color-ink-muted);
    margin: 0 0 var(--space-6);
    max-width: var(--rm-reading-width);
  }

  .section-intro a,
  .yaml-foot a,
  .oss-links a,
  .diff-body a {
    color: var(--color-ink);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .section-intro a:hover,
  .yaml-foot a:hover,
  .oss-links a:hover,
  .diff-body a:hover {
    background: var(--color-yellow);
  }

  .section-alt {
    background: var(--color-bg-deep);
    border-top: var(--border);
    border-bottom: var(--border);
  }

  .yaml-block-wrap {
    max-width: 48rem;
    margin-bottom: var(--space-4);
  }

  .yaml-block-wrap :global(.codeblock) {
    min-width: 0;
  }

  .yaml-foot {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    color: var(--rm-dim);
    margin: 0;
    line-height: var(--leading-relaxed);
  }

  .diff-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-5);
  }

  @media (min-width: 48rem) {
    .diff-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .diff-card {
    margin: 0;
    padding: var(--space-5);
    background: var(--color-surface);
    border: var(--border);
    border-radius: 0;
    box-shadow: var(--shadow-md);
  }

  .diff-title {
    font-family: var(--font-display);
    font-size: var(--text-body-md);
    font-weight: 900;
    text-transform: uppercase;
    color: var(--color-ink);
    margin: 0 0 var(--space-2);
  }

  .diff-body {
    font-size: var(--text-body-sm);
    line-height: var(--text-body-line-height);
    color: var(--color-ink-muted);
    margin: 0;
  }

  .diff-body strong {
    color: var(--color-ink);
  }

  .oss-wrap {
    max-width: var(--rm-container-narrow);
    margin: 0 auto;
    text-align: center;
  }

  .oss-lead {
    font-family: var(--rm-font-ui);
    font-size: var(--text-lg);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    margin: 0 0 var(--space-4);
  }

  .oss-lead strong {
    color: var(--rm-text);
  }

  .oss-detail {
    font-family: var(--rm-font-ui);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    margin: 0 0 var(--space-5);
  }

  .oss-detail strong {
    color: var(--rm-text);
  }

  .oss-links {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-dim);
  }

  .oss-sep {
    margin: 0 var(--space-2);
  }

  .pro-wrap {
    max-width: 36rem;
    margin: 0 auto;
  }

  .pro-list {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
    padding-left: var(--space-6);
  }

  .pro-list li {
    margin-bottom: var(--space-2);
  }

  .pro-cta {
    display: inline-flex;
  }

  .demo-action-wrap {
    max-width: 40rem;
    margin: 0 auto;
    text-align: center;
  }
  .demo-action-title {
    margin-bottom: var(--space-3);
  }
  .demo-action-intro {
    margin-bottom: var(--space-6);
  }
  .demo-action-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    justify-content: center;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .section--founders {
    border-bottom: none;
  }

  .founders-inner {
    text-align: center;
    max-width: 36rem;
    margin: 0 auto;
  }

  .founders-title {
    font-family: var(--rm-font-display);
    font-size: clamp(1.5rem, 3vw, var(--text-2xl));
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-4);
  }

  .founders-lead {
    margin: 0 0 var(--space-6);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
  }

  .founders-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
  }

  .founders-primary {
    display: inline-flex;
    text-align: center;
  }

  .founders-secondary-wrap {
    margin: 0;
  }

  .founders-secondary {
    font-size: var(--text-sm);
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .founders-secondary:hover {
    color: var(--signal-teal-hover);
  }
</style>
