# Restormel Keys — Prompt Pack Phase 4

**Phase:** Launch + Polish (Weeks 8–10)
**Target:** Cursor
**Prerequisites:** Phase 3 complete. Dashboard, site, docs, billing, Zuplo deployed.

---

## Prompt 4.1 — Comprehensive testing suite

```
## Prompt 4.1 — Comprehensive testing suite

Create comprehensive testing suite: unit, integration, component.

STEPS:

1. packages/core unit tests:
   - providers: cost estimation for every model, validateKey with mocked fetch, model list completeness
   - storage: full CRUD lifecycle, user isolation, concurrency
   - router: preferred model resolution, fallback chain, no key error
   - cost: known model/token → expected USD, unknown model → error
   - entitlements: free blocks premium, pro allows BYOK, glob matching
   - wallet: debit/credit, below-zero fail, idempotency
   - security: format, determinism, masking, round-trip, timing-safe

2. packages/svelte component tests (vitest + @testing-library/svelte):
   - KeyManager: empty state, add flow, list, delete, error states
   - ModelSelector: grouping, unavailable reasons, selection
   - CostEstimator: correct estimate, budget warnings

3. packages/react component tests (vitest + @testing-library/react):
   - wrapper rendering
   - event propagation
   - hook initialisation
   - context
   - typed callback behaviour for the wrapped custom elements

4. packages/elements tests:
   - registration
   - attribute mapping
   - events
   - shadow DOM
   - host theming via --rk-* variables

5. tests/integration/:
   - full lifecycle
   - multi-user
   - server middleware
   - cross-package compatibility path: core → elements → react

6. Add explicit framework compatibility verification:
   - Next.js App Router remains green
   - React wrapper remains aligned to elements package behaviour
   - Web Components remain usable in non-framework contexts

7. Coverage:
   - vitest + @vitest/coverage-v8
   - thresholds: 80% lines, 75% branches

DO NOT:
- Make real API calls
- Test implementation details
- Treat framework compatibility as already solved and untested
```

**Gate:** `pnpm test` passes everywhere. Coverage meets thresholds.

---

## Prompt 4.2 — End-to-end tests

```
## Prompt 4.2 — End-to-end tests

Create E2E tests with Playwright.

STEPS:

1. Install Playwright. Configure chromium, firefox, webkit.
2. Dashboard tests:
   - landing loads
   - unauth redirects
   - create project
   - generate key
   - billing page
   - settings
3. API tests:
   - health 200
   - projects CRUD with auth
   - keys CRUD
4. Billing tests:
   - pricing renders
   - subscribe button present
   - tier display
5. Framework compatibility tests:
   - Next.js demo renders and works cleanly
   - add key flow works in Next.js App Router demo
   - dynamic import path works
   - no hydration mismatch
   - docs quickstart steps match actual working flow
6. Add to CI (run against local dev server)

DO NOT:
- Test against production
- Test Paddle checkout with real charges
- Hardcode credentials
- Ship without explicit Next.js App Router E2E proof
```

**Gate:** E2E passes on all browsers. Dashboard journey works.

---

## Prompt 4.3 — Bundle size monitoring

```
Add bundle size monitoring.

STEPS:

1. Install size-limit + @size-limit/preset-small-lib
2. Limits: core <15KB, svelte <25KB, elements <30KB, react <5KB (all gzip)
3. CI: check on every PR, report changes, fail on exceed

DO NOT: Set limits too tight. Include test files in calculations.
```

**Gate:** `pnpm size` all under limits. CI blocks exceeding PRs.

---

## Prompt 4.4 — Paddle production mode

```
Switch Paddle from sandbox to production.

STEPS:

1. Create production products in Paddle dashboard with correct pricing
2. Update GCP Secret Manager with production API key + webhook secret + price IDs
3. Set PADDLE_ENVIRONMENT=production, update all env vars
4. Deploy new Cloud Run revision
5. Verify: pricing page correct, checkout opens production Paddle, webhook delivers, Firestore updates, portal works
6. Add monitoring: webhook failure alerts, billing sync error alerts

DO NOT: Process real charges before verification. Remove sandbox config. Commit production secrets.
```

**Gate:** Real Pro subscription can be created and managed.

---

## Prompt 4.5 — v1.0.0 stable publish

