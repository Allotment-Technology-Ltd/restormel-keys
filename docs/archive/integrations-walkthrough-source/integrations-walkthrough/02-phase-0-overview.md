# Phase 0 — What is Restormel Integrations?

> **Time:** ~5 minutes  
> **Prerequisites:** None  
> **You'll need:** A browser; optional: Restormel account

This phase establishes what Restormel Integrations is, how it relates to Restormel Keys, and when to use which surface (CLI, MCP, AAIF).

---

## Product model

- **Restormel Keys** — Core. BYOK, routing, cost, entitlements. You use it from your app via the SDK and HTTP APIs (**Dashboard API** with Gateway Key for resolve/routes/models index; **Zuplo Gateway** with consumer key for project/key CRUD — see in-app Cloud API doc).
- **Restormel Integrations** — Developer surfaces. Connects Keys to your **terminal** (CLI), **agent/IDE** (MCP), and **structured AI contracts** (AAIF).
- **Future Restormel** — Graph, evaluation, reasoning (out of scope for this walkthrough).

Integrations does **not** replace Keys. It makes Keys usable from more places: CLI for debugging and validation, MCP for agent tools, AAIF for predictable request/response shapes.

---

## When to use which surface

| Surface | Status | Use when |
|--------|--------|----------|
| **CLI** | Available | You want terminal-based doctor, validate, models list, routing explain |
| **MCP** | Early | You want agents or IDEs to call Restormel tools (models, cost, routing, docs) |
| **AAIF** | Advanced | You want a typed request/response contract for AI interactions |

---

## Step 0.1 — Confirm your starting point

You either:

- **Already use Restormel Keys** (you have a project, Gateway Key, routes). Integrations adds CLI/MCP/AAIF on top.
- **New to Restormel.** Start with the [Keys walkthrough](/keys/docs/walkthrough) for install and first resolve; then return here for Integrations phases 1–6.

### You'll see

You know whether you need to do the Keys walkthrough first or can start at Phase 1.

---

## Checkpoint

You now have:

- A clear picture of what Restormel Integrations is and how it relates to Keys.
- A decision on whether to complete the Keys walkthrough first or proceed to Phase 1.
