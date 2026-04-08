<script lang="ts">
  import { base } from "$app/paths";
  import DocArticle from "$lib/components/docs/DocArticle.svelte";
  import WalkthroughAgentPrompts from "$lib/components/docs/WalkthroughAgentPrompts.svelte";
</script>

<DocArticle
  title="Phase 5 — Add CI (GitHub Actions)"
  description="Run the same suite contract as local on every PR (or your chosen trigger); surface a clear pass/fail and a local reproduction command when something breaks."
>
  <div class="phase-page">
    <div class="doc-prose">
      <p>MVP goals:</p>
      <ul>
        <li>Secrets only in CI, not in committed YAML.</li>
        <li>Use the composite action under <code>packages/testing-github-action</code>; run <code>validate</code> then <code>run</code> like local.</li>
        <li>Upload the run directory as a workflow artefact; step summary + <code>report.json</code> carry goal ids and reproduction.</li>
      </ul>
      <p>
        <a href="{base}/docs/guides/ci">CI guide</a> ·
        <a href="{base}/docs/walkthrough/phase-4-local-run">← Phase 4</a> ·
        <a href="{base}/docs/walkthrough/verification-strategy">Verification strategy →</a>
      </p>
    </div>
    <WalkthroughAgentPrompts>
      <div class="doc-prose">
        <ol>
          <li>Add a workflow using the composite action (see <code>examples/testing-github-actions/sample-workflow.yml</code>); wire Keys / fallback env; validate then run.</li>
          <li>Open a test PR that fails the job; verify the summary links or comments help triage.</li>
          <li>Document the exact command to reproduce the failing run from a developer laptop.</li>
        </ol>
      </div>
    </WalkthroughAgentPrompts>
  </div>
</DocArticle>
