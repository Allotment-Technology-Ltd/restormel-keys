<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import { githubRepoUrl, keysDocsUrl, keysHomeUrl } from "$lib/testing/site.js";

  const journeys = [
    {
      href: `${base}/docs/getting-started/existing-stack`,
      title: "Monorepo with Playwright already",
      blurb: "pnpm workspaces, global setup, storage state—add Testing without rewiring E2E.",
    },
    {
      href: `${base}/docs/journeys/new-project`,
      title: "First run in your repo",
      blurb: "Install the CLI, add a suite config, and run goals locally.",
    },
    {
      href: `${base}/docs/journeys/ci`,
      title: "Gate AI journeys on PRs",
      blurb: "Run the same suite in GitHub Actions with a clear pass/fail verdict.",
    },
    {
      href: `${base}/docs/journeys/keys`,
      title: "Wire execution through Keys",
      blurb: "BYOK and provider resolution without parallel secret systems.",
    },
    {
      href: `${base}/docs/journeys/from-e2e`,
      title: "Replace brittle scripted E2E",
      blurb: "Goals and success criteria instead of endless selector-only scripts.",
    },
    {
      href: `${base}/docs/guides/test-definition`,
      title: "Regression across models",
      blurb: "Define goals once, vary provider paths—CI-first regression, not ad hoc evals.",
    },
  ] as const;

  const boxItems = [
    {
      title: "Repo-native suites",
      text: "YAML suites and goals, environments, timeouts, and retries—checked into git.",
    },
    {
      title: "Goal-based runner",
      text: "Browser-backed runs with structured verdicts: passed, failed, or indeterminate.",
    },
    {
      title: "Keys integration",
      text: "Logical model references resolved through Restormel Keys; no second key vault.",
    },
    {
      title: "CLI & CI",
      text: "Local commands plus a composite GitHub Action; Markdown summaries, JUnit, and JSON under each run directory.",
    },
    {
      title: "Artefacts",
      text: "Summaries, timelines, and evidence you can triage from a failed job—not a hosted observability product.",
    },
  ] as const;
</script>

