<script lang="ts">
  import { base } from "$app/paths";
  import DocArticle from "$lib/components/docs/DocArticle.svelte";
  import WalkthroughAgentPrompts from "$lib/components/docs/WalkthroughAgentPrompts.svelte";
</script>

<DocArticle
  title="Verification strategy"
  description="Before you rely on Testing as a merge gate: local/CI parity, Keys resolution behaviour, flake policy, and artefact usefulness under failure."
>
  <div class="phase-page">
    <div class="doc-prose">
      <ul>
        <li>Local run matches CI for the same commit and env variables (modulo base URLs).</li>
        <li>Forced failure produces a triage path within the MVP target (~30 minutes for a competent engineer).</li>
        <li><code>indeterminate</code> verdicts are rare, logged, and understood—not ignored.</li>
        <li>Keys misconfiguration or outage fails loudly; tests do not silently run against the wrong model.</li>
      </ul>
      <p>
        <a href="{base}/docs/walkthrough/phase-5-ci">← Phase 5 — CI</a> ·
        <a href="{base}/docs/walkthrough">Walkthrough index</a> ·
        <a href="{base}/docs/walkthrough/secrets-and-ci-setup">Secrets and CI setup →</a>
      </p>
    </div>
    <WalkthroughAgentPrompts>
      <div class="doc-prose">
        <ol>
          <li>Run the checklist above on a feature branch; file gaps as issues with severity.</li>
          <li>Define team policy for when <code>indeterminate</code> blocks merge vs needs human override.</li>
          <li>Schedule a monthly review of top flaky goals and artefact noise.</li>
        </ol>
      </div>
    </WalkthroughAgentPrompts>
  </div>
</DocArticle>
