<script lang="ts">
  import { getIntegrationsWalkthroughPrevNext } from "$lib/docs-integrations-walkthrough-nav";
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";
  import AgentPromptsSection from "$lib/components/walkthrough/AgentPromptsSection.svelte";
  import WalkthroughPhaseNav from "$lib/components/walkthrough/WalkthroughPhaseNav.svelte";

  const { prev, next, stepOf } = getIntegrationsWalkthroughPrevNext("phase-4-aaif");

  const agentPrompts = [
    {
      id: "i06-aaif-types",
      title: "Prompt I06 â Dispatch types install",
      intent: "Install @restormel/dispatch and use type guards to validate sample request and response.",
      contextDocs: [
        "This page: /keys/docs/integrations-walkthrough/phase-4-aaif",
        "packages/dispatch/src/types.ts",
      ],
      prompt: `You are working in [your app repo]. Goal: Install @restormel/dispatch and use the type guards. Steps: 1) Add @restormel/dispatch. 2) Import DispatchRequest, DispatchResponse, isDispatchRequest, isDispatchResponse. 3) Create minimal valid DispatchRequest and DispatchResponse; pass to guards â both return true. 4) Document: "Dispatch types, runtime guards, and runtime helper via executeDispatchRequest from @restormel/dispatch." DO NOT: Send real traffic to an AI endpoint.`,
      gate: "Package installed; both guards return true for valid objects; docs updated.",
    },
  ];
</script>

<svelte:head>
  <title>Phase 4 â Dispatch â Integrations walkthrough</title>
  <meta name="description" content="Request/response types, validation, when to use." />
</svelte:head>

<div class="doc-content">
  <p class="doc-meta"><span class="doc-step">{stepOf}</span></p>
  <h1>Phase 4 â Dispatch</h1>
  <p class="doc-prereqs">
    <strong>Time:</strong> ~10 minutes<br />
    <strong>Prerequisites:</strong> <a href="/keys/docs/integrations-walkthrough/phase-0-overview">Phase 0</a> read; you want a structured request/response contract<br />
    <strong>You'll need:</strong> TypeScript or JavaScript; optional: an app that calls AI APIs
  </p>

  <p>This phase introduces <strong>Dispatch</strong> (the in-process model-execution Interaction Format; formerly <code>@restormel/aaif</code>): typed request and response shapes. Types, validation, and a runtime helper (executeDispatchRequest) live in <code>@restormel/dispatch</code>. Dispatch is an in-process contract, not a wire protocol — for cross-agent interop see A2A.</p>

  <h2>Step 4.1 â Request shape</h2>
  <p><code>DispatchRequest</code>: <code>input</code>, <code>task?</code>, <code>constraints?</code> (maxCost/latency/tokens), <code>user?</code>, and <code>routing?</code> (model/provider).</p>

  <h2>Step 4.2 â Response shape</h2>
  <p><code>DispatchResponse</code>: <code>output</code>, <code>provider</code>, <code>model</code>, <code>cost</code>, <code>routing.reason</code>.</p>

  <h2>Step 4.3 â Install and use</h2>
  <CodeBlock language="bash" code="pnpm add @restormel/dispatch" label="CLI" />
  <CodeBlock language="typescript" code={`import type { DispatchRequest, DispatchResponse } from "@restormel/dispatch";
import { isDispatchRequest, isDispatchResponse } from "@restormel/dispatch";`} label="TypeScript" />
  <p>Use the type guards to validate incoming/outgoing payloads. <strong>How to test:</strong> Pass a sample object to <code>isDispatchRequest</code> / <code>isDispatchResponse</code>; confirm they return true for valid shapes.</p>

  <AgentPromptsSection
    intro="Optional. Use if a coding agent should install @restormel/dispatch and verify type guards."
    prompts={agentPrompts}
    defaultOpen={false}
  />

  <h2>Checkpoint</h2>
  <p>You now have <code>@restormel/dispatch</code> installed and request/response types and validation guards in use (or ready for when the runtime exists).</p>

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
