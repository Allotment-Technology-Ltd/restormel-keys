<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import { githubRepoUrl } from "$lib/testing/site.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="Architecture"
  description="Modular packages: core contracts, runner orchestration, browser adaptor, Keys adaptor, CLI, GitHub Action—commodity boundaries vs Restormel-owned test contracts."
>
  <div class="doc-prose">
    <p>Target package shape (from the technical architecture note):</p>
    <pre>@restormel/testing-core — schemas, verdict model, run contract{"\n"}@restormel/testing-config — load + MVP validate rules{"\n"}@restormel/testing-runner — suite execution, retries, Web Vitals + optional Lighthouse structured checks{"\n"}@restormel/testing-browser-playwright{"\n"}@restormel/testing-keys-adapter{"\n"}@restormel/testing-report — report.json, Markdown, JUnit, summaries{"\n"}@restormel/testing-cli{"\n"}packages/testing-github-action — composite workflow wrapper</pre>
    <p>
      <strong>Commodity:</strong> Playwright, Lighthouse (for <code>lighthouse:*</code> / <code>lh:*</code> checks), GitHub Actions, OTEL exporters.<br />
      <strong>Differentiated:</strong> goal/suite/run/verdict contracts, Keys-aware execution, workflow-aware failure summaries.<br />
      <strong>Adjacent / later:</strong> hosted control plane, team dashboards, heavy governance UI.
    </p>
    <p>
      <strong>Native device runs (public roadmap):</strong> Config validation already reserves a <code>native</code> goal type for
      Maestro-, Appium-, or XCTest-style execution. <strong>MVP ships browser (Playwright) only;</strong> native adaptors are not
      production-ready in <code>0.1.x</code>. Planned phases: (1) contract + report shape parity with browser goals, (2) first
      adaptor behind a feature flag, (3) CI recipes for device farms or self-hosted runners. Track shipped packages and changelogs
      in the monorepo; this page is the high-level promise, not a release guarantee.
    </p>
    <p>
      Authoritative detail:
      <a href={`${githubRepoUrl}/blob/main/docs/testing/restormel-testing-technical-architecture.md`} rel="noopener noreferrer"
        ><code>docs/testing/restormel-testing-technical-architecture.md</code></a
      >.
    </p>
    <p>
      <a href="{base}/docs/how-it-fits-together">How it fits together</a> · <a href="{base}/docs/walkthrough">Walkthrough</a> ·
      <a href="{base}/docs/guides/performance-goals">Performance goals</a>
    </p>
  </div>
</DocArticle>
