# Restormel Keys — Prompt Pack Phase 1

**Phase:** Foundation + Core Extraction (Weeks 1–2)
**Target:** Cursor (VS Code)
**Prerequisites:** Access to `Allotment-Technology-Ltd/sophia` repo for reference code

---

## How to use

1. Read each prompt fully before pasting into Cursor.
2. Execute prompts in order — later prompts depend on earlier ones.
3. Verify the **Gate** at the end of each prompt before proceeding.
4. Where a prompt says "Copy from SOPHIA," open the SOPHIA repo side-by-side and use the referenced file as source material.

---

## Prompt 1.1 — Create repository and workspace

```
Create a new pnpm monorepo for the Restormel Keys project.

CONTEXT: This is a new standalone repository for a multi-provider AI BYOK library. It will contain npm packages, a SvelteKit dashboard app, an Astro marketing site, and example apps.

STEPS:

1. Initialise the repo root:
   - package.json with name "restormel-keys", private: true, packageManager "pnpm@9.15.0"
   - pnpm-workspace.yaml listing packages/*, apps/*, examples/*
   - tsconfig.json (base config, strict, ES2022, NodeNext module resolution)
   - .gitignore (node_modules, dist, build, .svelte-kit, .env, .env.local)
   - .npmrc with shamefully-hoist=false

2. Create empty package directories with placeholder package.json files:
   - packages/core (name: @restormel/keys)
   - packages/svelte (name: @restormel/keys-svelte)
   - packages/elements (name: @restormel/keys-elements)
   - packages/react (name: @restormel/keys-react)
   - packages/cli (name: @restormel/keys-cli)

3. Create empty app directories:
   - apps/dashboard (placeholder)
   - apps/site (placeholder)
   - apps/demo-next (placeholder)

4. Create README.md with:
   - One-line: "Drop-in BYOK for AI apps."
   - Badges: npm version, license MIT, CI status
   - Short description of the two modes
   - "Coming soon" note
   - License: MIT

5. Create LICENSE (MIT, Allotment Technology Ltd, 2026)
6. Create CONTRIBUTING.md (placeholder)
7. Create CHANGELOG.md (placeholder)

DO NOT:
- Install any dependencies yet
- Create any implementation code
- Add CI/CD (that's prompt 1.3)
```

**Gate:** `pnpm install` runs without errors. All package directories exist.

---

## Prompt 1.2 — Core package dependencies and build setup

```
Set up the build tooling and dependencies for the @restormel/keys core package.

CONTEXT: packages/core is the headless core of Restormel Keys. It must have ZERO UI dependencies and work in any Node.js / Bun / Deno environment.

STEPS:

1. In packages/core/package.json:
   - name: "@restormel/keys", version: "0.1.0", type: "module"
   - main: "dist/index.js", types: "dist/index.d.ts"
   - exports with subpath exports for ./storage/* and ./server/*
   - scripts: build (tsc), dev (tsc --watch), test (vitest run)
   - devDependencies: typescript, vitest
   - NO runtime dependencies (zero-dep core)

2. tsconfig.json extending root, outDir: dist, declaration: true, strict

3. Create src/index.ts with placeholder exports
4. Create src/types.ts with core type definitions:
   - ProviderId, KeyConfig, ModelDefinition, RoutingConfig, EntitlementConfig, PlanDefinition, KeysConfig, CostEstimate, ValidationResult, ResolvedRoute, UsageRecord, UsageSummary, EntitlementResult

5. Create src/keys.ts with createKeys() factory stub

DO NOT:
- Add any provider implementations (prompt 1.5)
- Add any storage implementations (prompt 1.6)
```

**Gate:** `pnpm --filter @restormel/keys build` produces `dist/` with `.js` and `.d.ts` files.

---

## Prompt 1.3 — CI/CD pipeline

```
Set up GitHub Actions CI/CD for restormel-keys, based on SOPHIA's deploy.yml.

CONTEXT: Copy SOPHIA's CI/CD pattern but simplify for Keys (no SurrealDB, no ingestion job, no VPC).

STEPS:

1. Create .github/workflows/ci.yml:
   - Trigger: push to main, pull_request
   - Jobs: changes (paths-filter), security (TruffleHog, pnpm audit, type check), test (vitest), codeql

2. Create .github/workflows/deploy.yml:
   - Trigger: push to main (app/infra path changes)
   - Jobs: infra-preview (PR), infra-apply (push), deploy (Docker build → Artifact Registry → Cloud Run)
   - WIF auth, europe-west2 region

3. Create .github/dependabot.yml

Reference SOPHIA's deploy.yml for exact action versions. Remove SurrealDB/VPC/ingestion references.

DO NOT:
- Set up actual GCP secrets yet
- Create the Pulumi stack yet (prompt 1.4)
```

**Gate:** CI workflow runs on push. Deploy workflow is valid YAML.

---

## Prompt 1.4 — Pulumi infrastructure

```
Set up Pulumi infrastructure for Restormel Keys, based on SOPHIA's infra/index.ts.

CONTEXT: Keys needs a SUBSET of SOPHIA's infra: service account, Artifact Registry, Cloud Run service (dashboard), load balancer, SSL cert. NO VPC, NO SurrealDB, NO ingestion job.

STEPS:

1. Create infra/ directory with package.json, tsconfig.json, Pulumi.yaml, Pulumi.production.yaml, index.ts

2. In index.ts provision:
   a. Service account (keys-dashboard-sa)
   b. Artifact Registry repository
   c. Cloud Run service (keys-dashboard, europe-west2, 512Mi/1CPU, 0-3 instances)
   d. Environment variables from Secret Manager (Paddle, Firebase, API key hash)
   e. Global static IP, Serverless NEG, Backend service, SSL cert, URL map, HTTPS proxy, forwarding rule
   f. IAM: public invoker

Copy load balancer pattern exactly from SOPHIA.

DO NOT:
- Run pulumi up yet
- Provision SurrealDB, VPC, or ingestion job
```

