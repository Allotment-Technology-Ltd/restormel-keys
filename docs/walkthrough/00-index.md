# Walkthrough — Master Index

> **Status:** Proposed. Entry point for the `docs/walkthrough/` folder. Commit this file last after all other walkthrough files are in place.

---

## What this is

A public-facing, app-agnostic integration walkthrough for Restormel Keys. It takes a developer from "I have an AI app with some routing" to "my app resolves, routes, enforces policies, and shows embeddable UI through Restormel Keys."

The walkthrough is designed to work as:
- **Public docs** (Svelte/SvelteKit docs under `/keys/docs/walkthrough/`, served by the same app as the dashboard)
- **A dogfooding plan** (the same journey SOPHIA follows as the first consumer)
- **A prompt pack** (12 build-agent prompts that a coding agent can execute sequentially)

---

## File listing

| File | Purpose | Type |
|------|---------|------|
| `00-index.md` | **This file.** Master index and reading order. | Index |
| `00-walkthrough-ia.md` | Docs IA: navigation placement, page map, mermaid flow diagram, cross-links, dashboard checklist integration. | Architecture |
| `01-writing-style-guide.md` | Terminology, voice, page template, callout types, code conventions, prompt formatting rules. | Style guide |
| `02-phase-0-inventory.md` | **Phase 0.** "Before you begin" entry page + audit existing routing. Prompts: P01, P02. | Walkthrough page |
| `03-phase-1-install.md` | **Phase 1.** Install packages, create dashboard project, generate Gateway Key, run `keys doctor`. Prompt: P03. | Walkthrough page |
| `04-phase-2-resolve.md` | **Phase 2.** First resolve call (curl + typed client), feature flag wiring, error handling, optional local resolve. Prompts: P04, P05. | Walkthrough page |
| `05-phase-3-routes.md` | **Phase 3.** Create routes with steps, configure fallback chain, test failover, wire route IDs. Prompt: P06. | Walkthrough page |
| `06-phase-4-policies.md` | **Phase 4.** Policies, bindings, evaluate vs resolve, structured errors, budget/token caps. Prompts: P07B, P07C, P07. | Walkthrough page |
| `07-phase-5-ui.md` | **Phase 5.** Embed ModelSelector (React, SvelteKit, Web Components), optional KeyManager, policy-filtered model list, theming. Prompt: P08. | Walkthrough page |
| `08-phase-6-golive.md` | **Phase 6.** Pre-cutover checklist, parallel run, full cutover, smoke test, legacy code removal. Prompts: P09, P10. | Walkthrough page |
| `09-migration-paths.md` | Migration variants: custom, LiteLLM, Portkey, OpenRouter. Strangler pattern. Comparison table. Prompt: P11. | Migration guide |
| `10-verification-strategy.md` | Dashboard checks, CLI checks, smoke tests, ongoing monitoring, CI integration. Prompt: P12. | Verification |
| `11-prompt-index.md` | All 12 build-agent prompts collected with context doc references and execution order. | Prompt pack |
| `12-staging-and-ci-setup.md` | **Staging and CI setup.** Non-production project/env, each secret (where to get it, what to call it, where to save it, rotate/replace), nightly and post-deploy. | Walkthrough page |
| `../reference/npm-packages.md` | npm scope: headless vs UI, pnpm monorepos, verify before install. | Reference |

---

## Reading order

**For docs readers (understanding the product):**

```
00-walkthrough-ia.md → 02-phase-0 → 03-phase-1 → 04-phase-2 → 05-phase-3 →
06-phase-4 → 07-phase-5 → 08-phase-6 → 09-migration-paths → 10-verification → 12-staging-and-ci-setup
```

**For implementors (executing with a coding agent):**

```
01-writing-style-guide.md (skim for terminology) → 11-prompt-index.md (execute P01–P12 in order)
```

**For docs authors (contributing to the walkthrough):**

```
00-walkthrough-ia.md → 01-writing-style-guide.md → then the page you're editing
```

---

## Cross-references to existing repo docs

The walkthrough references these existing docs. Keep links consistent when file paths change.

### Strategy and architecture

| Existing doc | Referenced by | Why |
|-------------|---------------|-----|
| `docs/01-product-strategy.md` | Migration paths, Phase 4 | Product modes, competitive gap matrix |
| `docs/02-architecture.md` | Phases 1–5, prompt index | Package structure, framework compatibility |
| `docs/ux-contracts.md` | Phase 1, Phase 5, style guide | Canonical URLs, state conventions |
| `docs/documentation-strategy.md` | IA doc | Same-link rule, doc journey |

### Reference and runbooks

| Existing doc | Referenced by | Why |
|-------------|---------------|-----|
| `docs/reference/sophia-dogfooding-plan.md` | Phases 0–5, prompt index | Removal pattern, resolve wiring, routes, policies, UI |
| `docs/reference/sophia-integration.md` | Phases 0, 2, 5, prompt index | KeyStorage adapter, resolve handler, middleware |
| `docs/runbooks/zuplo-setup.md` | Phase 6 | Gateway validation checks |
| `docs/testing-strategy.md` | Verification strategy | Testing scope |

### Source code

| File | Referenced by | Why |
|------|---------------|-----|
| `packages/core/src/keys.ts` | Phases 1–2 | `createKeys` API |
| `packages/core/src/router.ts` | Phases 2–3 | Router, `ResolveResult`, fallback |
| `packages/core/src/server/resolve.ts` | Phase 2 | Resolve middleware |
| `packages/core/src/entitlements.ts` | Phase 4 | Entitlements, model matching |
| `packages/cli/README.md` | Phases 1, 6, verification | CLI commands |
| `packages/react/README.md` | Phase 5 | React wrapper API |
| `packages/elements/README.md` | Phase 5 | Web Component API |
| `apps/dashboard/…/resolve/+server.ts` | Phases 2–3 | Resolve endpoint |
| `apps/dashboard/…/policies/evaluate/+server.ts` | Phase 4 | Evaluate endpoint |
| `.github/workflows/ci.yml` | Verification | CI workflow |

---

## Prompt summary

12 prompts covering the full integration lifecycle:

| Phase | Prompts | Focus |
|-------|---------|-------|
| 0 — Inventory | P01, P02 | Audit, classify, feature flag |
| 1 — Install | P03 | Packages, config, env |
| 2 — Resolve | P04, P05 | HTTP client, local resolve |
| 3 — Routes | P06 | Route IDs, call sites |
| 4 — Policies | P07 | Policy error handling |
| 5 — UI | P08 | Embed components |
| 6 — Go live | P09, P10 | Smoke test, legacy removal |
| Migration | P11 | LiteLLM plan |
| Ongoing | P12 | CI verification |

**Fresh integration:** `P01 → P02 → P03 → P04 → P06 → P07 → P08 → P09 → [cutover] → P10 → P12`

**LiteLLM migration:** `P11 → P01 → P02 → P03 → P04 → P06 → P07 → P08 → P09 → [cutover] → P10 → P12`

---

## How to commit this folder

Recommended path: `docs/walkthrough/` in the restormel-keys repo.

```bash
mkdir -p docs/walkthrough
# Copy all walkthrough files into docs/walkthrough/
```

Then update `docs/00-master-index.md` to include a "Walkthrough" entry pointing to `docs/walkthrough/00-index.md`.

---

*This completes the walkthrough documentation suite.*
