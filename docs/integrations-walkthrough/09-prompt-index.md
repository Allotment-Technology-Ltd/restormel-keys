# Integrations Walkthrough — Prompt Index

> **Status:** Canonical. All build-agent prompts for the Integrations walkthrough in one place. Execute in order; stop if a gate fails.

Use this when implementing the Integrations walkthrough with a coding agent. Each prompt's **Context docs** should be read (or provided to the agent) before running. **Gates** must pass before the next prompt.

---

## Prompt inventory

| # | Id | Source | Phase |
|---|-----|--------|-------|
| I01 | `integrations-overview-review` | [Phase 0](02-phase-0-overview.md) | 0 |
| I02 | `choose-workflow-persist` | [Phase 1](03-phase-1-choose-workflow.md) | 1 |
| I03 | `cli-install-doctor` | [Phase 2](04-phase-2-cli.md) | 2 |
| I04 | `cli-models-routing` | [Phase 2](04-phase-2-cli.md) | 2 |
| I05 | `mcp-schemas-install` | [Phase 3](05-phase-3-mcp.md) | 3 |
| I06 | `aaif-types-install` | [Phase 4](06-phase-4-aaif.md) | 4 |
| I07 | `dashboard-docs-links` | [Phase 5](07-phase-5-dashboard-docs.md) | 5 |
| I08 | `verify-and-document` | [Phase 6](08-phase-6-verify.md) | 6 |

**Recommended sequence (full):** I01 → I02 → I03 → I04 → I05 → I06 → I07 → I08.

**CLI-only path:** I01 → I02 → I03 → I04 → I07 → I08.

**MCP/AAIF schema-only:** I01 → I02 → I05 → I06 → I07 → I08.

**Operator API path:** I01 → I02 → I05 → I06 → I08, then validate provider health, route coverage, readiness, recommendations, and policy lifecycle APIs.

---

## I01 — `integrations-overview-review`

**Phase:** 0  **Source:** [02-phase-0-overview.md](02-phase-0-overview.md)

**Context docs:**
- This repo: `docs/integrations-walkthrough/02-phase-0-overview.md`
- This repo: `docs/integrations/INTEGRATIONS-FULL-SPEC.md` (§0–1)

**Prompt:**

> You are working in [your repo or the restormel-keys repo].
>
> **Goal:** Review the Restormel Integrations walkthrough Phase 0 and produce a one-paragraph summary of what Integrations is and when you would use CLI vs MCP vs AAIF. No code changes.
>
> **Steps:**
> 1. Read Phase 0 (What is Restormel Integrations?) in full.
> 2. Read the Integrations full spec §0 (Purpose) and §1 (Product model).
> 3. Write 2–3 sentences: what Integrations is, and which surface (CLI / MCP / AAIF) applies to "terminal workflow," "agent/IDE workflow," and "structured AI contract."
>
> **DO NOT:** Install packages. Modify any code. Commit.

**Gate:** You have a short written summary; no repo changes.

---

## I02 — `choose-workflow-persist`

**Phase:** 1  **Source:** [03-phase-1-choose-workflow.md](03-phase-1-choose-workflow.md)

**Context docs:**
- This repo: `docs/integrations-walkthrough/03-phase-1-choose-workflow.md`
- Dashboard: `/keys/dashboard` (usage path selector)

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Record the chosen Integrations usage path so later phases know which surface to configure.
>
> **Steps:**
> 1. Decide usage path: "app" | "terminal" | "agent" (or document that a human will choose in the Dashboard).
> 2. If automating: add to `.env.example` a placeholder `RESTORMEL_USAGE_PATH=` with a comment that values are `app`, `terminal`, or `agent`. Do not set a value in `.env`.
> 3. If not automating: document in README or docs that the user should open the Restormel Dashboard, go to Overview, and select "In my app" / "In my terminal" / "In my agent or IDE."
>
> **DO NOT:** Commit a real value for RESTORMEL_USAGE_PATH. Overwrite any existing env docs without reading them first.

**Gate:** Usage path is documented or env placeholder exists; no secrets.

---

## I03 — `cli-install-doctor`

**Phase:** 2  **Source:** [04-phase-2-cli.md](04-phase-2-cli.md)

**Context docs:**
- This repo: `docs/integrations-walkthrough/04-phase-2-cli.md`
- This repo: `packages/cli/README.md` (if present)
- npm: `@restormel/keys-cli`

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Install the Restormel Keys CLI and run doctor so it exits 0.
>
> **Steps:**
> 1. Add `@restormel/keys-cli` as a dev dependency (pnpm add -D @restormel/keys-cli or npm equivalent). If the repo uses a monorepo, add it to the app package that will run CLI commands.
> 2. Ensure `restormel.config.json` exists in the app root (or run `npx keys init` to scaffold). Config must have `framework` and `providers` (can be []).
> 3. Run `npx keys doctor` (or pnpm exec keys doctor). It must exit 0. If it fails, fix the cause (missing @restormel/keys, missing config, wrong framework).
> 4. Document in README or a doc file: "Restormel CLI: run `npx keys doctor` to validate setup; see [Integrations walkthrough](link)."
>
> **DO NOT:** Commit secrets. Run `keys validate` if it would expose key material in logs. Install the CLI globally unless the user explicitly wants global.

**Gate:** `npx keys doctor` exits 0; CLI is documented.

---

## I04 — `cli-models-routing`

**Phase:** 2  **Source:** [04-phase-2-cli.md](04-phase-2-cli.md)

