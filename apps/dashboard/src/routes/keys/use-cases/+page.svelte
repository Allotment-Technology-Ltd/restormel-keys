<script lang="ts">
  const fitModes = [
    {
      title: "Builder-side routing",
      body: "Pick providers, fallbacks, and policy in-app—without building your own control plane.",
    },
    {
      title: "End-user BYOK",
      body: "User keys in your product, bounded by policy and clear server-side handling.",
    },
    {
      title: "Combined mode",
      body: "Ops-owned defaults plus user BYOK when both matter.",
    },
  ];

  const reusablePatterns = [
    "Route and policy live in the dashboard, not scattered `if/else` in handlers.",
    "Fallback chains instead of one-off retries per feature.",
    "Keys stay server-side; UI shows prefixes or hashes, not raw secrets.",
    "Model pickers follow live allowlists so UI matches what policy allows.",
  ];
</script>

<svelte:head>
  <title>Use cases — Restormel Keys</title>
  <meta
    name="description"
    content="PLOT and Sophia: how real apps use Restormel Keys for routing, policy, fallbacks, and BYOK—library-first, no heavy default infra."
  />
</svelte:head>

<article class="use-cases-page">
  <div class="container">
    <header class="hero" aria-labelledby="use-cases-heading">
      <p class="hero-kicker">Use cases</p>
      <h1 id="use-cases-heading" class="hero-title">Real products, one control layer</h1>
      <p class="hero-lead">
        Production routing, BYOK, and policy—without treating Keys like another gateway or adding Docker/Redis/Postgres by default.
      </p>
      <p class="hero-subcopy">
        Library-first: embed in the app you ship. Below: two different products, same primitives—extraction vs multi-pass reasoning.
      </p>
      <div class="hero-actions">
        <a href="/keys/dashboard/login" class="btn btn-primary">Start free</a>
        <a href="/keys/docs" class="btn btn-secondary">Read docs</a>
      </div>
    </header>

    <nav class="jump-nav" aria-label="Use case sections">
      <a href="#why-this-page">Fit</a>
      <a href="#real-examples">Overview</a>
      <a href="#plot">PLOT</a>
      <a href="#sophia">Sophia</a>
      <a href="#patterns">Patterns</a>
      <a href="#build-your-own">Next</a>
    </nav>

    <section id="why-this-page" class="section section-panel" aria-labelledby="why-heading">
      <h2 id="why-heading" class="section-title">What Keys is for</h2>
      <p class="section-intro">
        Not a proxy marketplace—a drop-in layer for routing, fallbacks, BYOK, and entitlements inside your codebase.
      </p>
      <div class="fit-grid">
        {#each fitModes as mode}
          <article class="fit-card">
            <h3>{mode.title}</h3>
            <p>{mode.body}</p>
          </article>
        {/each}
      </div>
    </section>

    <section id="real-examples" class="section">
      <h2 class="section-title">Two products, same building blocks</h2>
      <p class="section-intro">
        PLOT: high-trust document extraction. Sophia: multi-stage analysis, ingestion, user BYOK. Different shapes; same resolve, policy, and catalog ideas.
      </p>
      <div class="proof-strip" role="list">
        <p role="listitem"><strong>Both get:</strong> policy-aware routing, fallbacks, practical BYOK boundaries.</p>
        <p role="listitem"><strong>Adoption:</strong> library-first; no Docker/Redis/Postgres required to start.</p>
      </div>
    </section>

    <section id="plot" class="section case-shell" aria-labelledby="plot-title">
      <div class="case-main">
        <p class="case-kicker">Case study</p>
        <h2 id="plot-title" class="case-title">PLOT — Household Operating System</h2>
        <p class="case-subhead">
          Household finance OS—Vault extraction with strict privacy and traceability.
        </p>
        <p class="case-narrative">
          Extraction picks models via policy (`plot.vault.extraction`), not nested app branches. Cleaner code, server-only creds, visible fallbacks.
        </p>
        <blockquote class="case-quote">
          “We use Restormel Keys to keep model routing and fallback logic out of brittle app code. It gives us safer, policy-driven control for
          sensitive household document workflows.”
          <span>Plotbudget team</span>
        </blockquote>
        <p class="case-links">
          <a href="https://plotbudget.com" target="_blank" rel="noopener noreferrer">plotbudget.com</a>
          <span aria-hidden="true"> · </span>
          <a href="https://app.plotbudget.com" target="_blank" rel="noopener noreferrer">app.plotbudget.com</a>
        </p>
      </div>
      <aside class="case-side">
        <article class="meta-card">
          <h3>Keys here</h3>
          <ul>
            <li>Policy evaluate → route for extraction.</li>
            <li>Primary + fallback paths when a call fails.</li>
            <li>Gateway/control-plane creds server-only; routing metadata on results.</li>
          </ul>
        </article>
        <article class="meta-card">
          <h3>Time to loop</h3>
          <p>
            Docs + Restormel MCP in Cursor: working routing/policy loop in one session (~30 min; your setup may vary).
          </p>
        </article>
      </aside>
    </section>

    <section id="sophia" class="section case-shell" aria-labelledby="sophia-title">
      <div class="case-main">
        <p class="case-kicker">Case study</p>
        <h2 id="sophia-title" class="case-title">Sophia — structured analysis and multi-pass reasoning</h2>
        <p class="case-subhead">
          SvelteKit: analysis, ingestion, user BYOK—one control plane across APIs.
        </p>
        <p class="case-narrative">
          Deeper product = longer overall build. Keys replaced bespoke routing/BYOK glue with shared resolve, policy, and allowlist patterns.
        </p>
        <p class="case-highlight">
          Analyse, allowed-models, ingestion admin, beta AAIF: same resolve + Dashboard API patterns as repo smoke tests.
        </p>
        <p class="case-links">
          <a href="https://usesophia.app" target="_blank" rel="noopener noreferrer">usesophia.app</a>
          <span aria-hidden="true"> · </span>
          <a href="https://docs.usesophia.app" target="_blank" rel="noopener noreferrer">docs.usesophia.app</a>
        </p>
      </div>
      <aside class="case-side">
        <article class="meta-card">
          <h3>Keys here</h3>
          <ul>
            <li>Resolve across analysis + ingestion workloads.</li>
            <li>Policy before heavy work; clear errors when blocked.</li>
            <li>Picker ↔ live allowlist (BYOK + platform).</li>
          </ul>
        </article>
        <article class="meta-card">
          <h3>Ops = runtime</h3>
          <p>
            Scripts and admin proxies call the same primitives as production paths—no drift between “how we configured it” and “what ran.”
          </p>
        </article>
      </aside>
    </section>

    <section id="patterns" class="section section-panel" aria-labelledby="patterns-heading">
      <h2 id="patterns-heading" class="section-title">Patterns to reuse</h2>
      <p class="section-intro">Portable if your app mixes routing, policy, and BYOK.</p>
      <div class="patterns-grid">
        {#each reusablePatterns as item}
          <article class="pattern-card">
            <p>{item}</p>
          </article>
        {/each}
      </div>
    </section>

    <section id="build-your-own" class="section cta-panel" aria-labelledby="cta-heading">
      <h2 id="cta-heading" class="section-title">Ship your version</h2>
      <p class="section-intro">
        Wire resolve, set routes and policy in the dashboard, add BYOK when your users need their own keys.
      </p>
      <div class="cta-actions">
        <a href="/keys/dashboard/login" class="btn btn-primary">Start free</a>
        <a href="/keys/docs/walkthrough" class="btn btn-secondary">Walkthrough</a>
        <a href="/keys/docs" class="btn btn-secondary">All docs</a>
      </div>
    </section>
  </div>
</article>

<style>
  .use-cases-page .container {
    max-width: var(--rm-container-max);
    margin: 0 auto;
    padding: 0 var(--space-6);
    display: grid;
    gap: var(--space-7);
  }
  .hero {
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface);
    padding: var(--space-7);
  }
  .hero-kicker {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--rm-dim);
  }
  .hero-title {
    margin: 0 0 var(--space-3);
    font-family: var(--rm-font-display);
    font-size: clamp(1.9rem, 4.2vw, 2.8rem);
    line-height: var(--leading-tight);
    color: var(--rm-text);
  }
  .hero-lead {
    margin: 0 0 var(--space-3);
    max-width: 76ch;
    color: var(--rm-text);
    font-size: var(--text-base);
  }
  .hero-subcopy {
    margin: 0 0 var(--space-4);
    max-width: 76ch;
    color: var(--rm-muted);
  }
  .hero-actions {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .jump-nav {
    position: sticky;
    top: calc(var(--rm-nav-height) + var(--space-2));
    z-index: 5;
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    padding: var(--space-2);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: color-mix(in oklab, var(--rm-surface) 92%, var(--rm-bg) 8%);
  }
  .jump-nav a {
    display: inline-flex;
    align-items: center;
    min-height: 36px;
    padding: 0 var(--space-3);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    color: var(--rm-muted);
    font-size: var(--text-xs);
    text-decoration: none;
    background: var(--rm-surface-raised);
  }
  .jump-nav a:hover {
    color: var(--rm-text);
    border-color: var(--rm-sage);
  }

  .section {
    display: grid;
    gap: var(--space-3);
  }
  .section-panel {
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface);
    padding: var(--space-6);
  }
  .section-title {
    margin: 0;
    font-family: var(--rm-font-display);
    font-size: clamp(1.5rem, 3vw, 2rem);
    color: var(--rm-text);
  }
  .section-intro {
    margin: 0;
    max-width: 80ch;
    color: var(--rm-muted);
  }

  .fit-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
  }
  .fit-card {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
    padding: var(--space-4);
  }
  .fit-card h3 {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    color: var(--rm-text);
  }
  .fit-card p {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }

  .proof-strip {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }
  .proof-strip p {
    margin: 0;
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
    padding: var(--space-3);
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .proof-strip strong {
    color: var(--rm-text);
  }

  .case-shell {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
    gap: var(--space-5);
    border-top: 1px solid var(--rm-border);
    padding-top: var(--space-6);
  }
  .case-main {
    display: grid;
    gap: var(--space-3);
  }
  .case-side {
    display: grid;
    gap: var(--space-3);
  }
  .case-kicker {
    margin: 0;
    font-size: var(--text-xs);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--rm-dim);
  }
  .case-title {
    margin: 0;
    font-family: var(--rm-font-display);
    font-size: clamp(1.4rem, 3vw, 1.9rem);
    color: var(--rm-text);
  }
  .case-subhead {
    margin: 0;
    color: var(--rm-dim);
    font-size: var(--text-sm);
    max-width: 70ch;
  }
  .case-narrative {
    margin: 0;
    color: var(--rm-muted);
    max-width: 72ch;
  }
  .case-quote {
    margin: 0;
    display: grid;
    gap: var(--space-2);
    border: 1px solid color-mix(in oklab, var(--rm-sage) 45%, var(--rm-border));
    border-radius: var(--rm-radius);
    background: color-mix(in oklab, var(--rm-sage) 10%, var(--rm-surface));
    padding: var(--space-4);
    color: var(--rm-text);
  }
  .case-quote span {
    color: var(--rm-dim);
    font-size: var(--text-xs);
  }
  .case-links {
    margin: 0;
    font-size: var(--text-sm);
  }
  .case-highlight {
    margin: 0;
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
    padding: var(--space-3);
    color: var(--rm-text);
    font-size: var(--text-sm);
  }
  .meta-card {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
    padding: var(--space-4);
  }
  .meta-card h3 {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    color: var(--rm-text);
  }
  .meta-card p {
    margin: 0;
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .meta-card ul {
    margin: 0;
    padding-left: 1.2rem;
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .meta-card li + li {
    margin-top: var(--space-1);
  }

  .patterns-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }
  .pattern-card {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
    padding: var(--space-4);
  }
  .pattern-card p {
    margin: 0;
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }

  .cta-panel {
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface);
    padding: var(--space-6);
  }
  .cta-actions {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  @media (max-width: 980px) {
    .fit-grid,
    .proof-strip,
    .patterns-grid {
      grid-template-columns: 1fr;
    }
    .case-shell {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 760px) {
    .use-cases-page .container {
      padding: 0 var(--space-4);
      gap: var(--space-6);
    }
    .hero,
    .section-panel,
    .cta-panel {
      padding: var(--space-5);
    }
    .jump-nav {
      top: calc(var(--rm-nav-height) + var(--space-1));
    }
  }
</style>
