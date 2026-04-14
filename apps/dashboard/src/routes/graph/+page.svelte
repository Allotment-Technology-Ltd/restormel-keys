<script lang="ts">
  import { graphBase as base } from "$lib/graph/paths.js";
  import { GITHUB_REPO_URL } from "$lib/site-nav";
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";
  import EcosystemStrip from "$lib/components/integrations/EcosystemStrip.svelte";

  const discussionsUrl = `${GITHUB_REPO_URL}/discussions`;
  const npmGraphCore = "https://www.npmjs.com/package/@restormel/graph-core";

  const contractProducerSnippet = `import type { GraphData } from "@restormel/graph-core/viewModel";

/** Your app maps domain state → portable GraphData (no UI imports). */
export function toGraphData(snapshot: YourDomainSnapshot): GraphData {
  return {
    nodes: snapshot.vertices.map((v) => ({
      id: v.id,
      type: v.role === "premise" ? "claim" : "source",
      label: v.text,
    })),
    edges: snapshot.links.map((e) => ({
      from: e.sourceId,
      to: e.targetId,
      type: "supports",
    })),
    ghostNodes: snapshot.pruned.map(/* … */),
    ghostEdges: [],
  };
}`;

  const contractConsumerSnippet = `<script lang="ts">
  import { GraphCanvas } from "@restormel/ui-graph-svelte";
  import type { GraphData } from "@restormel/graph-core/viewModel";

  export let graphData: GraphData;
<\/script>

<GraphCanvas
  nodes={graphData.nodes}
  edges={graphData.edges}
  ghostNodes={graphData.ghostNodes}
  ghostEdges={graphData.ghostEdges}
  width={720}
  height={420}
  showGhostLayer={true}
/>`;

  const helloInstall = "pnpm add @restormel/graph-core @restormel/ui-graph-svelte";

  const helloSnippet = `<script lang="ts">
  import { GraphCanvas } from "@restormel/ui-graph-svelte";
  import type { GraphData } from "@restormel/graph-core/viewModel";

  const graphData: GraphData = {
    nodes: [
      { id: "a", type: "claim", label: "Node A" },
      { id: "b", type: "claim", label: "Node B" },
    ],
    edges: [{ from: "a", to: "b", type: "supports" }],
    ghostNodes: [],
    ghostEdges: [],
  };
<\/script>

<GraphCanvas
  nodes={graphData.nodes}
  edges={graphData.edges}
  ghostNodes={graphData.ghostNodes}
  ghostEdges={graphData.ghostEdges}
  width={560}
  height={320}
/>`;
</script>

<svelte:head>
  <title>Restormel Graph — Contract-first graph UI for Svelte 5</title>
  <meta
    name="description"
    content="Free open-source graph packages: frozen GraphData contract and Svelte 5 canvas. Reasoning visualisers, RAG explorers, agent workflows, argument maps."
  />
</svelte:head>

