<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="CLI telemetry"
  description="Optional, anonymous usage data from the Restormel Testing CLI — what is collected, what is not, and how to opt out."
>
  <div class="doc-prose">
    <p>
      The <code>restormel-testing</code> CLI can send <strong>anonymous</strong> usage events to help improve the product. Telemetry is
      <strong>opt-in by default</strong>; you can disable it at any time (see below).
    </p>

    <h2>First run</h2>
    <p>
      The first time you run a substantive command (for example <code>validate</code>, <code>run</code>, <code>report</code>,
      <code>doctor</code>, or <code>telemetry</code>), the CLI may print a short notice to <code>stderr</code> explaining this policy and
      how to opt out. No response is required.
    </p>

    <h2>What we collect (when enabled)</h2>
    <p>Each event includes only:</p>
    <ul>
      <li>CLI command name: <code>run</code>, <code>validate</code>, <code>report</code>, or <code>doctor</code></li>
      <li>Node.js version and OS platform (e.g. <code>darwin</code>, <code>linux</code>, <code>win32</code>)</li>
      <li>Suite count and goal count (integers only)</li>
      <li>Verdict summary: counts of goals in each of <code>passed</code>, <code>failed</code>, and <code>indeterminate</code></li>
      <li>CLI package version (for compatibility diagnostics)</li>
    </ul>

    <h2>What we do not collect</h2>
    <ul>
      <li>No source code, repository paths, or file contents</li>
      <li>No suite names, goal names, URLs, or model identifiers</li>
      <li>No API keys, tokens, or other secrets</li>
      <li>No personal data or stable per-user identifiers</li>
    </ul>

    <h2>Where events are sent</h2>
    <p>
      Events are sent via HTTPS POST to <code>https://telemetry.restormel.dev/v1/event</code>. If the service is unavailable, the CLI
      fails silently and your command still completes normally.
    </p>

    <h2>Opt out</h2>
    <ul>
      <li>
        <strong>Environment:</strong> set <code>RESTORMEL_TELEMETRY=0</code> (or <code>false</code> / <code>off</code> / <code>no</code>) for
        the shell or CI job. Set to <code>1</code> (or <code>true</code> / <code>on</code> / <code>yes</code>) to force enable; the
        environment variable overrides the file preference.
      </li>
      <li>
        <strong>Preference file:</strong> run <code>restormel-testing telemetry disable</code>. This saves your choice under
        <code>~/.restormel/telemetry.json</code>. Use <code>restormel-testing telemetry enable</code> to turn sending back on.
      </li>
      <li><strong>Check status:</strong> <code>restormel-testing telemetry status</code> shows whether sending is enabled and why.</li>
    </ul>

    <p>
      Related: <a href="{base}/docs/guides/config">Configuration</a> ·
      <a href="{base}/docs/walkthrough/phase-1-install">Walkthrough — Install</a>
    </p>
  </div>
</DocArticle>
