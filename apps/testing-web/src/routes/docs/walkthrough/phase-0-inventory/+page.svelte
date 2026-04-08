<script lang="ts">
  import { base } from "$app/paths";
  import DocArticle from "$lib/components/docs/DocArticle.svelte";
  import WalkthroughAgentPrompts from "$lib/components/docs/WalkthroughAgentPrompts.svelte";
</script>

<DocArticle
  title="Phase 0 — Inventory"
  description="Audit AI-heavy journeys, decide what becomes a Restormel Testing goal versus unit or traditional E2E, and align on how Keys and secrets will participate in test runs."
>
  <div class="phase-page">
    <div class="doc-prose">
      <p>You should finish this phase with:</p>
      <ul>
        <li>A short list of user outcomes that depend on AI (prompts, tools, retrieval, model routing).</li>
        <li>A clear line between “deterministic app logic” tests (stay in your existing runners) and “outcome goals” for Testing.</li>
        <li>A plan for Keys: which logical model slots tests will need (primary, optional vision/judge).</li>
        <li>No commitment yet to huge coverage—MVP targets 5–8 meaningful goals.</li>
      </ul>
      <p>
        <a href="{base}/docs/getting-started/existing-stack">Existing stack</a> ·
        <a href="{base}/docs/walkthrough/phase-1-install">Next: Phase 1 — Install and configure</a>
      </p>
    </div>
    <WalkthroughAgentPrompts>
      <div class="doc-prose">
        <ol>
          <li>List three AI-affected user journeys in our product; rank by regression risk.</li>
          <li>For each, note what “pass” means in user terms vs technical signals we can assert.</li>
          <li>Mark which journeys stay in Playwright/unit tests only and which merit a Testing goal.</li>
        </ol>
      </div>
    </WalkthroughAgentPrompts>
  </div>
</DocArticle>