<div class="graph-landing">
  <section class="graph-hero container">
    <p class="graph-eyebrow">Restormel Graph — free &amp; open source</p>
    <h1 class="graph-title">Stop rebuilding graph UIs for every AI reasoning feature</h1>
    <p class="graph-lead">
      Graph ships two npm packages: a frozen contract (GraphData DTOs, layout helpers) and a Svelte 5 canvas. Your domain
      logic stays in your app. Your renderer stays portable. The contract stays stable.
    </p>
    <ul class="graph-cta-row">
      <li>
        <a class="btn btn-primary" href="{base}/docs/integration/sveltekit">Get started →</a>
      </li>
      <li>
        <a class="btn btn-ghost" href={npmGraphCore} rel="noopener noreferrer" target="_blank">View on npm →</a>
      </li>
      <li>
        <a class="btn btn-ghost" href="{base}/docs/extensions/reasoning">Reasoning extensions →</a>
      </li>
    </ul>
  </section>

  <div class="container">
    <EcosystemStrip
      variant="compact"
      heading="Same suite, shared foundations"
      intro="Graph ships standalone — and sits next to Keys, Testing, and the integrations you already run in production."
    />
  </div>

  <section class="use-cases section-alt" aria-labelledby="use-cases-heading">
    <div class="container">
      <h2 id="use-cases-heading" class="section-heading">What kind of product needs this?</h2>
      <div class="use-case-grid">
        <article class="use-case-card">
          <h3 class="use-case-title">Reasoning visualisers</h3>
          <p class="use-case-body">
            Show users how an AI reached a conclusion. Nodes are claims. Edges are inferences. Ghost layers show discarded
            paths.
          </p>
        </article>
        <article class="use-case-card">
          <h3 class="use-case-title">Knowledge graph explorers</h3>
          <p class="use-case-body">
            Render entity relationships from RAG pipelines and retrieval graphs — one contract from your indexer to the
            canvas, without a bespoke SVG stack each time.
          </p>
        </article>
        <article class="use-case-card">
          <h3 class="use-case-title">Agent workflow UIs</h3>
          <p class="use-case-body">
            Visualise multi-step agent runs as they happen: tools, branches, and hand-offs as a living graph instead of a
            log dump.
          </p>
        </article>
        <article class="use-case-card">
          <h3 class="use-case-title">Argument maps</h3>
          <p class="use-case-body">
            Built for SOPHIA-style philosophical reasoning: typed arcs, contested claims, and synthesis paths — all
            expressible in Contract v0.
          </p>
        </article>
      </div>
    </div>
  </section>

  <section class="contract-section container" aria-labelledby="contract-heading">
    <h2 id="contract-heading" class="section-heading">Contract-first, not library-lock-in</h2>
    <p class="contract-prose">
      Most graph libraries couple your data model to their renderer. Change the library, rewrite your adapters. Restormel
      Graph separates the contract (<strong>GraphData</strong>) from the canvas (<strong>@restormel/ui-graph-svelte</strong>).
      Swap the renderer without touching your domain.
    </p>
    <div class="code-two-col">
      <div class="code-col">
        <p class="code-col-label">Your app produces</p>
        <CodeBlock language="ts" code={contractProducerSnippet} />
      </div>
      <div class="code-col">
        <p class="code-col-label">Canvas consumes</p>
        <CodeBlock language="svelte" code={contractConsumerSnippet} />
      </div>
    </div>
  </section>

  <section class="hello-section section-alt" aria-labelledby="hello-heading">
    <div class="container">
      <h2 id="hello-heading" class="section-heading">Hello world</h2>
      <div class="hello-install">
        <span class="hello-label">Install</span>
        <CodeBlock language="bash" code={helloInstall} />
      </div>
      <p class="hello-intro">Import <code>GraphCanvas</code> and pass a minimal <code>GraphData</code> (two nodes, one edge):</p>
      <CodeBlock language="svelte" code={helloSnippet} />
    </div>
  </section>

  <section class="roadmap-section container" aria-labelledby="svelte-heading">
    <h2 id="svelte-heading" class="section-heading">Svelte 5 — and what’s next</h2>
    <p class="roadmap-prose">
      Graph currently ships a first-class <strong>Svelte 5</strong> canvas: zoom, pan, selection, ghost layers, and orbital
      layout helpers — the same surface we exercise in CI. Other frameworks are on the roadmap; we’re not pretending parity
      before it ships.
    </p>
    <p class="roadmap-tag">
      <a class="react-roadmap-pill" href={discussionsUrl} rel="noopener noreferrer" target="_blank">
        React adapter — Coming, vote on GitHub →
      </a>
    </p>
  </section>

  <section class="graph-pricing section-alt" aria-labelledby="graph-pricing-heading">
    <div class="container graph-pricing-inner">
      <h2 id="graph-pricing-heading" class="section-heading">Pricing</h2>
      <p class="graph-pricing-lead">
        Both <strong>@restormel/graph-core</strong> and <strong>@restormel/ui-graph-svelte</strong> are <strong>MIT</strong>
        — free forever for build and ship.
      </p>
      <p class="graph-pricing-pro">
        <strong>Graph Pro</strong> extensions (reasoning integrations, premium layouts, and suite support) are included in
        the Restormel <strong>Platform</strong> plan.
      </p>
      <a class="btn btn-primary graph-pricing-cta" href="/keys/pricing">See Keys &amp; Platform pricing →</a>
    </div>
  </section>

  <section class="founders-section section-alt founders-edge" aria-labelledby="founders-heading">
    <div class="container founders-inner">
      <h2 id="founders-heading" class="founders-title">Join the Founders Circle</h2>
      <p class="founders-lead">50 founding member slots. 12 months Pro free. Direct access to the roadmap.</p>
      <div class="founders-actions">
        <a class="btn btn-primary founders-primary" href="/founders">Apply for founding access →</a>
        <p class="founders-secondary-wrap">
          <a class="founders-secondary" href="/founders#program">Learn more about the program</a>
        </p>
      </div>
    </div>
  </section>
</div>

