<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import { githubRepoUrl } from "$lib/testing/site.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="Fork PRs and workflow triggers"
  description="Safe defaults for GitHub Actions when contributors open pull requests from forks—especially secrets, preview URLs, and pull_request vs pull_request_target."
>
  <div class="doc-prose">
    <p>
      This page complements your product security review and any PRD appendix on CI. It states <strong>defaults we expect for Restormel
      Testing</strong> in open or fork-friendly repos—not legal advice.
    </p>

    <h2 class="doc-prose__h2"><code>pull_request</code> (recommended default)</h2>
    <p>
      Use a normal <code>pull_request</code> (or <code>pull_request</code> with path filters) workflow for suites that need secrets (Keys
      tokens, preview URLs, private registry auth). GitHub <strong>does not</strong> expose your repo secrets to jobs triggered from
      <strong>forks</strong> on <code>pull_request</code>—so those jobs should skip or degrade gracefully when secrets are missing.
    </p>

    <h2 class="doc-prose__h2"><code>pull_request_target</code> (high risk)</h2>
    <p>
      <code>pull_request_target</code> runs in the <strong>base</strong> repository context with access to secrets, while the checked-out
      code can still be attacker-controlled from the fork. That combination is a common source of supply-chain issues. Do
      <strong>not</strong> adopt <code>pull_request_target</code> for Restormel Testing unless you have a separate security review and a
      minimal, audited workflow (e.g. label-gated, no arbitrary code execution from PR head, no secret exfiltration).
    </p>

    <h2 class="doc-prose__h2">Composite Action: fork policy</h2>
    <p>
      The MVP composite action defaults to <code>fork_pr_policy: skip</code> when <code>is_fork_pr</code> is true, so forked PRs do not fail
      the job because secrets are unavailable. Only set <code>fork_pr_policy: run</code> when the suite is safe <strong>without</strong>
      secrets and targets a <strong>public</strong> URL you are willing to hit from GitHub’s network.
    </p>
    <p>
      Implementation detail:
      <a href={`${githubRepoUrl}/blob/main/packages/testing-github-action/README.md`} rel="noopener noreferrer"
        ><code>packages/testing-github-action/README.md</code></a
      >.
    </p>

    <p>
      <a href="{base}/docs/guides/ci">CI guide</a> ·
      <a href="{base}/docs/walkthrough/phase-5-ci">Walkthrough — Phase 5</a> ·
      <a href="{base}/docs/walkthrough/secrets-and-ci-setup">Secrets and CI setup</a>
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
