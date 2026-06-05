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
  /** Stamp bar above gallery (hero-visual eyebrow pattern). */
  export let stampEyebrow = "Capability samples";
  /** When omitted, uses root layout `suiteModulesForUi` or full SUITE_MODULES. */
  export let modules: SuiteModule[] | undefined = undefined;

  $: modulesForUi = modules ?? $page.data.suiteModulesForUi ?? SUITE_MODULES;
</script>

<figure
  class="proof-gallery-frame"
  class:proof-gallery-frame--compact={compact}
  aria-labelledby="proof-gallery-heading"
>
  <figcaption id="proof-gallery-heading" class="proof-gallery-eyebrow">
    {stampEyebrow}
  </figcaption>

  <div
    class="proof-gallery"
    class:proof-gallery-compact={compact}
    role="list"
    aria-label="Product proof samples"
  >
    {#each modulesForUi as mod, i (mod.id)}
      <article
        class="proof-card"
        role="listitem"
        style="--proof-accent: var({mod.colorVar})"
      >
        <div class="proof-card-meta">
          <span class="proof-card-idx" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
          <span class="proof-card-kind">{mod.proofLabel}</span>
        </div>

        <header class="proof-header">
          <h3 class="proof-title">{mod.capability}</h3>
          <p class="proof-product">{mod.product}</p>
        </header>

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
explorer → 94% claims supported
connect.search → context pack
MCP: @restormel/mcp + rk_ gateway key
BYO Surreal — graph stays yours`}</code></pre>
          </div>
        {/if}

        <footer class="proof-footer">
          <a class="proof-link" href={mod.href}>
            <span class="proof-link-label">{mod.dashboardLabel}</span>
            <span class="proof-link-arrow" aria-hidden="true">→</span>
          </a>
        </footer>
      </article>
    {/each}
  </div>
</figure>

<style>
  .proof-gallery-frame {
    margin: 0;
    border: 2px solid var(--color-ink);
    box-shadow: 4px 4px 0 var(--color-ink);
    background: var(--color-surface);
    display: flex;
    flex-direction: column;
    transition: transform 100ms ease, box-shadow 100ms ease;
  }

  .proof-gallery-frame:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0 var(--color-ink);
  }

  .proof-gallery-eyebrow {
    margin: 0;
    padding: 0.5rem 0.75rem;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    border-bottom: 2px solid var(--color-ink);
    background: var(--color-bg-deep);
    color: var(--color-ink);
  }

  .proof-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0;
    width: 100%;
    border-top: none;
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
    border: none;
    border-right: 2px solid var(--color-ink);
    border-bottom: 2px solid var(--color-ink);
    background: var(--color-surface);
    display: flex;
    flex-direction: column;
    min-height: 100%;
    overflow: hidden;
    position: relative;
  }

  .proof-card::before {
    content: "";
    position: absolute;
    inset: auto 0 0 0;
    height: 3rem;
    pointer-events: none;
    opacity: 0.06;
    background: repeating-linear-gradient(
      -12deg,
      var(--color-ink),
      var(--color-ink) 1px,
      transparent 1px,
      transparent 6px
    );
  }

  .proof-gallery-compact .proof-card:nth-child(2n) {
    border-right: none;
  }

  @media (min-width: 720px) {
    .proof-gallery-compact .proof-card {
      border-bottom: none;
      border-right: 2px solid var(--color-ink);
    }

    .proof-gallery-compact .proof-card:last-child {
      border-right: none;
    }
  }

  @media (max-width: 719px) {
    .proof-gallery-compact .proof-card:nth-last-child(-n + 2) {
      border-bottom: none;
    }
  }

  .proof-card-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-bottom: 2px solid var(--color-ink);
    background: var(--color-bg);
  }

  .proof-card-idx {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--color-ink-faint);
  }

  .proof-card-kind {
    font-family: var(--font-mono);
    font-size: 0.5625rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-ink-muted);
  }

  .proof-header {
    background: var(--proof-accent);
    border-bottom: 2px solid var(--color-ink);
    padding: var(--space-3) var(--space-3);
  }

  .proof-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-display-sm);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
    line-height: 1;
    color: var(--color-ink);
  }

  .proof-product {
    margin: var(--space-1) 0 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-ink);
    opacity: 0.85;
  }

  .proof-panel {
    margin: 0;
    flex: 1;
    min-height: 5.5rem;
    padding: var(--space-3);
    border-bottom: 2px solid var(--color-ink);
    background: var(--color-bg);
  }

  .proof-panel-graph {
    padding: var(--space-2);
    background: var(--color-surface);
  }

  .proof-panel-graph :global(.graph-preview) {
    border: 2px solid var(--color-ink);
    box-shadow: 2px 2px 0 var(--color-ink);
  }

  .proof-pre {
    margin: 0;
    padding: var(--space-2) var(--space-2) var(--space-2) calc(var(--space-2) + 3px);
    font-size: 0.65rem;
    line-height: 1.35;
    background: var(--color-surface);
    border: 2px solid var(--color-ink);
    border-left: 3px solid var(--color-yellow);
    box-shadow: 3px 3px 0 var(--color-yellow);
    overflow-x: auto;
    height: 100%;
    min-height: 5.25rem;
    box-sizing: border-box;
    border-radius: 0;
  }

  .proof-pre-pass {
    border-left-color: var(--color-ink);
    box-shadow: 3px 3px 0 var(--color-ink);
  }

  .proof-pre code {
    font-family: var(--font-mono);
    color: var(--color-ink);
  }

  .proof-footer {
    margin-top: auto;
    padding: 0;
    border-top: none;
    background: var(--color-bg-deep);
  }

  .proof-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-ink);
    text-decoration: none;
    border-top: 2px solid var(--color-ink);
    transition: background 100ms ease, color 100ms ease;
  }

  .proof-link:hover {
    background: var(--color-yellow);
    color: var(--color-ink);
  }

  .proof-link:focus-visible {
    outline: 2px solid var(--color-ink);
    outline-offset: -2px;
  }

  .proof-link-arrow {
    font-size: 1rem;
    line-height: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .proof-gallery-frame,
    .proof-gallery-frame:hover {
      transition: none;
      transform: none;
      box-shadow: 4px 4px 0 var(--color-ink);
    }
  }
</style>
