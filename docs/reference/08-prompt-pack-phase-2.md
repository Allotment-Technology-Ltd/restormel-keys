# Restormel Keys — Prompt Pack Phase 2

**Phase:** UI Components + Framework Wrappers + CLI (Weeks 3–4)
**Target:** Cursor
**Prerequisites:** Phase 1 complete. `@restormel/keys` v0.1.0 published.

---

## Prompt 2.1 — Svelte KeyManager component

```
Create the KeyManager Svelte 5 component for @restormel/keys-svelte.

CONTEXT: Primary embeddable UI. Settings panel for managing AI provider API keys. Themeable, accessible, works in any host app.

STEPS:

1. Set up packages/svelte with svelte 5, @restormel/keys as dependency, vite library mode build

2. Create KeyManager.svelte:
   Props: keys (RestormelKeys instance), userId, onKeyAdded?, onKeyRemoved?, providers?
   States: Empty (add first key), Key entry (provider form, test, save), Key list (provider icon, masked key, status, expand), Key detail (models, spend, budget, delete)
   Styling: --rk-* CSS custom properties, scoped, dark default, inherit fonts
   Accessibility: keyboard nav, aria-labels, aria-expanded, focus management, screen reader announcements

3. Create theme.css with --rk-* defaults, .rk-dark and .rk-light presets

DO NOT: Import external icon/CSS libraries. Use inline SVG. Plain CSS with custom properties.
```

**Gate:** Component renders. Keys can be added, validated, listed, deleted.

---

## Prompt 2.2 — ModelSelector and CostEstimator

```
Create ModelSelector and CostEstimator Svelte 5 components.

STEPS:

1. ModelSelector.svelte: models grouped by provider, available/unavailable styling with reasons, click fires onSelect
2. CostEstimator.svelte: estimated cost display, breakdown, budget comparison with colour coding (green/amber/red)
3. Icons module: inline SVG strings for OpenAI, Anthropic, Google, generic
4. Export all from index.ts
5. Tests: rendering, grouping, cost display, custom property respect

DO NOT: Import icon libraries. Use external CSS frameworks.
```

**Gate:** All three components render. Tests pass.

---

## Prompt 2.3 — Web Component wrappers

```
Create Web Component wrappers for Svelte components.

CONTEXT: This is the universal UI layer for non-Svelte stacks. It must work cleanly in plain HTML, Astro, and as the underlying compatibility layer for React/Next.js wrappers.

STEPS:

1. Set up packages/elements with vite library mode producing a single JS bundle
2. Register custom elements:
   - <rk-key-manager>
   - <rk-model-selector>
   - <rk-cost-estimator>
3. Each component must:
   - map kebab-case attributes to props
   - emit stable custom events (rk-key-added, rk-key-removed, rk-model-selected, rk-cost-updated)
   - use shadow DOM
   - ship default theme CSS
   - support host theming through --rk-* custom properties on :host
4. Create register.ts for side-effect import
5. Create README examples for:
   - plain HTML
   - Astro
   - generic script import
6. Tests:
   - registration
   - attribute/prop mapping
   - custom event dispatch
   - shadow DOM structure
   - host CSS custom property override
7. Add an explicit compatibility note explaining expected friction points when consumed inside React/Next.js and how the React wrapper solves them

DO NOT:
- Include unnecessary framework-specific logic
- Include Svelte runtime in bundle
- Break shadow DOM encapsulation
- Treat Web Components as a fallback-only afterthought

Create Web Component wrappers for Svelte components.

STEPS:

1. Set up packages/elements with vite library mode producing single JS bundle
2. Register custom elements: <rk-key-manager>, <rk-model-selector>, <rk-cost-estimator>
3. Each: attributes map to props (kebab-case), custom events (rk-key-added etc), shadow DOM, default theme CSS, --rk-* custom properties via :host
4. Create register.ts for side-effect import
5. Tests: registration, attribute mapping, event dispatch, shadow DOM structure

DO NOT: Include Svelte runtime in bundle. Break shadow DOM encapsulation.
```

**Gate:** `<rk-key-manager>` renders in plain HTML. No framework required.

---

## Prompt 2.4 — React wrapper and hooks

