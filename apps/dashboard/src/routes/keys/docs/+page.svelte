<script lang="ts">
  /** Docs overview */
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";
</script>

<svelte:head>
  <title>Restormel Keys docs</title>
  <meta name="description" content="Documentation for Restormel Keys — an integration-first control layer for AI provider access (routing, policies, health, cost, and UX)." />
</svelte:head>

<div class="doc-content">
  <h1>Keys docs</h1>
  <p class="doc-tagline">
    Prefer the <a href="/docs">suite docs hub</a> for orientation. Use this tree for Keys-specific guides and reference
    (search and collapsed Reference in the sidebar).
  </p>

  <h2>What brings you here?</h2>
  <div class="intent-grid">
    <a class="intent-card" href="/keys/docs/journeys/new-project">
      <strong>Starting a new project</strong>
      <span>Get routing + first resolve in 15-20 minutes.</span>
    </a>
    <a class="intent-card" href="/keys/docs/journeys/existing-stack">
      <strong>Adding control to an existing stack</strong>
      <span>OpenRouter/Vercel/Portkey + Restormel control-plane path.</span>
    </a>
    <a class="intent-card" href="/keys/docs/journeys/byok-saas">
      <strong>Adding BYOK to a SaaS</strong>
      <span>KeyManager + policy-bounded model choice for end users.</span>
    </a>
    <a class="intent-card" href="/keys/docs/journeys/agent-ide">
      <strong>CLI, agent, or IDE path</strong>
      <span>Developer tooling path (CLI, MCP, AAIF).</span>
    </a>
    <a class="intent-card" href="/keys/docs/journeys/platform-ops">
      <strong>Running platform operations</strong>
      <span>Lifecycle, readiness, coverage, CI/CD, governance.</span>
    </a>
  </div>

  <p>
    <strong>Restormel Keys</strong> is a product in the <strong>Restormel</strong> platform. It’s designed to slot into your existing stack. It complements provider-access layers like <strong>OpenRouter</strong>, <strong>Vercel AI Gateway</strong>, and <strong>Portkey</strong>, and it also supports direct providers when you manage credentials in your own environment.
    This doc set covers install, framework choice, provider access modes, the <strong>Restormel Resolve</strong> API surface, and the Dashboard.
  </p>

  <h2>Products and components</h2>
  <ul>
    <li><strong>Restormel Keys</strong> — routing, policies, cost, and embeddable UX for AI apps.</li>
    <li><strong>Restormel Resolve</strong> — the API surface that returns the provider/model decision for a request.</li>
    <li><strong>Restormel Doctor</strong> — health checks for framework + config.</li>
    <li><strong>Restormel Validate</strong> — verification checks for provider access and stored credentials (CI-friendly).</li>
  </ul>

  <h2>Start with Next.js</h2>
  <p>Using <strong>Next.js App Router</strong>? Install the core plus React and Web Components. Full path: <a href="/keys/docs/compatibility">Framework compatibility</a>.</p>
  <CodeBlock language="bash" code="pnpm add @restormel/keys @restormel/keys-react @restormel/keys-elements" />

  <h2>Choose a provider access mode</h2>
  <p>
    Before you wire anything, decide how your stack will reach providers. Restormel does not need to hold raw provider secrets by default.
    See <a href="/keys/docs/guides/provider-access-modes">Provider access modes</a> for a simple decision tree.
  </p>

  <h2>Pick your framework</h2>
  <p>One core; different wrappers. Use the headless API for resolution and cost on the server; add UI (KeyManager, ModelSelector, CostEstimator) where it fits.</p>
  <table class="doc-table">
    <thead>
      <tr><th>Framework</th><th>Package path</th><th>Status</th></tr>
    </thead>
    <tbody>
      <tr><td>Next.js / React</td><td><code>@restormel/keys</code> + <code>@restormel/keys-react</code> + <code>@restormel/keys-elements</code></td><td>✅ Supported</td></tr>
      <tr><td>SvelteKit</td><td><code>@restormel/keys</code> + <code>@restormel/keys-svelte</code></td><td>✅ Supported</td></tr>
      <tr><td>Web Components / Astro / vanilla</td><td><code>@restormel/keys</code> + <code>@restormel/keys-elements</code></td><td>✅ Supported</td></tr>
      <tr><td>Vue / Nuxt</td><td>Headless or elements for now</td><td>🔵 Planned</td></tr>
    </tbody>
  </table>
  <p><a href="/keys/docs/compatibility">Framework compatibility</a> has install commands, when-to-use guidance, and the full Next.js walkthrough.</p>

  <h2>Quick links</h2>
  <ul>
    <li><a href="/keys/docs/guides/environment-vocabulary">Environment vocabulary (canonical)</a> — official <code>RESTORMEL_*</code> names; Gateway key vs server token; site base vs control-plane vs evaluate URL</li>
    <li>
      <a href="/keys/docs/guides/database-neon-for-self-hosters">Database for self-hosters: Neon</a> — default Postgres + Neon Auth when you self-host Keys; CI previews; ingestion/graph context; links to Neon docs and the OSS program
    </li>
    <li><a href="/keys/docs/guides/keys-testing-onboarding">Keys + Restormel Testing onboarding</a> — Connections, Testing hub, Gateway keys, CLI env</li>
    <li><a href="/keys/docs/guides/integration-catalog">Integration catalog</a> — index of vendors and stacks with links to canonical guides</li>
    <li><a href="/docs/how-it-fits-together">How the suite fits together</a> — key types, API surfaces, and where each URL fits</li>
    <li><a href="/keys/docs/walkthrough">Walkthrough</a> — step-by-step integration (Phase 0–6)</li>
    <li>
      <a href="/keys/docs/cloud-api">Cloud API</a> — Dashboard API (<code>rk_…</code>): resolve, routes, policies, catalog, <strong>project model index</strong>; Zuplo gateway (<code>zpka_…</code>); OpenAPI imports.
      Integrator note (index <code>data</code> shape, validation errors):
      <a
        href="https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/guides/integration/keys-catalog-sync.md"
        target="_blank"
        rel="noopener noreferrer"><code>keys-catalog-sync.md</code></a>.
    </li>
    <li><a href="/keys/docs/guides/openrouter">OpenRouter integration</a> — keep OpenRouter as your provider access layer</li>
    <li><a href="/keys/docs/guides/vercel-ai-gateway">Vercel AI Gateway integration</a> — keep Vercel gateway auth and observability</li>
    <li><a href="/keys/docs/guides/portkey">Portkey integration</a> — keep Portkey as your gateway and route via Restormel</li>
    <li><a href="/keys/docs/guides/canonical-catalog">Canonical model &amp; provider catalog</a> — public HTTP feed + npm helpers for up-to-date lists</li>
    <li><a href="/keys">Keys landing</a> — what Keys is, modes, comparison, pricing</li>
    <li><a href="/keys/pricing">Pricing</a> — tiers and FAQ</li>
    <li><a href="/keys/dashboard">Dashboard</a> — create projects and API keys</li>
    <li><a href="/keys/dashboard/login">Sign in</a> — authenticate with GitHub</li>
  </ul>
