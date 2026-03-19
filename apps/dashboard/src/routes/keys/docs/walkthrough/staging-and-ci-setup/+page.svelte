<script lang="ts">
  /** Staging and CI setup — public walkthrough guide. Per-secret: where to get it, what to call it, where to save it, rotate/replace. */
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { getWalkthroughPrevNext } from "$lib/docs-walkthrough-nav";
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";
  import WalkthroughStep from "$lib/components/walkthrough/WalkthroughStep.svelte";
  import WalkthroughPhaseNav from "$lib/components/walkthrough/WalkthroughPhaseNav.svelte";

  const { prev, next, stepOf } = getWalkthroughPrevNext("staging-and-ci-setup");
  const phaseSlug = "staging-and-ci-setup";

  const steps = [
    { id: "create", label: "1. What to create in Restormel" },
    { id: "secrets", label: "2. Each secret: get it, name it, save it, rotate" },
    { id: "nightly", label: "3. Configure nightly CI" },
    { id: "postdeploy", label: "4. Configure post-deploy" },
    { id: "phased", label: "5. Recommended minimum (phased)" },
    { id: "workflow", label: "6. Workflow file changes (optional)" },
  ];

  const ghSecret = "$" + "{{ secrets.RESTORMEL_GATEWAY_KEY_STAGING }}";
  const nightlySnippet =
    "env:\n  RESTORMEL_GATEWAY_KEY: $" +
    "{{ secrets.RESTORMEL_GATEWAY_KEY_STAGING }}\n  RESTORMEL_PROJECT_ID: $" +
    "{{ secrets.RESTORMEL_PROJECT_ID_STAGING }}\n  RESTORMEL_ENVIRONMENT_ID: $" +
    "{{ secrets.RESTORMEL_ENVIRONMENT_ID_STAGING }}\n\n# then:\nrun: npx @restormel/validate\n# optionally: pnpm run smoke:restormel";
</script>

<svelte:head>
  <title>Staging and CI setup — Restormel Keys</title>
  <meta name="description" content="Non-production Restormel setup: where to get each secret, what to call it, where to save it, and how to rotate or replace it." />
</svelte:head>

