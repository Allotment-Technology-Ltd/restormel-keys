<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import { githubRepoUrl, keysDocsUrl, keysHomeUrl } from "$lib/testing/site.js";

  const journeys = [
    {
      href: `${base}/docs/journeys/new-project`,
      title: "Starting a new project",
      blurb: "Install the CLI, add `restormel-testing.yaml`, first local run.",
    },
    {
      href: `${base}/docs/journeys/existing-stack`,
      title: "Adding Testing to an existing stack",
      blurb: "Playwright, CI, and Keys already in place—wire the runner without a rewrite.",
    },
    {
      href: `${base}/docs/journeys/ci`,
      title: "CI / GitHub Actions",
      blurb: "PR checks, verdicts, and reproducing a failed job locally.",
    },
    {
      href: `${base}/docs/journeys/keys`,
      title: "BYOK through Restormel Keys",
      blurb: "Logical model refs, provider resolution, no parallel secret system.",
    },
    {
      href: `${base}/docs/journeys/from-e2e`,
      title: "Escaping brittle scripted E2E",
      blurb: "Goals and success criteria for AI-heavy journeys instead of selector soup.",
    },
  ] as const;

  const quickLinks: { href: string; label: string; hint?: string }[] = [
    { href: `${base}/docs/walkthrough`, label: "Walkthrough", hint: "Phase 0 → verification strategy" },
    { href: `${base}/docs/how-it-fits-together`, label: "How it fits together", hint: "Runner, Keys, browser, CI" },
    { href: `${base}/docs/guides/config`, label: "Configuration", hint: "`restormel-testing.yaml`" },
    { href: `${base}/docs/guides/test-definition`, label: "Test definition", hint: "Suites, goals, success criteria" },
    { href: `${base}/docs/integrations/keys`, label: "Keys integration", hint: "BYOK seam" },
    { href: `${base}/docs/guides/ci`, label: "CI guide", hint: "GitHub Actions" },
    { href: `${base}/docs/architecture`, label: "Architecture", hint: "Packages and boundaries" },
    { href: `${base}/docs/guides/plot-dogfooding`, label: "Plot dogfooding", hint: "First real suite" },
    { href: `${base}/docs/examples`, label: "Examples", hint: "Reference layouts" },
    { href: keysDocsUrl, label: "Keys docs (canonical)", hint: "Env vocabulary, resolve API" },
    { href: keysHomeUrl, label: "Restormel Keys", hint: "Suite product home" },
    { href: `${githubRepoUrl}/tree/main/docs`, label: "Repo docs folder", hint: "Markdown specs today" },
  ];
</script>

<svelte:head>
  <title>Docs — Restormel Testing</title>
  <meta
    name="description"
    content="Documentation for Restormel Testing: goal-based AI product tests, local and CI, powered by Restormel Keys."
  />
</svelte:head>

