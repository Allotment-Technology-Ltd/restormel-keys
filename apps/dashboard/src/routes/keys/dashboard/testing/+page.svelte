<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import BrutalPageHeader from "$lib/components/brutalist/BrutalPageHeader.svelte";
  import BrutalCard from "$lib/components/brutalist/BrutalCard.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import TestingTimeline from "$lib/components/testing/TestingTimeline.svelte";
  import type { TestingVerdictEntry } from "@restormel/contracts";

  /**
   * W3.8 — Testing hub: real runs, real verdicts.
   *
   * Registry nouns (ux-contracts §2):
   *   - "Restormel Testing" — the hub and project noun (not "Testing project" alone)
   *   - "Gateway key" — not "API key"
   *   - "Connections" — nav label for /integrations
   */
  export let data: {
    testingProject: { id: string; name: string; workspaceId: string | null; isRestormelTesting?: boolean } | null;
    environments: Array<{ id: string; name: string; type: string }>;
    gatewayKeys: Array<{ id: string; keyPrefix: string }>;
    controlPlaneHint: string;
    keysApiBaseUrl: string;
    loadError?: string;
    testingHistory: Promise<TestingVerdictEntry[]>;
  };

  $: resolveModelUrl =
    data.keysApiBaseUrl
      ? `${data.keysApiBaseUrl.replace(/\/$/, "")}/v1/testing/resolve-model`
      : "";

  $: envSnippet =
    data.testingProject != null && data.keysApiBaseUrl
      ? `RESTORMEL_KEYS_BASE=${data.keysApiBaseUrl.replace(/\/$/, "")}
RESTORMEL_GATEWAY_KEY=rk_…your_gateway_key
RESTORMEL_PROJECT_ID=${data.testingProject.id}`
      : "";

  /**
   * CI snippet for posting testing verdicts — matches the TestingVerdictIngest schema.
   * (ux-contracts §2: copy must be accurate; this references the real endpoint shape.)
   */
  $: verdictSnippet =
    data.testingProject != null && data.keysApiBaseUrl
      ? `curl -X POST "${data.keysApiBaseUrl.replace(/\/$/, "")}/connect/v1/testing/verdicts?workspace_id=<YOUR_WORKSPACE_ID>" \\
  -H "Authorization: Bearer rk_…your_gateway_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "schema_version": "1.0",
    "suite_id": "your-suite-id",
    "evaluated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "pass": true,
    "reasons": [],
    "source": "ci_action",
    "goals_passed": 8,
    "goals_total": 10,
    "artifact_ref": "https://example.com/release-pack.zip"
  }'`
      : "";
</script>

<svelte:head>
  <title>Restormel Testing – Restormel Keys</title>
</svelte:head>