<div class="doc-content">
  <p class="doc-meta"><span class="doc-step">{stepOf}</span></p>
  <h1>Staging and CI setup</h1>
  <p class="doc-intro">Set up a <strong>non-production</strong> Restormel target and wire it into your app’s CI. For each secret you get: <strong>where to get it</strong>, <strong>what to call it</strong>, <strong>where to save it</strong>, and <strong>how to rotate or replace it</strong>.</p>
  <p>Dashboard: <a href={DASHBOARD_BASE}>{DASHBOARD_BASE}</a>. Do not point CI at production unless you explicitly accept that risk.</p>

  <table class="doc-table doc-table-compact">
    <thead>
      <tr><th>Goal</th><th>In Restormel</th><th>In your repo (e.g. GitHub)</th></tr>
    </thead>
    <tbody>
      <tr><td><strong>Minimum</strong> (PR doctor + validate)</td><td>Project + env + Gateway Key</td><td><code>RESTORMEL_GATEWAY_KEY_STAGING</code>, <code>RESTORMEL_PROJECT_ID_STAGING</code>, <code>RESTORMEL_ENVIRONMENT_ID_STAGING</code></td></tr>
      <tr><td><strong>+ Smoke tests</strong></td><td>Route ID</td><td><code>RESTORMEL_SMOKE_ROUTE_ID_STAGING</code></td></tr>
      <tr><td><strong>+ Blocked-model test</strong></td><td>Model/provider policies reject</td><td><code>RESTORMEL_SMOKE_BLOCKED_MODEL_ID_STAGING</code>, <code>RESTORMEL_SMOKE_BLOCKED_PROVIDER_TYPE_STAGING</code></td></tr>
    </tbody>
  </table>

  <WalkthroughStep stepId="create" title="1. What to create in Restormel" defaultOpen={true} {phaseSlug}>
  <p>Create these in the Dashboard before storing secrets.</p>
  <ul>
    <li><strong>Non-production project or environment</strong> — Prefer a dedicated staging project; or add a <code>staging</code> environment to your existing project.</li>
    <li><strong>Route for smoke tests</strong> (if you will run smoke) — Note the route ID (e.g. <code>interactive</code>) from Project → Routes.</li>
    <li><strong>Optional blocked-model pair</strong> — A model + provider your staging policies reject (e.g. a model not on the allowlist).</li>
  </ul>
  </WalkthroughStep>

  <WalkthroughStep stepId="secrets" title="2. Each secret: where to get it, what to call it, where to save it, rotate/replace" {phaseSlug}>
  <p>Store secrets in your app repo: <strong>Settings → Secrets and variables → Actions → New repository secret</strong>. In workflows, map them to env vars (e.g. <code>RESTORMEL_GATEWAY_KEY: {ghSecret}</code>). GCP Secret Manager: same names, inject in the workflow as you do for app secrets.</p>

  <h3>Gateway Key (required)</h3>
  <table class="doc-table doc-secret-table">
    <tbody>
    <tr><th>Where to get it</th><td>Dashboard → staging project → <strong>API Keys</strong> → Generate key. Copy the <code>rk_...</code> value (shown once).</td></tr>
    <tr><th>What to call it</th><td><code>RESTORMEL_GATEWAY_KEY_STAGING</code>. Workflow passes as <code>RESTORMEL_GATEWAY_KEY</code>.</td></tr>
    <tr><th>Where to save it</th><td>GitHub: New repository secret, name <code>RESTORMEL_GATEWAY_KEY_STAGING</code>, value = the key. Or GCP Secret Manager.</td></tr>
    <tr><th>Rotate or replace</th><td>Dashboard → same project → API Keys → revoke old, generate new. Update the secret <em>value</em> in GitHub/GCP. No code change.</td></tr>
    </tbody>
  </table>

  <h3>Project ID (required)</h3>
  <table class="doc-table doc-secret-table">
    <tbody>
    <tr><th>Where to get it</th><td>Dashboard → staging project → project settings or URL. Copy the project <strong>UUID</strong>.</td></tr>
    <tr><th>What to call it</th><td><code>RESTORMEL_PROJECT_ID_STAGING</code>. Workflow passes as <code>RESTORMEL_PROJECT_ID</code>.</td></tr>
    <tr><th>Where to save it</th><td>New repository secret <code>RESTORMEL_PROJECT_ID_STAGING</code>, value = project UUID. Or GCP.</td></tr>
    <tr><th>Rotate or replace</th><td>Project IDs don’t rotate. If you replace the staging project, update the secret with the new project’s UUID. No code change.</td></tr>
    </tbody>
  </table>

  <h3>Environment ID (required)</h3>
  <table class="doc-table doc-secret-table">
    <tbody>
    <tr><th>Where to get it</th><td>Dashboard → same project → <strong>Environments</strong>. Copy the staging environment’s ID (slug or UUID, e.g. <code>staging</code>).</td></tr>
    <tr><th>What to call it</th><td><code>RESTORMEL_ENVIRONMENT_ID_STAGING</code>. Workflow passes as <code>RESTORMEL_ENVIRONMENT_ID</code>.</td></tr>
    <tr><th>Where to save it</th><td>New repository secret <code>RESTORMEL_ENVIRONMENT_ID_STAGING</code>. Or GCP.</td></tr>
    <tr><th>Rotate or replace</th><td>If you replace the staging environment, update the secret with the new environment ID. No code change.</td></tr>
    </tbody>
  </table>

  <h3>Smoke route ID (optional)</h3>
  <table class="doc-table doc-secret-table">
    <tbody>
    <tr><th>Where to get it</th><td>Dashboard → same project → <strong>Routes</strong> → open the route (e.g. interactive). Copy the <strong>route ID</strong> (often the slug).</td></tr>
    <tr><th>What to call it</th><td><code>RESTORMEL_SMOKE_ROUTE_ID_STAGING</code> or <code>RESTORMEL_ANALYSE_ROUTE_ID_STAGING</code>. Workflow passes as <code>RESTORMEL_SMOKE_ROUTE_ID</code>.</td></tr>
    <tr><th>Where to save it</th><td>New repository secret with that name. Or GCP.</td></tr>
    <tr><th>Rotate or replace</th><td>If you rename or use a different route, update the secret with the new route ID. No code change if script reads env.</td></tr>
    </tbody>
  </table>

  <h3>Blocked model ID (optional)</h3>
  <table class="doc-table doc-secret-table">
    <tbody>
    <tr><th>Where to get it</th><td>Pick a <strong>model ID</strong> your staging policies block (e.g. <code>gpt-3.5-turbo</code>). Confirm via evaluate or Dashboard.</td></tr>
    <tr><th>What to call it</th><td><code>RESTORMEL_SMOKE_BLOCKED_MODEL_ID_STAGING</code>. Workflow passes as <code>RESTORMEL_SMOKE_BLOCKED_MODEL_ID</code>.</td></tr>
    <tr><th>Where to save it</th><td>New repository secret, value e.g. <code>gpt-3.5-turbo</code>. Or GCP.</td></tr>
    <tr><th>Rotate or replace</th><td>If policies change and this model becomes allowed, pick another blocked model and update the secret. No code change.</td></tr>
    </tbody>
  </table>

  <h3>Blocked provider type (optional)</h3>
  <table class="doc-table doc-secret-table">
    <tbody>
    <tr><th>Where to get it</th><td>The <strong>provider type</strong> for the blocked model (e.g. <code>openai</code>, <code>anthropic</code>).</td></tr>
    <tr><th>What to call it</th><td><code>RESTORMEL_SMOKE_BLOCKED_PROVIDER_TYPE_STAGING</code>. Workflow passes as <code>RESTORMEL_SMOKE_BLOCKED_PROVIDER_TYPE</code>.</td></tr>
    <tr><th>Where to save it</th><td>New repository secret, value e.g. <code>openai</code>. Or GCP.</td></tr>
    <tr><th>Rotate or replace</th><td>Update if you change the blocked model to one from a different provider. No code change.</td></tr>
    </tbody>
  </table>

  <h3>Keys base URL (optional; usually omit)</h3>
  <table class="doc-table doc-secret-table">
    <tbody>
    <tr><th>Where to get it</th><td>Default is <code>https://restormel.dev</code>. Only set if you use a different API host.</td></tr>
    <tr><th>What to call it</th><td><code>RESTORMEL_KEYS_BASE_STAGING</code>. Workflow passes as <code>RESTORMEL_KEYS_BASE</code>.</td></tr>
    <tr><th>Where to save it</th><td>GitHub or GCP. Omit if using default.</td></tr>
    <tr><th>Rotate or replace</th><td>Only if the API host changes. Update the secret. No code change.</td></tr>
    </tbody>
  </table>
  </WalkthroughStep>
  <WalkthroughStep stepId="nightly" title="3. Configure scheduled CI (nightly)" {phaseSlug}>
  <p>In your nightly workflow (e.g. <code>nightly-gate-audit.yml</code>), add env from staging secrets and run:</p>
  <CodeBlock language="yaml" code={nightlySnippet} />
  <p>Add <code>smoke:restormel</code> to nightly only if staging is stable and you're comfortable with nightly traffic hitting it.</p>
  </WalkthroughStep>


  <WalkthroughStep stepId="postdeploy" title="4. Configure post-deploy" {phaseSlug}>
  <p><strong>Safer at first:</strong> After deploy, an operator runs <code>pnpm run smoke:restormel</code> manually and checks the dashboard.</p>
  <p><strong>Automated:</strong> Add a post–health-check step in deploy; inject staging secrets; run <code>pnpm run smoke:restormel</code>. Don’t make it deploy-blocking until the path and staging project are reliably healthy.</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="phased" title="5. Recommended minimum setup (phased)" {phaseSlug}>
  <ul>
    <li><strong>Phase A</strong> — Secrets: <code>RESTORMEL_GATEWAY_KEY_STAGING</code>, <code>RESTORMEL_PROJECT_ID_STAGING</code>, <code>RESTORMEL_ENVIRONMENT_ID_STAGING</code>. Enough for PR doctor and <code>npx @restormel/validate</code>.</li>
    <li><strong>Phase B</strong> — Add <code>RESTORMEL_SMOKE_ROUTE_ID_STAGING</code>. Enough for post-deploy or nightly <code>pnpm run smoke:restormel</code>.</li>
    <li><strong>Phase C</strong> — Add <code>RESTORMEL_SMOKE_BLOCKED_MODEL_ID_STAGING</code> and <code>RESTORMEL_SMOKE_BLOCKED_PROVIDER_TYPE_STAGING</code> after staging policies are stable.</li>
  </ul>
  </WalkthroughStep>

  <WalkthroughStep stepId="workflow" title="6. Workflow file changes (optional)" {phaseSlug}>
  <p>Nightly: add staging env and <code>npx @restormel/validate</code> (and optionally <code>pnpm run smoke:restormel</code>) to <code>nightly-gate-audit.yml</code> or equivalent. Post-deploy: add an optional step to <code>deploy.yml</code> that injects secrets and runs <code>pnpm run smoke:restormel</code>; don’t gate deploys on it until you’re confident.</p>
  <p>See <a href="/keys/docs/walkthrough/verification-strategy">Verification strategy</a> for CLI and smoke details; <a href="/keys/docs/walkthrough/phase-6-golive">Phase 6 — Go live</a> for the smoke script.</p>
  </WalkthroughStep>

  <p class="doc-footer">See the <a href="/keys/docs/walkthrough">Walkthrough</a> index for the full phase listing.</p>
  <WalkthroughPhaseNav {prev} {next} {stepOf} />
