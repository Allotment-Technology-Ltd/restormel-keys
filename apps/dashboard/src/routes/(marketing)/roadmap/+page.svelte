<script lang="ts">
  import { GITHUB_DISCUSSIONS_URL, GITHUB_REPO_URL } from "$lib/site-nav";

  const alreadyLive = [
    {
      title: "Your knowledge graph, under your control",
      body:
        "Connect your sources, choose your graph store, and route every AI step with your own keys — no separate RAG platform to stand up.",
    },
    {
      title: "Ingest with a human in the loop",
      body:
        "Documents become structured ideas you can review, flag, and re-check — so agents build on what you’ve approved, not a black-box chunk index.",
    },
    {
      title: "Context agents can call",
      body:
        "Retrieve and verify from your workspace so copilots, apps, and MCP workflows can ground answers in what you actually know.",
    },
  ] as const;

  const buildingNext = [
    {
      title: "Agents that actually use your knowledge",
      body:
        "Production-grade retrieval from your graph — the right ideas and relationships at query time, not empty or degraded context when it matters.",
    },
    {
      title: "Trust you can ship on",
      body:
        "Validation and review at scale: clear supported vs weak claims, source provenance, and workflows to clear backlogs before answers reach users.",
    },
    {
      title: "First trustworthy graph in an afternoon",
      body:
        "Onboarding for teams without a platform group — from first documents to a graph you’d let an agent cite, with fewer dead ends and surprises.",
    },
    {
      title: "Embed without rebuilding the pipeline",
      body:
        "Stable APIs and docs for product teams who need ingest, retrieve, and verify in their app — not a fork of someone else’s notebook.",
    },
  ] as const;

  const onTheHorizon = [
    {
      title: "Catch knowledge regressions before users do",
      body:
        "Tie Connect to Testing so model, route, or corpus changes get the same acceptance scrutiny as the rest of your AI stack.",
    },
    {
      title: "See cost and quality in one place",
      body:
        "Spend and reliability across ingest, retrieval, and routing — so you can tune budgets and spot when grounding quietly degrades.",
    },
    {
      title: "Start from how your field thinks",
      body:
        "Curated domain starting points (research, ops, policy, and more) so structure matches expert mental models, not generic “chunks.”",
    },
    {
      title: "Enterprise-ready trust",
      body:
        "Audit exports, policy bundles, and rollout patterns for teams that must show where an answer came from — exploring demand with Founders partners.",
    },
  ] as const;
</script>

<svelte:head>
  <title>Roadmap — Restormel</title>
  <meta
    name="description"
    content="What Restormel is building next: trustworthy knowledge for AI agents — structured ingest, reliable retrieval, and review workflows — plus how to suggest features."
  />
</svelte:head>