</div>

<style>
  .doc-content {
    max-width: var(--rm-container-narrow);
  }
  .doc-tagline {
    font-size: var(--text-lg);
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
  }
  .doc-content h1 {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    color: var(--rm-text);
    margin: 0 0 var(--space-4);
  }
  .doc-content h2 {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    color: var(--rm-text);
    margin: var(--space-8) 0 var(--space-3);
  }
  .doc-content p {
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-4);
  }
  .doc-content ul {
    margin: 0 0 var(--space-6);
    padding-left: var(--space-5);
  }
  .doc-content li {
    margin-bottom: var(--space-2);
  }
  .doc-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 var(--space-4);
    font-size: var(--text-sm);
  }
  .doc-table th, .doc-table td {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rm-border);
    text-align: left;
  }
  .doc-table th {
    background: var(--rm-surface-raised);
    color: var(--rm-text);
    font-weight: var(--font-medium);
  }
  .doc-table td {
    color: var(--rm-muted);
  }
  .doc-table code {
    font-family: var(--rm-font-ui);
    font-size: 0.9em;
  }
  .intent-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--space-3);
    margin: 0 0 var(--space-6);
  }
  .intent-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface-raised);
    padding: var(--space-3);
    text-decoration: none;
  }
  .intent-card strong {
    color: var(--rm-text);
    font-size: var(--text-sm);
  }
  .intent-card span {
    color: var(--rm-muted);
    font-size: var(--text-xs);
    line-height: 1.4;
  }
</style>
