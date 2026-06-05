<script lang="ts">
  import "$lib/styles/suite-landing.css";
  import { page } from "$app/stores";
  import { dashboardEntryHref } from "$lib/dashboard-entry";
  import { trackSuiteIntent } from "$lib/posthog";
  import SuiteHeroVisual from "$lib/components/suite/SuiteHeroVisual.svelte";
  import ProductDemo from "$lib/components/suite/product-demo/ProductDemo.svelte";
  import SuiteProductCards from "$lib/components/suite/SuiteProductCards.svelte";
  import EcosystemStrip from "$lib/components/integrations/EcosystemStrip.svelte";
  import { isSuiteMarketingExpanded } from "$lib/integration-catalog-for-flags";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
  import { SUITE_CAPABILITY_TAGLINE, SUITE_MODULES, type SuiteModule } from "$lib/suite/suite-modules";
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
  <title>Restormel — {SUITE_CAPABILITY_TAGLINE}</title>
  <meta
    name="description"
    content={suiteExpanded
      ? "One Restormel workspace to route LLM requests, assure quality in CI, visualise knowledge graphs, and stand up agent-ready knowledge infrastructure with Connect."
      : "Route LLM requests with BYOK control and stand up agent-ready knowledge infrastructure with Connect — one signed-in workspace."}
  />
</svelte:head>

<div class="suite-landing">
  <section class="suite-hero suite-hero-slab" aria-labelledby="suite-hero-heading">
    <div class="suite-hero-inner">
      <div class="suite-hero-copy">
        <p class="suite-hero-eyebrow">Restormel</p>
        <h1 id="suite-hero-heading" class="suite-hero-title">
          One AI<br />product<br />layer for<br /><em>your</em> stack
        </h1>
        <p class="suite-hero-lead">
          {#if suiteExpanded}
            Route model requests with <strong>fallback chains</strong>, assure behavior in CI, embed reasoning graph
            UIs, and stand up agent-ready knowledge infrastructure — in one signed-in workspace, with direct providers
            and <strong>BYOK custody</strong>.
          {:else}
            Route model requests with <strong>fallback chains</strong> and stand up agent-ready knowledge
            infrastructure — in one signed-in workspace, with direct providers and <strong>BYOK custody</strong>.
          {/if}
        </p>
        <div class="suite-hero-ctas">
          <a
            class="btn btn-primary"
            href={runRestormelHref}
            on:click={() => trackSuiteIntent("run")}
          >
            Run Restormel →
          </a>
          <a class="btn btn-outline" href="/docs/quickstart" on:click={() => trackSuiteIntent("embed")}>
            Embed in my stack
          </a>
        </div>
        <p class="suite-hero-meta">
          <a href="/docs">Suite docs</a>
          <span class="suite-hero-meta-sep" aria-hidden="true">·</span>
          <a href="/product">Capabilities</a>
          <span class="suite-hero-meta-sep" aria-hidden="true">·</span>
          Invite-only while we learn
        </p>
      </div>
      <SuiteHeroVisual {suiteExpanded} />
    </div>
  </section>

  <ProductDemo />

  <section class="suite-use-cases suite-hero-slab" aria-labelledby="use-cases-teaser-heading">
    <div class="suite-section-inner">
      <span class="suite-section-tag suite-section-tag--inverted">Templates</span>
      <h2 id="use-cases-teaser-heading" class="suite-section-title">What will you build first?</h2>
      <p class="suite-section-sub">
        From compliance corpora to mythology pantheons — Restormel works for any structured knowledge problem.
      </p>
      <UseCaseTeaserGrid useCases={homepageUseCases} />
      <p class="suite-use-cases-more">
        <a href="/use-cases">See all use cases, including starter templates →</a>
      </p>
    </div>
  </section>

  <section class="suite-products" aria-labelledby="products-heading">
    <div class="suite-section-inner">
      <span class="suite-section-tag">The suite</span>
      <h2 id="products-heading" class="suite-section-title">
        {#if suiteExpanded}
          Route, assure, visualise, connect.<br />One layer.
        {:else}
          Route and connect.<br />Two products, one layer.
        {/if}
      </h2>
      <p class="suite-section-sub">
        {#if suiteExpanded}
          Start in the dashboard. Each capability has a run path and an embed guide when you integrate.
        {:else}
          Start in the dashboard. Keys handles your model routing; Connect handles your knowledge paths.
        {/if}
      </p>
      <SuiteProductCards modules={productModules} />
    </div>
  </section>

  <section class="suite-stack" aria-labelledby="stack-heading">
    <div class="suite-section-inner">
      <span class="suite-section-tag">How it fits</span>
      <h2 id="stack-heading" class="suite-section-title">No rip-and-replace.</h2>
      <p class="suite-section-sub">
        Keep Neon, SurrealDB, and your existing providers. Restormel sits between your stack and your product as a thin
        control layer.
      </p>
      <EcosystemStrip variant="diagram" moduleFlags={flags} />
    </div>
  </section>

  <section class="suite-invite" id="invite" aria-labelledby="invite-heading">
    <div class="suite-section-inner suite-invite-inner">
      <div>
        <h2 id="invite-heading" class="suite-section-title">Invite-only<br />while we learn</h2>
        <p class="suite-invite-lead">
          Restormel isn't on general sale yet. Join the Founders Circle — register your email, get a personal access
          link, and help us prove the suite before we set pricing.
        </p>
      </div>
      <a class="btn btn-primary btn-lg" href="/founders#apply-heading">Request early access →</a>
    </div>
  </section>
</div>

<style>
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
</style>
