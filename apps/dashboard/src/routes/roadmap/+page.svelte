<script lang="ts">
  import SuiteMarketingLayout from "$lib/components/suite/SuiteMarketingLayout.svelte";
  import { GITHUB_DISCUSSIONS_URL, GITHUB_REPO_URL } from "$lib/site-nav";

  const shippingSoon = [
    {
      title: "Suite MCP & developer tools",
      body: "Tighter parity between the dashboard, CLI, and `@restormel/mcp` — so agents and humans see the same capabilities.",
    },
    {
      title: "Dashboard experience wave",
      body: "Unified marketing shell, in-app docs, and control-plane surfaces that stay consistent across Keys, Testing, and Graph.",
    },
    {
      title: "Keys × Testing onboarding",
      body: "Clearer first-run paths from Connections to CI — fewer env surprises, stronger `doctor` and hub guidance.",
    },
    {
      title: "Integrations depth",
      body: "More walkthroughs and examples for MCP, AAIF, and provider access — meeting teams where they integrate.",
    },
  ] as const;

  const planned = [
    {
      title: "Usage & reliability ledger",
      body: "Cross-cutting visibility into runs, resolves, and costs so teams can tune budgets and catch regressions early.",
    },
    {
      title: "Richer UI kit contracts",
      body: "KeyManager and ModelSelector patterns that embrace async persistence, loading states, and host-owned validation.",
    },
    {
      title: "AAIF & automation hooks",
      body: "Routing integration beyond today’s paths, plus room for event-style signals when workloads need them.",
    },
    {
      title: "Release hardening for npm consumers",
      body: "Smoother installs and typings for packaged Svelte/React components — fewer wrapper layers in host apps.",
    },
  ] as const;

  const considering = [
    {
      title: "Durable agent execution",
      body: "Checkpointed, resumable runs for long-lived workflows — spec-first, product-shaped when the contract is right.",
    },
    {
      title: "Memory / retrieval lane",
      body: "A Restormel-native story for RAG and context that stays correlated with traces, keys, and tests.",
    },
    {
      title: "Enterprise AI front door",
      body: "Keys, policy, metering, and MCP as a coherent gateway story for larger org rollouts.",
    },
    {
      title: "Production synthetics",
      body: "Reusing Testing goals and acceptance criteria for always-on probes — same semantics, different trigger.",
    },
    {
      title: "Policy & audit exports",
      body: "Bundled provenance: traces, policy snapshots, and fingerprints you can hand to reviewers or tools.",
    },
  ] as const;
</script>

<svelte:head>
  <title>Roadmap — Restormel</title>
  <meta
    name="description"
    content="What Restormel is building next: shipping soon, planned work, and ideas under consideration — plus how to suggest features."
  />
</svelte:head>

<SuiteMarketingLayout>
  <article class="roadmap-page container">
    <header class="roadmap-hero">
      <h1 class="roadmap-title">What we're building</h1>
      <p class="roadmap-sub">
        Restormel is in active development. Here's what's shipping soon, what's planned, and what we're considering.
        Founders Circle members can vote on priorities.
      </p>
    </header>

    <div class="roadmap-columns">
      <section class="roadmap-column" aria-labelledby="roadmap-soon-heading">
        <h2 id="roadmap-soon-heading" class="roadmap-column-title">Shipping soon</h2>
        <p class="roadmap-column-hint">In motion now — expect steady changelog updates.</p>
        <ul class="roadmap-cards">
          {#each shippingSoon as item}
            <li>
              <article class="roadmap-card">
                <h3 class="roadmap-card-title">{item.title}</h3>
                <p class="roadmap-card-body">{item.body}</p>
              </article>
            </li>
          {/each}
        </ul>
      </section>

      <section class="roadmap-column" aria-labelledby="roadmap-planned-heading">
        <h2 id="roadmap-planned-heading" class="roadmap-column-title">Planned</h2>
        <p class="roadmap-column-hint">Committed direction — sequencing follows customer signal and dependencies.</p>
        <ul class="roadmap-cards">
          {#each planned as item}
            <li>
              <article class="roadmap-card">
                <h3 class="roadmap-card-title">{item.title}</h3>
                <p class="roadmap-card-body">{item.body}</p>
              </article>
            </li>
          {/each}
        </ul>
      </section>

      <section class="roadmap-column" aria-labelledby="roadmap-considering-heading">
        <h2 id="roadmap-considering-heading" class="roadmap-column-title">Considering</h2>
        <p class="roadmap-column-hint">Exploring — we may ship, defer, or reshape based on research and demand.</p>
        <ul class="roadmap-cards">
          {#each considering as item}
            <li>
              <article class="roadmap-card">
                <h3 class="roadmap-card-title">{item.title}</h3>
                <p class="roadmap-card-body">{item.body}</p>
              </article>
            </li>
          {/each}
        </ul>
      </section>
    </div>

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
        Timelines are indicative. For shipped work, see the <a href="/changelog">changelog</a> and
        <a href={GITHUB_REPO_URL} rel="noopener noreferrer" target="_blank">GitHub repository</a>.
      </p>
    </section>
  </article>
</SuiteMarketingLayout>

<style>
  .roadmap-page {
    max-width: var(--rm-container-max);
  }
  .roadmap-hero {
    max-width: 42rem;
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
  .roadmap-columns {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-8);
    align-items: start;
  }
  @media (max-width: 960px) {
    .roadmap-columns {
      grid-template-columns: 1fr;
      gap: var(--space-10);
    }
  }
  .roadmap-column-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-lg);
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .roadmap-column-hint {
    font-size: var(--text-sm);
    color: var(--rm-dim);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-4);
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