<div class="landing">
  <!-- 1. Hero -->
  <section class="section section--hero" aria-labelledby="hero-heading">
    <div class="container">
    <p class="eyebrow">Restormel Testing — open source</p>
    <h1 id="hero-heading" class="hero-title">
      Stop shipping AI flows you can’t regression-test in CI
    </h1>
    <p class="lede">
      Restormel Testing is open-source infrastructure for <strong>goal-based, workflow-aware</strong> tests of
      AI-enabled software—in <strong>local development and CI/CD</strong>—with model execution through
      <strong>Restormel Keys (BYOK)</strong>.
    </p>
    <p class="lede lede--tight">
      Define suites in repo config. Get verdicts and artefacts you can act on. Not a hosted control plane requirement
      for the core loop.
    </p>

    <ul class="pillars" role="list">
      <li class="pillar">
        <h2 class="pillar__title">Goals, not just clicks</h2>
        <p class="pillar__text">
          Express critical journeys as outcomes and success criteria—so a run can fail when the user outcome fails, not
          only when a selector breaks.
        </p>
      </li>
      <li class="pillar">
        <h2 class="pillar__title">Keys-backed execution</h2>
        <p class="pillar__text">
          Resolve providers and models through the same Restormel layer your app uses. Keep cost and provider choice under
          your keys.
        </p>
      </li>
      <li class="pillar">
        <h2 class="pillar__title">Built for CI</h2>
        <p class="pillar__text">
          The same run contract locally and in GitHub Actions—structured summaries, retries, and evidence for triage.
        </p>
      </li>
    </ul>

    <p class="ecosystem">
      Composes with Playwright for browser automation. Docs and examples track the MVP CLI and <code>restormel-testing</code> config.
    </p>

    <div class="hero-cta">
      <a class="btn btn-primary" href="{base}/docs/walkthrough">Get started</a>
      <a class="hero-docs-link" href="{base}/docs">Browse the docs →</a>
    </div>
    </div>
  </section>

  <!-- 2. What brings you here? -->
  <section class="section section-alt" aria-labelledby="journeys-heading">
    <div class="container">
    <h2 id="journeys-heading" class="section-title">What brings you here?</h2>
    <ul class="journey-grid" role="list">
      {#each journeys as j}
        <li>
          <a class="journey-tile" href={j.href}>
            <span class="journey-tile__title">{j.title}</span>
            <span class="journey-tile__blurb">{j.blurb}</span>
          </a>
        </li>
      {/each}
    </ul>
    </div>
  </section>

  <!-- 3. What Testing is -->
  <section class="section section--prose" aria-labelledby="what-heading">
    <div class="container">
    <h2 id="what-heading" class="section-title">What Testing is</h2>
    <div class="prose">
      <p>
        A testing layer for teams shipping <strong>prompt-driven features</strong>, <strong>browser flows that depend on AI</strong>,
        <strong>tool-using agents</strong>, and <strong>retrieval-backed behaviour</strong>. It is designed for
        <strong>non-determinism</strong>: explicit verdicts, retries, and artefacts instead of pretending every run is a
        simple boolean.
      </p>
      <p>
        It extends the Restormel suite the same way Keys extends your runtime—<strong>open source</strong>, repo-native,
        and meant to run where your pipeline already runs.
      </p>
      <p class="prose-label">Out of scope for this product story:</p>
      <ul class="neglist neglist--inline" role="list">
        <li>Not a generic <strong>Playwright wrapper</strong>—browser automation is a substrate, not the headline.</li>
        <li>Not a generic <strong>eval dashboard</strong> or prompt playground.</li>
        <li>Not an <strong>observability platform</strong>—use your existing production tooling for that job.</li>
        <li>Not a replacement for <strong>unit tests, types, lint, or security scanning</strong>.</li>
      </ul>
    </div>
    </div>
  </section>

  <!-- 4. Product proof -->
  <section class="section section-alt" id="proof" aria-labelledby="proof-heading">
    <div class="container">
    <h2 id="proof-heading" class="section-title">Built where it ships first</h2>
    <p class="section-intro">
      The MVP is intentionally small and dogfooded on real product surface area before the scope balloons.
    </p>
    <article class="proof-card">
      <h3 class="proof-card__title">Plot — web-critical journeys</h3>
      <p class="proof-card__text">
        First suites target Plot’s <code>web-critical</code> goals: a handful of business-meaningful browser journeys with
        explicit success criteria, runnable locally and in GitHub Actions, with Keys-backed model execution and
        triage-friendly failure output.
      </p>
      <p class="proof-card__text">
        <a href="{githubRepoUrl}/tree/main/docs" rel="noopener noreferrer">Read product and MVP docs in the repo →</a>
      </p>
    </article>
    </div>
  </section>

  <!-- 5. Stack -->
  <section class="section" aria-labelledby="stack-heading">
    <div class="container">
    <h2 id="stack-heading" class="section-title">Where Testing fits in your stack</h2>
    <p class="section-intro">
      Testing runs in your pipeline and talks to your app like other developer tools. It is not a proxy in front of user
      traffic and not a replacement for your AI gateway.
    </p>
    <div class="stack-layers" role="list">
      <div class="stack-layer" role="listitem">
        <span class="stack-layer__label">Your product</span>
        <span class="stack-layer__body">Features, UI, APIs, agents—your domain code.</span>
      </div>
      <div class="stack-layer stack-layer--accent" role="listitem">
        <span class="stack-layer__label">Restormel Testing</span>
        <span class="stack-layer__body">Suites, goals, runner, verdicts, CI adapters, artefacts.</span>
      </div>
      <div class="stack-layer" role="listitem">
        <span class="stack-layer__label">Automation &amp; execution</span>
        <span class="stack-layer__body">Browser automation (e.g. Playwright), job runners, local and CI environments.</span>
      </div>
      <div class="stack-layer" role="listitem">
        <span class="stack-layer__label">Restormel Keys</span>
        <span class="stack-layer__body">Resolve, policy, and BYOK execution alignment for model calls used in tests.</span>
      </div>
      <div class="stack-layer" role="listitem">
        <span class="stack-layer__label">Providers</span>
        <span class="stack-layer__body">Direct APIs or gateways you already use.</span>
      </div>
    </div>
    <figure
      class="media-placeholder"
      aria-label="Placeholder for a future stack diagram"
    >
      <div class="media-placeholder__frame"></div>
      <figcaption class="media-placeholder__cap">Diagram placeholder — stack illustration can ship here without layout changes.</figcaption>
    </figure>
    </div>
  </section>

  <!-- 6. What it tests -->
  <section class="section section-alt section--prose" aria-labelledby="covers-heading">
    <div class="container">
    <h2 id="covers-heading" class="section-title">What it tests</h2>
    <ul class="checklist" role="list">
      <li>AI features and prompts that change behaviour without a traditional “code diff”.</li>
      <li>Browser and UI flows where AI is on the critical path to the user outcome.</li>
      <li>Agent-style workflows with tools or multi-step reasoning.</li>
      <li>Retrieval-aware behaviour where quality degrades before hard errors appear.</li>
      <li>Regression when models, providers, or prompts change—via Keys-aware execution.</li>
    </ul>
    </div>
  </section>

  <!-- 7. How it works -->
  <section class="section section--prose" aria-labelledby="how-heading">
    <div class="container">
    <h2 id="how-heading" class="section-title">How it works</h2>
    <ol class="steps">
      <li><strong>Config in the repo</strong> — suites, goals, environments, and opaque Keys references (never raw secrets in YAML).</li>
      <li><strong>CLI or CI</strong> starts a run with the same contract everywhere.</li>
      <li><strong>Runner</strong> executes browser-backed goals with retries, verdicts, and artefact writes.</li>
      <li><strong>Keys adapter</strong> resolves logical models to provider execution.</li>
      <li><strong>Reporter</strong> writes summaries and artefacts for local triage and downstream CI consumers.</li>
    </ol>
    </div>
  </section>

  <!-- 8. Built on Keys -->
  <section class="section section-alt section--prose" aria-labelledby="keys-heading">
    <div class="container">
    <h2 id="keys-heading" class="section-title">Built on Restormel Keys</h2>
    <div class="prose">
      <p>
        Keys is the suite product for <strong>routing, policy, and BYOK</strong>. Testing uses that seam so test runs
        <strong>don’t bypass</strong> your control plane and <strong>don’t invent</strong> a parallel credential system.
        Configure projects and keys where you already do for production workloads.
      </p>
      <p>
        <a href={keysHomeUrl}>Restormel Keys</a> ·
        <a href={keysDocsUrl}>Keys documentation</a>
      </p>
    </div>
    </div>
  </section>

  <!-- 9. What's in the box -->
  <section class="section" aria-labelledby="box-heading">
    <div class="container">
    <h2 id="box-heading" class="section-title">What’s in the box</h2>
    <p class="section-intro">
      Suites, runs, and CI-friendly outputs—composed from mature pieces, with Restormel-owned contracts in the middle.
    </p>
    <ul class="box-grid" role="list">
      {#each boxItems as item}
        <li class="box-item">
          <h3 class="box-item__title">{item.title}</h3>
          <p class="box-item__text">{item.text}</p>
        </li>
      {/each}
    </ul>
    </div>
  </section>

  <!-- 10. Final CTA -->
  <section class="section section-alt section--final" aria-labelledby="final-heading">
    <div class="container">
    <h2 id="final-heading" class="final-cta__title">Add testing to your AI pipeline</h2>
    <p class="final-cta__lede">
      Install the CLI, define a small suite, wire Keys, then run the same job locally and in GitHub Actions. Follow the
      <a href="{base}/docs/walkthrough">walkthrough</a> from inventory to CI.
    </p>
    <div class="final-cta__actions">
      <a class="btn btn-primary" href="{base}/docs/walkthrough">Get started</a>
      <a class="btn btn-ghost" href={githubRepoUrl} rel="noopener noreferrer">Open GitHub →</a>
    </div>
    <figure
      class="media-placeholder media-placeholder--compact"
      aria-label="Placeholder for product screenshot or demo recording"
    >
      <div class="media-placeholder__frame"></div>
      <figcaption class="media-placeholder__cap">Media placeholder — screenshot or demo can replace this region.</figcaption>
    </figure>
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

  .eyebrow {
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--rm-dim);
    margin: 0 0 var(--space-4);
  }

  .hero-title {
    font-family: var(--rm-font-display);
    font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl));
    font-weight: var(--font-semibold);
    line-height: var(--leading-tight);
    letter-spacing: var(--tracking-tight);
    color: var(--rm-text);
    margin: 0 0 var(--space-6);
    max-width: 20ch;
  }

  @media (min-width: 40rem) {
    .hero-title {
      max-width: none;
    }
  }

  .lede {
    font-family: var(--rm-font-ui);
    font-size: var(--text-lg);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    margin: 0 0 var(--space-4);
    max-width: var(--rm-reading-width);
  }

  .lede--tight {
    font-size: var(--text-base);
    margin-bottom: var(--space-8);
  }

  .lede strong {
    color: var(--rm-text);
    font-weight: var(--font-semibold);
  }

  .pillars {
    list-style: none;
    margin: 0 0 var(--space-8);
    padding: 0;
    display: grid;
    gap: var(--space-6);
    grid-template-columns: 1fr;
  }

  @media (min-width: 48rem) {
    .pillars {
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-8);
    }
  }

  .pillar {
    margin: 0;
  }

  .pillar__title {
    font-family: var(--rm-font-display);
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    margin: 0 0 var(--space-3);
    color: var(--rm-text);
  }

  .pillar__text {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    margin: 0;
  }

  .ecosystem {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    color: var(--rm-dim);
    margin: 0 0 var(--space-8);
    max-width: var(--rm-reading-width);
  }

  .ecosystem code {
    font-size: 0.95em;
    color: var(--rm-muted);
  }

  .hero-cta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    align-items: center;
  }

  .hero-docs-link {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--rm-sage);
    text-decoration: none;
  }

  .hero-docs-link:hover {
    text-decoration: underline;
  }

  .hero-docs-link:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }

  .section-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: var(--font-semibold);
    margin: 0 0 var(--space-6);
    color: var(--rm-text);
    letter-spacing: var(--tracking-tight);
  }

  .section-intro {
    font-family: var(--rm-font-ui);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    margin: calc(var(--space-2) * -1) 0 var(--space-6);
    max-width: var(--rm-reading-width);
  }

  .journey-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-4);
    grid-template-columns: 1fr;
  }

  @media (min-width: 40rem) {
    .journey-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 64rem) {
    .journey-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .journey-tile {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    height: 100%;
    padding: var(--card-padding-md);
    background: var(--rm-surface-raised);
    border: var(--border-1) solid var(--rm-border);
    border-radius: var(--rm-card-radius);
    box-shadow: var(--rm-card-shadow);
    text-decoration: none;
    color: inherit;
    transition: border-color var(--duration-fast) var(--ease);
  }

  .journey-tile:hover {
    border-color: var(--rm-sage);
  }

  .journey-tile:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }

  .journey-tile__title {
    font-family: var(--rm-font-display);
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
  }

  .journey-tile__blurb {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
  }

  .prose {
    font-family: var(--rm-font-ui);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    max-width: var(--rm-reading-width);
  }

  .prose p {
    margin: 0 0 var(--space-4);
  }

  .prose p:last-child {
    margin-bottom: 0;
  }

  .prose strong {
    color: var(--rm-text);
  }

  .prose-label {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: var(--space-6) 0 var(--space-3);
  }

  .prose a {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .prose a:hover {
    color: var(--signal-teal-hover);
  }

  .prose a:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }

  .proof-card {
    background: var(--rm-surface-raised);
    border: var(--border-1) solid var(--rm-border);
    border-radius: var(--rm-card-radius);
    padding: var(--card-padding-lg);
    max-width: var(--rm-reading-width);
    box-shadow: var(--rm-card-shadow);
  }

  .proof-card__title {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    margin: 0 0 var(--space-3);
    color: var(--rm-text);
  }

  .proof-card__text {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    margin: 0 0 var(--space-3);
  }

  .proof-card__text:last-child {
    margin-bottom: 0;
  }

  .proof-card a {
    color: var(--rm-sage);
    font-weight: var(--font-medium);
  }

  .proof-card a:hover {
    color: var(--signal-teal-hover);
  }

  .proof-card code {
    font-size: 0.9em;
    color: var(--rm-text);
  }

  .stack-layers {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-bottom: var(--space-8);
    max-width: 36rem;
  }

  .stack-layer {
    padding: var(--space-4) var(--space-5);
    background: var(--rm-surface);
    border: var(--border-1) solid var(--rm-border);
    border-radius: var(--rm-card-radius);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .stack-layer--accent {
    border-color: var(--path-blue-20);
    background: var(--path-blue-5);
  }

  .stack-layer__label {
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--rm-dim);
  }

  .stack-layer--accent .stack-layer__label {
    color: var(--path-blue);
  }

  .stack-layer__body {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }

  .media-placeholder {
    margin: var(--space-8) 0 0;
    max-width: 40rem;
  }

  .media-placeholder--compact {
    margin-top: var(--space-8);
    max-width: 100%;
  }

  .media-placeholder__frame {
    min-height: 12rem;
    border: var(--border-1) dashed var(--rm-border);
    border-radius: var(--rm-card-radius);
    background: var(--rm-surface);
  }

  .media-placeholder--compact .media-placeholder__frame {
    min-height: 8rem;
  }

  .media-placeholder__cap {
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    color: var(--rm-dim);
    margin: var(--space-3) 0 0;
    line-height: var(--leading-normal);
  }

  .checklist,
  .neglist {
    font-family: var(--rm-font-ui);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    max-width: var(--rm-reading-width);
    margin: 0;
    padding-left: var(--space-6);
  }

  .checklist li,
  .neglist li {
    margin-bottom: var(--space-3);
  }

  .neglist strong {
    color: var(--rm-text);
  }

  .neglist--inline {
    margin-top: 0;
  }

  .steps {
    font-family: var(--rm-font-ui);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    max-width: var(--rm-reading-width);
    margin: 0;
    padding-left: var(--space-6);
  }

  .steps li {
    margin-bottom: var(--space-3);
  }

  .steps strong {
    color: var(--rm-text);
  }

  .box-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-4);
    grid-template-columns: 1fr;
  }

  @media (min-width: 40rem) {
    .box-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 60rem) {
    .box-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .box-item {
    margin: 0;
    padding: var(--card-padding-md);
    background: var(--rm-surface);
    border: var(--border-1) solid var(--rm-border);
    border-radius: var(--rm-card-radius);
  }

  .box-item__title {
    font-family: var(--rm-font-display);
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    margin: 0 0 var(--space-2);
    color: var(--rm-text);
  }

  .box-item__text {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    margin: 0;
  }

  .section--final {
    margin-top: 0;
    padding-top: var(--space-16);
    padding-bottom: var(--space-16);
  }

  .section--final .container {
    max-width: var(--rm-container-narrow);
  }

  .final-cta__lede a {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .final-cta__lede a:hover {
    color: var(--signal-teal-hover);
  }

  .final-cta__title {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: var(--font-semibold);
    margin: 0 0 var(--space-4);
    color: var(--rm-text);
  }

  .final-cta__lede {
    font-family: var(--rm-font-ui);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
  }

  .final-cta__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

</style>
