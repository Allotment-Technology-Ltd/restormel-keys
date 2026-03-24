<script lang="ts">
  /** Public guide: canonical provider/model catalog for third-party integrations */
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";

  const curlProbe = `curl -sS "https://restormel.dev/keys/dashboard/api/catalog?limit=5" | jq '.contractVersion, .generatedAt, (.providers|length), (.data|length)'`;

  const curlPaging = `# Default page size is 500 models per response (max 1000). Use offset for the next page.
curl -sS "https://restormel.dev/keys/dashboard/api/catalog?limit=500&offset=0" -o page0.json
curl -sS "https://restormel.dev/keys/dashboard/api/catalog?limit=500&offset=500" -o page1.json`;

  const nodeSnippet = `import { fetchCanonicalCatalog, filterCanonicalCatalogForViability } from "@restormel/keys/dashboard";

const catalog = await fetchCanonicalCatalog({
  baseUrl: "https://restormel.dev", // or process.env.RESTORMEL_KEYS_BASE
  limit: 500,
  offset: 0,
});

// Optional: extra client-side filtering if you cached an older payload
const viable = filterCanonicalCatalogForViability(catalog);

console.log(viable.contractVersion, viable.providers.length, viable.data.length);`;

  const envBase = `export RESTORMEL_KEYS_BASE=https://restormel.dev
npx @restormel/keys-cli catalog fetch`;

  const unhealthyNote = `# Operator / debugging only — includes deprecated models and non-available variants
curl -sS "https://restormel.dev/keys/dashboard/api/catalog?includeUnhealthy=1&limit=20" | jq .`;
</script>

<svelte:head>
  <title>Canonical model &amp; provider catalog — Restormel Keys</title>
  <meta
    name="description"
    content="Keep provider and model lists up to date: use the public Restormel catalog HTTP API or @restormel/keys dashboard helpers. Step-by-step for third-party integrations."
  />
</svelte:head>

