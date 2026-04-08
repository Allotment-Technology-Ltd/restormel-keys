<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import { githubRepoUrl } from "$lib/testing/site.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="CI / GitHub Actions"
  description="Run the same suite contract as local: load config, execute goals, fail the job on required failures, surface summaries for PR triage."
>
  <div class="doc-prose">
    <p>Current MVP shape:</p>
    <ul>
      <li>
        Composite action under <code>packages/testing-github-action</code> — same <code>run</code> contract as local, with a step summary and
        sensible defaults (e.g. fork PR <code>skip</code>).
      </li>
      <li>Validate in CI before run: <code>validate --config …</code> fails fast on unsupported YAML.</li>
      <li>
        Artefacts: each run writes <code>report.json</code>, Markdown, <code>junit.xml</code>, and related files under
        <code>--artifact-dir</code> (or <code>RESTORMEL_TESTING_ARTIFACT_DIR</code> in the Action) — upload that directory in Actions for
        triage. Prefer one action step with <code>suites: a,b,c</code> (or CLI <code>--suites</code>) so each suite gets a
        <strong>subfolder</strong> under the same base dir; alternatively use a <strong>distinct</strong> artefact directory per step.
      </li>
      <li>
        <strong>Keys</strong> — deterministic goals (URL + DOM only) do not need <code>RESTORMEL_KEYS_*</code>. See
        <a href="{base}/docs/guides/keys-ci-checklist">Keys in CI (checklist)</a> before adding <code>judge_rubric</code>.
      </li>
      <li>
        <code>report.json</code> includes a <code>reproduction</code> object with the exact local rerun command when a goal fails.
      </li>
    </ul>
    <p>
      Deep dive: <a href="{base}/docs/walkthrough/phase-5-ci">Walkthrough — Phase 5 — CI</a>. Sample workflow:
      <a href={`${githubRepoUrl}/blob/main/examples/testing-github-actions/sample-workflow.yml`} rel="noopener noreferrer"
        ><code>examples/testing-github-actions/sample-workflow.yml</code></a>.
      Consuming from another repo:
      <a href={`${githubRepoUrl}/blob/main/docs/testing/oss-consumption.md`} rel="noopener noreferrer"
        ><code>docs/testing/oss-consumption.md</code></a
      >. CI security:
      <a href="{base}/docs/guides/ci-security">Fork PRs and workflow triggers</a>. Plotbudget-class adoption notes:
      <a href={`${githubRepoUrl}/blob/main/docs/testing/plotbudget-testing-adoption-feedback.md`} rel="noopener noreferrer"
        ><code>docs/testing/plotbudget-testing-adoption-feedback.md</code></a
      >.
    </p>
  </div>
</DocArticle>
