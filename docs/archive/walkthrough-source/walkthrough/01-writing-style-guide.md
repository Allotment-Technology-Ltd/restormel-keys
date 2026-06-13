# Walkthrough — Writing Style Guide

> **Status:** Proposed. Canonical style rules for the "Walkthrough" section of the Restormel Keys public docs. All walkthrough pages must follow these conventions.

---

## 1. Voice and tone

- **Second person throughout.** "You" and "your app," never "the developer" or "one."
- **Present tense.** "You see a JSON response" not "You will see a JSON response."
- **Active voice.** "The resolve endpoint returns…" not "A response is returned by…"
- **Confident but not cocky.** State what happens; don't hedge with "should" or "might" when describing deterministic behaviour. Use "if" for genuinely conditional outcomes.
- **Short sentences.** Aim for 15–20 words average. Break complex ideas across multiple sentences rather than using semicolons or dashes.
- **No filler.** Cut "simply," "just," "easily," "of course," "as you can see." If something is simple, the reader will feel it from the short instructions — you don't need to tell them.

---

## 2. Canonical terminology

Use these terms exactly. Do not invent synonyms in any walkthrough page.

| Term | What it means | Never say instead |
|------|---------------|-------------------|
| **Workspace** | Top-level organisational container in the dashboard (maps to an account or org) | "Account," "org," "tenant" |
| **Project** | A container for routes, policies, keys, and usage within a workspace | "App," "service," "instance" |
| **Environment** | A deployment context within a project (e.g. production, staging) | "Stage," "slot," "config" |
| **Gateway Key** | The key your backend uses to authenticate to the Restormel API (format `rk_…`) | "API key" (ambiguous), "backend key," "server key" |
| **Connect CLI** | Dashboard route `/keys/dashboard/cli/connect` where you approve **`keys login`** from the terminal | "CLI OAuth page" (vague) |
| **Provider credential** | An AI provider API key stored in Restormel (e.g. an OpenAI key) | "BYOK key," "user key," "secret" |
| **Route** | A named routing configuration within a project; contains steps and a route mode | "Endpoint," "path," "chain" |
| **Step** | One entry in a route's fallback chain; specifies a provider preference and optional model | "Stage," "tier," "level" |
| **Route mode** | How a route's steps are evaluated (e.g. `fallback_chain`) | "Strategy," "algorithm" |
| **Policy** | A rule that constrains resolution (model allowlist, budget cap, deprecated block, etc.) | "Guard," "filter," "rule" (too vague) |
| **Resolve** | The act of asking Restormel which provider + model + key to use for a request | "Route" (verb — too ambiguous), "select," "pick" |
| **ModelSelector** | The embeddable UI component that lets end-users choose a model | "Model picker," "model dropdown" |
| **KeyManager** | The embeddable UI component that lets end-users manage their provider credentials | "Key panel," "BYOK settings" |
| **Dashboard** | The web app at `/keys/dashboard` where you configure projects, routes, policies | "Admin," "portal," "console" |
| **Dashboard API** | HTTP API on the dashboard host (`/keys/dashboard/api/…`) — resolve, routes/steps, policies, **GET** project models index, catalog, etc. | "Zuplo API," "the gateway" (wrong surface) |
| **Cloud API** (product umbrella) | Documented HTTP access: **Dashboard API** (Gateway Key) **and** **Zuplo Gateway API** (consumer key). See in-app Cloud API page. | "REST API" without naming which surface |
| **Zuplo Gateway API** | Control-plane CRUD at the Zuplo base URL (projects, keys) with a **consumer key** | "Dashboard API" |
| **Consumer key** | A Zuplo-issued key (format `zpka_…`) for the **Zuplo Gateway** host | "Zuplo key," "external key" |

### When to use which credential (auth cheat-sheet)

| Credential | Scope | Use for | Never use for |
|------------|--------|---------|----------------|
| **Gateway Key** (`RESTORMEL_GATEWAY_KEY`, format `rk_…`) | Project + environment | Resolve, policy evaluate, routes/steps, **GET** `…/projects/{id}/models` (project model index), catalog routes that require it | Browser/client-side code; unrelated projects; **not** valid as Zuplo consumer key |
| **Consumer key** (`zpka_…`) | Zuplo-issued | **Zuplo Gateway** control-plane (projects, keys per portal docs) | Dashboard API / resolve / project model index |
| **Session** (dashboard login) | User + workspace | Dashboard UI: routes, policies, keys, model index **edits** (until HTTP mutations exist), logs | Server-side automation from untrusted contexts |

