<script lang="ts">
  /** Cloud API doc */
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";

  const resolveCurl = `curl -s -X POST \\
  "https://restormel.dev/keys/dashboard/api/projects/\${RESTORMEL_PROJECT_ID}/resolve" \\
  -H "Authorization: Bearer \${RESTORMEL_GATEWAY_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{ "environmentId": "prod", "routeId": "ingestion-extract" }' | jq '.data'`;

  const resolveResponse = `{
  "data": {
    "contractVersion": "2026-03-20",
    "traceId": "trace_123",
    "routeId": "route_abc123",
    "routeName": "ingestion-extract",
    "providerType": "anthropic",
    "modelId": "claude-3-5-sonnet",
    "explanation": "route=... step=0 provider=anthropic model=claude-3-5-sonnet",
    "decisionMetadata": { "selectedStepId": "step_01", "switchReasonCode": null }
  }
}`;

  const evaluateCurl = `curl -s -X POST \\
  "https://restormel.dev/keys/dashboard/api/policies/evaluate" \\
  -H "Authorization: Bearer \${RESTORMEL_GATEWAY_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{ "projectId": "'\${RESTORMEL_PROJECT_ID}'", "environmentId": "prod", "modelId": "gpt-4o", "providerType": "openai" }' \\
  | jq '.data'`;

  const evaluateResponse = `{
  "data": {
    "allowed": true,
    "violations": []
  }
}`;

  const simulateCurl = `curl -s -X POST \\
  "https://restormel.dev/keys/dashboard/api/projects/\${RESTORMEL_PROJECT_ID}/routes/\${RESTORMEL_ROUTE_ID}/simulate" \\
  -H "Authorization: Bearer \${RESTORMEL_GATEWAY_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{ "environmentId": "prod", "stage": "ingestion_grouping", "workload": "ingestion", "estimatedInputTokens": 12000 }' \\
  | jq '.data'`;

  const simulateResponse = `{
  "data": {
    "contractVersion": "2026-03-20",
    "traceId": "trace_123",
    "routeId": "route_abc123",
    "routeName": "ingestion-extract",
    "selectedStepId": "step_01",
    "estimatedCostUsd": 0.18,
    "perStepEstimates": [
      { "stepId": "step_01", "orderIndex": 0, "providerType": "anthropic", "modelId": "claude-sonnet-4", "estimatedCostUsd": 0.18, "wouldRun": true, "wouldBeSkippedBecause": null },
      { "stepId": "step_02", "orderIndex": 1, "providerType": "openai", "modelId": "gpt-4.1", "estimatedCostUsd": 0.21, "wouldRun": false, "wouldBeSkippedBecause": "not_selected" }
    ],
    "switchOutcomePreview": {
      "attemptNumber": 0,
      "failureKind": null,
      "selectedOrderIndex": 0
    },
    "decisionMetadata": { "selectedStepId": "step_01" }
  }
}`;

  const policyPublishCurl = `curl -s -X POST \\
  "https://restormel.dev/keys/dashboard/api/policies/\${RESTORMEL_POLICY_ID}/publish" \\
  -H "Authorization: Bearer \${RESTORMEL_GATEWAY_KEY}" \\
  -H "Content-Type: application/json" | jq '.data'`;

  const policyRollbackCurl = `curl -s -X POST \\
  "https://restormel.dev/keys/dashboard/api/policies/\${RESTORMEL_POLICY_ID}/rollback" \\
  -H "Authorization: Bearer \${RESTORMEL_GATEWAY_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{ "toVersion": 1 }' | jq '.data'`;

  const policyDiffCurl = `curl -s -X POST \\
  "https://restormel.dev/keys/dashboard/api/policies/\${RESTORMEL_POLICY_ID}/diff" \\
  -H "Authorization: Bearer \${RESTORMEL_GATEWAY_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{ "fromVersion": 1, "toVersion": 2 }' | jq '.data'`;
</script>

<svelte:head>
  <title>Cloud API — Restormel Keys</title>
  <meta name="description" content="Control-plane CRUD via the Zuplo gateway, and runtime operations via the Dashboard API. Includes resolve, policy evaluation, stage routing metadata, and route simulation." />
</svelte:head>

