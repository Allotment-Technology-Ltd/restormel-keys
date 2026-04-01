<script lang="ts">
  import EmptyState from "$lib/components/EmptyState.svelte";
</script>

<h1 class="page-title">CLI</h1>
<p class="page-desc">
  Install and configure the Restormel Keys CLI for terminal-based debugging, validation, and inspection.
</p>

<section class="section" aria-labelledby="install-heading">
  <h2 id="install-heading" class="section-title">Installation</h2>
  <div class="code-block">
    <code>npm install -g @restormel/keys-cli</code>
  </div>
  <p class="help-text">
    Run <code class="inline-code">keys doctor</code> after install to validate your environment.
  </p>
</section>

<section class="section" aria-labelledby="commands-heading">
  <h2 id="commands-heading" class="section-title">Available commands</h2>
  <ul class="command-list">
    <li><code class="inline-code">keys init</code> — scaffold a Restormel configuration</li>
    <li><code class="inline-code">keys doctor</code> — validate environment and configuration</li>
    <li><code class="inline-code">keys validate</code> — check key validity</li>
    <li><code class="inline-code">keys estimate &lt;model&gt;</code> — cost estimate for a model</li>
    <li><code class="inline-code">keys models list</code> — list available models across providers</li>
    <li><code class="inline-code">keys routing explain &lt;model&gt;</code> — explain routing decisions</li>
    <li><code class="inline-code">keys login</code> — device authorization: link this machine to a project (new Gateway key in your terminal)</li>
  </ul>
</section>

<section class="section" aria-labelledby="device-login-heading">
  <h2 id="device-login-heading" class="section-title">Connect from your terminal</h2>
  <p class="help-text">
    Run <code class="inline-code">npx @restormel/keys-cli login</code> in your project directory. Open the printed URL, enter the user code, and pick a project. A new Gateway key is created and written to your env file (or printed).
  </p>
  <a href="/keys/dashboard/cli/connect" class="btn-link">Open Connect CLI (after running login)</a>
</section>

<section class="section" aria-labelledby="activity-heading">
  <h2 id="activity-heading" class="section-title">Recent activity</h2>
  <EmptyState
    title="No CLI activity yet"
    description="CLI activity will appear here once you start using the CLI tools."
  >
    <a href="/keys/docs/integrations/cli" class="btn-link">CLI quickstart guide</a>
  </EmptyState>
</section>

<style>
  .page-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .page-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-5);
  }
  .section {
    margin-bottom: var(--space-6);
  }
  .section-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-3);
  }
  .code-block {
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-3) var(--space-4);
    font-family: "JetBrains Mono", monospace;
    font-size: var(--text-sm);
    color: var(--rm-text);
    margin-bottom: var(--space-3);
  }
  .inline-code {
    font-family: "JetBrains Mono", monospace;
    font-size: var(--text-xs);
    background: var(--rm-surface);
    padding: 0.1rem 0.3rem;
    border-radius: var(--rm-radius);
    border: 1px solid var(--rm-border);
  }
  .help-text {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .command-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .command-list li {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .btn-link {
    font-size: var(--text-sm);
    color: var(--rm-sage);
    text-decoration: none;
    font-weight: 500;
  }
  .btn-link:hover {
    text-decoration: underline;
  }
</style>
