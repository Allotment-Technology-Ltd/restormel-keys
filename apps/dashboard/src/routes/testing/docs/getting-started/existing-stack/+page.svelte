<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import { githubRepoUrl } from "$lib/testing/site.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="Existing stack"
  description="You already have Playwright, CI, and probably Restormel Keys. Testing adds a goal-based orchestration layer—not a replacement migration."
>
  <div class="doc-prose">
    <p>Integration principles:</p>
    <ul>
      <li>Keep Playwright as the <strong>browser substrate</strong>; Testing owns suites, goals, verdicts, and CI contract.</li>
      <li>Map high-value journeys first (5–8 goals) instead of porting an entire legacy suite day one.</li>
      <li>Resolve models through <strong>Keys</strong> so test spend and provider policy match production semantics.</li>
      <li>Reuse existing secrets machinery—Testing configs hold <strong>opaque refs</strong>, not raw keys.</li>
    </ul>

    <h2 class="doc-prose__h2">Recipe: pnpm monorepo with <code>apps/web</code> (Plotbudget-style)</h2>
    <p>
      Many teams keep a single repo with <code>pnpm-workspace.yaml</code>, an app under <code>apps/web</code> (or similar), and Playwright
      already installed for classic E2E. Restormel Testing sits <strong>alongside</strong> that setup: same Node toolchain, same browser
      install, one more dev dependency for the CLI.
    </p>
    <ol>
      <li>
        <strong>Workspace root</strong> — from the repo root, add
        <code>pnpm add -D @restormel/testing-cli@^0.1.1</code> (or add to the workspace package that runs CI). Pin the same minor line
        across <code>@restormel/testing-*</code> if you depend on more than the CLI.
      </li>
      <li>
        <strong>Playwright browsers</strong> — keep your existing
        <code>pnpm exec playwright install chromium</code> (or full install) step; Testing’s browser adaptor uses Playwright. Run it in CI
        before <code>testing run</code>.
      </li>
      <li>
        <strong>Config file</strong> — place <code>restormel-testing.yaml</code> where your team can find it (often repo root or
        <code>apps/web/</code>). Run <code>pnpm exec testing init</code> once if you want a scaffold, then edit suites and goals.
      </li>
      <li>
        <strong>Coexist with Playwright config</strong> — keep <code>playwright.config.ts</code> for any legacy tests you still run.
        Testing does not require deleting it. Over time, migrate only the journeys that benefit from goal-based criteria.
      </li>
      <li>
        <strong>Global setup and auth storage</strong> — if you already use <code>globalSetup</code> to mint session cookies and write
        <code>storageState</code> JSON, reuse that artefact: in <code>restormel-testing.yaml</code>, set
        <code>auth_mode: storage_state</code> and <code>auth_ref</code> to the path (or <code>env:VAR</code> pointing at a path produced in
        CI). Do not commit raw storage files with live secrets; generate them in CI from test credentials.
      </li>
      <li>
        <strong>CI job order</strong> — install deps → install Playwright browsers → (optional) run your global setup or publish a preview
        URL → <code>testing validate</code> → <code>testing run</code> or the composite GitHub Action. Use the same
        <code>RESTORMEL_KEYS_*</code> secrets pattern as local.
      </li>
      <li>
        <strong>GitHub Actions</strong> — prefer the composite action under
        <code>packages/testing-github-action</code> (published path on npm) so the run contract matches local. See
        <a href="{base}/docs/guides/ci">CI guide</a>,
        <a href="{base}/docs/guides/http-runs-and-actions">HTTP runs vs Action</a>, and
        <a href="{base}/docs/guides/ci-security">Fork PRs and workflow triggers</a>.
      </li>
    </ol>
    <p>
      Off-registry consumption and npm pins:
      <a href={`${githubRepoUrl}/blob/main/docs/testing/oss-consumption.md`} rel="noopener noreferrer"
        ><code>docs/testing/oss-consumption.md</code></a
      >.
    </p>

    <p>
      See <a href="{base}/docs/journeys/from-e2e">Escaping brittle E2E</a>,
      <a href="{base}/docs/guides/plot-dogfooding">Plot dogfooding</a>, and the
      <a href="{base}/docs/walkthrough/phase-0-inventory">inventory</a> phase.
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