Use the Gateway Key in server-side env vars for resolve, evaluate, and **read** project models. Never expose the Gateway Key in browser code.

To get a Gateway key into a local project, use **Copy .env snippet** on **Gateway keys** (`/keys/dashboard/access`) or run **`keys login`** (device-style flow) and complete **Connect CLI**. See the [Integrations walkthrough Phase 2](/keys/docs/integrations-walkthrough/phase-2-cli).

### Provider names

Always capitalise: **OpenAI**, **Anthropic**, **Google** (not "google" or "GCP" when referring to the AI provider).

### Package names

Always use the full npm scope: `@restormel/keys`, `@restormel/keys-react`, `@restormel/keys-svelte`, `@restormel/keys-elements`, `@restormel/keys-cli`. Never abbreviate to "the keys package" without first establishing the full name on the page.

---

## 3. Page structure template

Every walkthrough page follows this skeleton:

```markdown
# Phase N — [Title]

> **Time:** ~X minutes
> **Prerequisites:** [Phase N-1] complete, [specific tool/access]
> **You'll need:** [list of accounts, tools, or access]

[1–2 sentence summary of what this phase achieves and why it matters.]

---

## Step N.1 — [Action verb] [object]

[Instructions — short paragraphs, no more than 3–4 lines each.]

### You'll see

[Describe the visible outcome: a response, a UI change, a terminal output.]

### How to test

[Concrete verification step: a curl command, a dashboard check, a CLI command.]

### Build-agent prompt: [short name]

**Context docs:**
- [list of walkthrough and repo docs this prompt needs]

**Prompt:**

> [fenced copy-paste block]

**Gate:** [what must be true before moving on]

---

## Step N.2 — …

[Repeat pattern.]

---

## Checkpoint

[Summary: what you now have working, what's next.]

**Next:** [Phase N+1 — Title](link)
```

---

## 4. Callout types

Use exactly these callout labels and styles. Do not invent new ones.

| Label | When to use | In Svelte/docs |
|-------|-------------|----------------|
| **Tip** | Helpful shortcut or best practice that isn't strictly required | Use a styled block or component for tips (e.g. `.callout.tip`). |
| **Pitfall** | Common mistake that wastes time or causes a confusing error | Use a caution-style callout. |
| **If you see…** | Troubleshooting for a specific error message or unexpected state | Use a note-style callout with the error text. |
| **Security** | Anything related to key handling, secret storage, or credential safety | Use a danger-style callout. |
| **Dashboard** | When a step requires action in the Restormel dashboard UI | Use a note-style callout. |

### Callout formatting rules

- One callout per step maximum. If you need two, the step is too big — split it.
- Callout text should be 1–3 sentences. If longer, it should be a subsection, not a callout.
- Keep code blocks outside callouts: put the code block immediately after the callout so it renders correctly in the Svelte docs.

---

## 5. Code block conventions

- **Language tags:** Always specify the language. Use `ts` for TypeScript, `bash` for shell commands, `json` for JSON responses. Never use bare ` ``` `.
- **Imports:** Always show imports. Never assume the reader knows where a function comes from.
- **Copy-paste ready:** Every code block should work if pasted into the right file. No `// ...` placeholders unless the omitted code is genuinely irrelevant and clearly labelled.
- **File paths:** When a code block is meant for a specific file, include a comment on line 1: `// src/lib/server/restormel.ts` or `// app/api/resolve/route.ts`.
- **Environment variables:** Show placeholder patterns, never real values. Use `RESTORMEL_GATEWAY_KEY=<gateway_key_placeholder>` not any real-looking key value.
- **Framework-aware:** When a code example differs by framework, show the primary framework (Next.js App Router) first, then provide a tabbed or clearly-labelled alternative for SvelteKit and vanilla/Web Components.

---

## 6. Build-agent prompt conventions

Build-agent prompts are fenced blocks that readers can paste directly into Cursor, Claude Code, or a similar coding agent. They follow strict rules:

### Structure

