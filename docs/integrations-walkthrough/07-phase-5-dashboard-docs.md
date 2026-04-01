# Phase 5 — Dashboard & docs

> **Time:** ~5 minutes  
> **Prerequisites:** Phases 0–2 (or 3–4) complete  
> **You'll need:** Restormel account, signed in to the Dashboard

This phase ties the Integrations experience together in the Dashboard and docs: Developer Tools section, usage path, and doc links.

---

## Step 5.1 — Developer Tools in the Dashboard

In the [Dashboard](https://restormel.dev/keys/dashboard) sidebar, open **Developer Tools**. You see:

- **Overview** — Cards for CLI, MCP, AAIF with status and setup CTAs
- **CLI** tab — Install instructions, command list, recent activity (when wired)
- **MCP** tab — Connection status, available tools, recent calls (when wired)
- **AAIF** tab — Request/response schema summary, request logs (when wired)

Use this as your home for Integrations status and quick links.

---

## Step 5.1b — Gateway keys and Connect CLI

For backend integration, open **Gateway keys** in the sidebar (`/keys/dashboard/access`):

- **Create Gateway key** and use **Copy .env snippet** to paste `RESTORMEL_GATEWAY_KEY`, `RESTORMEL_PROJECT_ID`, and `RESTORMEL_KEYS_BASE` into a local env file (never commit secrets).
- Or run `npx @restormel/keys-cli login` in your terminal and complete approval on **Connect CLI** (`/keys/dashboard/cli/connect`) — this mints a new Gateway key and delivers it once to your machine.

---

## Step 5.2 — Usage path and quick links

On the Dashboard **Overview** page, the usage path selector shows your chosen workflow and links to:

- **SDK docs** (if "In my app")
- **CLI quickstart** (if "In my terminal")
- **MCP setup** (if "In my agent or IDE")

Plus a link to **Developer tools** and a "Change" option to switch path.

---

## Step 5.3 — Doc links

Bookmark or link others to:

- [Integrations overview](/keys/docs/integrations) — CLI, MCP, AAIF reference
- [Integrations walkthrough](/keys/docs/integrations-walkthrough) — This journey
- [CLI quickstart](/keys/docs/integrations/cli)
- [MCP setup](/keys/docs/integrations/mcp)
- [AAIF overview](/keys/docs/integrations/aaif)

---

## Checkpoint

You now have:

- Developer Tools section and tabs in use.
- Gateway keys page and Connect CLI bookmarked when you use terminal linking or env snippets.
- Usage path and quick links visible on Overview.
- Doc links saved for your team or agent.
