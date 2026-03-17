<script lang="ts">
  /** Phase 6 — Go live. Progressive disclosure: checklist + expandable steps. */
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { getWalkthroughPrevNext } from "$lib/docs-walkthrough-nav";
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";
  import WalkthroughChecklist from "$lib/components/walkthrough/WalkthroughChecklist.svelte";
  import WalkthroughStep from "$lib/components/walkthrough/WalkthroughStep.svelte";
  import WalkthroughPhaseNav from "$lib/components/walkthrough/WalkthroughPhaseNav.svelte";

  const { prev, next, stepOf } = getWalkthroughPrevNext("phase-6-golive");
  const phaseSlug = "phase-6-golive";

  const phase6Steps = [
    { id: "6.1", label: "Pre-cutover checklist" },
    { id: "6.2", label: "Enable the flag for a small percentage (parallel run)" },
    { id: "6.3", label: "Full cutover" },
    { id: "6.4", label: "Post-cutover verification" },
    { id: "6.5", label: "Remove legacy routing code" },
  ];

  const rolloutSnippet = `const RESTORMEL_ROLLOUT_PERCENT = parseInt(
  process.env.RESTORMEL_ROLLOUT_PERCENT ?? '0',
  10
);

export const USE_RESTORMEL_KEYS =
  process.env.USE_RESTORMEL_KEYS === 'true' ||
  (RESTORMEL_ROLLOUT_PERCENT > 0 && Math.random() * 100 < RESTORMEL_ROLLOUT_PERCENT);`;

  const cutoverEnvSnippet = `# In your production environment variables
USE_RESTORMEL_KEYS=true
RESTORMEL_ROLLOUT_PERCENT=100  # if using percentage-based rollout`;

  const doctorValidateSnippet = `npx @restormel/doctor
npx @restormel/validate`;
</script>

<svelte:head>
  <title>Phase 6 — Go live — Restormel Keys</title>
  <meta name="description" content="Parallel run, phased traffic shift, cutover, post-cutover verification, smoke test, legacy code removal." />
</svelte:head>