**Gate:** TypeScript compiles. `pulumi preview` shows expected resources.

---

## Prompt 1.5 — Provider adapters

```
Implement AI provider adapters for @restormel/keys.

CONTEXT: Each provider adapter defines models, key validation, cost estimation, and client creation. Pure TypeScript, no SDK dependencies. Use fetch() for validation.

STEPS:

1. Create src/providers/types.ts: ProviderDefinition, ValidationResult, CostEstimate, ProviderClient interfaces
2. Create src/providers/openai.ts: models (gpt-4o, gpt-4o-mini, o1, etc.), validateKey (GET /v1/models), estimateCost (pricing table lookup)
3. Create src/providers/anthropic.ts: models (claude-sonnet-4, claude-haiku-4.5, claude-opus-4), validateKey (GET /v1/models with x-api-key), estimateCost
4. Create src/providers/google.ts: models (gemini-2.5-pro, gemini-2.5-flash), validateKey (GET /v1/models?key=), estimateCost
5. Create src/providers/index.ts: export all
6. Tests: cost estimation correctness, model list completeness, mocked fetch for validation

DO NOT:
- Install OpenAI/Anthropic/Google SDKs. Use fetch().
- Make real API calls in tests.
```

**Gate:** Tests pass. Cost estimation returns correct values.

---

## Prompt 1.6 — Storage adapters

```
Implement storage adapter interface and first two adapters.

STEPS:

1. Create src/storage/types.ts: KeyStorage interface (get, list, set, delete, getUsage, trackUsage)
2. Create src/storage/memory.ts: Map-based in-memory storage, fully functional, no persistence
3. Create src/storage/encrypted-local.ts: localStorage with AES-GCM encryption via Web Crypto API, PBKDF2 key derivation, 'rk_' prefix
4. Create src/storage/index.ts: export all
5. Tests: full CRUD lifecycle, user isolation, encrypted values in localStorage

DO NOT:
- Implement Firestore/Supabase/neondb/PostgreSQL adapters (paid tier, Phase 3+)
```

**Gate:** Storage tests pass. Memory adapter handles full lifecycle.

---

## Prompt 1.7 — Router and cost estimation

```
Implement routing engine and cost estimation.

STEPS:

1. Create src/router.ts: createRouter(config, providers) → Router with resolve() method
   - Resolution: BYOK key → fallback chain → platform key → no_key_available error
2. Create src/cost.ts: estimateCost() lookup across providers, trackCost() for actual usage
3. Create src/entitlements.ts: createEntitlements(config) with check() and getAvailableModels(). Glob pattern support (gpt-4o* matches gpt-4o-mini).
4. Create src/wallet.ts: getBalance, debit (idempotent), credit
5. Wire everything into createKeys() factory in src/keys.ts
6. Tests: routing resolution, cost accuracy, entitlement enforcement, wallet operations

DO NOT:
- Import UI code
- Make actual API calls
```

**Gate:** All tests pass. `createKeys()` returns functional instance.

---

## Prompt 1.8 — Server middleware

```
Implement server-side middleware for key resolution.

STEPS:

1. Create src/server/middleware.ts: createMiddleware(keys, { auth }) → GET/POST/DELETE handlers for key management
2. Create src/server/resolve.ts: createResolveMiddleware(keys, { auth }) → resolves provider/key per request
3. Create src/server/proxy.ts: createProxy(keys, { auth }) → forwards requests with resolved key, supports streaming
4. Tests: masked keys on GET, validate+store on POST, correct resolution, mock proxy

Uses standard Web API Request/Response — no Express or SvelteKit imports.

DO NOT:
- Import framework-specific types
```

**Gate:** Server middleware tests pass.

---

## Prompt 1.9 — Key hashing and security

```
Implement API key hashing and security, based on SOPHIA's apiAuth.ts.

STEPS:

1. Create src/security/hash.ts:
   - createApiKey(prefix?): generates sk-rk-{random}, HMAC-SHA256 hash, returns raw key + hash + ID
   - hashApiKey(rawKey): deterministic HMAC-SHA256
   - maskApiKey(rawKey): first 8 + '...' + last 4
   - Uses Node.js crypto (createHmac, timingSafeEqual, randomBytes)

2. Create src/security/verify.ts:
   - createKeyVerifier(storage, { hashSecret? }): verify(rawKey) → result
   - Portable version of SOPHIA's verifyApiKey that works with any KeyStorage

3. Tests: format, determinism, masking, round-trip create→verify, timing-safe comparison

DO NOT:
- Depend on Firestore directly. Use KeyStorage interface.
- Store or log raw keys.
```

**Gate:** Security tests pass. Create → hash → verify round-trip works.

---

## Prompt 1.10 — First npm publish

```
Prepare and publish @restormel/keys v0.1.0 to npm.

STEPS:

1. Update package.json: description, keywords, author, license, repository, homepage, files, publishConfig
2. Create packages/core/README.md with install + quickstart
3. Run full test suite + build + dry-run publish
4. Create .github/workflows/publish.yml (trigger on tag keys-v*)
5. Tag keys-v0.1.0 and push

DO NOT:
- Publish UI packages yet
- Include test or src files in published package
```

**Gate:** `npm info @restormel/keys` shows published package.

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