<div class="doc-content">
  <h1>Cloud API</h1>
  <p>
    The <strong>Restormel Keys Cloud API</strong> is split across two surfaces: a <strong>Zuplo Gateway API</strong> for control-plane CRUD (projects, keys), and a <strong>Dashboard API</strong> for runtime operations (Resolve, policy evaluate, routes/steps).
    Restormel Keys is library-first — you keep your existing infrastructure for execution (OpenRouter/Portkey/Vercel AI/direct providers), and Restormel adds the application layer (BYOK, routing, policies).
  </p>

  <h2>Two API surfaces (and two key types)</h2>
  <p>Restormel Keys has two distinct HTTP surfaces:</p>
  <ul>
    <li>
      <strong>Dashboard API (runtime operations)</strong> — resolve, policies/evaluate, routes/steps.
      Call <code>https://restormel.dev/keys/dashboard/api/...</code> with your <strong>Gateway Key</strong> (<code>rk_...</code>) from your backend.
    </li>
    <li>
      <strong>Zuplo Gateway API (control-plane CRUD)</strong> — health, projects, project keys.
      Call <code>https://restormel-keys-gateway-main-bc13eba.zuplo.app/api/...</code> with a <strong>consumer key</strong> (<code>zpka_...</code>).
    </li>
  </ul>
  <div class="callout callout-security">
    <strong>Security</strong> — Never send a Gateway Key to the browser. Use it only server-side.
  </div>
  <div class="callout">
    <strong>OpenAPI (stable URLs)</strong> —
    <a href="/keys/docs/api/openapi.yaml">/keys/docs/api/openapi.yaml</a> and
    <a href="/keys/dashboard/api/openapi.yaml">/keys/dashboard/api/openapi.yaml</a>
  </div>

  <h2>Resolve API (Dashboard API)</h2>
  <p>
    <strong>Restormel Resolve</strong> is the core runtime operation: your backend asks Restormel which provider/model to use for a request.
    Restormel does <strong>not</strong> proxy the AI request — it returns routing instructions; your backend calls the provider directly.
  </p>

  <p><strong>Endpoint</strong></p>
  <CodeBlock language="text" code={`POST /keys/dashboard/api/projects/{projectId}/resolve\nAuthorization: Bearer {RESTORMEL_GATEWAY_KEY}\nContent-Type: application/json`} />

  <p><strong>Request body</strong></p>
  <CodeBlock language="json" code={`{ "environmentId": "prod", "routeId": "ingestion-extract" }`} />
  <ul>
    <li><code>environmentId</code> (required): environment to resolve against (e.g. <code>dev</code>, <code>prod</code>)</li>
    <li><code>routeId</code> (optional): route name to evaluate; if omitted, uses the first active route for that environment</li>
  </ul>

  <p><strong>curl example</strong></p>
  <CodeBlock language="bash" code={resolveCurl} />

  <p><strong>Response (200)</strong></p>
  <CodeBlock language="json" code={resolveResponse} />
  <ul>
    <li><code>data.routeId</code>: the matched route id (stable identifier)</li>
    <li><code>data.routeName</code>: the matched route display name</li>
    <li><code>data.providerType</code>: the provider to call (e.g. <code>openai</code>, <code>anthropic</code>)</li>
    <li><code>data.modelId</code>: the model to use (may be <code>null</code>)</li>
    <li><code>data.explanation</code>: human-readable trace for debugging</li>
  </ul>

  <h3>Error responses</h3>
  <table class="doc-table">
    <thead>
      <tr><th>HTTP</th><th>Error</th><th>Meaning</th></tr>
    </thead>
    <tbody>
      <tr><td>401</td><td><code>unauthorized</code></td><td>Gateway Key missing or invalid</td></tr>
      <tr><td>403</td><td><code>forbidden</code></td><td>Gateway Key project does not match <code>projectId</code></td></tr>
      <tr><td>404</td><td><code>no_route</code></td><td>No active route found for this environment / route name</td></tr>
      <tr><td>500</td><td><code>internal_error</code></td><td>Unexpected resolver/runtime failure; inspect logs and route configuration</td></tr>
    </tbody>
  </table>

  <h2>Policy evaluate (Dashboard API)</h2>
  <p>Use policy evaluate to test whether a model/provider combination is allowed by active policies without executing a full resolve.</p>
  <p><strong>Endpoint</strong></p>
  <CodeBlock language="text" code={`POST /keys/dashboard/api/policies/evaluate\nAuthorization: Bearer {RESTORMEL_GATEWAY_KEY}\nContent-Type: application/json`} />

  <p><strong>Request body</strong></p>
  <CodeBlock language="json" code={`{ "projectId": "...", "environmentId": "prod", "modelId": "gpt-4o", "providerType": "openai" }`} />
  <p>
    When authenticating with a Gateway Key, the server enforces that <code>projectId</code> matches the key’s bound project.
    Never trust client-supplied <code>projectId</code> for cross-project evaluation.
  </p>
  <p><strong>curl example</strong></p>
  <CodeBlock language="bash" code={evaluateCurl} />
  <p><strong>Response</strong></p>
  <CodeBlock language="json" code={evaluateResponse} />

  <h2>Ingestion routing control-plane (Dashboard API)</h2>
  <p>
    The Dashboard API now exposes route-level metadata and simulation surfaces used by ingestion routing UIs.
    These endpoints are project-scoped and require a Gateway Key.
  </p>

  <h3>Route simulation</h3>
  <p><strong>Endpoint</strong></p>
  <CodeBlock language="text" code={`POST /keys/dashboard/api/projects/{projectId}/routes/{routeId}/simulate\nAuthorization: Bearer {RESTORMEL_GATEWAY_KEY}\nContent-Type: application/json`} />
  <p><strong>Request body (example)</strong></p>
  <CodeBlock language="json" code={`{ "environmentId": "prod", "stage": "ingestion_grouping", "workload": "ingestion", "estimatedInputTokens": 12000 }`} />
  <p><strong>curl example</strong></p>
  <CodeBlock language="bash" code={simulateCurl} />
  <p><strong>Response (example)</strong></p>
  <CodeBlock language="json" code={simulateResponse} />

  <h3>Routing metadata endpoints</h3>
  <table class="doc-table">
    <thead>
      <tr><th>Endpoint</th><th>Purpose</th></tr>
    </thead>
    <tbody>
      <tr>
        <td><code>GET /keys/dashboard/api/projects/{'{'}projectId{'}'}/routing-capabilities</code></td>
        <td>Returns workload + stage enums for route editors.</td>
      </tr>
      <tr>
        <td><code>GET /keys/dashboard/api/projects/{'{'}projectId{'}'}/models</code></td>
        <td>Project-scoped model catalog list for selector controls.</td>
      </tr>
      <tr>
        <td><code>GET /keys/dashboard/api/projects/{'{'}projectId{'}'}/providers/health</code></td>
        <td>Provider integration verification/health summary for routing decisions.</td>
      </tr>
      <tr>
        <td><code>GET /keys/dashboard/api/projects/{'{'}projectId{'}'}/switch-criteria-enums</code></td>
        <td>Machine-readable switch-criteria enums for UI constraints.</td>
      </tr>
    </tbody>
  </table>

  <h3>Stage-aware resolve request fields</h3>
  <p>
    Resolve now accepts optional stage/switch context fields to support ingestion workflows:
    <code>stage</code>, <code>workload</code>, <code>task</code>, <code>attemptNumber</code>,
    <code>estimatedInputTokens</code>, <code>estimatedInputChars</code>, <code>complexity</code>,
    <code>constraints</code>, <code>previousFailure</code>, and <code>failureKind</code>.
  </p>
  <p>
    Resolve responses may include <code>selectedStepId</code>, <code>selectedOrderIndex</code>, and
    <code>switchReasonCode</code> for operator/trace UX, plus machine-readable fields
    <code>estimatedCostUsd</code>, <code>matchedCriteria</code>, and <code>fallbackCandidates</code>.
  </p>

  <h3>Route lifecycle endpoints</h3>
  <ul>
    <li><code>POST /keys/dashboard/api/projects/{'{'}projectId{'}'}/routes/{'{'}routeId{'}'}/publish</code> — publish a new route version snapshot.</li>
    <li><code>POST /keys/dashboard/api/projects/{'{'}projectId{'}'}/routes/{'{'}routeId{'}'}/rollback</code> — rollback to a previously published snapshot (optional <code>toVersion</code>).</li>
    <li><code>GET /keys/dashboard/api/projects/{'{'}projectId{'}'}/routes/{'{'}routeId{'}'}/history</code> — list publish/rollback history events.</li>
  </ul>

  <h3>Operator advisory endpoints</h3>
  <ul>
    <li><code>GET /keys/dashboard/api/projects/{'{'}projectId{'}'}/route-coverage</code> — stage/workload coverage matrix and zero-enabled-step routes.</li>
    <li><code>GET /keys/dashboard/api/projects/{'{'}projectId{'}'}/readiness</code> — status, issues, and recommendations before rollout.</li>
    <li><code>POST /keys/dashboard/api/projects/{'{'}projectId{'}'}/routes/{'{'}routeId{'}'}/recommend</code> — route diagnostics, recommendations, and diff preview.</li>
    <li><code>GET /keys/dashboard/api/policies/{'{'}id{'}'}/history</code>, <code>POST /publish</code>, <code>POST /rollback</code>, <code>POST /diff</code> — policy lifecycle parity endpoints.</li>
  </ul>

  <h3>Policy lifecycle examples</h3>
  <p><strong>History</strong></p>
  <CodeBlock language="bash" code={`curl -s "https://restormel.dev/keys/dashboard/api/policies/\${RESTORMEL_POLICY_ID}/history?limit=20" -H "Authorization: Bearer \${RESTORMEL_GATEWAY_KEY}" | jq '.data'`} />
  <p><strong>Publish</strong></p>
  <CodeBlock language="bash" code={policyPublishCurl} />
  <p><strong>Rollback</strong></p>
  <CodeBlock language="bash" code={policyRollbackCurl} />
  <p><strong>Diff</strong></p>
  <CodeBlock language="bash" code={policyDiffCurl} />

  <h2>Where to use it</h2>
  <ul>
    <li><strong>API reference and Try it:</strong> <a href="https://restormel-keys-gateway-main-bc13eba.zuplo.site" target="_blank" rel="noopener noreferrer">Restormel Keys Developer Portal</a> — full endpoint list, request/response schemas, and interactive “Try it” with a consumer key.</li>
    <li><strong>Gateway base URL (for API calls):</strong> <code>https://restormel-keys-gateway-main-bc13eba.zuplo.app</code> — call <code>/api/health</code>, <code>/api/projects</code>, <code>/api/projects/{'{'}id{'}'}</code>, <code>/api/projects/{'{'}id{'}'}/keys</code>. The gateway root (<code>/</code>) is not a page; use these paths.</li>
    <li><strong>Dashboard:</strong> <a href="/keys/dashboard">Dashboard</a> — <a href="/keys/dashboard/login">Sign in</a>, create projects, and create <strong>Gateway keys</strong> for project-scoped access.</li>
  </ul>

  <h2>How it fits together</h2>
  <ol>
    <li>You use the <strong>Dashboard</strong> to create projects and Gateway keys.</li>
    <li>You (or your services) call the <strong>gateway</strong> with a <strong>consumer key</strong> (<code>zpka_...</code>) from Zuplo's API Key Service.</li>
    <li>The <strong>Developer Portal</strong> (link above) documents the API and lets you try requests.</li>
  </ol>
  <p>See the portal's <a href="https://restormel-keys-gateway-main-bc13eba.zuplo.site/how-it-fits-together" target="_blank" rel="noopener noreferrer">How it all fits together</a> page for the full picture.</p>

  <h2>Quick links</h2>
  <ul>
    <li><a href="https://restormel-keys-gateway-main-bc13eba.zuplo.site" target="_blank" rel="noopener noreferrer">Developer Portal (API reference + Try it)</a></li>
    <li><a href="https://restormel-keys-gateway-main-bc13eba.zuplo.site/introduction" target="_blank" rel="noopener noreferrer">Introduction & authentication</a></li>
    <li><a href="/keys/dashboard">Dashboard</a> — create projects and Gateway keys</li>
  </ul>

  <h2>See also</h2>
  <ul>
    <li><a href="/keys/dashboard">Dashboard</a> — create projects and Gateway keys</li>
    <li><a href="/keys/dashboard/login">Sign in</a> — authenticate with GitHub</li>
    <li><a href="/keys/docs">Docs</a> — framework compatibility and guides</li>
    <li><a href="/keys/pricing">Pricing</a> — tiers and plans</li>
  </ul>
</div>

<style>
  .doc-content {
    max-width: var(--rm-container-narrow);
  }
  .doc-content h1 {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    color: var(--rm-text);
    margin: 0 0 var(--space-4);
  }
  .doc-content h2 {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    color: var(--rm-text);
    margin: var(--space-8) 0 var(--space-3);
  }
  .doc-content p {
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-4);
  }
  .doc-content ul, .doc-content ol {
    margin: 0 0 var(--space-6);
    padding-left: var(--space-5);
  }
  .doc-content li {
    margin-bottom: var(--space-2);
  }
  .doc-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 var(--space-6);
    font-size: var(--text-sm);
  }
  .doc-table th, .doc-table td {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rm-border);
    text-align: left;
  }
  .doc-table th {
    background: var(--rm-surface-raised);
    color: var(--rm-text);
    font-weight: var(--font-medium);
  }
  .doc-table td {
    color: var(--rm-muted);
  }
</style>
