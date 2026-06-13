# Aikido Security MCP (Cursor)

**Status:** Canonical setup for SAST and secret scanning from Cursor Agent. Product security baseline remains [security-baseline.md](../governance/security-baseline.md); this guide is MCP wiring only.

## What it provides

- **`aikido_full_scan`** — scan local files for vulnerabilities (SAST) and hardcoded secrets before commit
- **`aikido_issues_list`** — list issues from your Aikido workspace (by repo, cloud, VM, domain, or container)

Official docs: [Aikido Cursor MCP](https://help.aikido.dev/ai-and-dev-tools/aikido-mcp/cursor-mcp). npm: [`@aikidosec/mcp`](https://www.npmjs.com/package/@aikidosec/mcp).

## One-time setup

1. In Aikido: **Settings → Integrations → IDE → MCP** — create a **Personal Access Token**.

2. **Easiest on macOS (recommended):** edit the local env file Cursor already uses:

   - In Cursor: **File → Open File…** (or `Cmd+O`)
   - Paste this path and press Open:

     `/Users/adamboon/.cursor/aikido.env`

   - On the `AIKIDO_API_KEY=` line, paste your token **after** `=` (no spaces). Save (`Cmd+S`).

   Global MCP config should reference that file:

   ```json
   "aikido": {
     "command": "npx",
     "args": ["-y", "@aikidosec/mcp"],
     "envFile": "/Users/adamboon/.cursor/aikido.env"
   }
   ```

3. **Alternative:** shell env in `~/.zprofile` or `~/.zshrc` (hidden files — open via **Go → Go to Folder…** in Finder with `Cmd+Shift+G`, then type `~/.zprofile`):

   ```bash
   export AIKIDO_API_KEY='your-token-here'
   ```

   GUI Cursor on macOS often only sees this if you use `envFile` above or launch Cursor from Terminal.

4. Project template for others: [`.cursor/mcp.json.example`](../../.cursor/mcp.json.example).

5. Restart Cursor fully (`Cmd+Q`, reopen). **Settings → MCP** → `aikido` should be connected.
6. Use **Agent** mode — MCP tools are not available in Ask mode.

### Alternative: Aikido VS Code / Cursor extension

The [Aikido IDE extension](https://help.aikido.dev/) can enable MCP via **Expansion Packs** without hand-editing `mcp.json`. Use that path if you already run the extension.

## Agent usage (examples)

- “Scan my staged changes with `aikido_full_scan` before I commit.”
- “Run Aikido on the Connect gateway key storage files I just edited.”
- “List critical SAST issues for repo `restormel-keys` via `aikido_issues_list`.”

Optional Cursor custom instruction (user-level):

```text
Scan any new or modified code with aikido_full_scan before finalizing security-sensitive changes.
```

## Security

- Do **not** commit `AIKIDO_API_KEY` or paste tokens into `mcp.json` — use `${env:AIKIDO_API_KEY}` only.
- Do **not** log scan output that might contain secret literals from findings.
- Aikido complements — does not replace — BYOK review in [security-baseline.md](../governance/security-baseline.md) and the **restormel-high-risk-security** skill ([pre-pr-security-review.md](./pre-pr-security-review.md)).
