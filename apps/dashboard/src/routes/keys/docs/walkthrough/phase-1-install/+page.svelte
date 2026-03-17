<script lang="ts">
  /** Phase 1 — Install and configure. Progressive disclosure: checklist + expandable steps. */
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { getWalkthroughPrevNext } from "$lib/docs-walkthrough-nav";
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";
  import WalkthroughChecklist from "$lib/components/walkthrough/WalkthroughChecklist.svelte";
  import WalkthroughStep from "$lib/components/walkthrough/WalkthroughStep.svelte";
  import WalkthroughPhaseNav from "$lib/components/walkthrough/WalkthroughPhaseNav.svelte";

  const { prev, next, stepOf } = getWalkthroughPrevNext("phase-1-install");
  const phaseSlug = "phase-1-install";

  const phase1Steps = [
    { id: "1.1", label: "Install the packages" },
    { id: "1.2", label: "Scaffold with the CLI" },
    { id: "1.3", label: "Create a project in the Dashboard" },
    { id: "1.4", label: "Generate a Gateway Key" },
    { id: "1.5", label: "Configure provider credentials (optional)" },
    { id: "1.6", label: "Run keys doctor again" },
    { id: "1.7", label: "Add env var placeholders to .env.example" },
  ];

  const esmCheckCmd =
    "node --input-type=module -e \"import { createKeys } from '@restormel/keys'; console.log('OK: createKeys is', typeof createKeys)\"";

  const confirmPackageCmd =
    "# Confirm the package installed correctly\nnode -e \"const k = require('@restormel/keys'); console.log('OK:', Object.keys(k).length, 'exports')\"";

  const doctorTestCmd = 'npx @restormel/doctor && echo "PASS" || echo "FAIL"';
</script>

<svelte:head>
  <title>Phase 1 — Install and configure — Restormel Keys</title>
  <meta name="description" content="Install Restormel Keys packages, create a project in the dashboard, generate a Gateway Key, run keys doctor." />
</svelte:head>

