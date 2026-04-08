<script lang="ts">
  import { base } from "$app/paths";
  import { githubRepoUrl } from "$lib/site";
  import DocArticle from "$lib/components/docs/DocArticle.svelte";
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
        <code>--artifact-dir</code> — upload that directory in Actions for triage.
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
      <a href={`${githubRepoUrl}/blob/main/docs/oss-consumption.md`} rel="noopener noreferrer"><code>docs/oss-consumption.md</code></a>.
    </p>
  </div>
</DocArticle>