```
## Prompt 2.4 — React wrapper and hooks

Create React wrapper package.

CONTEXT: React and Next.js are P0 adoption targets. This package must make Restormel Keys feel native in React apps rather than like a foreign embedded widget.

STEPS:

1. Set up packages/react:
   - depends on @restormel/keys + @restormel/keys-elements
   - peer deps react 18+
2. Create React wrappers:
   - KeyManager.tsx
   - ModelSelector.tsx
   - CostEstimator.tsx
3. Each wrapper must:
   - wrap the corresponding Web Component
   - use useRef + useEffect for custom event listeners
   - expose typed React props and callback props
   - include 'use client' where required
4. Create hooks:
   - useKeys(): initialises createKeys(), returns instance + loading + error
   - useModels(): fetches available models for user
   - useCost(): returns cost estimate and recalculates on change
5. Create KeysProvider context:
   - wraps children with Keys instance
   - minimises boilerplate for Next.js and generic React apps
6. Add README examples for:
   - generic React app
   - Next.js App Router settings page
   - dynamic import usage where needed
7. Tests:
   - wrapper rendering
   - event propagation
   - typed callback behaviour
   - hook initialisation
   - context usage
8. Ensure the public API feels native for React consumers and does not require them to think about custom elements directly

DO NOT:
- Re-implement Svelte components in React
- Expose raw custom-element internals as the primary React API
- Skip typed props or event mapping
- Use class components
```

**Gate:** React components render. Event callbacks fire.

---

## Prompt 2.5 — Next.js integration test

```
## Prompt 2.5 — Next.js integration test

Create Next.js App Router demo and integration tests.

CONTEXT: Next.js App Router is the primary integration target and a v1 gate. This demo must prove that Restormel Keys works cleanly in the stack most common among AI SaaS builders and vibe-coded apps.

STEPS:

1. Create apps/demo-next with create-next-app, TypeScript, App Router
2. Create app/api/keys/route.ts:
   - createKeys + createMiddleware with memory storage
3. Create app/api/resolve/route.ts:
   - server-side key resolution example
4. Create app/settings/page.tsx:
   - client boundary
   - KeysProvider + KeyManager + ModelSelector
5. Create app/components/LazyKeyManager.tsx:
   - next/dynamic with ssr: false
6. Add example usage showing:
   - server-side setup
   - client-side settings UI
   - resolved provider flow
7. Playwright tests must cover:
   - page renders
   - add key works
   - API returns 200
   - dynamic import works
   - no hydration mismatch
   - app/settings/page.tsx works without special repo-specific hacks
8. Add this demo to CI
9. Add README notes documenting:
   - client boundary expectations
   - dynamic import usage
   - server-side key resolution pattern

DO NOT:
- Use pages/ router
- Use undocumented workarounds
- Skip dynamic import test
- Declare Next.js support without proving App Router compatibility

---

## Prompt 2.6 — CLI tool

```
## Prompt 2.6 — CLI tool

Create @restormel/keys-cli.

CONTEXT: The CLI should reduce setup friction across the most important stacks, especially Next.js and generic React. It is part of the “start in minutes” adoption story.

STEPS:

1. Set up packages/cli:
   - commander
   - inquirer
   - chalk
   - @restormel/keys
   - bin: { "keys": "./dist/index.js" }

2. Commands:
   - keys init: detect framework, prompt providers/storage, generate config, install packages
   - keys add <provider>: prompt for key, validate, store
   - keys list: show stored keys
   - keys validate: re-validate all keys (exit 1 if invalid — CI-friendly)
   - keys doctor: check framework, packages, config, key health
   - keys estimate <model> --input <n> --output <n>: cost estimate

3. Framework detection in keys init / doctor should explicitly support:
   - Next.js App Router
   - generic React
   - SvelteKit
   - Astro / static Web Component usage where practical

4. init should choose the appropriate install path:
   - headless core only
   - React wrapper
   - Svelte package
   - Elements package

5. Tests:
   - framework detection
   - config generation
   - validate exit codes
   - package recommendation logic

DO NOT:
- Add heavy dependencies
- Require a running server
- Store secrets in config
- Optimise only for SvelteKit
```

**Gate:** `npx @restormel/keys-cli doctor` runs in fresh Next.js project.

---

## Prompt 2.7 — SOPHIA integration

```
Replace SOPHIA's inline BYOK code with @restormel/keys.

STEPS:

