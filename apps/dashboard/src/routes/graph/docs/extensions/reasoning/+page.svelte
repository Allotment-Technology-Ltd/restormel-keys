<script lang="ts">
  import DocArticle from "$lib/graph/components/docs/DocArticle.svelte";
  import { graphBase as base } from "$lib/graph/paths.js";
  import { GITHUB_REPO_URL } from "$lib/site-nav";

  const sketch = `// Pseudocode: reasoning on @restormel/contracts shapes, render on GraphData.
import { diffGraphs } from "@restormel/graph-reasoning-extensions/diff";
import { evaluateReasoningGraph } from "@restormel/graph-reasoning-extensions/evaluation";
import type { GraphSnapshot } from "@restormel/contracts";
import type { GraphData } from "@restormel/graph-core/viewModel";

const before: GraphSnapshot = /* … */;
const after: GraphSnapshot = /* … */;
const delta = diffGraphs(before, after);

// Map delta.addedNodeIds / changedNodeIds into pathNodeIds or semantic styles,
// then pass GraphData into <GraphCanvas … /> (canvas stays contracts-free).`;
</script>

<DocArticle
  title="Reasoning extensions & contracts"
  description="@restormel/graph-reasoning-extensions is a published Restormel package for compare, lineage, projection, evaluation, diff, and summary over reasoning snapshots. It depends on @restormel/contracts and @restormel/graph-core; semver is independent of Contract v0 canvas releases."
