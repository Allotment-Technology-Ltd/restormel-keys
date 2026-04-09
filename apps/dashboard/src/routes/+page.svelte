<script lang="ts">
  import SuiteMarketingLayout from "$lib/components/suite/SuiteMarketingLayout.svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
</script>

<svelte:head>
  <title>Restormel — Keys, Testing, Graph, and integrations for production AI</title>
  <meta
    name="description"
    content="Restormel Keys for BYOK and gateway routing, Restormel Testing for goal-based AI product verification, Restormel Graph for Svelte graph UIs, and integration guides—all in one place."
  />
</svelte:head>

<SuiteMarketingLayout>
  <div class="suite-landing">
    <section class="suite-hero container">
      <p class="suite-kicker">Restormel</p>
      <h1 class="suite-title">Ship AI products with confidence</h1>
      <p class="suite-lead">
        One suite for <strong>provider keys and routing</strong>, <strong>goal-based testing</strong>,
        <strong>contract-first graph UI</strong>, and <strong>integration paths</strong> your team can run in CI and production.
      </p>
    </section>

    <section class="suite-cards section-alt" aria-label="Products">
      <div class="container suite-cards-inner">
        <article class="suite-card">
          <h2 class="suite-card-title">Restormel Keys</h2>
          <p class="suite-card-desc">
            Bring-your-own-key routing, guard rails, and a dashboard for models, projects, and gateway access.
          </p>
          <ul class="suite-card-actions">
            <li><a class="btn btn-primary" href="/keys">Explore Keys</a></li>
            <li><a class="btn btn-ghost" href="/keys/docs">Documentation</a></li>
            <li><a class="btn btn-ghost" href={DASHBOARD_BASE}>Dashboard</a></li>
          </ul>
        </article>

        <article class="suite-card">
          <h2 class="suite-card-title">Restormel Testing</h2>
          <p class="suite-card-desc">
            YAML-native suites, browser-backed goals, and CI-friendly verdicts—integrated with Keys for provider
            resolution.
          </p>
          <ul class="suite-card-actions">
            <li><a class="btn btn-primary" href="/testing">Explore Testing</a></li>
            <li><a class="btn btn-ghost" href="/testing/docs">Documentation</a></li>
            <li><a class="btn btn-ghost" href="/testing/dashboard">Testing dashboard</a></li>
          </ul>
        </article>

        <article class="suite-card">
          <h2 class="suite-card-title">Restormel Graph</h2>
          <p class="suite-card-desc">
            Portable GraphData DTOs, orbital layout helpers, and a Svelte&nbsp;5 canvas—integrate without coupling your app
            to Restormel reasoning contracts.
          </p>
          <ul class="suite-card-actions">
            <li><a class="btn btn-primary" href="/graph">Explore Graph</a></li>
            <li><a class="btn btn-ghost" href="/graph/docs">Documentation</a></li>
            <li><a class="btn btn-ghost" href="/graph/docs/integration/sveltekit">SvelteKit integration</a></li>
          </ul>
        </article>

        <article class="suite-card">
          <h2 class="suite-card-title">Integrations</h2>
          <p class="suite-card-desc">
            Connect gateways, IDEs, and workflows across the Restormel stack with copy-paste guides and examples.
          </p>
          <ul class="suite-card-actions">
            <li><a class="btn btn-primary" href="/integrations">View integrations</a></li>
            <li><a class="btn btn-ghost" href="/keys/docs/integrations">Keys integrations</a></li>
          </ul>
        </article>
      </div>
    </section>
  </div>
</SuiteMarketingLayout>

<style>
  .suite-landing {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    padding-bottom: var(--space-12);
  }
  .suite-hero {
    padding-top: var(--space-4);
    text-align: center;
    max-width: 42rem;
    margin-left: auto;
    margin-right: auto;
  }
  .suite-kicker {
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--rm-dim);
    margin: 0 0 var(--space-3);
  }
  .suite-title {
    font-family: var(--rm-font-display);
    font-size: clamp(var(--text-3xl), 4vw, var(--text-4xl));
    font-weight: var(--font-semibold);
    line-height: var(--leading-tight);
    margin: 0 0 var(--space-4);
    color: var(--rm-text);
  }
  .suite-lead {
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    margin: 0;
  }
  .suite-lead strong {
    color: var(--rm-text);
    font-weight: var(--font-medium);
  }
  .suite-cards-inner {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
    gap: var(--space-8);
    padding-top: var(--space-10);
    padding-bottom: var(--space-10);
  }
  .suite-card {
    background: var(--rm-bg);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .suite-card-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    margin: 0;
    color: var(--rm-text);
  }
  .suite-card-desc {
    margin: 0;
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    flex: 1;
  }
  .suite-card-actions {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .suite-card-actions a {
    text-align: center;
    justify-content: center;
  }
</style>
