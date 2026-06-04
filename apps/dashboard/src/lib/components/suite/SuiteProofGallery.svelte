<script lang="ts">
  /**
   * Compact “show don’t tell” proof panels for suite marketing.
   * Static samples only — no live secrets or API calls.
   */
  import { page } from "$app/stores";
  import type { SuiteModule } from "$lib/suite/suite-modules";
  import { SUITE_MODULES } from "$lib/suite/suite-modules";
  import SuiteModuleGraphPreview from "$lib/components/suite/SuiteModuleGraphPreview.svelte";

  export let compact = false;
  /** When omitted, uses root layout `suiteModulesForUi` or full SUITE_MODULES. */
  export let modules: SuiteModule[] | undefined = undefined;

  $: modulesForUi = modules ?? $page.data.suiteModulesForUi ?? SUITE_MODULES;
</script>

<div class="proof-gallery" class:proof-gallery-compact={compact} role="list" aria-label="Product proof samples">
  {#each modulesForUi as mod}
    <article
      class="proof-card"
      role="listitem"
      style="--proof-accent: var({mod.colorVar})"
    >
      <header class="proof-header">
        <h3 class="proof-title">{mod.capability}</h3>
        <p class="proof-product">{mod.product}</p>
      </header>
      <p class="proof-label">{mod.proofLabel}</p>

      {#if mod.id === "keys"}
        <div class="proof-panel">
          <pre class="proof-pre" aria-label="Sample resolve chain"><code>{`route: production-default
primary → openai / gpt-4o-mini
fallback → anthropic / claude-3-5
policy: cost-cap-pass`}</code></pre>
        </div>
      {:else if mod.id === "testing"}
        <div class="proof-panel">
          <pre class="proof-pre proof-pre-pass" aria-label="Sample QA verdict"><code>{`goal: onboarding-happy-path
verdict: PASS
acceptance: 3/3 met`}</code></pre>
        </div>
      {:else if mod.id === "graph"}
        <div class="proof-panel proof-panel-graph">
          <SuiteModuleGraphPreview />
        </div>
      {:else if mod.id === "connect"}
        <div class="proof-panel">
          <pre class="proof-pre" aria-label="Sample agent context flow"><code>{`graph: 847 ideas · 2.1k edges
retrieve → depth: standard
agent: tool call + context pack
verify → 94% claims supported`}</code></pre>
        </div>
      {/if}

      <a class="proof-link" href={mod.href}>{mod.dashboardLabel}</a>
    </article>
  {/each}
</div>

<style>
  .proof-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: var(--space-4);
    width: 100%;
  }
  .proof-gallery-compact {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (min-width: 720px) {
    .proof-gallery-compact {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  .proof-card {
    margin: 0;
    padding: 0;
    border: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-white);
    box-shadow: var(--brut-shadow);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    overflow: hidden;
  }
  .proof-header {
    background: var(--proof-accent);
    border-bottom: var(--brut-border-micro) solid var(--brut-ink);
    padding: var(--space-3) var(--space-4);
  }
  .proof-title {
    margin: 0;
    font-family: var(--brut-font);
    font-size: var(--text-sm);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--brut-ink);
  }
  .proof-product {
    margin: var(--space-1) 0 0;
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--brut-ink);
    opacity: 0.85;
  }
  .proof-label {
    margin: 0;
    padding: 0 var(--space-4);
    font-size: var(--text-xs);
    color: var(--rm-dim);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .proof-panel {
    margin: 0 var(--space-4);
    flex: 1;
    min-height: 5.5rem;
  }
  .proof-panel-graph {
    padding: 0;
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
  }
  .proof-pre {
    margin: 0;
    padding: var(--space-2);
    font-size: 0.65rem;
    line-height: 1.35;
    background: var(--brut-canvas);
    border: var(--brut-border-micro) solid var(--brut-ink);
    overflow-x: auto;
    height: 100%;
    min-height: 5.5rem;
    box-sizing: border-box;
  }
  .proof-pre-pass code {
    color: var(--brut-ink);
  }
  .proof-pre code {
    font-family: ui-monospace, monospace;
    color: var(--brut-ink);
  }
  .proof-link {
    padding: 0 var(--space-4) var(--space-4);
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--brut-blue);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .proof-link:hover {
    color: var(--brut-ink);
  }
</style>
