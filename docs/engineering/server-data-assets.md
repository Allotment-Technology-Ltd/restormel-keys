# Reading shipped data assets from server code (the canonical pattern)

**Status:** canonical · **Applies to:** `apps/dashboard/src/lib/server/**` · **Risk:** RISK-014 · **Incident:** REC-INC-008
**Guard:** `scripts/ci/check-bundled-asset-reads.mjs` (CI, blocking)

## The bug this prevents

A server module reads a **shipped, non-code data asset** (a seed JSON, starter-corpus
markdown, a governance YAML/record) using a path that is **fixed relative to
`import.meta.url`** — then `readFileSync` / `readdirSync` reads it at runtime.

```ts
// ❌ FORBIDDEN — fixed up-tree climb
const SEED = new URL("../../../../data/model-catalog-seed.json", import.meta.url);
const raw = readFileSync(fileURLToPath(SEED), "utf8");

// ❌ FORBIDDEN — sibling-dir read
const DIR = join(dirname(fileURLToPath(import.meta.url)), "starter-corpus");
const raw = readFileSync(join(DIR, "manifest.json"), "utf8");
```

This is correct in the **source tree**, in **dev**, in **CI**, and under **SvelteKit
prerender**. It is **wrong in the bundled `adapter-node` prod runtime**: the bundler emits
the importing module at a **different depth**, so the up-tree climb **overshoots** (the
`dashboard/` segment drops → `/app/apps/data/...`) and the sibling dir is **never copied next
to the chunk**. The read throws `ENOENT` → a bare **HTTP 500**, and it is invisible
everywhere except the production bundle — so it reaches founders/users before anyone catches
it.

### It has happened three times

| # | Site | Symptom | Fix |
|---|------|---------|-----|
| 1 | records gate `REPO_ROOT` (`112b8c99`) | authed `/keys/v1/records` returned 0 records in prod | `resolveRepoRoot` cwd-walk |
| 2 | Connect starter-corpus (PR #276) | "Load 3 starter documents" → ENOENT | module-import + Vite `?raw` |
| 3 | `model-catalog-seed.json` key→stage bind (PR #282) | apply-recommended-routes → 500 ENOENT | shared `resolveSeedPath` cwd-walk |

(Two further latent same-class sites exist on `main` — `records/subprocessors.ts` and
`connect/demo-graph/seed-demo-graph.ts` — allowlisted in the guard pending a fix.)

## The canonical pattern — pick one

### 1. PREFERRED — module-import the asset

Let Rollup inline the asset into the server chunk. **No runtime `fs`. Adapter-agnostic. No
copy step or path resolver to maintain.** This is the default; reach for it first.

```ts
// JSON — `resolveJsonModule` is already on
import manifest from "./starter-corpus/manifest.json";
// Text (markdown, etc.) — Vite ?raw query
import passage from "./starter-corpus/01-trolley-problem-dialogue.md?raw";
```

Use this whenever the asset set is **fixed and known at build time** and lives at or below the
importing module. (This is how PR #276 fixed starter-corpus.)

### 2. FALLBACK — the shared cwd-walk resolver

Only when the asset set is **dynamic / whole-repo / git-backed** and genuinely cannot be
module-imported — e.g. the records gate scans arbitrary `.md` across the whole repo and reads
git history. Resolve at runtime by walking up from `process.cwd()` (the container `WORKDIR`
is the repo root) to the `pnpm-workspace.yaml` workspace marker, preferring the
module-relative candidate when it exists (so prerender behaviour is unchanged):

- repo root → `apps/dashboard/src/lib/server/records/gate.ts` → `resolveRepoRoot()`
- dashboard data asset → `apps/dashboard/src/lib/server/catalogue/seed-path.ts` → `resolveSeedPath()`

```ts
import { resolveSeedPath } from "$lib/server/catalogue/seed-path";
const SEED_PATH = resolveSeedPath(
  fileURLToPath(new URL("../../../../data/model-catalog-seed.json", import.meta.url)),
);
const raw = readFileSync(SEED_PATH, "utf8"); // path is robust in the bundle
```

A bespoke cwd-walk that checks `existsSync(join(dir, "pnpm-workspace.yaml"))` is also
accepted — but prefer reusing the two helpers above over a fourth copy.

## The guard

`scripts/ci/check-bundled-asset-reads.mjs` (wired into `.forgejo/workflows/ci.yml`, blocking)
scans `apps/dashboard/src/lib/server/**` and **fails CI** on any **new** file that feeds a
fixed-climb or sibling-dir `import.meta.url` path into a runtime `readFileSync` /
`readdirSync` **without** routing through a sanctioned resolver. Module-import sites have no
runtime `fs` read, so they never trip it. Known-pending sites are allowlisted in the script
(each with a tracking ref); the guard stays green after the open fix PRs merge and then notes
the now-stale allowlist entries for cleanup.

**If the guard fails your PR:** do **not** add your file to the allowlist. Switch the site to
a sanctioned pattern above. Unit tests for the classifier live in
`scripts/ci/check-bundled-asset-reads.test.mjs`.
