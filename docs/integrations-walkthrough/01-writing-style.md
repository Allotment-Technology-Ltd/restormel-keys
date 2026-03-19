# Integrations Walkthrough — Writing Style

> **Status:** Canonical. Same principles as the [Keys walkthrough writing style](../walkthrough/01-writing-style-guide.md); terminology below is specific to Integrations.

---

## 1. Voice and tone

- **Second person.** "You" and "your workflow." Present tense. Active voice. Short sentences. No filler ("simply," "just," "easily").
- **Confident.** State what happens; use "if" only for genuinely conditional outcomes.

---

## 2. Canonical terminology (Integrations)

| Term | Meaning | Never say instead |
|------|---------|-------------------|
| **Restormel Integrations** | The developer enablement layer: CLI, MCP, AAIF | "Integrations product," "dev tools" (ambiguous) |
| **Restormel Keys** | Core: BYOK, routing, cost, entitlements | "Core," "Keys product" (without "Restormel") |
| **CLI** | `@restormel/keys-cli`: terminal commands (doctor, validate, models list, routing explain) | "keys-cli" (use "CLI" in prose) |
| **MCP** | Model Context Protocol; tool schemas and (when available) runtime server | "MCP server" (until runtime exists, we have schemas only) |
| **AAIF** | Agent-to-Agent Interaction Format; request/response types and validation | "AAIF API" (contract first) |
| **Developer Tools** | Dashboard section at `/keys/dashboard/dev-tools` (CLI, MCP, AAIF tabs) | "Integrations dashboard" (that's the marketing page) |
| **Provider Access** | Dashboard section for provider integrations (OpenRouter, Portkey, etc.); formerly "Integrations" | "Integrations" (reserved for CLI/MCP/AAIF) |
| **Usage path** | User choice: "In my app" / "In my terminal" / "In my agent or IDE" | "Onboarding path," "workflow choice" |

---

## 3. Page structure

Every phase page follows the same template as the Keys walkthrough:

- **Title:** Phase N — [Title]
- **Meta block:** Time, Prerequisites, You'll need
- **Summary:** 1–2 sentences on what this phase achieves
- **Steps:** Step N.1, N.2, … with "You'll see" and "How to test" where applicable
- **Agent prompts:** Optional, collapsed by default
- **Checkpoint:** Bullet list of what you now have
- **Prev/Next:** Phase navigation

---

## 4. Agent prompts

- Each prompt has: **id**, **title**, **intent**, **contextDocs**, **prompt** (the copy-pastable block), **gate** (pass/fail criterion).
- Prompts are **gated**: do not proceed to the next prompt until the gate passes.
- Context docs must be read (or provided to the agent) before running the prompt.
