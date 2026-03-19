# Phase 1 — Choose your workflow

> **Time:** ~5 minutes  
> **Prerequisites:** [Phase 0](02-phase-0-overview.md) complete  
> **You'll need:** Access to the [Dashboard](/keys/dashboard) (optional; you can choose without it)

This phase captures how you want to use Restormel: **in my app**, **in my terminal**, or **in my agent or IDE**. The choice drives which phases you do next (CLI, MCP, or both) and surfaces the right quick-links in the dashboard.

---

## Step 1.1 — Choose a usage path

When you open the [Dashboard](/keys/dashboard) overview, you see the question: **"How do you want to use Restormel?"**

Options:

1. **In my app** — You integrate via the SDK and Cloud API. Focus on the [Keys walkthrough](/keys/docs/walkthrough). Integrations CLI is still useful for validation and routing explain.
2. **In my terminal** — You want the CLI for doctor, validate, models list, routing explain. Proceed to [Phase 2 — CLI](04-phase-2-cli.md).
3. **In my agent or IDE** — You want MCP tools. Proceed to [Phase 3 — MCP](05-phase-3-mcp.md).

You can change your answer later (Dismiss or Change on the dashboard).

---

## Step 1.2 — Persist your selection

If you are in the Dashboard, click one of the three options. Your choice is stored in localStorage (`rk_usage_path`) and the overview shows follow-up links (SDK docs, CLI quickstart, MCP setup).

If you are implementing with an agent, the agent can create a small config or env placeholder that records the chosen path (e.g. `RESTORMEL_USAGE_PATH=cli`) so later phases know which path to configure.

### You'll see

The dashboard overview shows your selected workflow and links to the relevant docs (CLI quickstart, MCP setup, or SDK docs).

### How to test

Reload the dashboard overview. Your selection is still there. Click "Change" and pick a different option; confirm the links update.

---

## Checkpoint

You now have:

- A chosen usage path (app / terminal / agent).
- Persisted selection (dashboard or config/env for agents).
- Clear next step: Phase 2 (CLI), Phase 3 (MCP), or Keys walkthrough (app).