```
Publish all packages at v1.0.0.

STEPS:

1. Version bump all packages to 1.0.0
2. Update inter-package dependencies
3. CHANGELOG.md for each package
4. Root CHANGELOG.md with release notes
5. Update README: remove "coming soon", add screenshot, comparison table, "Used by SOPHIA"
6. Update docs to reference v1.0.0
7. Full test + build + size check + dry-run
8. Tag keys-v1.0.0, push

DO NOT: Publish without test pass. Skip changelog. Include pre-release warnings.
```

**Gate:** `npm info @restormel/keys version` → `1.0.0`. All five packages published.

---

## Prompt 4.6 — Launch content

```
## Prompt 4.6 — Launch content

Create launch content.

STEPS:

1. Blog post: "Why we built Restormel Keys" (800-1200 words, calm/technical tone)
   - Problem
   - what exists
   - what's missing
   - what we built
   - 10-line code
   - why Next.js/React compatibility matters
   - SOPHIA proof
   - what's next

2. Dev.to tutorial:
   - "Add BYOK to your Next.js AI app in 15 minutes"
   - prerequisites
   - install
   - config
   - API route
   - settings page
   - resolved provider
   - result
   - complete copy-paste code

3. Optional second tutorial stub or outline:
   - "Use Restormel Keys in React or Astro"
   - show React wrapper or Web Components path

4. Product Hunt materials:
   - tagline
   - description
   - first comment
   - 5 screenshots

5. Social:
   - X thread (5 tweets)
   - LinkedIn post
   - Reddit (r/nextjs, r/sveltejs, r/webdev)

Requirements:
- make framework compatibility part of the launch story
- especially emphasise Next.js App Router, React wrapper, and plug-and-play BYOK UI
- keep claims grounded in actual tested support

DO NOT:
- Use buzzwords
- Overstate capabilities
- Compare aggressively
- Claim framework support that is not backed by docs/examples/tests
```

**Gate:** Blog published. Dev.to ready. Product Hunt prepared.

---

## Prompt 4.7 — Final accessibility and UX pass

```
## Prompt 4.7 — Final accessibility and UX pass

Final audit across all surfaces.

STEPS:

1. Accessibility:
   - axe-core on all pages (landing, pricing, docs, dashboard)
   - zero AA violations
   - keyboard nav
   - screen reader
   - focus indicators
   - colour contrast 4.5:1
   - reduced motion

2. Dashboard UX:
   - <3 clicks to create project
   - copy button on API key
   - clear tier display
   - user-friendly errors
   - loading indicators
   - helpful empty states

3. Docs UX:
   - quickstart <5 minutes
   - code examples correct
   - search relevant
   - mobile readable
   - framework compatibility easy to understand
   - Next.js path obvious
   - package-choice guidance clear

4. Landing UX:
   - <2s load
   - hero above fold
   - code readable on mobile
   - all links work
   - framework support communicated clearly, not buried

5. Fix all issues.

DO NOT:
- Ship with known violations
- Paper over missing compatibility guidance with visual polish
```

**Gate:** Zero violations. Lighthouse >90. All audit items pass.

---

## Prompt 4.8 — Launch checklist

```
## Prompt 4.8 — Launch checklist

Execute launch day sequence.

PRE-LAUNCH:
[ ] All packages at v1.0.0
[ ] Landing page, docs, dashboard live
[ ] Paddle production verified
[ ] Zuplo gateway live
[ ] CI green, E2E passing, accessibility clean
[ ] Blog published, README polished
[ ] Next.js App Router quickstart verified against actual working demo
[ ] React wrapper documented and usable
[ ] Web Components path documented for non-native stacks
[ ] No framework support claims exceed what is actually tested and documented

LAUNCH:
1. [ ] Final production deploy
2. [ ] Verify all URLs
3. [ ] Smoke test: create project, complete subscription
4. [ ] Smoke test: Next.js quickstart path still works
5. [ ] Post blog to X/Twitter
6. [ ] Post Dev.to tutorial
7. [ ] Submit Product Hunt
8. [ ] Post Reddit (r/nextjs, r/sveltejs, r/webdev)
9. [ ] Post Hacker News (Show HN)
10. [ ] Personal outreach

MONITOR (48h):
[ ] PostHog: page views, sign-ups
[ ] npm: install count
[ ] GitHub: stars, issues
[ ] Paddle: subscription events
[ ] Cloud Run: errors, latency
[ ] Zuplo: request volumes
[ ] Docs entry pages: Next.js guide visits, quickstart drop-off, framework page usage

DO NOT:
- Launch on Friday
- Launch without pre-check
- Ignore early feedback
- Claim “works everywhere” unless docs/examples/tests support it
```

**Gate:** Product live. First external user signed up. No critical bugs in 48h.

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