**Context docs:**
- This repo: `docs/integrations-walkthrough/04-phase-2-cli.md` (Steps 2.4–2.5)
- This repo: `packages/core` defaultProviders (for models list)

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Verify CLI commands `keys models list` and `keys routing explain <model>` work.
>
> **Steps:**
> 1. Run `npx keys models list`. You should see at least one provider and its models. If the output is empty, the CLI may not have access to provider definitions — document that "models list requires @restormel/keys with default providers."
> 2. Run `npx keys routing explain gpt-4o` (or another model id from the list). You should see "Routing explanation for: gpt-4o" and steps showing provider resolution.
> 3. Add to your docs or README: "Use `keys models list` to see models; `keys routing explain <model>` to see how Restormel would route that model."
>
> **DO NOT:** Assume a specific model exists; use a model from the list or document the requirement.

**Gate:** Both commands run successfully; docs updated.

---

## I05 — `mcp-schemas-install`

**Phase:** 3  **Source:** [05-phase-3-mcp.md](05-phase-3-mcp.md)

**Context docs:**
- This repo: `docs/integrations-walkthrough/05-phase-3-mcp.md`
- This repo: `packages/mcp/src/tools.ts` (tool definitions)
- Docs: `/keys/docs/integrations/mcp`

**Prompt:**

> You are working in [your repo or an agent/MCP server repo].
>
> **Goal:** Install @restormel/mcp and confirm you can import the tool definitions.
>
> **Steps:**
> 1. Add `@restormel/mcp` as a dependency (or dev dependency if only building tool descriptors).
> 2. In a small script or test file, import `ALL_TOOLS` and `modelsListTool` from "@restormel/mcp". Log the length of ALL_TOOLS (should be 7) and the name of modelsListTool (should be "models.list").
> 3. Document: "Restormel MCP tool schemas from @restormel/mcp; runtime server via restormel-mcp stdio. See [MCP setup](/keys/docs/integrations/mcp)."
>
> **DO NOT:** Implement a full MCP server unless the task explicitly asks for it. This prompt is schema-only.

**Gate:** Package installed; import works; docs mention MCP.

---

## I06 — `aaif-types-install`

**Phase:** 4  **Source:** [06-phase-4-aaif.md](06-phase-4-aaif.md)

**Context docs:**
- This repo: `docs/integrations-walkthrough/06-phase-4-aaif.md`
- This repo: `packages/aaif/src/types.ts`, `packages/aaif/src/validate.ts`

**Prompt:**

> You are working in [your app repo or a service repo].
>
> **Goal:** Install @restormel/aaif and use the type guards to validate a sample request and response.
>
> **Steps:**
> 1. Add `@restormel/aaif` as a dependency.
> 2. Import `AAIFRequest`, `AAIFResponse`, `isAAIFRequest`, `isAAIFResponse` from "@restormel/aaif".
> 3. Create a minimal valid object matching AAIFRequest (input, optional task). Pass it to isAAIFRequest; it must return true. Create a minimal valid AAIFResponse and pass to isAAIFResponse; it must return true.
> 4. Document: "AAIF types, runtime guards, and runtime helper via executeAAIFRequest from @restormel/aaif. See [AAIF overview](/keys/docs/integrations/aaif)."
>
> **DO NOT:** Send real traffic to an AAIF endpoint (none is specified yet). This is types and validation only.

**Gate:** Package installed; both guards return true for valid objects; docs updated.

---

## I07 — `dashboard-docs-links`

**Phase:** 5  **Source:** [07-phase-5-dashboard-docs.md](07-phase-5-dashboard-docs.md)

**Context docs:**
- This repo: `docs/integrations-walkthrough/07-phase-5-dashboard-docs.md`

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Add a short "Restormel Integrations" section to your README or internal docs with links to the Dashboard and doc pages.
>
> **Steps:**
> 1. Add a section titled "Restormel Integrations" (or "Developer tools / Integrations").
> 2. Include links: Dashboard Developer Tools (/keys/dashboard/dev-tools), Integrations walkthrough (/keys/docs/integrations-walkthrough), and the reference page for your chosen surface (CLI, MCP, or AAIF).
> 3. One sentence: what you use (e.g. "We use the CLI for doctor and routing explain; see the walkthrough for setup."
>
> **DO NOT:** Paste Dashboard URLs with secrets or session tokens. Use path-only or canonical docs URLs.

**Gate:** README or doc has an Integrations section with at least two correct links.

---

## I08 — `verify-and-document`

**Phase:** 6  **Source:** [08-phase-6-verify.md](08-phase-6-verify.md)

**Context docs:**
- This repo: `docs/integrations-walkthrough/08-phase-6-verify.md`

**Prompt:**

> You are working in [your app repo].
>
> **Goal:** Run the Phase 6 verification checklist and document completion.
>
> **Steps:**
> 1. If CLI is in use: run `npx keys doctor` and confirm exit 0. Run `npx keys models list` and `npx keys routing explain <model>`; confirm they succeed.
> 2. Add a "Verification" or "Go live" subsection under Restormel Integrations: checklist items from Phase 6 (CLI verified, Dashboard Developer Tools checked, doc links in README, optional: CLI in CI).
> 3. If you used agent prompts from this walkthrough, add: "Integrations setup followed the [Integrations walkthrough prompt index](link to 09-prompt-index)."
>
> **DO NOT:** Mark "go live" as done if any verification step failed. Fix or document the gap.

**Gate:** Verification steps run; checklist and prompt-index reference (if applicable) are in docs.