<div class="doc-content">
  <p class="doc-meta"><span class="doc-step">{stepOf}</span></p>
  <h1>Phase 6 — Go live</h1>
  <p class="doc-prereqs">
    <strong>Time:</strong> ~30 minutes (cutover) + monitoring period<br />
    <strong>Prerequisites:</strong> <a href="/keys/docs/walkthrough/phase-5-ui">Phase 5</a> complete (resolve, routes, policies, and UI all working with the feature flag on in development)<br />
    <strong>You'll need:</strong> Access to your deployment pipeline, monitoring/logging, the <a href={DASHBOARD_BASE}>Dashboard</a>
  </p>

  <p>This phase moves your Restormel Keys integration from development into production traffic. The strategy is conservative: parallel run, phased traffic shift, verify, then cut over fully. By the end, your production app resolves through Restormel and the legacy routing code is retired.</p>

  <WalkthroughStep stepId="6.1" title="Step 6.1 — Pre-cutover checklist" defaultOpen={true} {phaseSlug}>
  <p>Before enabling the feature flag in production, verify everything works in a staging or preview environment.</p>
  <table class="doc-table">
    <thead>
      <tr><th>Check</th><th>How to verify</th><th>Pass?</th></tr>
    </thead>
    <tbody>
      <tr><td>Resolve works</td><td><code>USE_RESTORMEL_KEYS=true</code> in staging; make AI requests; confirm correct provider/model</td><td>☐</td></tr>
      <tr><td>Fallback works</td><td>Remove a provider credential in dashboard; confirm resolve returns next step</td><td>☐</td></tr>
      <tr><td>Policy enforcement works</td><td>Request a blocked model; confirm it's rejected or falls through</td><td>☐</td></tr>
      <tr><td>Error fallback works</td><td>Set invalid Gateway Key; confirm legacy routing takes over</td><td>☐</td></tr>
      <tr><td>ModelSelector renders</td><td>Open settings page; confirm component loads and selection works</td><td>☐</td></tr>
      <tr><td>(If BYOK) KeyManager works</td><td>Add/remove a test key; confirm callbacks fire</td><td>☐</td></tr>
      <tr><td><code>keys doctor</code> passes</td><td>Run <code>npx @restormel/doctor</code> in the staging env</td><td>☐</td></tr>
      <tr><td><code>keys validate</code> passes</td><td>Run <code>npx @restormel/validate</code> to re-check stored keys</td><td>☐</td></tr>
      <tr><td>No secrets committed</td><td>Run <code>scripts/check-secrets.sh</code> or <code>git log --diff-filter=A -- '*.env'</code></td><td>☐</td></tr>
      <tr><td>Dashboard logs show requests</td><td>Check the project's usage/logs section in the dashboard</td><td>☐</td></tr>
    </tbody>
  </table>
  <div class="callout callout-pitfall">
    <strong>Pitfall</strong> — Do not skip the error fallback check. The most dangerous production failure mode is Restormel being unreachable and your app not falling back to legacy. Confirm this works before proceeding.
  </div>
  </WalkthroughStep>

  <WalkthroughStep stepId="6.2" title="Step 6.2 — Enable the flag for a small percentage (parallel run)" {phaseSlug}>
  <p>If your app supports percentage-based rollout (e.g. via LaunchDarkly, Vercel Edge Config, Cloudflare Workers, or a simple random check), start with a small percentage of traffic using Restormel.</p>
  <CodeBlock language="ts" code={rolloutSnippet} />
  <p><strong>Rollout sequence:</strong></p>
  <table class="doc-table">
    <thead>
      <tr><th>Step</th><th><code>RESTORMEL_ROLLOUT_PERCENT</code></th><th>What to watch</th></tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>5</td><td>Errors in logs, latency increase, correct provider in responses</td></tr>
      <tr><td>2</td><td>25</td><td>Same, at higher volume</td></tr>
      <tr><td>3</td><td>50</td><td>Compare Restormel path vs legacy path outcomes</td></tr>
      <tr><td>4</td><td>100</td><td>Full traffic through Restormel</td></tr>
    </tbody>
  </table>
  <p>If you don't have percentage-based rollout, use the boolean flag: <code>USE_RESTORMEL_KEYS=true</code> for the full cutover (Step 6.3).</p>
  <h3>You'll see</h3>
  <p>A mix of requests going through Restormel (your app logs include <code>providerType</code> / <code>modelId</code> from resolve) and legacy. The ratio roughly matches your rollout percentage.</p>
  <h3>How to test</h3>
  <p>Check your application logs. Requests that went through Restormel log the resolved provider and source. Requests that went through legacy log the legacy provider. Both succeed without user-facing errors.</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="6.3" title="Step 6.3 — Full cutover" {phaseSlug}>
  <p>When you're confident from the parallel run, enable Restormel for all traffic:</p>
  <CodeBlock language="bash" code={cutoverEnvSnippet} />
  <p>Deploy the env change. Monitor for 15–30 minutes.</p>
  <h3>You'll see</h3>
  <p>All AI requests resolve through Restormel. Your logs show the resolved <code>providerType</code> / <code>modelId</code> for every request. The dashboard shows request volume in the project's usage section.</p>
  <h3>How to test</h3>
  <p>Verify no requests are going through legacy (e.g. <code>grep -c '"source":"legacy"' /path/to/your/app.log</code> — expected 0). Check the dashboard: <strong>Projects → your project → Usage</strong>. Request counts match your expected traffic.</p>
  <div class="callout callout-tip">
    <strong>Tip</strong> — Keep the legacy fallback code in place for at least one release cycle after cutover. If something unexpected happens, you can flip the flag back to <code>false</code> and instantly restore the old behaviour.
  </div>
  </WalkthroughStep>

  <WalkthroughStep stepId="6.4" title="Step 6.4 — Post-cutover verification" {phaseSlug}>
  <p>Run a comprehensive check within the first hour after cutover.</p>
  <p><strong>CLI checks:</strong></p>
  <CodeBlock language="bash" code={doctorValidateSnippet} />
  <p><strong>Dashboard checks:</strong> Usage (request count non-zero and growing, no error spikes); Routes (traffic against configured routes); Policies (no unexpected violations); Provider credentials (all show "valid").</p>
  <p><strong>Application checks:</strong> Make a request through each major code path; confirm correct provider and model. Test fallback (temporarily remove a provider credential, confirm next step is used, restore). Test a policy block (request a model not on the allowlist). Check latency; resolve adds a network round-trip (typically &lt;100ms).</p>
  <p><strong>Smoke test script:</strong> Create a script that (1) calls the resolve endpoint and prints provider, model, explanation; (2) calls the policy evaluate endpoint for an allowed model; (3) runs <code>keys doctor</code>. Use <code>RESTORMEL_GATEWAY_KEY</code> and <code>RESTORMEL_MANAGEMENT_KEY</code> from the environment; never hardcode secrets.</p>
  <div class="build-agent-block">
    <h3>Build-agent prompt: create-smoke-test</h3>
    <p><strong>Context docs</strong> (adapt for your project): this page; <a href="/keys/docs/walkthrough/phase-2-resolve">Phase 2 — Resolve</a>; <a href="/keys/docs/walkthrough/phase-4-policies">Phase 4 — Policies</a>.</p>
    <p><strong>Goal:</strong> Create a post-cutover smoke test script. It must: call resolve and print provider/model/source; call policy evaluate for an allowed (and optionally blocked) model; run <code>keys doctor</code> and <code>keys validate</code>; read keys and project ID from env; exit 0 if all pass, 1 if any fail. Add <code>smoke:restormel</code> to <code>package.json</code> scripts.</p>
    <p><strong>DO NOT:</strong> Hardcode real API keys, project IDs, or URLs. Make the script destructive. Skip doctor/validate. Commit real secrets.</p>
    <p><strong>Gate:</strong> <code>pnpm run smoke:restormel</code> exits 0 in staging; script prints resolved provider and policy results; no secrets hardcoded.</p>
  </div>
  </WalkthroughStep>

  <WalkthroughStep stepId="6.5" title="Step 6.5 — Remove legacy routing code" {phaseSlug}>
  <p>Once you're confident Restormel is handling all traffic correctly (at least one full release cycle with the flag at 100%), clean up:</p>
  <ol>
    <li><strong>Remove the feature flag.</strong> The Restormel path is now the only path.</li>
    <li><strong>Remove the legacy resolve function.</strong> The legacy fallback in your resolve module is no longer needed.</li>
    <li><strong>Remove the inventory items marked "REMOVE" in Phase 0.</strong> Custom router, hardcoded model lists, custom fallback chains, custom model picker UI.</li>
    <li><strong>Remove unused env vars.</strong> Any <code>DEFAULT_MODEL</code>, <code>AI_PROVIDER</code>, or provider-specific routing env vars that Restormel replaces.</li>
    <li><strong>Keep the error fallback to a sensible default.</strong> Your resolve wrapper should still handle Restormel errors gracefully (e.g. return a hardcoded default or a user-facing error).</li>
  </ol>
  <div class="build-agent-block">
    <h3>Build-agent prompt: remove-legacy-routing</h3>
    <p><strong>Context docs</strong> (adapt for your project): this page (Step 6.5); <a href="/keys/docs/walkthrough/phase-0-inventory">Phase 0 — Inventory</a> ("REMOVE" items); <a href="/keys/docs/walkthrough/phase-2-resolve">Phase 2 — Resolve</a> (feature flag and legacy fallback to remove).</p>
    <p><strong>Goal:</strong> Remove legacy routing code. Delete every "REMOVE" item from the routing inventory. In the resolve module: remove the feature flag and <code>legacyResolve</code>; resolve always uses Restormel; keep try/catch with a safe default or user-facing error on failure. Remove the flag from <code>.env.example</code>. Remove replaced UI (custom model picker/BYOK). Remove unused routing env vars. Run tests and the smoke test.</p>
    <p><strong>DO NOT:</strong> Remove billing, auth, session, or orchestration code. Remove Restormel error handling. Remove env vars other parts of the app use. Remove the smoke test script. Commit real secrets.</p>
    <p><strong>Gate:</strong> All "REMOVE" items deleted; feature flag gone; <code>resolveProvider</code> always uses Restormel; tests and smoke test pass.</p>
  </div>
  </WalkthroughStep>

  <p><strong>Checkpoint checklist:</strong> mark each step complete as you finish it.</p>
  <WalkthroughChecklist phaseSlug={phaseSlug} steps={phase6Steps} />

  <h2>Checkpoint</h2>
  <p>You now have: production traffic resolving through Restormel Keys; a smoke test script for ongoing verification; (after Step 6.5) legacy routing code removed and Restormel as the single source of truth; the dashboard showing live traffic, route usage, and policy enforcement.</p>
  <p>Your integration is complete. For ongoing operations, see <a href="/keys/docs/walkthrough/verification-strategy">Verification strategy</a>.</p>

  <WalkthroughPhaseNav {prev} {next} {stepOf} />
</div>

<style>
  .doc-content { max-width: var(--rm-container-narrow); }
  .doc-meta { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-2); }
  .doc-step { font-weight: var(--font-medium); }
  .doc-prereqs { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-6); line-height: var(--leading-relaxed); }
  .doc-prereqs a { color: var(--rm-primary); }
  .doc-content h1 { font-family: var(--rm-font-display); font-size: var(--text-2xl); margin: 0 0 var(--space-4); }
  .doc-content h2 { font-size: var(--text-xl); margin: var(--space-8) 0 var(--space-3); }
  .doc-content h3 { font-size: var(--text-lg); margin: var(--space-4) 0 var(--space-2); }
  .doc-content p, .doc-content li { color: var(--rm-muted); line-height: var(--leading-relaxed); margin: 0 0 var(--space-4); }
  .doc-content ol { margin: 0 0 var(--space-4); padding-left: var(--space-5); }
  .doc-content li { margin-bottom: var(--space-2); }
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
  .build-agent-block {
    margin: var(--space-6) 0;
    padding: var(--space-4);
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
  }
  .build-agent-block h3 { margin-top: 0; }
</style>