<div class="doc-content">
  <h1>Canonical model &amp; provider catalog</h1>
  <p class="doc-intro">
    Use a <strong>single HTTP catalog</strong> instead of hardcoding model IDs in your product. Restormel publishes providers, models, per-provider variants (vendor model strings), and validation metadata
    (<code>native</code> vs <code>openai_compatible</code>, optional <code>defaultApiBaseUrl</code>). The feed is <strong>public read</strong> — no Gateway Key required.
  </p>

  <p class="doc-intro">
    <strong>Canonical reference (maintainers):</strong>
    <a
      href="https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/reference/catalog-governance.md"
      target="_blank"
      rel="noopener noreferrer">Catalog governance</a>
    in the repo describes CI drift checks and the dashboard seed. This page is the <strong>integration recipe</strong> you can share with partners.
  </p>

  <div class="callout callout-tip">
    <strong>Stable contract</strong> — Check <code>contractVersion</code> in every response (e.g. <code>2026-03-23.catalog.v1</code>). If it changes, re-validate your parser.
  </div>

  <h2>Step 1 — Pick a base URL</h2>
  <ul>
    <li><strong>Hosted:</strong> <code>https://restormel.dev</code> (or your own deployment hostname).</li>
    <li>Catalog path is always <code>/keys/dashboard/api/catalog</code> on that host.</li>
  </ul>

  <h2>Step 2 — Call the catalog (GET, no auth)</h2>
  <p>Example probe (first few rows):</p>
  <CodeBlock language="bash" code={curlProbe} />

  <p>Successful JSON includes:</p>
  <ul>
    <li><code>contractVersion</code> — schema / semantics version</li>
    <li><code>generatedAt</code> — ISO timestamp for this payload</li>
    <li><code>providers[]</code> — <code>id</code>, <code>displayName</code>, <code>modelCount</code>, <code>validation</code> (<code>mode</code>, <code>requiresBaseUrl</code>, <code>requiresModel</code>, optional <code>defaultApiBaseUrl</code>)</li>
    <li><code>data[]</code> — models with <code>id</code>, <code>canonicalName</code>, <code>lifecycleState</code>, <code>providerTypes</code>, <code>variants[]</code> (<code>providerModelId</code> is what you send to the vendor API)</li>
    <li><code>paging</code> — <code>limit</code>, <code>offset</code>, <code>count</code> for this page</li>
  </ul>

  <h2>Step 3 — Page through large catalogs</h2>
  <CodeBlock language="bash" code={curlPaging} />

  <h2>Step 4 — Cache and refresh</h2>
  <ul>
    <li>Store the JSON (or your derived lists) in your backend cache, object store, or build artifact.</li>
    <li>Refresh on a schedule (e.g. hourly/daily) and on deploy; compare <code>generatedAt</code> or track <code>contractVersion</code>.</li>
    <li>Keep a <strong>last-known-good</strong> snapshot if Restormel is unreachable — but treat the network result as authoritative when available.</li>
  </ul>

  <h2>Step 5 — Map to your UI and API calls</h2>
  <ol>
    <li>Build provider pickers from <code>providers[]</code> (use <code>validation.mode</code> to choose native vs OpenAI-compatible client code).</li>
    <li>Build model pickers from <code>data[]</code>; scope models by <code>providerTypes</code> and selected provider.</li>
    <li>When calling a vendor, use the variant’s <code>providerModelId</code> for that provider.</li>
    <li>If <code>validation.defaultApiBaseUrl</code> is present, prefer it over hardcoding vendor base URLs.</li>
  </ol>

  <h2>Step 6 — Optional: npm helper (server-side only)</h2>
  <p>
    Install <code>@restormel/keys</code> and import from <code>@restormel/keys/dashboard</code>. Use only on the server — do not expose catalog fetch from the browser if you later add authenticated options.
  </p>
  <CodeBlock language="bash" code="pnpm add @restormel/keys" />
  <CodeBlock language="typescript" code={nodeSnippet} />

  <p>
    For resilience, <code>fetchCanonicalCatalogWithFallback()</code> tries the network first, then your local snapshot — see the
    <a href="https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/packages/core/README.md"><code>@restormel/keys</code> README</a>.
  </p>

  <h2>Step 7 — Verify from CI or a laptop</h2>
  <p>Use the CLI to confirm reachability and contract version:</p>
  <CodeBlock language="bash" code="npx @restormel/keys-cli catalog fetch" />
  <CodeBlock language="bash" code={envBase} />

  <p>Full JSON:</p>
  <CodeBlock language="bash" code="npx @restormel/keys-cli catalog fetch --json | jq ." />

  <h2>Operator query parameters</h2>
  <ul>
    <li><code>lifecycleState</code>, <code>family</code> — filter rows (optional).</li>
    <li><code>includeUnhealthy=1</code> — include deprecated/retired models and non-available variants (for debugging, not default product UIs).</li>
  </ul>
  <CodeBlock language="bash" code={unhealthyNote} />

  <h2>Related</h2>
  <ul>
    <li><a href="/keys/docs/cloud-api">Cloud API</a> — Resolve and other authenticated dashboard APIs</li>
    <li><a href="/keys/docs/integrations/cli">CLI integration</a> — <code>keys patch</code> also probes this catalog endpoint</li>
    <li><a href="/keys/docs/compatibility">Framework compatibility</a> — UI packages and demos that consume the catalog</li>
  </ul>
</div>

<style>
  .doc-content {
    max-width: var(--rm-container-narrow);
  }
  .doc-intro {
    color: var(--rm-muted);
    margin: 0 0 var(--space-4);
    line-height: var(--leading-relaxed);
  }
  .doc-content h1 {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    margin: 0 0 var(--space-4);
  }
  .doc-content h2 {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    margin: var(--space-8) 0 var(--space-3);
  }
  .doc-content p,
  .doc-content li {
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .doc-content ul,
  .doc-content ol {
    margin: 0 0 var(--space-4);
    padding-left: var(--space-5);
  }
  .callout {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-3) var(--space-4);
    margin: var(--space-6) 0;
    font-size: var(--text-sm);
  }
  .callout-tip {
    background: var(--rm-sage-bg, color-mix(in oklab, var(--rm-sage) 12%, transparent));
    border-color: color-mix(in oklab, var(--rm-sage) 35%, var(--rm-border));
  }
  .callout code {
    font-size: 0.9em;
  }
</style>
