# Restormel / Testing — Initial Technical Architecture

**Status:** Internal architecture note  
**Date:** 2026-04-07

## 0. Current state (monorepo)

**Testing** code, packages, and docs live in **[restormel-keys](https://github.com/Allotment-Technology-Ltd/restormel-keys)**. The standalone **restormel-testing** GitHub repo is **archived**. **Production** uses **one Vercel project** for **`restormel.dev`**; **`/testing`** is part of the **dashboard** app, not a second deployment. **Canonical:** [`docs/monorepo-vercel.md`](../monorepo-vercel.md) · reference stub [`vercel-suite-routing.md`](./vercel-suite-routing.md).

Sections below keep the original multi-repo narrative for history; read them as **in-monorepo** package and routing boundaries today.

---

## 1. Executive summary

Restormel / Testing should have:
- its **own repository**
- its **own CI/CD pipeline**
- its **own release lifecycle**
- a **shared design system and shared brand shell** with Restormel / Keys
- a **hard dependency seam** into Restormel / Keys for BYOK and provider-aware execution
- a **modular architecture** that cleanly separates commodity execution layers from differentiated Restormel value

The right architectural pattern is **separate product repos plus shared versioned foundation packages**, not app-level code sharing by copy/paste and not one giant coupled product repo.

This is the best fit for the suite because:
- Keys and Testing should ship independently
- they should still look and feel like one platform on `restormel.dev`
- they need shared brand/auth/navigation/tokens
- they should not create hidden cross-product app coupling that slows both products down

---

## 2. Recommended product-suite architecture

## 2.1 Product repository model

### Recommended model
- `restormel-keys` — separate repo
- `restormel-testing` — separate repo
- shared foundation delivered through **versioned packages**, not direct repo-to-repo imports

### Shared foundation package options
Either:
1. a new small shared repo, e.g. `restormel-foundation`, or
2. extraction of reusable packages from `restormel-keys` and publication under stable scopes

### Recommendation
Use **published scoped packages** as the main sharing mechanism.

This is the cleanest model because it preserves:
- independent deployment
- independent CI/CD
- semver discipline
- explicit dependency contracts
- lower coupling between product apps

---

## 2.2 Domain and entry-point model

Use **one root domain** with product-specific paths:
- `restormel.dev/keys`
- `restormel.dev/testing`

**Vercel wiring (canonical):** [monorepo-vercel.md](../monorepo-vercel.md) — one project, dashboard build; Testing routes under **`/testing`** in the same app ([vercel-suite-routing.md](./vercel-suite-routing.md) is a short reference + history).

If auth is shared later, unify through origin-level session strategy or edge-auth routing. But do not make Testing’s first release depend on deep cross-product auth coupling.

### Rule
Shared **entry point and brand shell**, independent product deployments.

That mirrors common industry practice for product suites: one brand, multiple deployables, shared foundation packages, explicit semver contracts.

---

## 3. Best-practice recommendation for this type of suite

Current ecosystem guidance strongly supports:
- workspaces/monorepo patterns for shared package authoring
- independent deployments for separate apps
- shared UI/token packages
- changeset-based versioning for shared packages
- explicit build graph / caching in multi-package setups

For Restormel, the right translation is:

### Do
- use `pnpm` workspaces where you author shared packages
- use versioned packages for shared tokens, docs shell, brand assets, auth helpers, and SDK seams
- use Changesets for multi-package release management
- use Turborepo-style build graph/caching where it makes authoring shared packages easier
- deploy product apps independently even if they share build tooling

### Do not
- import app internals from `restormel-keys` into `restormel-testing`
- share by git submodule
- share by copying files manually between repos
- make design system reuse depend on importing an entire dashboard app

---

## 4. What Restormel / Testing should reuse from Restormel / Keys

The repomix snapshot shows that Restormel / Keys already contains reusable building blocks in packages for:
- core provider/domain logic
- CLI patterns
- tokens
- Svelte / React / Elements surfaces
- MCP and AAIF packages
- dashboard/docs shell patterns
- control-plane schema patterns

That is valuable, but Testing should reuse them **selectively**.

## Reuse directly or extract into shared packages

### Strong reuse candidates
1. `packages/tokens`  
   Shared design system tokens and semantic token contracts.

2. brand/logo assets  
   Shared lockups, icons, and shell-level brand primitives.

3. CLI conventions and supporting utilities  
   Structure, doctor/validate style, config-validation approach.

4. `packages/core` seams related to provider metadata / resolution  
   Only through a stable package API, not app internals.

5. auth / shell / nav patterns  
   Shared product-suite UX conventions, not full dashboard reuse.

6. docs shell patterns  
   Shared site/docs primitives if extracted into stable packages.

### Reuse conceptually, not directly
1. dashboard app routes and page implementations  
   Do not import directly into Testing.

2. product-specific models, routes, policies UI  
   Useful reference only.

3. Keys-specific control-plane CRUD surfaces  
   Testing should consume public Keys APIs or packages, not dashboard internals.

### Likely future shared foundation packages
- `@restormel/tokens`
- `@restormel/brand`
- `@restormel/docs-kit`
- `@restormel/auth-shared`
- `@restormel/keys-sdk`
- `@restormel/platform-types`

---

## 5. Architectural classification

## COMMODITY
These are mature layers Restormel should mostly integrate.

### Browser execution
- Playwright
- later optional Stagehand / Browserbase / Browser Use adaptors

### CI execution
- GitHub Actions
- later other CI wrappers

### Artifact storage
- local filesystem for OSS/local use
- pluggable object storage later

### Observability transport
- OpenTelemetry exporters
- standard log sinks

### Versioning / package release
- pnpm workspaces
- Changesets
- Turborepo build graph/caching where useful

---

## DIFFERENTIATED
These are the actual product.

### Test contract model
Canonical schemas for:
- suite
- goal/test case
- assertion
- run
- trace event
- verdict
- report

### Agentic runner orchestration
- **Current MVP slice:** for each browser goal, navigate to the environment `base_url`, evaluate `success_criteria` (deterministic checks and optional `judge_rubric`). Retries and indeterminate verdicts are supported.
- **Deferred:** multi-step bounded autonomy loop from config, rich workflow scripting — do not market the MVP as a full “browser agent” yet.
- test-time policy enforcement (partially via schema + validate)
- retry / indeterminate model
- workflow-aware execution coordination (goal-level only today)

### Keys-aware execution layer
- logical model reference resolution
- provider-aware test execution
- BYOK-first cost discipline
- comparison workflows across model/provider/prompt

### Failure diagnosis layer
- workflow-aware failure summaries
- mapping failures to likely causes
- differentiating browser/app/provider/judge failures

### Developer workflow
- local + CI reproducibility
- PR-friendly summaries
- minimal setup for small teams

---

## ADJACENT
Build later only if clearly justified.

### Hosted control plane
- run scheduling
- retained run history
- multi-user UI
- collaboration / governance

### Premium analytics and dashboards
- historical diffing
- flaky-run analytics
- team views

### Enterprise governance surfaces
- approvals
- audit-heavy policy packs
- SSO extensions

---

## 6. Minimum viable architecture for launch

```text
GitHub Actions / Local CLI
        │
        ▼
  @restormel/testing-cli
        │
        ▼
  @restormel/testing-runner
        ├── @restormel/testing-core
        ├── @restormel/testing-browser-playwright
        ├── @restormel/testing-keys-adapter
        └── @restormel/testing-reporting
                │
                ├── local artifacts / JUnit / GitHub Checks
                └── optional OTEL export
```

### Launch principle
Keep the launch architecture runnable with:
- local filesystem artifacts
- no mandatory hosted database
- GitHub Actions + CLI only
- Keys as the only required product dependency

---

## 7. Recommended repo shape

```text
restormel-testing/
├── packages/
│   ├── core/
│   ├── runner/
│   ├── browser-playwright/
│   ├── keys-adapter/
│   ├── reporting/
│   ├── cli/
│   └── github-action/
├── docs/
├── examples/
│   ├── plot-reference/
│   ├── nextjs-playwright/
│   └── public-demo/
├── scripts/
├── .github/workflows/
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

### Why this is right
- clean boundaries
- easy local development
- easy OSS distribution
- package-level testability
- future hosted control plane can be added without rewriting the runner

---

## 8. Canonical schemas

## 8.1 Suite schema

```ts
interface TestSuite {
  id: string;
  description?: string;
  environment: string;
  goals: TestGoal[];
  retries?: number;
  tags?: string[];
}
```

## 8.2 Goal / test case schema

```ts
interface TestGoal {
  id: string;
  type: "browser" | "performance" | "native";
  description: string;
  successCriteria: SuccessCriteria;
  preconditions?: HookRef[];
  cleanup?: HookRef[];
  exclusiveWith?: string[];
  tags?: string[];
}
```

## 8.3 Assertion / success criteria schema

```ts
interface SuccessCriteria {
  urlMatches?: string | string[];
  domSignals?: string[];
  textPresent?: string[];
  textAbsent?: string[];
  structuredChecks?: StructuredCheck[];
  judgeRubric?: JudgeRubric;
}
```

## 8.4 Run schema

```ts
interface TestRun {
  id: string;
  suiteId: string;
  environment: string;
  trigger: "local" | "ci";
  commitSha?: string;
  startedAt: string;
  endedAt?: string;
  verdict: Verdict;
  goalResults: GoalResult[];
  /** Factual count of judge / rubric invocations (see `RunRecord` in `@restormel/testing-core`). */
  judgeInvocationCount?: number;
  /** `tokenEstimate` in MVP is heuristic only, not billing-grade. */
  costEstimate?: CostEstimate;
}
```

## 8.5 Trace event schema

```ts
interface TraceEvent {
  id: string;
  runId: string;
  goalId: string;
  stepIndex: number;
  kind:
    | "navigation"
    | "action"
    | "assertion"
    | "model_call"
    | "tool_call"
    | "observation"
    | "error";
  timestamp: string;
  summary: string;
  metadata?: Record<string, unknown>;
}
```

## 8.6 Verdict schema

```ts
type Verdict = "passed" | "failed" | "indeterminate";

interface GoalResult {
  goalId: string;
  verdict: Verdict;
  reasonCode: string;
  summary: string;
  retriesUsed: number;
  evidenceRefs: string[];
}
```

## 8.7 Report schema

```ts
interface RunReport {
  run: TestRun;
  highlights: string[];
  artifacts: ArtifactRef[];
  reproduction?: ReproductionHint;
}
```

---

## 9. Keys integration architecture

Testing should integrate with Keys through a narrow adapter package.

## Package
`@restormel/testing-keys-adapter`

## Responsibilities
- resolve logical key/model references from test config
- call stable Keys package or public API seam
- normalize provider/model resolution for the runner
- expose cost / provider metadata where available
- never leak raw secret values into logs or prompts

## Integration rule
Testing should depend on:
- public Keys packages, or
- stable Keys API contracts

It should not depend on:
- Keys dashboard page internals
- direct database coupling
- private route implementation details

---

## 10. Browser automation architecture

## MVP default
Use Playwright as the first and default browser executor.

## Package
`@restormel/testing-browser-playwright`

## Responsibilities
- browser launch/session handling
- navigation and action primitives
- DOM extraction
- screenshots and trace capture
- waiting/retry primitives
- optional perf smoke hooks

## Why Playwright first
- best fit for browser-backed CI usage
- mature traces and reporting
- strong OSS adoption
- already aligned with AI-agent use cases in its positioning

---

## 11. CI execution architecture

## Package
`@restormel/testing-github-action`

## Responsibilities
- map workflow inputs to runner inputs
- poll or await run completion
- write summary to GitHub Checks / step summary
- fail with correct exit code

## Inputs
- suite
- environment
- target URL override
- commit SHA
- PR number
- repository
- timeout
- fork PR policy

### Rule
Keep the Action thin. All meaningful behaviour should live in the runner packages so local and CI execution stay aligned.

---

## 12. Observability and artifact storage

## Launch recommendation
Keep launch storage local/simple:
- filesystem artifacts locally
- GitHub Actions artifacts in CI
- JSON run records
- optional JUnit export
- optional OpenTelemetry export hooks

## Do not require at launch
- hosted tracing backend
- retained central database
- proprietary artifact store

## Later path
Add optional sinks for:
- Phoenix
- LangSmith
- Braintrust
- Weave
- S3-compatible object storage

---

## 13. Shared design system and shell recommendation

The repomix output shows a mature shared token and shell model already exists in Keys.

### Recommended practice
Testing should share:
- brand assets
- tokens
- semantic color/spacing/type contracts
- shell navigation patterns
- docs primitives where extracted cleanly

It should not share:
- whole dashboard pages
- product-specific app routing logic
- app-level state stores

### Implementation recommendation
Publish shared packages such as:
- `@restormel/tokens`
- `@restormel/brand`
- `@restormel/docs-kit`

Testing should consume those packages and present itself as a sibling product at `/testing`.

---

## 14. Recommended release and deployment model

## Repositories
- separate product repos for Keys and Testing

## Package publishing
- shared foundation packages published with semver
- Changesets used for coordinated versioning in whichever repo owns the package set

## Product deployment
- independent deploy pipelines per product
- same brand domain through path routing / edge routing
- no requirement that both products release together

This is the cleanest way to preserve speed while keeping the suite coherent.

---

## 15. Concrete reuse recommendations from Keys

### Reuse now
- token package concepts and semantic contracts
- logo and brand assets
- CLI shape and doctor/validate mindset
- package boundary discipline
- control-plane schema patterns where relevant
- provider/domain concepts from public Keys package seams

### Reuse later if extracted cleanly
- docs shell components
- shared auth/session helpers
- shared product nav primitives
- shared analytics hooks

### Do not reuse directly
- dashboard route implementations
- app-specific stores and server modules
- direct DB schema coupling to the Keys dashboard app

---

## 16. Final architecture recommendation

For launch, Restormel / Testing should be:

- **its own repo**
- **its own product build and release train**
- **built from modular packages**
- **dependent on Restormel / Keys through a stable adapter seam**
- **sharing design system and brand through versioned foundation packages**
- **using Playwright and GitHub Actions as first commodity substrates**
- **storing artifacts simply at first**
- **leaving observability, hosted control plane, and richer UI as later layers**

That is the architecture most likely to let the product ship quickly without creating future structural debt.

---

## 17. Sources consulted

Internal sources:
- `restormel_testing_chatgpt_project_setup.md`
- `restormel-agentic-testing-requirements.md`
- `repomix-output.md`

External official sources consulted on 2026-04-07:
- pnpm workspace docs
- Turborepo repository structuring docs
- Changesets docs / GitHub
- Vercel monorepo and deployment docs
