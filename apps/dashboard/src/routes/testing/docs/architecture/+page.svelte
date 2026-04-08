<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="Architecture"
  description="Modular packages: core contracts, runner orchestration, browser adaptor, Keys adaptor, CLI, GitHub Action—commodity boundaries vs Restormel-owned test contracts."
>
  <div class="doc-prose">
    <p>Target package shape (from the technical architecture note):</p>
    <pre>@restormel/testing-core — schemas, verdict model, run contract{"\n"}@restormel/testing-config — load + MVP validate rules{"\n"}@restormel/testing-runner — suite execution, retries{"\n"}@restormel/testing-browser-playwright{"\n"}@restormel/testing-keys-adapter{"\n"}@restormel/testing-report — report.json, Markdown, JUnit, summaries{"\n"}@restormel/testing-cli{"\n"}packages/testing-github-action — composite workflow wrapper</pre>
    <p>
      <strong>Commodity:</strong> Playwright, GitHub Actions, OTEL exporters.<br />
      <strong>Differentiated:</strong> goal/suite/run/verdict contracts, Keys-aware execution, workflow-aware failure summaries.<br />
      <strong>Adjacent / later:</strong> hosted control plane, team dashboards, heavy governance UI.
    </p>
    <p>Authoritative detail: repo <code>docs/restormel-testing-technical-architecture.md</code>.</p>
    <p><a href="{base}/docs/how-it-fits-together">How it fits together</a> · <a href="{base}/docs/walkthrough">Walkthrough</a></p>
  </div>
</DocArticle>