<div class="docs-home">
  <h1 class="docs-home__title">Docs</h1>
  <p class="docs-home__intro">
    Restormel Testing is the suite’s <strong>open-source</strong> layer for <strong>goal-based, workflow-aware</strong> tests
    of AI-enabled software—<strong>local and in CI/CD</strong>—with model execution through
    <strong>Restormel Keys (BYOK)</strong>. Follow the <a href="{base}/docs/walkthrough">walkthrough</a> for the fastest path
    from zero to a passing (or intentionally failing) run you can debug.
  </p>

  <section class="docs-home__section" aria-labelledby="chooser-heading">
    <h2 id="chooser-heading" class="docs-home__h2">What brings you here?</h2>
    <ul class="docs-home__tiles" role="list">
      {#each journeys as j}
        <li>
          <a class="docs-home__tile" href={j.href} data-sveltekit-preload-data="hover">
            <span class="docs-home__tile-title">{j.title}</span>
            <span class="docs-home__tile-blurb">{j.blurb}</span>
          </a>
        </li>
      {/each}
    </ul>
  </section>

  <section class="docs-home__section" aria-labelledby="components-heading">
    <h2 id="components-heading" class="docs-home__h2">Product and components</h2>
    <ul class="docs-home__components" role="list">
      <li>
        <strong>CLI</strong> — <code>init</code>, <code>validate</code> (with optional <code>--json</code>),
        <code>run</code> (optional <code>--goal</code>, <code>--json</code>), <code>report</code>, <code>doctor</code>.
      </li>
      <li>
        <strong>Runner</strong> — orchestrates goals, retries, verdicts (<code>passed</code> / <code>failed</code> /
        <code>indeterminate</code>), and artefacts.
      </li>
      <li>
        <strong>Browser adaptor</strong> — Playwright-backed execution for MVP (substrate, not the product headline).
      </li>
      <li>
        <strong>Keys adaptor</strong> — resolves logical model references; aligns test execution with your Keys project.
      </li>
      <li>
        <strong>Reporting</strong> — <code>report.json</code>, Markdown summaries, GitHub step-summary Markdown, JUnit, plus a
        <code>reproduction</code> hint for failed runs.
      </li>
      <li>
        <strong>GitHub Action</strong> — thin wrapper around the same run contract as local.
      </li>
    </ul>
  </section>

  <section class="docs-home__section" aria-labelledby="compat-heading">
    <h2 id="compat-heading" class="docs-home__h2">Runtime and CI</h2>
    <p class="docs-home__compat-lede">
      One runner contract; different install paths. See <a href="{base}/docs/compatibility">Compatibility</a> for the
      matrix and version targets as they stabilise.
    </p>
    <div class="docs-home__table-wrap">
      <table class="docs-home__table">
        <caption class="visually-hidden">Supported runtime and CI targets (initial)</caption>
        <thead>
          <tr>
            <th scope="col">Target</th>
            <th scope="col">Status</th>
            <th scope="col">Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Node.js</td>
            <td>20.x (project engine)</td>
            <td>Align with Restormel module default stack.</td>
          </tr>
          <tr>
            <td>Local CLI</td>
            <td>MVP path</td>
            <td>Same config as CI; artefacts on disk.</td>
          </tr>
          <tr>
            <td>GitHub Actions</td>
            <td>MVP path</td>
            <td>PR annotations and fail-the-job semantics.</td>
          </tr>
          <tr>
            <td>Other CI</td>
            <td>Bring your runner</td>
            <td>Invoke the CLI; no hosted platform required.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="docs-home__section" aria-labelledby="quick-heading">
    <h2 id="quick-heading" class="docs-home__h2">Quick links</h2>
    <ul class="docs-home__quick" role="list">
      {#each quickLinks as link}
        <li>
          <a class="docs-home__quick-link" href={link.href} rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}>
            {link.label}
          </a>
          {#if link.hint}
            <span class="docs-home__quick-hint"> — {link.hint}</span>
          {/if}
        </li>
      {/each}
    </ul>
  </section>

  <p class="docs-home__back">
    <a href="{base}/">← Restormel Testing home</a>
  </p>
</div>

<style>
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

  .docs-home {
    max-width: min(100%, 52rem);
    padding-bottom: var(--space-12);
  }

  .docs-home__title {
    font-family: var(--rm-font-display);
    font-size: var(--text-3xl);
    font-weight: var(--font-semibold);
    letter-spacing: var(--tracking-tight);
    color: var(--rm-text);
    margin: 0 0 var(--space-4);
  }

  .docs-home__intro {
    font-family: var(--rm-font-ui);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    margin: 0 0 var(--space-10);
  }

  .docs-home__intro strong {
    color: var(--rm-text);
    font-weight: var(--font-semibold);
  }

  .docs-home__intro a {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .docs-home__intro a:hover {
    color: var(--signal-teal-hover);
  }

  .docs-home__section {
    margin-bottom: var(--space-10);
  }

  .docs-home__h2 {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-4);
    letter-spacing: var(--tracking-tight);
  }

  .docs-home__tiles {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-4);
    grid-template-columns: 1fr;
  }

  @media (min-width: 40rem) {
    .docs-home__tiles {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .docs-home__tile {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    height: 100%;
    padding: var(--card-padding-md);
    background: var(--rm-surface);
    border: var(--border-1) solid var(--rm-border);
    border-radius: var(--rm-card-radius);
    box-shadow: var(--rm-card-shadow);
    text-decoration: none;
    color: inherit;
    transition: border-color var(--duration-fast) var(--ease);
  }

  .docs-home__tile:hover {
    border-color: var(--rm-sage);
  }

  .docs-home__tile:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }

  .docs-home__tile-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
  }

  .docs-home__tile-blurb {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
  }

  .docs-home__components {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    margin: 0;
    padding-left: var(--space-5);
  }

  .docs-home__components li {
    margin-bottom: var(--space-3);
  }

  .docs-home__components strong {
    color: var(--rm-text);
  }

  .docs-home__components code {
    font-size: 0.9em;
    color: var(--rm-text);
  }

  .docs-home__compat-lede {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-4);
    line-height: var(--leading-relaxed);
  }

  .docs-home__compat-lede a {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .docs-home__table-wrap {
    overflow-x: auto;
    border: var(--border-1) solid var(--rm-border);
    border-radius: var(--rm-card-radius);
    background: var(--rm-surface);
  }

  .docs-home__table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }

  .docs-home__table th,
  .docs-home__table td {
    text-align: left;
    padding: var(--space-3) var(--space-4);
    border-bottom: var(--border-1) solid var(--rm-border);
    vertical-align: top;
  }

  .docs-home__table th {
    color: var(--rm-text);
    font-weight: var(--font-semibold);
    background: var(--rm-surface-raised);
  }

  .docs-home__table tr:last-child td {
    border-bottom: none;
  }

  .docs-home__quick {
    list-style: none;
    margin: 0;
    padding: 0;
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
  }

  .docs-home__quick li {
    margin-bottom: var(--space-2);
  }

  .docs-home__quick-link {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
    font-weight: var(--font-medium);
  }

  .docs-home__quick-link:hover {
    color: var(--signal-teal-hover);
  }

  .docs-home__quick-hint {
    color: var(--rm-dim);
  }

  .docs-home__back {
    margin: var(--space-10) 0 0;
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
  }

  .docs-home__back a {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .docs-home__back a:hover {
    color: var(--signal-teal-hover);
  }
</style>