>
  <div class="doc-prose">
    <p>
      The <a href="{base}/docs/integration/sveltekit">SvelteKit integration</a> guide stops at the <strong>canvas seam</strong>:
      <code>GraphData</code> in, <code>GraphCanvas</code> out. When you need <strong>compare, lineage, projection, or
      evaluation</strong> over structured reasoning graphs, add the extensions package and
      <a href="https://www.npmjs.com/package/@restormel/contracts" rel="noopener noreferrer">@restormel/contracts</a> —
      those concerns live <strong>outside</strong> Contract v0 (<code>viewModel.ts</code>), by design.
    </p>

    <h2>What it is</h2>
    <p>
      <a href="https://www.npmjs.com/package/@restormel/graph-reasoning-extensions" rel="noopener noreferrer"
        ><code>@restormel/graph-reasoning-extensions</code></a
      >
      ships TypeScript helpers that operate on <strong>contracts-defined snapshots</strong> (for example
      <code>GraphSnapshot</code>, <code>ReasoningObjectSnapshot</code>). It is the same package SOPHIA and other hosts consume
      from npm — not a private fork.
    </p>
    <ul>
      <li>
        <strong>Depends on:</strong> <code>@restormel/contracts</code> (Zod-backed shapes) and
        <code>@restormel/graph-core</code> where types align — but it does <strong>not</strong> change Contract v0 DTOs.
      </li>
      <li>
        <strong>Semver:</strong> releases on git tag <code>platform-v*</code> with other platform packages. Version bumps can
        ship independently of <code>graph-v*</code> (canvas). Pin each package per your integration tests.
      </li>
    </ul>

    <h2>Export subpaths</h2>
    <p>Prefer subpath imports so bundlers tree-shake unused modules:</p>
    <table>
      <thead>
        <tr>
          <th scope="col">Import</th>
          <th scope="col">Use when</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>@restormel/graph-reasoning-extensions/compare</code></td>
          <td>Diff reasoning-object snapshots (<code>diffReasoningSnapshots</code>, related helpers).</td>
        </tr>
        <tr>
          <td><code>@restormel/graph-reasoning-extensions/diff</code></td>
          <td>Structural diff of two <code>GraphSnapshot</code> values (<code>diffGraphs</code>).</td>
        </tr>
        <tr>
          <td><code>@restormel/graph-reasoning-extensions/evaluation</code></td>
          <td>Graph evaluation passes (<code>evaluateReasoningGraph</code>, finding helpers).</td>
        </tr>
        <tr>
          <td><code>@restormel/graph-reasoning-extensions/lineage</code></td>
          <td>Lineage report + markdown rendering.</td>
        </tr>
        <tr>
          <td><code>@restormel/graph-reasoning-extensions/projection</code></td>
          <td>Project retrieval-like input to <code>GraphSnapshot</code>.</td>
        </tr>
        <tr>
          <td><code>@restormel/graph-reasoning-extensions/summary</code></td>
          <td>Compact summaries over a snapshot.</td>
        </tr>
        <tr>
          <td><code>@restormel/graph-reasoning-extensions</code> (barrel)</td>
          <td>Re-exports all of the above; convenient, larger surface for static analysis.</td>
        </tr>
      </tbody>
    </table>

    <h2>When to use vs GraphData only</h2>
    <ul>
      <li>
        <strong>GraphData + GraphCanvas only:</strong> interactive rendering, layout/trace/workspace, ghost layer, focus/dim —
        no shared reasoning-object pipeline.
      </li>
      <li>
        <strong>Add extensions + contracts:</strong> you compare snapshots, evaluate graphs, project retrieval into graph
        shapes, or emit lineage reports — then <strong>adapt results into <code>GraphData</code></strong> for the canvas.
      </li>
    </ul>

    <h2>Minimal integration sketch (no SOPHIA required)</h2>
    <ol>
      <li>Add <code>@restormel/contracts</code> and <code>@restormel/graph-reasoning-extensions</code> to the app.</li>
      <li>Run reasoning helpers on contracts types (diff, evaluate, …).</li>
      <li>
        At the boundary, map nodes/edges (and optional highlight sets) into <code>GraphData</code> and pass props such as
        <code>pathNodeIds</code> / <code>nodeSemanticStyles</code> to <code>GraphCanvas</code> — see
        <a href="{base}/docs/guides/recipes">Recipes</a>.
      </li>
    </ol>
    <pre><code>{sketch}</code></pre>

    <h2>Source and publishing</h2>
    <p>
      Package root:
      <a href="{GITHUB_REPO_URL}/tree/main/packages/graph-reasoning-extensions" rel="noopener noreferrer"
        ><code>packages/graph-reasoning-extensions</code></a
      >. Programme context:
      <a href="{GITHUB_REPO_URL}/blob/main/docs/restormel/phase1-restormel-engineering-spec.md" rel="noopener noreferrer"
        >phase1-restormel-engineering-spec.md</a
      >,
      <a href="{GITHUB_REPO_URL}/blob/main/docs/architecture/restormel-monorepo-packages.md" rel="noopener noreferrer"
        >restormel-monorepo-packages.md</a
      >. SOPHIA consumer notes:
      <a href="{GITHUB_REPO_URL}/blob/main/docs/restormel-graph-sophia-consumer.md" rel="noopener noreferrer"
        >restormel-graph-sophia-consumer.md</a
      >.
    </p>

    <h2>Related: context packs (Phase 2)</h2>
    <p>
      <code>@restormel/context-packs</code> (monorepo <code>packages/context-packs</code>) builds pass-specific LLM text
      from a portable retrieval-shaped payload. It is not part of the canvas packages; when published to npm, treat it as
      part of the <strong>graph-aware reasoning</strong> story (retrieval → packs → optional UI). Status:
      <a href="{GITHUB_REPO_URL}/blob/main/docs/restormel/PHASE2-EXTRACTION-STATUS.md" rel="noopener noreferrer"
        >PHASE2-EXTRACTION-STATUS.md</a
      >.
    </p>

    <h2>Related: Restormel State (agent memory)</h2>
    <p>
      <code>@restormel/state</code> adds an append-only <strong>memory event</strong> model, deterministic
      <code>projectWorkingMemory</code>, and <strong>correlation</strong> fields on context-pack inputs (and helpers for
      observability <code>run_id</code> alignment). Same <code>platform-v*</code> train as contracts, context-packs, and this
      extensions package—not <code>graph-v*</code>. Integrator overview:
      <a href="{base}/docs/extensions/state">Restormel State (agent memory)</a>; repo spec:
      <a href="{GITHUB_REPO_URL}/blob/main/docs/architecture/RESTORMEL-STATE.md" rel="noopener noreferrer"
        >RESTORMEL-STATE.md</a
      >.
    </p>

    <p>
      <a href="{base}/docs">← Docs home</a> · <a href="{base}/docs/reference/contract-v0-scope">Contract v0 scope</a> ·
      <a href="{base}/docs/reference/api">API reference</a>
    </p>
  </div>
</DocArticle>
