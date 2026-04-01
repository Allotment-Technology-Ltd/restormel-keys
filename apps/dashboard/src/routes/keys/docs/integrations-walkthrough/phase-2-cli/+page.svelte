<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { getIntegrationsWalkthroughPrevNext } from "$lib/docs-integrations-walkthrough-nav";
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";
  import AgentPromptsSection from "$lib/components/walkthrough/AgentPromptsSection.svelte";
  import WalkthroughPhaseNav from "$lib/components/walkthrough/WalkthroughPhaseNav.svelte";

  const { prev, next, stepOf } = getIntegrationsWalkthroughPrevNext("phase-2-cli");

  const agentPrompts = [
    {
      id: "i03-cli-install",
      title: "Prompt I03 — Install CLI and run doctor",
      intent: "Install @restormel/keys-cli and run doctor so it exits 0.",
      contextDocs: [
        "This page: /keys/docs/integrations-walkthrough/phase-2-cli",
        "packages/cli/README.md",
      ],
      prompt: `You are working in [your app repo]. Goal: Install the Restormel Keys CLI and run doctor so it exits 0. Steps: 1) Add @restormel/keys-cli as dev dependency. 2) Ensure restormel.config.json exists (or npx keys init). 3) Run npx keys doctor — exit 0. 4) Document in README: "Restormel CLI: run npx keys doctor to validate setup." DO NOT: Commit secrets. Install CLI globally unless user wants global.`,
      gate: "npx keys doctor exits 0; CLI is documented.",
    },
    {
      id: "i03b-cli-device-login",
      title: "Prompt I03b — Device login (optional)",
      intent: "Use keys login or document Copy .env snippet for RESTORMEL_* vars.",
      contextDocs: [
        "This page: /keys/docs/integrations-walkthrough/phase-2-cli",
        "Dashboard: Gateway keys, Connect CLI",
      ],
      prompt: `You are working in [your app repo]. Goal: Obtain RESTORMEL_GATEWAY_KEY and RESTORMEL_PROJECT_ID without pasting secrets into chat. Choose one path: (A) Run npx @restormel/keys-cli login --write-env .env.local and complete Connect CLI in the browser. (B) Dashboard → Gateway keys → create key → Copy .env snippet into .env.local. DO NOT: Commit .env.local or paste raw keys into README or issues.`,
      gate: ".env.local (or equivalent) exists locally with RESTORMEL_GATEWAY_KEY and RESTORMEL_PROJECT_ID; not committed.",
    },
    {
      id: "i04-cli-models-routing",
      title: "Prompt I04 — Models list and routing explain",
      intent: "Verify keys models list and keys routing explain work.",
      contextDocs: ["This page: /keys/docs/integrations-walkthrough/phase-2-cli"],
      prompt: `You are working in [your app repo]. Goal: Verify CLI commands keys models list and keys routing explain <model> work. Steps: 1) Run npx keys models list — see at least one provider. 2) Run npx keys routing explain gpt-4o (or a model from the list). 3) Add to docs: "Use keys models list and keys routing explain <model>." DO NOT: Assume a specific model exists.`,
      gate: "Both commands run successfully; docs updated.",
    },
  ];
</script>

<svelte:head>
  <title>Phase 2 — CLI — Integrations walkthrough</title>
  <meta
    name="description"
    content="Install the CLI, optional device login or env snippet, doctor, validate, models list, routing explain."
  />
</svelte:head>