<div class="testing-hub">
  <BrutalPageHeader
    title="Restormel Testing"
    description="Ingest run verdicts from your CI action and testing CLI — every suite run becomes a data point in this hub."
  />

  {#if data.loadError}
    <BrutalErrorBanner
      title="Could not load Testing project"
      message={data.loadError}
    >
      {#snippet actions()}
        <a class="btn btn-primary btn-sm" href={DASHBOARD_BASE + "/testing"}>Reload</a>
      {/snippet}
    </BrutalErrorBanner>
  {/if}

  {#if data.testingProject}
    <!-- ── Testing runs timeline (W3.8 hub surface) ───────────────────── -->
    <TestingTimeline history={data.testingHistory} />

    <!-- ── Project setup cards (remain below as setup help) ───────────── -->
    <h2 class="section-title">Setup</h2>

    <BrutalCard fill="white">
      <div class="setup-section" aria-labelledby="proj-heading">
        <h3 id="proj-heading" class="setup-heading">Project</h3>
        <dl class="kv">
          <dt>Project ID</dt>
          <dd><code class="mono">{data.testingProject.id}</code></dd>
          <dt>Environments</dt>
          <dd>
            <ul class="env-list">
              {#each data.environments as e}
                <li><code class="mono">{e.id}</code> — {e.name} ({e.type})</li>
              {/each}
            </ul>
          </dd>
        </dl>
      </div>
    </BrutalCard>

    <BrutalCard fill="white">
      <div class="setup-section" aria-labelledby="env-heading">
        <h3 id="env-heading" class="setup-heading">Environment variables (CI / local)</h3>
        <p class="hint">{data.controlPlaneHint}</p>
        <pre class="snippet" role="region" aria-label="Environment variables block">{envSnippet}</pre>
        <p class="muted">
          Resolve endpoint: <code class="mono">{resolveModelUrl}</code>
        </p>
      </div>
    </BrutalCard>

    <BrutalCard fill="white">
      <div class="setup-section" aria-labelledby="verdict-heading">
        <h3 id="verdict-heading" class="setup-heading">Post a verdict from CI</h3>
        <p class="hint">
          POST to <code class="mono">/connect/v1/testing/verdicts</code> using a
          <a href={DASHBOARD_BASE + "/access"}>Gateway key</a> to add a run to this hub's timeline.
          The <code class="mono">artifact_ref</code> field links to a release pack download
          when provided.
        </p>
        <pre class="snippet" role="region" aria-label="Verdict POST curl snippet">{verdictSnippet}</pre>
      </div>
    </BrutalCard>

    <BrutalCard fill="white">
      <div class="setup-section" aria-labelledby="evidence-heading">
        <h3 id="evidence-heading" class="setup-heading">Evidence and merge gates</h3>
        <p class="muted">
          Export a <strong>Release pack</strong> from CI to tie route/policy versions to
          acceptance results — see the
          <a href="/keys/docs/guides/release-pack-and-merge-gates">Release pack &amp; merge gates</a>
          guide and the example workflow
          <code class="mono">examples/github-actions/restormel-testing-merge-gate.yml</code>.
          GPU / private route smoke templates:
          <a href="/keys/docs/guides/testing-gpu-route-smoke">GPU route smoke (Testing)</a>.
        </p>
      </div>
    </BrutalCard>

    <BrutalCard fill="white">
      <div class="setup-section" aria-labelledby="keys-heading">
        <h3 id="keys-heading" class="setup-heading">Gateway keys for this project</h3>
        {#if data.gatewayKeys.length === 0}
          <p class="muted">
            Create a <a href={DASHBOARD_BASE + "/access"}>Gateway key</a> to authenticate the
            Testing CLI and CI action against this project.
          </p>
        {:else}
          <ul class="key-list">
            {#each data.gatewayKeys as k}
              <li><code class="mono">{k.keyPrefix}…</code></li>
            {/each}
          </ul>
        {/if}
      </div>
    </BrutalCard>
  {:else if !data.loadError}
    <!-- Signed-out or workspace unavailable — prompt sign-in (ux-contracts §2 CTA grammar) -->
    <BrutalCard fill="white">
      <p class="muted">
        Sign in to view your Restormel Testing project and run history.
      </p>
      <a class="btn btn-primary" href={DASHBOARD_BASE + "/login"}>Sign in with GitHub</a>
    </BrutalCard>
  {/if}
</div>

<style>
  .testing-hub {
    max-width: 52rem;
    padding: var(--space-6);
  }

  /* Section title for the setup block */
  .section-title {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
    margin: var(--space-6) 0 var(--space-3);
    color: var(--color-ink);
  }

  .setup-heading {
    font-size: var(--text-base);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    margin: 0 0 var(--space-3);
  }

  .kv {
    display: grid;
    grid-template-columns: 8rem 1fr;
    gap: var(--space-2) var(--space-4);
    margin: 0;
  }

  .kv dt {
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }

  .kv dd {
    margin: 0;
  }

  .mono {
    font-family: var(--rm-font-mono);
    font-size: 0.9em;
    word-break: break-all;
  }

  .snippet {
    background: var(--rm-surface-2);
    padding: var(--space-3);
    border: var(--border);
    font-size: var(--text-sm);
    overflow-x: auto;
    white-space: pre-wrap;
    font-family: var(--font-mono);
    margin: var(--space-2) 0 0;
  }

  .hint {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-2);
  }

  .muted {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-3);
  }

  .env-list,
  .key-list {
    margin: 0;
    padding-left: var(--space-5);
    font-size: var(--text-sm);
  }
</style>
