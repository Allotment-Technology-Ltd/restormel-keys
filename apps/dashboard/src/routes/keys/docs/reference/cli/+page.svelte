<script lang="ts">
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";
</script>

<svelte:head>
  <title>CLI options — Restormel Keys</title>
  <meta
    name="description"
    content="When to use Restormel Doctor, Restormel Validate, and the Keys CLI wrapper. CI-friendly exit codes, common workflows, and migration safety rails."
  />
</svelte:head>

<div class="doc-content">
  <h1>CLI options</h1>
  <p class="doc-tagline">
    Restormel has three CLI entry points. They overlap by design: you can start small with standalone wedge tools, then
    adopt Keys CLI when you want scaffolding and onboarding.
  </p>

  <div class="callout callout-tip">
    <strong>Rule of thumb</strong> — use <code>@restormel/doctor</code> and <code>@restormel/validate</code> as your CI gates; use
    <code>@restormel/keys-cli</code> when you want Keys-specific scaffolding (<code>init</code>, <code>add</code>, <code>list</code>, <code>estimate</code>).
  </div>

  <h2>1) Restormel Doctor (<code>restormel-doctor</code>)</h2>
  <p>
    Doctor answers: “Is my local integration setup healthy?” It checks framework detection, config presence, suggested packages,
    and (optionally) scans your repo for provider/model identifiers.
  </p>

  <CodeBlock language="bash" code={`npx @restormel/doctor`} />

  <h3>Repo scan and lifecycle warnings (advisory)</h3>
  <p>
    To surface which models your codebase appears to use (and whether any are deprecated/sunset), run a repo scan. This does
    not read or print secret values; it only reports identifiers and file paths.
  </p>
  <CodeBlock language="bash" code={`npx @restormel/doctor --repo`} />

  <p>
    If your repo includes a model registry at <code>registry/models.json</code>, Doctor can map detected models to lifecycle states.
    See <a href="/docs/model-registry">Model registry</a>.
  </p>

  <h3>Manifest output (CI-stable)</h3>
  <p>
    If you want deterministic results in CI, you can write a manifest file. Commit it to your repo, then compare diffs in PRs.
  </p>
  <CodeBlock language="bash" code={`npx @restormel/doctor --repo --manifest-out restormel.doctor.manifest.json`} />

  <h2>2) Restormel Validate (<code>restormel-validate</code>)</h2>
  <p>
    Validate answers: “Do my provider credentials work right now?” It re-checks keys in your local key store and exits with
    CI-friendly codes.
  </p>

  <CodeBlock language="bash" code={`npx @restormel/validate`} />

  <h3>Exit codes</h3>
  <ul>
    <li><code>0</code> — OK</li>
    <li><code>1</code> — confirmed invalid credential(s)</li>
    <li><code>2</code> — usage/config error</li>
    <li><code>3</code> — transient failures only (timeouts, rate limits, 5xx); no confirmed invalid keys</li>
  </ul>

  <h3>Retries and timeouts</h3>
  <CodeBlock language="bash" code={`npx @restormel/validate --retries 2 --timeout-ms 8000`} />

  <h2>3) Restormel Keys CLI (wrapper) (<code>keys …</code>)</h2>
  <p>
    The Keys CLI provides onboarding and convenience. It wraps Doctor and Validate so teams can use one CLI surface while still
    benefiting from the standalone wedge tools.
  </p>

  <CodeBlock
    language="bash"
    code={[
      "npx @restormel/keys-cli init",
      "npx @restormel/keys-cli add openai",
      "npx @restormel/keys-cli doctor --repo",
      "npx @restormel/keys-cli validate --format json",
    ].join("\\n")}
  />

  <h2>Recommended workflows</h2>

  <h3>Local dev</h3>
  <ul>
    <li><strong>After install</strong>: <code>npx @restormel/doctor</code></li>
    <li><strong>After key rotation</strong>: <code>npx @restormel/validate</code></li>
  </ul>

  <h3>CI gates</h3>
  <ul>
    <li><strong>On every PR</strong>: <code>npx @restormel/doctor</code></li>
    <li><strong>On deploy / nightly</strong>: <code>npx @restormel/validate</code></li>
  </ul>

  <h3>Migrations (OpenRouter / Portkey)</h3>
  <ul>
    <li><strong>Before shifting traffic</strong>: <code>npx @restormel/validate</code> (credential health)</li>
    <li><strong>Before enabling a new model</strong>: <code>npx @restormel/doctor --repo</code> (usage inventory + lifecycle risk)</li>
  </ul>
</div>

<style>
  .doc-content {
    max-width: var(--rm-container-narrow);
  }
  .doc-tagline {
    font-size: var(--text-lg);
    color: var(--rm-muted);
    margin: 0 0 var(--space-6);
  }
  .doc-content h1 {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    color: var(--rm-text);
    margin: 0 0 var(--space-4);
  }
  .doc-content h2 {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    color: var(--rm-text);
    margin: var(--space-8) 0 var(--space-3);
  }
  .doc-content h3 {
    font-size: var(--text-lg);
    margin: var(--space-6) 0 var(--space-2);
  }
  .doc-content p,
  .doc-content li {
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
</style>