<div class="doc-content">
  <p class="doc-meta"><span class="doc-step">{stepOf}</span></p>
  <h1>Phase 2 — CLI</h1>
  <p class="doc-prereqs">
    <strong>Time:</strong> ~10 minutes<br />
    <strong>Prerequisites:</strong> <a href="/keys/docs/integrations-walkthrough/phase-1-choose-workflow">Phase 1</a> complete; you chose "In my terminal" or want CLI<br />
    <strong>You'll need:</strong> Terminal, Node 18+, npm or pnpm
  </p>

  <p>
    This phase installs the Restormel Keys CLI and runs doctor, validate, models list, and routing explain so you can
    debug and inspect from the terminal. You can also link a Gateway key with <strong>device login</strong> or the
    dashboard <strong>Copy .env snippet</strong> action.
  </p>

  <h2>Step 2.1 — Install the CLI</h2>
  <CodeBlock language="bash" code="npm install -g @restormel/keys-cli" label="CLI" />
  <p>Or as a dev dependency:</p>
  <CodeBlock language="bash" code="pnpm add -D @restormel/keys-cli" label="CLI" />
  <p>
    Then run via <code>npx keys</code> or <code>pnpm exec keys</code>. You'll see <code>keys --help</code> with init,
    login, add, list, validate, doctor, estimate, sync, models, routing, catalog, patch.
  </p>

  <h2>Step 2.2 — Link your project (device login, optional)</h2>
  <p>
    Run <code>npx @restormel/keys-cli login</code>, open the printed URL while signed in, enter the user code, and pick
    a project. Restormel creates a new Gateway key and shows an env block in the terminal. Optional:
  </p>
  <CodeBlock
    language="bash"
    code="npx @restormel/keys-cli login --write-env .env.local"
    label="CLI"
  />
  <p>
    Or use <a href={DASHBOARD_BASE + "/access"}>Gateway keys</a> → create a key → <strong>Copy .env snippet</strong> for
    <code>RESTORMEL_GATEWAY_KEY</code>, <code>RESTORMEL_PROJECT_ID</code>, and <code>RESTORMEL_KEYS_BASE</code>. Approve
    terminal linking at <a href={DASHBOARD_BASE + "/cli/connect"}>Connect CLI</a>.
  </p>

  <h2>Step 2.3 — Run doctor</h2>
  <p>From your app directory (where <code>restormel.config.json</code> lives):</p>
  <CodeBlock language="bash" code="npx keys doctor" label="CLI" />
  <p>Doctor checks framework, @restormel/keys, and config. Exit 0 means the local setup is valid. <strong>How to test:</strong> <code>npx keys doctor</code> exits with code 0.</p>

  <h2>Step 2.4 — Validate (optional)</h2>
  <p>If you have provider credentials in the local key store: <code>npx keys validate</code>. Skip if you use gateway-backed provider access only.</p>

  <h2>Step 2.5 — Models list</h2>
  <CodeBlock language="bash" code="npx keys models list" label="CLI" />
  <p>Filter by provider: <code>npx keys models list --provider anthropic</code>. You'll see a list of providers and their models with pricing hints.</p>

  <h2>Step 2.6 — Routing explain</h2>
  <CodeBlock language="bash" code="npx keys routing explain gpt-4o" label="CLI" />
  <p>You'll see steps: which provider was found for the model, cost lookup, resolution result.</p>

  <AgentPromptsSection
    intro="Optional. Use if a coding agent should install the CLI, set RESTORMEL_* (device login or env snippet), and verify doctor, models list, and routing explain."
    prompts={agentPrompts}
    defaultOpen={false}
  />

  <h2>Checkpoint</h2>
  <p>
    You now have: CLI installed (global or dev dependency); optional device login or env snippet for
    <code>RESTORMEL_GATEWAY_KEY</code>; doctor passing; <code>keys models list</code> and
    <code>keys routing explain</code> working; and optionally validate run for local credentials.
  </p>

  <WalkthroughPhaseNav {prev} {next} {stepOf} />
</div>

<style>
  .doc-content { max-width: var(--rm-container-narrow); }
  .doc-meta { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-2); }
  .doc-prereqs { font-size: var(--text-sm); color: var(--rm-muted); margin: 0 0 var(--space-6); line-height: var(--leading-relaxed); }
  .doc-prereqs a { color: var(--rm-sage); }
  .doc-content h1 { font-family: var(--rm-font-display); font-size: var(--text-2xl); margin: 0 0 var(--space-4); }
  .doc-content h2 { font-size: var(--text-xl); margin: var(--space-6) 0 var(--space-3); }
  .doc-content p { color: var(--rm-muted); line-height: var(--leading-relaxed); margin: 0 0 var(--space-4); }
  .doc-content a { color: var(--rm-sage); }
  .doc-content code { font-family: "JetBrains Mono", monospace; font-size: var(--text-sm); }
</style>
