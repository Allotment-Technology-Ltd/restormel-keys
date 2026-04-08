<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import { githubRepoUrl } from "$lib/testing/site.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="HTTP runs API vs GitHub Action"
  description="There is no hosted POST/GET runs control plane in the MVP. Prefer the composite Action or CLI; HTTP polling inputs are reserved and ignored today."
>
  <div class="doc-prose">
    <p>
      Some teams prototype CI with a script that polls a remote <code>/v1/runs</code>-style API (for example vendor “agentic run”
      helpers). <strong>Restormel Testing 0.1.x does not ship a supported HTTP runs API.</strong> The runner executes in your job via the
      CLI or the composite GitHub Action—the same contract as local.
    </p>

    <h2 class="doc-prose__h2">What to use instead</h2>
    <ul>
      <li>
        <strong>GitHub Actions</strong> — use
        <a href={`${githubRepoUrl}/tree/main/packages/testing-github-action`} rel="noopener noreferrer"
          ><code>packages/testing-github-action</code></a
        >
        (published as <code>@restormel/testing-github-action</code>) or invoke <code>pnpm exec testing run</code> directly.
      </li>
      <li>
        <strong>Other CI</strong> — shell out to the CLI after <code>pnpm install</code> and Playwright browser install; upload the
        artefact directory from the run.
      </li>
    </ul>

    <h2 class="doc-prose__h2">Action inputs you can ignore</h2>
    <p>
      <code>poll_interval_seconds</code> and <code>timeout_minutes</code> on the composite action are <strong>documentation placeholders</strong>
      for a possible future hosted mode. They are <strong>ignored</strong> today. Use GitHub’s
      <code>timeout-minutes</code> on the job or step for wall-clock limits.
    </p>

    <h2 class="doc-prose__h2">Future: sidecar or HTTP parity</h2>
    <p>
      If we add an official small sidecar that implements <code>POST/GET /v1/runs</code> for teams already wired to <code>curl</code>, it
      will be documented here and versioned separately from the core CLI. Until then, treat any HTTP poller as <strong>unsupported</strong>
      for Restormel Testing to avoid fork drift.
    </p>

    <p>
      <a href="{base}/docs/guides/ci">CI guide</a> ·
      <a href="{base}/docs/guides/ci-security">Fork PRs and workflow triggers</a>
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