1. In SOPHIA repo: pnpm add @restormel/keys
2. Create src/lib/server/keys-adapter.ts: configure createKeys with SOPHIA's providers and Firestore
3. Refactor BYOK routes to use Keys middleware where practical
4. Keep SOPHIA-specific billing logic (wallet, top-ups, founder offers)
5. Verify all existing tests pass. Verify full BYOK flow works.

DO NOT: Change SOPHIA's API contracts. Remove SOPHIA-specific billing. Break existing functionality.
```

**Gate:** SOPHIA tests pass. BYOK works end-to-end.

---

## Prompt 2.8 — Accessibility audit

```
Run accessibility audit on all UI components.

STEPS:

1. axe-core: zero violations at AA level for each component
2. Keyboard: tab through all elements, Enter/Space activates, Escape closes, arrows navigate lists
3. Screen reader: all inputs labelled, status changes announced, expandable sections have aria-expanded
4. Fix all violations.

DO NOT: Skip components. Lower compliance below AA.
```

**Gate:** Zero violations. Full keyboard navigation.

---

## Prompt 2.9 — Publish Phase 2 packages

```
Publish all Phase 2 packages at v0.1.0.

STEPS:

1. Each package: version 0.1.0, metadata, files field, README, build, dry-run
2. Update root README with package table and quickstart
3. Bump @restormel/keys to 0.2.0
4. Tag keys-v0.2.0, push to trigger publish

DO NOT: Publish Vue wrapper. Include test files.
```

**Gate:** All packages on npmjs.com. Install works in fresh project.

---

## Prompt 2.10 — SvelteKit demo

```
Create SvelteKit demo showing full Keys integration.

STEPS:

1. Create apps/demo-svelte with SvelteKit 2, Svelte 5
2. Routes: / (landing), /settings (KeyManager + ModelSelector), /api/keys (middleware), /demo (chat using resolved provider)
3. Style with --rm-* tokens. README.

DO NOT: Add auth. Use external APIs (mock responses).
```

**Gate:** Settings page shows KeyManager. Keys can be added and listed.

Before you finish, add a final section titled:

## Manual actions required

This section is mandatory whenever any part of the work requires a human to do something outside the editor, browser, terminal, Git provider, cloud console, payment platform, deployment platform, or third-party dashboard.

Your instructions must be:
- beginner friendly
- step by step
- current and practical
- specific to the work just completed
- written as if the user has never done this before
- explicit about exactly where to go and what to click or run
- explicit about what to copy, save, download, paste, commit, or configure
- explicit about what to do with any code, keys, config values, tokens, URLs, screenshots, or outputs after returning
- explicit about what to ask Cursor to do next once the manual steps are complete

Format the section exactly like this:

## Manual actions required

### 1. What you need to do now
Provide a numbered list of manual steps in exact order.
For each step include:
- where to go
- what to open
- what to click or run
- what value to enter or create
- what to copy back
- anything to avoid doing

### 2. What to bring back into Cursor
List exactly what the user should return with, such as:
- pasted values
- created file contents
- generated credentials or IDs
- URLs
- screenshots
- confirmation that a command succeeded
- confirmation that a service/account/project is ready

If nothing needs to be brought back, say so clearly.

### 3. What to do with any code or files
Explain exactly:
- where any generated code should go
- whether it should be pasted into an existing file or a new file
- whether it should be committed yet
- whether secrets must be stored in env files, secret managers, dashboards, or nowhere yet
- whether any files should be reviewed manually before use

### 4. What to ask Cursor next
Provide a short copy-paste-ready follow-up prompt the user can send after completing the manual steps.
This must be specific to the current phase and the work just completed.

### 5. Safety checks before continuing
List the small number of checks the user should do before moving on.
These must be practical and easy to verify.

Important rules:
- Do not assume the user knows the platform UI.
- Do not say vague things like “set up the account” or “configure the environment”.
- Do not skip steps where the user must leave Cursor.
- Do not bury manual actions in prose earlier in the response.
- If there are no manual actions, still include the section and explicitly say:
  “No manual actions are required for this phase.”
- If instructions may have changed in a third-party UI, say:
  “Menu names may vary slightly, but the flow should be similar.”
- If secrets or tokens are involved, clearly warn:
  - never commit them
  - where to store them safely
  - whether to paste them back into Cursor or not
- If code depends on a manual step, explain exactly what to do after returning before the code is considered complete.

Final requirement:
End every substantial phase response with this manual-actions section before giving the final completion summary.