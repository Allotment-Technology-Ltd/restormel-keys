<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import { githubRepoUrl } from "$lib/testing/site.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="New project"
  description="Fastest path: install the CLI, scaffold config, wire Keys references, run one suite locally, then add CI."
>
  <div class="doc-prose">
    <p>Recommended sequence (mirrors the walkthrough):</p>
    <ol>
      <li>
        <a href="{base}/docs/walkthrough/phase-1-install">Phase 1 — Install</a> the CLI; run <code>doctor</code> and
        <code>validate</code>.
      </li>
      <li>Add <a href="{base}/docs/guides/config"><code>restormel-testing.yaml</code></a> (<code>init</code> writes a valid starter).</li>
      <li>
        <a href="{base}/docs/walkthrough/phase-2-keys">Phase 2 — Wire Keys</a> using logical refs (no raw secrets in YAML).
      </li>
      <li>
        Define your first goal in
        <a href="{base}/docs/walkthrough/phase-3-first-goal">Phase 3 — First goal</a> and
        <a href="{base}/docs/guides/test-definition">Test definition</a>.
      </li>
      <li>
        <a href="{base}/docs/walkthrough/phase-4-local-run">Phase 4 — Local run</a> and inspect artefacts.
      </li>
      <li>
        <a href="{base}/docs/walkthrough/phase-5-ci">Phase 5 — CI</a>, then
        <a href="{base}/docs/walkthrough/verification-strategy">Verification strategy</a>.
      </li>
    </ol>
    <pre>pnpm exec testing init{"\n"}pnpm exec testing doctor --config restormel-testing.yaml{"\n"}pnpm exec testing validate --config restormel-testing.yaml</pre>
    <p>
      The snippet assumes this monorepo after <code>pnpm install</code> and <code>pnpm run build:testing-packages</code>. For install from npm once
      published, see <a href={`${githubRepoUrl}/blob/main/docs/testing/oss-consumption.md`} rel="noopener noreferrer"
        ><code>docs/testing/oss-consumption.md</code></a>.
    </p>
  </div>
</DocArticle>