<style>
  .graph-landing {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    padding-bottom: var(--space-12);
  }
  .container {
    max-width: var(--rm-container-max);
    margin: 0 auto;
    padding-left: var(--space-4);
    padding-right: var(--space-4);
  }
  .graph-hero {
    text-align: center;
    max-width: 46rem;
    margin: 0 auto;
  }
  .graph-eyebrow {
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--rm-dim);
    margin: 0 0 var(--space-3);
  }
  .graph-title {
    font-family: var(--rm-font-display);
    font-size: clamp(var(--text-3xl), 4vw, var(--text-4xl));
    font-weight: var(--font-semibold);
    line-height: var(--leading-tight);
    margin: 0 0 var(--space-4);
    color: var(--rm-text);
  }
  .graph-lead {
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
    text-align: left;
  }
  .graph-cta-row {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    justify-content: center;
  }
  .graph-cta-row a {
    text-align: center;
    justify-content: center;
  }

  .section-heading {
    font-family: var(--rm-font-display);
    font-size: clamp(1.35rem, 3vw, var(--text-2xl));
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-6);
    text-align: center;
  }
  .section-alt {
    background: var(--rm-surface-2);
    border-top: 1px solid var(--rm-border);
    border-bottom: 1px solid var(--rm-border);
  }
  .use-cases .container {
    padding-top: var(--space-10);
    padding-bottom: var(--space-10);
  }
  .use-case-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: var(--space-5);
  }
  .use-case-card {
    margin: 0;
    padding: var(--space-5);
    background: var(--rm-bg);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
  }
  .use-case-title {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--rm-sage);
    margin: 0 0 var(--space-2);
  }
  .use-case-body {
    margin: 0;
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
  }

  .contract-section {
    padding-top: var(--space-2);
  }
  .contract-prose {
    margin: 0 auto var(--space-8);
    max-width: var(--rm-container-narrow);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    text-align: center;
  }
  .contract-prose strong {
    color: var(--rm-text);
  }
  .code-two-col {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-6);
    align-items: start;
  }
  @media (max-width: 900px) {
    .code-two-col {
      grid-template-columns: 1fr;
    }
  }
  .code-col-label {
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--rm-dim);
    margin: 0 0 var(--space-2);
  }
  .code-col :global(.codeblock) {
    min-width: 0;
  }

  .hello-section .container {
    padding-top: var(--space-10);
    padding-bottom: var(--space-10);
  }
  .hello-install {
    margin-bottom: var(--space-6);
    max-width: 36rem;
  }
  .hello-label {
    display: block;
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--rm-dim);
    margin-bottom: var(--space-2);
  }
  .hello-intro {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-4);
    max-width: 40rem;
  }
  .hello-intro code {
    font-size: 0.92em;
    color: var(--rm-text);
  }

  .roadmap-section {
    padding-bottom: var(--space-4);
  }
  .roadmap-prose {
    margin: 0 auto var(--space-5);
    max-width: var(--rm-container-narrow);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    text-align: center;
  }
  .roadmap-prose strong {
    color: var(--rm-text);
  }
  .roadmap-tag {
    margin: 0;
    text-align: center;
  }
  .react-roadmap-pill {
    display: inline-flex;
    align-items: center;
    padding: var(--space-2) var(--space-4);
    border-radius: 999px;
    border: 1px solid color-mix(in oklab, var(--path-blue, var(--rm-sage)) 55%, var(--rm-border));
    background: color-mix(in oklab, var(--path-blue, var(--rm-sage)) 10%, var(--rm-surface-raised));
    color: var(--rm-text);
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    text-decoration: none;
    transition: border-color 0.15s ease, filter 0.15s ease;
  }
  .react-roadmap-pill:hover {
    filter: brightness(1.08);
    border-color: var(--path-blue, var(--rm-sage));
  }
  .react-roadmap-pill:focus-visible {
    outline: 2px solid var(--rm-sage);
    outline-offset: 2px;
  }

  .graph-pricing-inner {
    padding-top: var(--space-10);
    padding-bottom: var(--space-10);
    text-align: center;
    max-width: 36rem;
    margin: 0 auto;
  }
  .graph-pricing-lead,
  .graph-pricing-pro {
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    margin: 0 0 var(--space-4);
  }
  .graph-pricing-pro {
    margin-bottom: var(--space-6);
  }
  .graph-pricing-lead strong,
  .graph-pricing-pro strong {
    color: var(--rm-text);
  }
  .graph-pricing-cta {
    display: inline-flex;
  }

  .founders-edge {
    border-bottom: none;
  }
  .founders-inner {
    text-align: center;
    padding-top: var(--space-10);
    padding-bottom: var(--space-10);
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
    color: var(--signal-teal-hover, var(--rm-sage));
  }
</style>
