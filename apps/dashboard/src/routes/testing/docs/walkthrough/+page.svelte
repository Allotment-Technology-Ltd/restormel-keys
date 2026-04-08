<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import { keysDocsUrl, keysHomeUrl } from "$lib/testing/site.js";
  import { walkthroughCorePhases, walkthroughExtendedPhases } from "$lib/testing/docs-nav.js";
</script>

<svelte:head>
  <title>Walkthrough — Restormel Testing docs</title>
</svelte:head>

<article class="walkthrough-index">
  <h1>Testing walkthrough</h1>
  <p class="lede lede--strong">
    From <strong>“I have an AI-enabled product with brittle or incomplete AI journey testing”</strong> to
    <strong>“I can run one goal-based Restormel Testing suite locally and in CI using BYOK through Restormel Keys.”</strong>
  </p>
  <p class="lede">
    This is the primary onboarding path. It takes you through inventory, install, Keys-backed resolution, your first goal,
    a local suite run, and GitHub Actions—using the same run contract everywhere. Keep
    <a href="{base}/docs/guides/config">Configuration</a>, <a href="{base}/docs/guides/test-definition">Test definition</a>,
    and <a href="{base}/docs/integrations/keys">Keys integration</a> open beside you.
  </p>

  <h2 class="h2">Before you begin</h2>
  <ul class="list">
    <li>
      <strong>A repo</strong> with at least one user journey where AI behaviour affects the outcome (prompts, agents,
      retrieval, model choice).
    </li>
    <li>
      <strong>Restormel Keys</strong> — a project (or plan for one) if you want BYOK-aligned test execution; optional
      fallbacks are documented in-repo for early bring-up.
    </li>
    <li>
      <strong>Your routing inventory</strong> — how the app picks models today and where secrets live (so test config
      uses logical refs, not a parallel key vault).
    </li>
    <li>
      <strong>Toolchain</strong> — Node 20.x and pnpm aligned with the Restormel module stack; Playwright available where
      browser goals run.
    </li>
  </ul>

  <h2 class="h2">Phases</h2>
  <ol class="phases" role="list">
    {#each walkthroughCorePhases as phase, i}
      <li class="phase">
        <a class="phase__link" href="{base}{phase.path}" data-sveltekit-preload-data="hover">
          <span class="phase__num">{i + 1}.</span>
          <span class="phase__body">
            <span class="phase__title">{phase.title}</span>
            <span class="phase__summary">{phase.summary}</span>
          </span>
        </a>
      </li>
    {/each}
  </ol>

  <h2 class="h2">Beyond the core path</h2>
  <p class="between">
    Same pattern as the Keys walkthrough: after the numbered phases, deeper topics for migration, verification, and
    secrets hygiene.
  </p>
  <ol class="phases" role="list" start={walkthroughCorePhases.length + 1}>
    {#each walkthroughExtendedPhases as phase, i}
      <li class="phase">
        <a class="phase__link" href="{base}{phase.path}" data-sveltekit-preload-data="hover">
          <span class="phase__num">{walkthroughCorePhases.length + i + 1}.</span>
          <span class="phase__body">
            <span class="phase__title">{phase.title}</span>
            <span class="phase__summary">{phase.summary}</span>
          </span>
        </a>
      </li>
    {/each}
  </ol>

  <h2 class="h2">Implementing with a coding agent</h2>
  <p class="agent-intro">
    Each phase page includes an <strong>Agent prompts</strong> section, collapsed by default. Open it when you want an
    agent to apply that phase to your repository in a bounded, reviewable sequence—mirroring the Keys walkthrough UX.
  </p>

  <h2 class="h2">Keys and secrets at a glance</h2>
  <ul class="list">
    <li>
      <strong>Logical refs in Testing config</strong> — point at Keys-managed resolution; never commit raw provider keys
      in <code>restormel-testing.yaml</code>.
    </li>
    <li>
      <strong>Canonical env and API names</strong> — Keys vocabulary in
      <a href={keysDocsUrl} rel="noopener noreferrer">Keys documentation</a>; Testing CLI judge env (<code>RESTORMEL_KEYS_*</code>,
      optional OpenAI fallback) is summarised in <a href="{base}/docs/integrations/keys">Keys integration</a> and repo
      <code>docs/config-reference-mvp.md</code>.
    </li>
    <li>
      <strong>CI secrets</strong> — GitHub Actions (or your runner) holds gateway/control-plane material; Testing only
      consumes what Keys needs through your chosen pattern.
    </li>
  </ul>

  <h2 class="h2">Next</h2>
  <p class="next">
    <a href="{base}/docs/compatibility">Compatibility</a> for Node/CI targets ·
    <a href={keysHomeUrl}>Restormel Keys</a> product home ·
    <a href="{base}/docs/getting-started/new-project">New project</a> ·
    <a href="{base}/docs/getting-started/existing-stack">Existing stack</a>
  </p>
</article>

<style>
  .walkthrough-index {
    max-width: min(100%, 44rem);
    padding-bottom: var(--space-12);
  }

  .walkthrough-index h1 {
    font-family: var(--rm-font-display);
    font-size: var(--text-3xl);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: 0 0 var(--space-4);
    letter-spacing: var(--tracking-tight);
  }

  .lede {
    font-family: var(--rm-font-ui);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    margin: 0 0 var(--space-4);
  }

  .lede--strong {
    font-size: var(--text-lg);
  }

  .lede strong {
    color: var(--rm-text);
    font-weight: var(--font-semibold);
  }

  .lede a {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .lede a:hover {
    color: var(--signal-teal-hover);
  }

  .h2 {
    font-family: var(--rm-font-display);
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: var(--space-10) 0 var(--space-3);
    letter-spacing: var(--tracking-tight);
  }

  .list {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-6);
    padding-left: var(--space-5);
  }

  .list strong {
    color: var(--rm-text);
  }

  .list code {
    font-size: 0.9em;
    color: var(--rm-text);
  }

  .phases {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .between {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-4);
  }

  .phase__link {
    display: flex;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--rm-surface);
    border: var(--border-1) solid var(--rm-border);
    border-radius: var(--rm-card-radius);
    text-decoration: none;
    color: inherit;
    transition: border-color var(--duration-fast) var(--ease);
  }

  .phase__link:hover {
    border-color: var(--rm-sage);
  }

  .phase__link:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }

  .phase__num {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--rm-sage);
    flex-shrink: 0;
  }

  .phase__body {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  .phase__title {
    font-family: var(--rm-font-display);
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
  }

  .phase__summary {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }

  .agent-intro {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
    max-width: var(--rm-reading-width);
  }

  .agent-intro strong {
    color: var(--rm-text);
  }

  .next {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    margin: 0;
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }

  .next a {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .next a:hover {
    color: var(--signal-teal-hover);
  }
</style>
