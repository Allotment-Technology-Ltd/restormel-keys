<script lang="ts">
  import { getIntegrationsWalkthroughPrevNext } from "$lib/docs-integrations-walkthrough-nav";
  import WalkthroughPhaseNav from "$lib/components/walkthrough/WalkthroughPhaseNav.svelte";

  const { prev, next, stepOf } = getIntegrationsWalkthroughPrevNext("prompt-index");
</script>

<svelte:head>
  <title>Prompt index — Integrations walkthrough</title>
  <meta name="description" content="All build-agent prompts for the Integrations walkthrough in one place. Execute in order." />
</svelte:head>

<div class="doc-content">
  <p class="doc-meta"><span class="doc-step">{stepOf}</span></p>
  <h1>Integrations walkthrough — Prompt index</h1>
  <p class="doc-intro">All build-agent prompts for the Integrations walkthrough. Execute in order; stop if a gate fails. Provide context docs to your agent before each prompt.</p>

  <h2>Prompt inventory</h2>
  <table class="docs-table">
    <thead>
      <tr><th>#</th><th>Id</th><th>Source</th><th>Phase</th></tr>
    </thead>
    <tbody>
      <tr><td>I01</td><td>integrations-overview-review</td><td><a href="/keys/docs/integrations-walkthrough/phase-0-overview">Phase 0</a></td><td>0</td></tr>
      <tr><td>I02</td><td>choose-workflow-persist</td><td><a href="/keys/docs/integrations-walkthrough/phase-1-choose-workflow">Phase 1</a></td><td>1</td></tr>
      <tr><td>I03</td><td>cli-install-doctor</td><td><a href="/keys/docs/integrations-walkthrough/phase-2-cli">Phase 2</a></td><td>2</td></tr>
      <tr><td>I03b</td><td>cli-device-login-env</td><td><a href="/keys/docs/integrations-walkthrough/phase-2-cli">Phase 2</a></td><td>2</td></tr>
      <tr><td>I04</td><td>cli-models-routing</td><td><a href="/keys/docs/integrations-walkthrough/phase-2-cli">Phase 2</a></td><td>2</td></tr>
      <tr><td>I05</td><td>mcp-schemas-install</td><td><a href="/keys/docs/integrations-walkthrough/phase-3-mcp">Phase 3</a></td><td>3</td></tr>
      <tr><td>I06</td><td>aaif-types-install</td><td><a href="/keys/docs/integrations-walkthrough/phase-4-aaif">Phase 4</a></td><td>4</td></tr>
      <tr><td>I07</td><td>dashboard-docs-links</td><td><a href="/keys/docs/integrations-walkthrough/phase-5-dashboard-docs">Phase 5</a></td><td>5</td></tr>
      <tr><td>I08</td><td>verify-and-document</td><td><a href="/keys/docs/integrations-walkthrough/phase-6-verify">Phase 6</a></td><td>6</td></tr>
    </tbody>
  </table>

  <h2>Recommended sequences</h2>
  <ul>
    <li><strong>Full:</strong> I01 → I02 → I03 → I03b → I04 → I05 → I06 → I07 → I08</li>
    <li><strong>CLI-only:</strong> I01 → I02 → I03 → I03b → I04 → I07 → I08</li>
    <li><strong>MCP/AAIF schema-only:</strong> I01 → I02 → I05 → I06 → I07 → I08</li>
  </ul>

  <h2>Full prompt text</h2>
  <p>Each phase page contains the full prompt text in its <strong>Agent prompts</strong> section (collapsed by default). Enable agent prompts in the docs (see <code>RESTORMEL_DOCS_AGENT_PROMPTS</code>) to show and copy them. The canonical source for prompt text and gates is <a href="https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/integrations-walkthrough/09-prompt-index.md">docs/integrations-walkthrough/09-prompt-index.md</a> in the repo.</p>

  <h2>Next</h2>
  <p><a href="/keys/docs/integrations-walkthrough">Integrations walkthrough index</a>. <a href="/keys/docs/integrations-walkthrough/phase-0-overview">Phase 0</a> to start the journey.</p>

  <WalkthroughPhaseNav {prev} {next} {stepOf} />
</div>

<style>
  .doc-content { max-width: var(--rm-container-narrow); }
  .doc-meta { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-2); }
  .doc-intro { color: var(--rm-muted); line-height: var(--leading-relaxed); margin: 0 0 var(--space-6); }
  .doc-content h1 { font-family: var(--rm-font-display); font-size: var(--text-2xl); margin: 0 0 var(--space-4); }
  .doc-content h2 { font-size: var(--text-xl); margin: var(--space-6) 0 var(--space-3); }
  .doc-content p, .doc-content li { color: var(--rm-muted); line-height: var(--leading-relaxed); margin: 0 0 var(--space-4); }
  .doc-content ul { margin: 0 0 var(--space-4); padding-left: var(--space-5); }
  .docs-table { width: 100%; border-collapse: collapse; margin: 0 0 var(--space-4); font-size: var(--text-sm); }
  .docs-table th { text-align: left; font-weight: 600; padding: var(--space-2) var(--space-3); border-bottom: 2px solid var(--rm-border); }
  .docs-table td { padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--rm-border); color: var(--rm-muted); }
  .doc-content a { color: var(--rm-sage); }
  .doc-content code { font-family: "JetBrains Mono", monospace; font-size: var(--text-sm); }
</style>
