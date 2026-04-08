<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import { githubRepoUrl } from "$lib/testing/site.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="Performance goals"
  description="In-page Web Vitals vs Lighthouse category scores: what the runner measures today and when to keep Lighthouse CI or RUM."
>
  <div class="doc-prose">
    <p>
      Schema validation allows goals with <code>type: performance</code> alongside <code>browser</code> (and reserved
      <code>native</code>). The runner opens the <strong>same navigation path</strong> as a browser goal (environment
      <code>base_url</code> plus optional <code>start_path</code>), then evaluates <code>success_criteria</code> on that page.
    </p>
    <p>
      <strong>Two complementary layers:</strong>
    </p>
    <ul>
      <li>
        <strong>In-session Web Vitals (Performance API)</strong> — <code>structured_checks</code> with paths such as
        <code>vital:lcp</code>, <code>vital:fcp</code>, <code>vital:cls</code> (and <code>web_vitals:</code> aliases). These read metrics from the
        <strong>Playwright</strong> page after load; they respect your session (e.g. <code>storage_state</code>) and are cheap enough for many CI
        suites. Thresholds use the same units as in <code>docs/testing/config-reference-mvp.md</code>.
      </li>
      <li>
        <strong>Lighthouse-style audits</strong> — <code>structured_checks</code> with <code>lighthouse:performance</code>,
        <code>lh:accessibility</code>, <code>lighthouse:full</code>, etc. The runner invokes <strong>Lighthouse</strong> in a
        <strong>separate</strong> headless Chrome against the <strong>current URL</strong>; it does <strong>not</strong> inherit Playwright cookies or storage.
        Best for public URLs, smoke pages, or when you accept a second browser. Skip with <code>RESTORMEL_TESTING_SKIP_LIGHTHOUSE=1</code>; tune
        <code>RESTORMEL_TESTING_LIGHTHOUSE_TIMEOUT_MS</code>.
      </li>
    </ul>
    <p>
      <strong>Practical guidance:</strong> keep deep budgets, custom traces, or authenticated Lighthouse flows in
      <strong>Lighthouse CI</strong>, RUM, or existing Playwright perf jobs where you already solved auth. Use Restormel performance-typed goals
      for <strong>goal-level</strong> gates that match the YAML you version in-repo; confirm shapes in
      <a href={`${githubRepoUrl}/blob/main/docs/testing/config-reference-mvp.md`} rel="noopener noreferrer"
        ><code>docs/testing/config-reference-mvp.md</code></a
      >.
    </p>

    <h2 class="doc-prose__h2">Retiring old perf baselines</h2>
    <p>When migrating from legacy Lighthouse CI or static “perf budget” gates:</p>
    <ul>
      <li>
        <strong>Overlap briefly</strong> — run Restormel checks and your existing gate in parallel until scores stabilise on the same URLs.
      </li>
      <li>
        <strong>Do not assume parity</strong> — in-page vitals vs Lighthouse categories measure different things; auth and cold-load behaviour
        differ between the Playwright session and Lighthouse’s separate Chrome.
      </li>
      <li>
        When Restormel checks cover your risk, <strong>narrow or remove</strong> redundant jobs deliberately rather than dropping coverage in one
        step.
      </li>
    </ul>

    <h2 class="doc-prose__h2">Authoritative references</h2>
    <p>
      Field behaviour and env tables:
      <a href={`${githubRepoUrl}/blob/main/docs/testing/config-reference-mvp.md`} rel="noopener noreferrer"
        ><code>docs/testing/config-reference-mvp.md</code></a
      >
      and
      <a href={`${githubRepoUrl}/blob/main/docs/testing/restormel-testing-technical-architecture.md`} rel="noopener noreferrer"
        ><code>docs/testing/restormel-testing-technical-architecture.md</code></a
      >.
    </p>

    <p>
      <a href="{base}/docs/guides/config">Configuration</a> ·
      <a href="{base}/docs/guides/test-definition">Test definition</a> ·
      <a href="{base}/docs/compatibility">Compatibility</a>
    </p>
  </div>
</DocArticle>

<style>
  :global(.doc-article .doc-prose__h2) {
    font-family: var(--rm-font-display);
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--rm-text);
    margin: var(--space-8) 0 var(--space-3);
    letter-spacing: var(--tracking-tight);
  }
</style>