</div>

<style>
  .doc-content { max-width: var(--rm-container-narrow); }
  .doc-meta { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-2); }
  .doc-step { font-weight: var(--font-medium); }
  .doc-intro { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-4); }
  .doc-content h1 { font-family: var(--rm-font-display); font-size: var(--text-2xl); margin: 0 0 var(--space-4); }
  .doc-content h3 { font-size: var(--text-lg); margin: var(--space-4) 0 var(--space-2); }
  .doc-content p { color: var(--rm-muted); line-height: var(--leading-relaxed); margin: 0 0 var(--space-4); }
  .doc-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 var(--space-4);
    font-size: var(--text-sm);
  }
  .doc-table th, .doc-table td {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rm-border);
    text-align: left;
  }
  .doc-table th { background: var(--rm-surface-raised); font-weight: var(--font-medium); }
  .doc-table td { color: var(--rm-muted); }
  .doc-table code { font-family: var(--rm-font-ui); font-size: 0.9em; }
  .doc-table-compact td { padding: var(--space-1) var(--space-2); }
  .doc-secret-table th { width: 10em; vertical-align: top; }
  .doc-footer { margin-top: var(--space-6); font-size: var(--text-sm); color: var(--rm-muted); }
  .doc-footer a { color: var(--rm-primary); }
</style>