<article class="roadmap-page container">
    <header class="roadmap-hero">
      <h1 class="roadmap-title">What we're building</h1>
      <p class="roadmap-sub">
        Teams shipping AI on private knowledge keep hitting the same wall: generic RAG returns fragments, agents sound
        confident when they’re not, and standing up ingest, structure, retrieval, and governance takes quarters.
        Restormel exists so you can <strong>own the knowledge your agents rely on</strong> — reviewable, keyed to your
        providers, and wired into the same control plane as routing and quality.
      </p>
      <p class="roadmap-sub roadmap-sub-secondary">
        Our focus now is <strong>Connect</strong>: turn documents into a graph you trust, serve it to agents, and check
        claims before they reach users. Founders Circle members help set what ships next.
      </p>
    </header>

    <section class="roadmap-shipped" aria-labelledby="roadmap-live-heading">
      <h2 id="roadmap-live-heading" class="roadmap-shipped-title">Already live</h2>
      <p class="roadmap-shipped-hint">On restormel.dev today — see the <a href="/changelog">changelog</a> for detail.</p>
      <ul class="roadmap-cards roadmap-cards-compact">
        {#each alreadyLive as item}
          <li>
            <article class="roadmap-card roadmap-card-shipped">
              <h3 class="roadmap-card-title">{item.title}</h3>
              <p class="roadmap-card-body">{item.body}</p>
            </article>
          </li>
        {/each}
      </ul>
    </section>

    <section class="roadmap-section" aria-labelledby="roadmap-next-heading">
      <h2 id="roadmap-next-heading" class="roadmap-section-title">Building next</h2>
      <p class="roadmap-section-hint">
        Where we see the most user value — reliable grounding, operator trust, and faster time-to-first graph.
      </p>
      <ul class="roadmap-cards roadmap-cards-grid">
        {#each buildingNext as item}
          <li>
            <article class="roadmap-card">
              <h3 class="roadmap-card-title">{item.title}</h3>
              <p class="roadmap-card-body">{item.body}</p>
            </article>
          </li>
        {/each}
      </ul>
    </section>

    <section class="roadmap-section" aria-labelledby="roadmap-horizon-heading">
      <h2 id="roadmap-horizon-heading" class="roadmap-section-title">On the horizon</h2>
      <p class="roadmap-section-hint">
        Committed direction after the core Connect loop lands — shaped by customer signal, not a feature laundry list.
      </p>
      <ul class="roadmap-cards roadmap-cards-grid">
        {#each onTheHorizon as item}
          <li>
            <article class="roadmap-card roadmap-card-muted">
              <h3 class="roadmap-card-title">{item.title}</h3>
              <p class="roadmap-card-body">{item.body}</p>
            </article>
          </li>
        {/each}
      </ul>
    </section>

    <section class="roadmap-cta" aria-labelledby="roadmap-cta-heading">
      <h2 id="roadmap-cta-heading" class="visually-hidden">Community</h2>
      <div class="roadmap-cta-grid">
        <div class="roadmap-cta-card">
          <h3 class="roadmap-cta-title">Suggest a feature</h3>
          <p class="roadmap-cta-text">
            Open a discussion on GitHub — we read every thread and fold signal into planning.
          </p>
          <a class="roadmap-cta-link" href={GITHUB_DISCUSSIONS_URL} rel="noopener noreferrer" target="_blank"
            >GitHub Discussions →</a>
        </div>
        <div class="roadmap-cta-card roadmap-cta-card-accent">
          <h3 class="roadmap-cta-title">Founders Circle members get a vote</h3>
          <p class="roadmap-cta-text">
            Early partners help set priorities with direct access to what ships next — not just a discount.
          </p>
          <a class="roadmap-cta-link" href="/founders">Learn about Founders Circle →</a>
        </div>
      </div>
      <p class="roadmap-footnote">
        Timelines are indicative, not commitments. Shipped work is in the <a href="/changelog">changelog</a>;
        technical programme notes live in the
        <a href={GITHUB_REPO_URL} rel="noopener noreferrer" target="_blank">GitHub repository</a>.
      </p>
    </section>
  </article>

<style>
  .roadmap-page {
    max-width: var(--rm-container-max);
  }
  .roadmap-hero {
    max-width: 44rem;
    margin-bottom: var(--space-10);
  }
  .roadmap-title {
    font-family: var(--rm-font-display);
    font-size: clamp(var(--text-2xl), 4vw, var(--text-3xl));
    color: var(--rm-text);
    margin: 0 0 var(--space-4);
    line-height: var(--leading-tight);
  }
  .roadmap-sub {
    font-size: var(--text-lg);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0;
  }
  .roadmap-sub strong {
    color: var(--rm-text);
    font-weight: var(--font-semibold);
  }
  .roadmap-sub-secondary {
    margin-top: var(--space-4);
    font-size: var(--text-base);
  }
  .roadmap-shipped {
    margin-bottom: var(--space-10);
    padding-bottom: var(--space-8);
    border-bottom: 1px solid var(--rm-border);
  }
  .roadmap-shipped-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-lg);
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .roadmap-shipped-hint {
    font-size: var(--text-sm);
    color: var(--rm-dim);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-4);
  }
  .roadmap-shipped-hint a {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .roadmap-cards-compact {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-3);
  }
  @media (max-width: 960px) {
    .roadmap-cards-compact {
      grid-template-columns: 1fr;
    }
  }
  .roadmap-card-shipped {
    border-color: color-mix(in oklab, var(--rm-sage) 25%, var(--rm-border));
    background: color-mix(in oklab, var(--rm-sage) 6%, var(--rm-surface-raised));
  }
  .roadmap-section {
    margin-bottom: var(--space-10);
  }
  .roadmap-section-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-lg);
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .roadmap-section-hint {
    font-size: var(--text-sm);
    color: var(--rm-dim);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-4);
    max-width: 42rem;
  }
  .roadmap-cards-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-3);
  }
  @media (max-width: 720px) {
    .roadmap-cards-grid {
      grid-template-columns: 1fr;
    }
  }
  .roadmap-card-muted {
    background: var(--rm-bg);
  }
  .roadmap-cards {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .roadmap-card {
    margin: 0;
    padding: var(--space-4);
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    box-shadow: var(--rm-card-shadow, 0 2px 8px rgba(0, 0, 0, 0.06));
  }
  .roadmap-card-title {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
    line-height: var(--leading-snug);
  }
  .roadmap-card-body {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0;
  }
  .roadmap-cta {
    margin-top: var(--space-12);
    padding-top: var(--space-10);
    border-top: 1px solid var(--rm-border);
  }
  .roadmap-cta-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-6);
  }
  @media (max-width: 720px) {
    .roadmap-cta-grid {
      grid-template-columns: 1fr;
    }
  }
  .roadmap-cta-card {
    padding: var(--space-5);
    border-radius: var(--rm-radius);
    border: 1px solid var(--rm-border);
    background: var(--rm-bg);
  }
  .roadmap-cta-card-accent {
    border-color: color-mix(in oklab, var(--rm-sage) 35%, var(--rm-border));
    background: color-mix(in oklab, var(--rm-sage) 8%, var(--rm-bg));
  }
  .roadmap-cta-title {
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .roadmap-cta-text {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-4);
  }
  .roadmap-cta-link {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--rm-sage);
    text-decoration: none;
  }
  .roadmap-cta-link:hover {
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .roadmap-footnote {
    margin: var(--space-8) 0 0;
    font-size: var(--text-sm);
    color: var(--rm-dim);
    line-height: var(--leading-relaxed);
  }
  .roadmap-footnote a {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
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
</style>