<div class="doc-content">
  <p class="doc-meta"><span class="doc-step">{stepOf}</span></p>
  <h1>Phase 1 — Install and configure</h1>
  <p class="doc-prereqs">
    <strong>Time:</strong> ~15 minutes<br />
    <strong>Prerequisites:</strong> <a href="/keys/docs/walkthrough/phase-0-inventory">Phase 0</a> complete (routing inventory exists), a Restormel Keys account<br />
    <strong>You'll need:</strong> Terminal access, your app's package manager (pnpm, npm, or yarn), access to the <a href={DASHBOARD_BASE}>Dashboard</a>
  </p>

  <p>This phase gets the Restormel Keys packages into your project and creates the dashboard-side resources (workspace, project, environment, Gateway Key) that later phases depend on. By the end, <code>keys doctor</code> passes (framework, packages, and local config) and your dashboard shows a project ready for routes and policies. The CLI does not validate Cloud env vars (e.g. <code>RESTORMEL_GATEWAY_KEY</code>, <code>RESTORMEL_PROJECT_ID</code>) today — you verify those in Phase 2 when you make your first resolve call.</p>

  <WalkthroughStep stepId="1.1" title="Step 1.1 — Install the packages" defaultOpen={true} {phaseSlug}>
  <p>Choose the packages for your framework. The headless core (<code>@restormel/keys</code>) is always required. Add UI packages if you plan to embed ModelSelector or KeyManager (Phase 5).</p>
  <p><strong>Next.js / React:</strong></p>
  <CodeBlock language="bash" code="pnpm add @restormel/keys @restormel/keys-react @restormel/keys-elements" />
  <p><strong>SvelteKit:</strong></p>
  <CodeBlock language="bash" code="pnpm add @restormel/keys @restormel/keys-svelte" />
  <p><strong>Vanilla / Astro / Web Components:</strong></p>
  <CodeBlock language="bash" code="pnpm add @restormel/keys @restormel/keys-elements" />
  <p><strong>Server-only (no UI, just resolve):</strong></p>
  <CodeBlock language="bash" code="pnpm add @restormel/keys" />
  <div class="callout callout-tip">
    <strong>Tip</strong> — Not sure which packages you need? See <a href="/keys/docs/compatibility">Framework compatibility</a> for the full decision tree. If you only need server-side resolution and no embedded UI, the headless core is enough.
  </div>
  <h3>You'll see</h3>
  <p>The packages appear in your <code>package.json</code> dependencies. No build errors.</p>
  <h3>How to test</h3>
  <CodeBlock language="bash" code={confirmPackageCmd} />
  <p>If you use ESM (<code>"type": "module"</code> in your <code>package.json</code>):</p>
  <CodeBlock language="bash" code={esmCheckCmd} />
  </WalkthroughStep>

  <WalkthroughStep stepId="1.2" title="Step 1.2 — Scaffold with the CLI" {phaseSlug}>
  <p>The CLI generates a starter config and validates your setup. If you prefer to configure manually, skip to Step 1.3.</p>
  <CodeBlock language="bash" code="npx @restormel/keys-cli init" />
  <p>The <code>init</code> command detects your framework, suggests the right packages (confirming what you installed in 1.1), and creates a <code>restormel.config.json</code> in your project root.</p>
  <h3>You'll see</h3>
  <p>Interactive prompts asking for your framework, which providers you use, and your preferred storage adapter. On completion:</p>
  <CodeBlock language="text" code={`✔ Detected framework: Next.js (App Router)
✔ Created restormel.config.json
✔ Suggested packages: @restormel/keys, @restormel/keys-react, @restormel/keys-elements

Run 'keys doctor' to verify your setup.`} />
  <h3>How to test</h3>
  <CodeBlock language="bash" code="npx @restormel/doctor" />
  <p><code>doctor</code> checks framework detection, package versions, config validity, and key health. At this point it should pass with a note that no Gateway Key is configured yet (that's Step 1.4).</p>
  <div class="callout callout-note">
    <strong>If you see "framework not detected"</strong> — The CLI looks for framework markers (<code>next.config.*</code>, <code>svelte.config.*</code>, <code>astro.config.*</code>). If your project uses a non-standard layout, run <code>keys init --framework next</code> (or <code>sveltekit</code>, <code>react</code>, <code>astro</code>) to specify manually.
  </div>
  </WalkthroughStep>

  <WalkthroughStep stepId="1.3" title="Step 1.3 — Create a project in the Dashboard" {phaseSlug}>
  <p>Open the <a href={DASHBOARD_BASE}>Dashboard</a> and sign in with GitHub.</p>
  <ol>
    <li><strong>Create a workspace</strong> (if you don't have one). This is your top-level organisational container. Name it after your company or team.</li>
    <li><strong>Create a project.</strong> Name it after your app (e.g. "My Writing Tool"). The project is where routes, policies, and keys live.</li>
    <li><strong>Create an environment</strong> within the project: <code>production</code>. You can add <code>staging</code> later. The environment scopes routes and policies to a deployment context.</li>
  </ol>
  <div class="callout callout-note">
    <strong>Dashboard</strong> — Workspace → Projects → <strong>Create project</strong> → name it → <strong>Environments</strong> → <strong>Create environment</strong> → name it <code>production</code>.
  </div>
  <h3>You'll see</h3>
  <p>The project detail page in the dashboard with: project name and ID; an "Environments" section showing <code>production</code>; empty "Routes" and "Policies" sections (you'll fill these in Phases 3–4); an "API Keys" section (you'll generate a Gateway Key next).</p>
  <h3>How to test</h3>
  <p>The project detail page loads without errors. The environment <code>production</code> is listed.</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="1.4" title="Step 1.4 — Generate a Gateway Key" {phaseSlug}>
  <p>Still in the Dashboard, on your project detail page:</p>
  <ol>
    <li>Click <strong>Generate API key</strong> (or navigate to the API Keys section).</li>
    <li>Copy the full key immediately. It has the format <code>rk_…</code> and is shown only once.</li>
    <li>Store it securely. This is your <strong>Gateway Key</strong> — the credential your backend uses to authenticate to the Restormel resolve API.</li>
  </ol>
  <div class="callout callout-security">
    <strong>Security</strong> — The Gateway Key is a secret. Store it in your environment variables or secret manager. Never commit it to your repo, paste it into a coding agent, or log it in application output.
  </div>
  <h3>You'll see</h3>
  <p>A key displayed once with a "Copy" button. After you navigate away, you see only the key prefix (e.g. <code>rk_a3f…</code>) in the dashboard — the full key is not retrievable.</p>
  <h3>How to test</h3>
  <p>You test the key works in Phase 2 when you make your first resolve call. For now, confirm it's stored:</p>
  <CodeBlock language="bash" code={`# Add to your .env (gitignored) — NOT .env.example
# RESTORMEL_GATEWAY_KEY=rk_your_key_here
# RESTORMEL_PROJECT_ID=your_project_id_here
# RESTORMEL_ENVIRONMENT_ID=production`} />
  <p>Update <code>.env.example</code> with placeholder names (no values):</p>
  <CodeBlock language="bash" code={`# .env.example
RESTORMEL_GATEWAY_KEY=
RESTORMEL_PROJECT_ID=
RESTORMEL_ENVIRONMENT_ID=`} />
  </WalkthroughStep>

  <WalkthroughStep stepId="1.5" title="Step 1.5 — Configure provider credentials (optional)" {phaseSlug}>
  <p>If your app uses <strong>platform keys</strong> (your own OpenAI/Anthropic/Google keys, not user-provided BYOK), you can add them as provider credentials in the dashboard now. This is optional — you can also continue using your existing env vars and let Restormel resolve point to the provider while you supply the key yourself.</p>
  <p>To add provider credentials in the dashboard: in your project, go to <strong>Provider Credentials</strong>; click <strong>Add credential</strong>, choose the provider (e.g. OpenAI), paste your API key; Restormel validates the key and stores it encrypted.</p>
  <p>If you prefer to keep provider keys in your own env vars and only use Restormel for routing decisions, skip this step. The resolve response tells you <em>which</em> provider to call; you can supply the key from your own env.</p>
  <h3>You'll see</h3>
  <p>The credential listed in the dashboard with the provider name and a masked key preview. Validation status shows green if the key is valid.</p>
  <h3>How to test</h3>
  <p>No code-level test yet. The dashboard shows the credential as valid.</p>
  </WalkthroughStep>

  <WalkthroughStep stepId="1.6" title="Step 1.6 — Run keys doctor again" {phaseSlug}>
  <p>Now that you have a config (and optionally env vars), run the doctor check again:</p>
  <CodeBlock language="bash" code="npx @restormel/doctor" />
  <h3>You'll see</h3>
  <p><code>keys doctor</code> checks framework detection, package versions, and config validity. Example output:</p>
  <CodeBlock language="text" code={`✔ Framework: Next.js (App Router)
✔ Packages: @restormel/keys@0.2.0, @restormel/keys-react@0.1.0, @restormel/keys-elements@0.1.0
✔ Config: restormel.config.json valid

All checks passed.`} />
  <p>Cloud env vars (<code>RESTORMEL_GATEWAY_KEY</code>, <code>RESTORMEL_PROJECT_ID</code>, <code>RESTORMEL_ENVIRONMENT_ID</code>) are not validated by the CLI. You confirm they work in Phase 2 when you call the resolve endpoint.</p>
  <h3>How to test</h3>
  <CodeBlock language="bash" code={doctorTestCmd} />
  <div class="callout callout-pitfall">
    <strong>Pitfall</strong> — If <code>doctor</code> reports missing packages, install them (Step 1.1). If it reports a missing config, run <code>keys init</code> (Step 1.2). For resolve to work in Phase 2, ensure your <code>.env</code> (or secret manager) has the Gateway Key and project/environment IDs and that your app loads them at runtime.
  </div>
  </WalkthroughStep>

  <WalkthroughStep stepId="1.7" title="Step 1.7 — Add env var placeholders to .env.example" {phaseSlug}>
  <p>Make sure your repo's <code>.env.example</code> documents the new variables so collaborators know what to set:</p>
  <CodeBlock language="bash" code={`# .env.example — Restormel Keys integration
RESTORMEL_GATEWAY_KEY=
RESTORMEL_PROJECT_ID=
RESTORMEL_ENVIRONMENT_ID=
# Optional: feature flag for phased rollout (see Phase 0)
USE_RESTORMEL_KEYS=false`} />
  </WalkthroughStep>

  <p><strong>Checkpoint checklist:</strong> mark each step complete as you finish it.</p>
  <WalkthroughChecklist phaseSlug={phaseSlug} steps={phase1Steps} />

  <h2>Checkpoint</h2>
  <p>You now have:</p>
  <ul>
    <li>Restormel Keys packages installed in your project.</li>
    <li>A <code>restormel.config.json</code> that matches your framework.</li>
    <li>A project and environment created in the Restormel Dashboard.</li>
    <li>A Gateway Key stored in your <code>.env</code> (gitignored).</li>
    <li><code>keys doctor</code> passing.</li>
  </ul>
  <p>Your app still runs on the old routing path (the feature flag from Phase 0 is still <code>false</code>). Nothing has changed in your application behaviour.</p>

  <WalkthroughPhaseNav {prev} {next} {stepOf} />
</div>

<style>
  .doc-content {
    max-width: var(--rm-container-narrow);
  }
  .doc-meta { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-2); }
  .doc-step { font-weight: var(--font-medium); }
  .doc-prereqs { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-6); line-height: var(--leading-relaxed); }
  .doc-prereqs a { color: var(--rm-primary); }
  .doc-content h1 { font-family: var(--rm-font-display); font-size: var(--text-2xl); margin: 0 0 var(--space-4); }
  .doc-content h2 { font-size: var(--text-xl); margin: var(--space-8) 0 var(--space-3); }
  .doc-content h3 { font-size: var(--text-lg); margin: var(--space-4) 0 var(--space-2); }
  .doc-content p, .doc-content li { color: var(--rm-muted); line-height: var(--leading-relaxed); margin: 0 0 var(--space-4); }
  .doc-content ul, .doc-content ol { margin: 0 0 var(--space-4); padding-left: var(--space-5); }
  .doc-content li { margin-bottom: var(--space-2); }
</style>