```markdown
### Build-agent prompt: [short-kebab-name]

**Context docs:**
- `docs/walkthrough/[this-file].md` — [one-line reason]
- `docs/02-architecture.md` — [one-line reason]
- `packages/core/src/server/resolve.ts` — [one-line reason]
- [any other files the agent needs to read first]

**Prompt:**

> You are working in [repo name / project context].
>
> **Goal:** [one sentence]
>
> **Steps:**
> 1. [concrete action with file path]
> 2. [concrete action with file path]
> …
>
> **DO NOT:** [explicit guardrails]

**Gate:** [what must be true for this prompt's work to be considered done]
```

### Rules

- **Context docs are mandatory.** Every prompt lists the walkthrough page it belongs to, plus every repo doc or source file the agent should read before starting.
- **One goal per prompt.** If a phase has multiple implementation tasks, use multiple prompts.
- **File paths are explicit.** Never say "the resolve file" — say `packages/core/src/server/resolve.ts`.
- **DO NOT blocks are mandatory.** Every prompt must include at least one guardrail.
- **Gates are mandatory.** Every prompt ends with a concrete, verifiable acceptance criterion.
- **No secrets in prompts.** Use placeholder patterns (`rk_your_key_here`). Include a `DO NOT: Commit real API keys or secrets` guardrail in every prompt that touches credentials.

---

## 7. Cross-reference conventions

- **Internal walkthrough links:** Use relative paths: `[Phase 2](./04-phase-2-resolve)` (or the correct filename for the docs implementation).
- **Existing docs links:** Use paths from the docs root: `[Framework compatibility](/keys/docs/compatibility/)`.
- **Dashboard links:** Always use canonical URLs from `ux-contracts.md`: Dashboard → `/keys/dashboard`, Sign in → `/keys/dashboard/login`.
- **External links:** Use `target="_blank"` and `rel="noopener noreferrer"` where the Svelte app renders links. Label clearly: `[OpenAI API docs](https://platform.openai.com/docs) (external)`.
- **Repo file references (in prompts only):** Use repo-relative paths: `packages/core/src/server/resolve.ts`, `apps/dashboard/src/routes/keys/dashboard/api/projects/[id]/resolve/+server.ts`.

---

## 8. Length and density guidelines

| Content type | Target length | Notes |
|-------------|---------------|-------|
| Page intro | 1–2 sentences | What this phase does and why |
| Step instructions | 3–8 lines of prose | Break longer steps into sub-steps |
| "You'll see" block | 2–5 lines | Include a small code/JSON snippet if helpful |
| "How to test" block | 1–3 lines + one command | Should be runnable, not descriptive |
| Build-agent prompt | 10–30 lines in the fenced block | Enough for a coding agent to act; not a full spec |
| Callouts | 1–3 sentences | If longer, make it a subsection |
| Checkpoint (page footer) | 2–4 sentences | Summarise state and link to next |

---

## 9. Accessibility and inclusivity

- **No jargon without definition.** The first use of any term from the terminology table (§2) should be followed by a brief parenthetical if it's not self-evident from context.
- **No assumptions about experience level.** The walkthrough is written for a developer who has built an AI-powered app but has never used Restormel Keys. They know what an API key is; they don't know what a "route step" is in this product.
- **Screen reader friendly headings.** H2 headings should be descriptive enough to navigate by heading alone (e.g. "Step 2.1 — Call the resolve endpoint" not "Step 2.1").
- **Alt text for diagrams.** Any mermaid or image must have a text summary.

---

## 10. Naming and file conventions for the walkthrough folder

All walkthrough files live in a single folder (e.g. `docs/walkthrough/`). File naming:

```
docs/walkthrough/
  00-index.md                    ← master index (committed last)
  00-walkthrough-ia.md           ← docs IA and navigation
  01-writing-style-guide.md      ← this file
  02-phase-0-inventory.md        ← Phase 0 page spec
  03-phase-1-install.md          ← Phase 1 page spec
  04-phase-2-resolve.md          ← Phase 2 page spec
  05-phase-3-routes.md           ← Phase 3 page spec
  06-phase-4-policies.md         ← Phase 4 page spec
  07-phase-5-ui.md               ← Phase 5 page spec
  08-phase-6-golive.md           ← Phase 6 page spec
  09-migration-paths.md          ← Migration guide
  10-verification-strategy.md    ← Verification strategy
  11-prompt-index.md             ← All prompts collected with context refs
```

---

*Next file: `02-phase-0-inventory.md` — the "Before you begin" entry page and Phase 0 (inventory and remove custom routing).*
