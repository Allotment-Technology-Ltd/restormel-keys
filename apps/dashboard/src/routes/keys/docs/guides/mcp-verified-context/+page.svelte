<svelte:head>
  <title>MCP verified-context quickstart — Restormel Keys</title>
  <meta
    name="description"
    content="Set up the Restormel connect.retrieve_verified MCP tool in Claude Code, Claude Desktop, or Cursor in one command: keys init --mcp. Covers config generation, credential injection, citation rules, and troubleshooting."
  />
</svelte:head>

<div class="doc-content">
  <h1>MCP verified-context quickstart</h1>
  <p class="doc-intro">
    The <code class="inline-code">connect.retrieve_verified</code> MCP tool puts a Restormel Connect
    knowledge graph directly inside Claude Code, Claude Desktop, or Cursor. Every result the tool returns
    is an evidence-bound, citation-grounded claim — verified against its source, with the full provenance
    chain attached so both you and the AI can cite it accurately. This guide gets you from zero to a
    working tool call in under five minutes.
  </p>

  <div class="callout callout-tip">
    <strong>One command.</strong> Run <code class="inline-code">keys init --mcp</code> to generate the
    ready-to-paste config for all three supported clients. Fill in two values and restart your client —
    no build step required.
  </div>

  <h2 id="prereqs">Prerequisites</h2>
  <ul>
    <li>
      <strong>A Restormel Connect workspace with at least one ingested graph.</strong>
      If you have not built a graph yet, follow the
      <a href="/keys/docs/guides/connect-first-graph-onboarding">Connect first graph onboarding</a> guide first.
    </li>
    <li>
      <strong>A Gateway key (<code class="inline-code">rk_…</code>).</strong>
      Created in the <a href="https://restormel.dev/keys/dashboard">Dashboard</a>.
    </li>
    <li>
      <strong>Node.js ≥ 18</strong> and either npm, pnpm, or the <code class="inline-code">npx</code>
      binary available in your shell.
    </li>
    <li>
      <strong>The Restormel CLI</strong> (for config generation):
      <pre class="code-block"><code>{`npm install -g @restormel/mcp @restormel/keys
# or: pnpm add -g @restormel/mcp @restormel/keys`}</code></pre>
    </li>
  </ul>

  <h2 id="generate">Step 1 — generate the config</h2>
  <p>
    Run this command in any directory. It prints the ready-to-paste
    <code class="inline-code">mcpServers</code> block for Claude Code, Claude Desktop, and Cursor with
    placeholder values you will fill in next:
  </p>
  <pre class="code-block"><code>{`keys init --mcp`}</code></pre>
  <p>
    To print only the config for one client, pass <code class="inline-code">--mcp-client</code>:
  </p>
  <pre class="code-block"><code>{`keys init --mcp --mcp-client claude-code
keys init --mcp --mcp-client claude-desktop
keys init --mcp --mcp-client cursor`}</code></pre>
  <p>Example output for Claude Code:</p>
  <pre class="code-block"><code>{`── Claude Code ──
Config file location:
  ~/.claude.json

Paste into mcpServers (merge with any existing servers):
{
  "mcpServers": {
    "restormel": {
      "command": "npx",
      "args": ["-y", "@restormel/mcp@latest"],
      "env": {
        "RESTORMEL_GATEWAY_KEY": "<your-gateway-key>",
        "RESTORMEL_CONNECT_API_BASE": "https://restormel.dev",
        "RESTORMEL_WORKSPACE_ID": "<your-workspace-id>"
      }
    }
  }
}`}</code></pre>

  <h2 id="fill-in">Step 2 — fill in your credentials</h2>
  <p>
    Replace the two placeholder values before pasting. <strong>Never commit a real Gateway key</strong> —
    inject it at runtime via your OS keychain, a password manager, or an environment file that is
    listed in <code class="inline-code">.gitignore</code>:
  </p>
  <table class="doc-table">
    <thead>
      <tr>
        <th scope="col">Placeholder</th>
        <th scope="col">Where to get it</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code class="inline-code">&lt;your-gateway-key&gt;</code></td>
        <td>
          <a href="https://restormel.dev/keys/dashboard">Dashboard</a> → your project → Gateway key
          (<code class="inline-code">rk_…</code>). This is your project-scoped bearer token for the Connect API.
        </td>
      </tr>
      <tr>
        <td><code class="inline-code">&lt;your-workspace-id&gt;</code></td>
        <td>
          <a href="https://restormel.dev/keys/dashboard/connect">Connect hub</a> → workspace settings →
          copy the UUID. The tool uses this to scope every query to your graph.
        </td>
      </tr>
    </tbody>
  </table>

  <h2 id="paste">Step 3 — paste into your client's config file</h2>
  <p>Merge the <code class="inline-code">mcpServers</code> block into the config file for your client:</p>
  <table class="doc-table">
    <thead>
      <tr>
        <th scope="col">Client</th>
        <th scope="col">Config file</th>
        <th scope="col">After editing</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Claude Code</td>
        <td><code class="inline-code">~/.claude.json</code></td>
        <td>Restart the Claude Code session or run <code class="inline-code">/restart</code></td>
      </tr>
      <tr>
        <td>Claude Desktop</td>
        <td>
          macOS: <code class="inline-code">~/Library/Application Support/Claude/claude_desktop_config.json</code><br />
          Windows: <code class="inline-code">%APPDATA%\Claude\claude_desktop_config.json</code>
        </td>
        <td>Quit and reopen Claude Desktop</td>
      </tr>
      <tr>
        <td>Cursor</td>
        <td><code class="inline-code">~/.cursor/mcp.json</code></td>
        <td>Restart the Cursor window (<kbd>Cmd/Ctrl+Shift+P</kbd> → Reload Window)</td>
      </tr>
    </tbody>
  </table>
  <p>
    If the config file already has a <code class="inline-code">mcpServers</code> key, merge the
    <code class="inline-code">restormel</code> entry into the existing object — do not replace
    the whole file.
  </p>

  <h2 id="verify">Step 4 — verify the tool is loaded</h2>
  <p>In your client, open the tools panel (or type a question to the agent) and confirm
  <code class="inline-code">connect.retrieve_verified</code> appears in the available tools list.
  For a quick smoke test:</p>
  <pre class="code-block"><code>{`# In the AI chat, type:
Use connect.retrieve_verified to find claims about [a topic in your graph]`}</code></pre>
  <p>
    The tool should respond with a structured list of verified claims, each carrying a
    <code class="inline-code">citation</code> and a <code class="inline-code">trace_export_url</code>.
    If the workspace has no ingested content yet, you will get an empty claims array —
    not an error. Ingest content first; see
    <a href="/keys/docs/guides/connect-first-graph-onboarding">Connect first graph onboarding</a>.
  </p>

  <div class="callout callout-warning">
    <strong>Credentials not set?</strong> If the tool returns
    <code class="inline-code">{"{ ok: false, code: 'RST_CONNECT_HOSTED' }"}</code>,
    the MCP client did not pass the env block. Confirm the config file is correct, the JSON is
    valid, and the client was fully restarted after editing. Verify with:
    <pre class="code-block"><code>{`RESTORMEL_GATEWAY_KEY=rk_… RESTORMEL_CONNECT_API_BASE=https://restormel.dev \\
  RESTORMEL_WORKSPACE_ID=<uuid> \\
  npx -y @restormel/mcp@latest --check`}</code></pre>
    Exit code <code class="inline-code">0</code> confirms the server starts and the tool manifest loads.
  </div>

  <h2 id="modes">Tool modes: strict and annotated</h2>
  <p>
    The <code class="inline-code">connect.retrieve_verified</code> tool has two modes that the calling
    agent can select per request:
  </p>
  <table class="doc-table">
    <thead>
      <tr>
        <th scope="col">Mode</th>
        <th scope="col">What it returns</th>
        <th scope="col">When to use</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code class="inline-code">strict</code> (default)</td>
        <td>
          Only <code class="inline-code">supported</code> claims — fully evidence-bound (Layer 1 hash
          match) and entailed (Layer 2 judge). Safe to present as verified facts.
        </td>
        <td>Regulated outputs, citations in formal documents, any context that will be presented as fact.</td>
      </tr>
      <tr>
        <td><code class="inline-code">annotated</code></td>
        <td>
          All claims with their EBV state
          (<code class="inline-code">supported | inferred | unverified | contradicted | excluded</code>).
          Non-supported claims are labeled, never silently blended.
        </td>
        <td>
          Research exploration, coverage auditing, or when you need to see what the pipeline
          flagged as uncertain.
        </td>
      </tr>
    </tbody>
  </table>
  <p>
    You can instruct the agent to use a specific mode:
    <em>"Use connect.retrieve_verified in annotated mode to show me all claims about X, including
    unverified ones."</em>
  </p>

  <h2 id="citing">How to cite correctly</h2>
  <p>
    The tool description instructs the calling agent to follow these rules automatically. For human
    review or when building integrations that post-process the results:
  </p>
  <ol class="doc-ol">
    <li>
      Quote verbatim from <code class="inline-code">evidence[].quote</code>. The quote is the exact
      span the Layer-1 binder confirmed is at the stated character offsets in the cited source version.
      Do not paraphrase it and present it as the verified text.
    </li>
    <li>
      Attribute to <code class="inline-code">citation</code> (the source title):
      <code class="inline-code">(Source: &lt;citation&gt;)</code>.
    </li>
    <li>
      Include <code class="inline-code">trace_export_url</code> as the audit link:
      <code class="inline-code">[trace](&lt;trace_export_url&gt;)</code>.
      This URL fetches the full provenance trace document (query, verification policy, every
      included and excluded claim with reasons) from
      <code class="inline-code">GET /connect/v1/traces/&#123;traceId&#125;/export</code>.
    </li>
    <li>
      In <code class="inline-code">annotated</code> mode, never present
      <code class="inline-code">inferred</code>, <code class="inline-code">unverified</code>,
      <code class="inline-code">contradicted</code>, or <code class="inline-code">excluded</code>
      claims as confirmed facts. Label them appropriately
      (e.g. "reportedly", "unconfirmed", "disputed").
    </li>
  </ol>
  <p>
    These rules are how the pipeline's guarantees carry through to the agent's output.
    See <a href="/keys/docs/guides/verified-context">Verified context</a> for the full guarantee chain.
  </p>

  <h2 id="fresh-machine">Fresh-machine walkthrough</h2>
  <p>
    The following sequence covers setup on a machine with no prior Restormel install.
    Commands and expected output shapes are shown; a Gateway key and workspace ID are required
    for the live steps (marked with <strong>[key required]</strong>).
  </p>
  <pre class="code-block"><code>{`# 1. Install the CLI and MCP package.
npm install -g @restormel/mcp @restormel/keys
# Expected: no errors; both packages in node_modules

# 2. Generate the config (no credentials needed for this step).
keys init --mcp --mcp-client claude-code
# Expected output shape:
# ── Claude Code ──
# Config file location:
#   ~/.claude.json
# ...mcpServers block with placeholders...

# 3. Verify the MCP server binary is reachable.
npx -y @restormel/mcp@latest --check
# Expected: JSON manifest on stdout, exit 0
# { "version": "x.y.z", "tools": ["connect.retrieve_verified", ...] }

# 4. [key required] Smoke-test the server with real credentials.
RESTORMEL_GATEWAY_KEY=rk_live_… \
  RESTORMEL_CONNECT_API_BASE=https://restormel.dev \
  RESTORMEL_WORKSPACE_ID=<your-uuid> \
  npx -y @restormel/mcp@latest --check
# Expected: same JSON manifest, exit 0 — credentials are not validated at start
# (the server connects lazily on the first tool call)

# 5. Paste the filled-in config block into ~/.claude.json.
# Restart Claude Code.

# 6. In the Claude Code chat, verify the tool is listed:
# "What MCP tools do you have?"
# Expected: connect.retrieve_verified listed

# 7. [key required] Make a tool call:
# "Use connect.retrieve_verified to find supported claims about [topic]"
# Expected response shape:
# {
#   "ok": true,
#   "mode": "strict",
#   "claims": [ { "claim": { ... }, "state": "supported", "evidence": [...], ... } ],
#   "total_retrieved": N,
#   "total_after_mode_filter": M
# }`}</code></pre>

  <h2 id="troubleshooting">Troubleshooting</h2>
  <table class="doc-table">
    <thead>
      <tr>
        <th scope="col">Symptom</th>
        <th scope="col">Cause</th>
        <th scope="col">Fix</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code class="inline-code">RST_CONNECT_HOSTED</code> error</td>
        <td>Env vars not passed by the client</td>
        <td>Verify the config file has correct JSON and the client was fully restarted</td>
      </tr>
      <tr>
        <td><code class="inline-code">RST_CONNECT_WORKSPACE</code> error</td>
        <td><code class="inline-code">RESTORMEL_WORKSPACE_ID</code> missing or empty</td>
        <td>Fill in the workspace UUID from the <a href="https://restormel.dev/keys/dashboard/connect">Connect hub</a></td>
      </tr>
      <tr>
        <td>Tool returns <code class="inline-code">claims: []</code></td>
        <td>Workspace has no ingested content, or query has no matches</td>
        <td>Ingest content first; try a broader query term</td>
      </tr>
      <tr>
        <td>401 from the Connect API</td>
        <td>Gateway key is invalid, expired, or scoped to a different project</td>
        <td>Regenerate the key in the <a href="https://restormel.dev/keys/dashboard">Dashboard</a></td>
      </tr>
      <tr>
        <td>Tool not listed in the client</td>
        <td>Config file not picked up / JSON syntax error</td>
        <td>Validate the JSON with <code class="inline-code">cat ~/.claude.json | python3 -m json.tool</code></td>
      </tr>
    </tbody>
  </table>

  <h2>Related</h2>
  <ul>
    <li>
      <a href="/keys/docs/guides/verified-context">Verified context</a> — what "supported" means, the
      five EBV states, the fail-safe gates, the G2 bar, and how to audit a claim yourself
    </li>
    <li>
      <a href="/keys/docs/guides/connect-first-graph-onboarding">Connect first graph onboarding</a> —
      build the knowledge graph this tool queries
    </li>
    <li>
      <a href="/keys/docs/guides/context-regression-ci">Context-regression CI</a> — gate pull requests
      on graph quality with <code class="inline-code">keys connect eval</code>
    </li>
    <li>
      <a href="/keys/docs/api-reference">API reference</a> — the OpenAPI spec for the Connect v1
      endpoints the tool proxies
    </li>
    <li>
      <a href="https://restormel.dev/keys/dashboard/connect">Connect hub</a> — pipeline, graph store,
      and quality reports for your workspace
    </li>
  </ul>
</div>
