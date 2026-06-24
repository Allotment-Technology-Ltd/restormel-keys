<script lang="ts">
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";
</script>

<svelte:head>
  <title>CLI — Integrations — Docs — Restormel Keys</title>
  <meta name="description" content="Install and use the Restormel Keys CLI for terminal-based debugging, validation, and inspection." />
</svelte:head>

<h1 class="docs-h1">CLI</h1>
<p class="docs-intro">
  The Restormel Keys CLI gives you terminal-based access to validation, cost estimation, routing
  inspection, and environment diagnostics.
</p>

<h2 class="docs-h2">Install</h2>
<CodeBlock code="npm install -g @restormel/keys-cli" label="CLI" />

<p class="docs-p">
  Or add it as a dev dependency in your project:
</p>
<CodeBlock code="npm install -D @restormel/keys-cli" label="CLI" />

<h2 class="docs-h2">Commands</h2>

<h3 class="docs-h3"><code>keys init</code></h3>
<p class="docs-p">Scaffold a Restormel configuration file in the current project.</p>
<CodeBlock code="keys init" label="CLI" />

<h3 class="docs-h3"><code>keys doctor</code></h3>
<p class="docs-p">Validate your environment, dependencies, and configuration.</p>
<CodeBlock code="keys doctor" label="CLI" />

<h3 class="docs-h3"><code>keys validate</code></h3>
<p class="docs-p">Check the validity of configured provider credentials (masked).</p>
<CodeBlock code="keys validate" label="CLI" />

<h3 class="docs-h3"><code>keys estimate &lt;model&gt;</code></h3>
<p class="docs-p">Get a cost estimate for a given model with configurable token volumes.</p>
<CodeBlock code={`keys estimate gpt-4o --input 2 --output 1`} label="CLI" />

<h3 class="docs-h3"><code>keys models list</code></h3>
<p class="docs-p">List all available models across configured providers, with pricing.</p>
<CodeBlock code="keys models list" label="CLI" />
<p class="docs-p">Filter by provider:</p>
<CodeBlock code="keys models list --provider anthropic" label="CLI" />

<h3 class="docs-h3"><code>keys routing explain &lt;model&gt;</code></h3>
<p class="docs-p">Explain how Restormel would route a request for a given model.</p>
<CodeBlock code="keys routing explain claude-3-5-sonnet" label="CLI" />

<h3 class="docs-h3"><code>keys catalog fetch</code></h3>
<p class="docs-p">
  Fetch the public canonical provider + model catalog from Restormel (no Gateway Key). Uses <code>RESTORMEL_KEYS_BASE</code> or
  <code>https://restormel.dev</code>. See <a href="/keys/docs/guides/canonical-catalog">Canonical catalog</a> for the full integration guide.
</p>
<CodeBlock code="keys catalog fetch" label="CLI" />
<CodeBlock code="keys catalog fetch --json | jq .contractVersion" label="CLI" />

<h2 class="docs-h2">Next steps</h2>
<p class="docs-p">
  For CI/CD rollouts, pair CLI checks with MCP <code>readiness.check</code> to enforce model/catalog/policy
  guardrails in a single machine-readable step.
</p>
<ul class="docs-links">
  <li><a href="/keys/docs/integrations/mcp">MCP setup</a> — connect to agent workflows</li>
  <li><a href="/keys/docs/integrations/aaif">Dispatch overview</a> — structured AI interaction contract</li>
  <li><a href="/keys/docs/integrations">All integrations</a></li>
</ul>

<style>
  .docs-h1 {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-3);
  }
  .docs-intro {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-5);
    max-width: 42rem;
  }
  .docs-h2 {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--rm-text);
    margin: var(--space-6) 0 var(--space-3);
  }
  .docs-h3 {
    font-size: var(--text-base);
    font-weight: 500;
    color: var(--rm-text);
    margin: var(--space-4) 0 var(--space-2);
  }
  .docs-h3 code {
    font-family: "JetBrains Mono", monospace;
    font-size: var(--text-sm);
  }
  .docs-p {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-3);
    line-height: var(--leading-relaxed);
  }
  .docs-links {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .docs-links li {
    margin-bottom: var(--space-2);
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .docs-links a {
    color: var(--rm-sage);
    font-weight: 500;
    text-decoration: none;
  }
  .docs-links a:hover {
    text-decoration: underline;
  }
</style>
