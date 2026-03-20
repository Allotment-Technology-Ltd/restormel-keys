# Integrations Walkthrough — Master Index

> **Status:** Canonical. Entry point for the Integrations walkthrough. Same principles and layout as the [Keys walkthrough](../walkthrough/00-index.md); separate journey from "never heard of it" to full implementation.

---

## What this is

A public-facing walkthrough for **Restormel Integrations**: the developer enablement layer (CLI, MCP, AAIF) that connects Restormel Keys to real developer workflows. It takes you from "What is Integrations?" to having at least one surface (CLI, MCP, or AAIF) installed, configured, and verified.

The walkthrough is designed to work as:

- **Public docs** — SvelteKit pages under `/keys/docs/integrations-walkthrough/`, same app as dashboard and Keys docs
- **Same principles as Keys walkthrough** — Second person, present tense, short sentences, canonical terminology, page template with Time/Prerequisites/You'll need, "You'll see" / "How to test", checkpoint checklist
- **Agent prompt pack** — Each phase has optional, collapsed "Agent prompts" for users implementing with a coding agent; full prompt index at the end

---

## Who this is for

- You have heard of Restormel Keys and want to add **CLI**, **MCP**, or **AAIF** to your workflow
- You want terminal-based validation and routing inspection (CLI)
- You want agent/IDE integration via Model Context Protocol (MCP)
- You want a structured request/response contract for AI interactions (AAIF)
- You may be implementing with a coding agent and want gated, sequential prompts

---

## Prerequisites

- **Restormel Keys** — Integrations builds on Keys. You need (or will create) a Restormel account, project, and optionally a Gateway Key. The [Keys walkthrough](/keys/docs/walkthrough) covers that.
- **Choice of surface** — CLI (available now), MCP (early; schemas first), AAIF (advanced; types first). Phase 1 helps you choose.

---

## Phases

| Phase | Title | What you do |
|-------|--------|-------------|
| 0 | [What is Restormel Integrations?](02-phase-0-overview.md) | Product model, when to use, relation to Keys |
| 1 | [Choose your workflow](03-phase-1-choose-workflow.md) | In my app / terminal / agent — and persist choice |
| 2 | [CLI](04-phase-2-cli.md) | Install CLI, doctor, validate, models list, routing explain |
| 3 | [MCP](05-phase-3-mcp.md) | Tool surface, setup, connection (when runtime exists) |
| 4 | [AAIF](06-phase-4-aaif.md) | Request/response types, validation, when to use |
| 5 | [Dashboard & docs](07-phase-5-dashboard-docs.md) | Developer Tools section, usage path, doc links |
| 6 | [Verify and go live](08-phase-6-verify.md) | CLI doctor, dashboard checks, smoke, agent prompts |
| — | [Prompt index](09-prompt-index.md) | All agent prompts in one place for sequential execution |

---

## Implementing with a coding agent

Each phase page includes an **"Agent prompts"** section. It is collapsed by default. Use it if you want a coding agent to implement that phase in your repo in a safe, gated sequence. Run prompts in order; stop if a gate fails. The [Prompt index](09-prompt-index.md) collects every prompt with context doc references.

---

## Reading order

**Understanding the product:** Phase 0 → Phase 1 → Phase 2 (or 3 or 4 depending on your choice) → Phase 5 → Phase 6.

**Implementing with an agent:** [01-writing-style.md](01-writing-style.md) (skim) → [09-prompt-index.md](09-prompt-index.md) (execute prompts in order).

---

## Cross-references

- [Keys walkthrough](/keys/docs/walkthrough) — Install, resolve, routes, policies, UI, go live
- [Integrations full spec](../integrations/INTEGRATIONS-FULL-SPEC.md) — Product, UX, IA, component spec, build prompts
- [Docs Integrations overview](/keys/docs/integrations) — CLI, MCP, AAIF reference pages
- [Choosing a route model](../guides/choosing-route-model.md) — shared generic vs dedicated stage-aware routes
- [From resolve to execution](../guides/resolve-to-execution-contract.md) — resolve guarantees vs host execution obligations
