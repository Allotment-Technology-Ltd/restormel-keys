/**
 * Robust runtime resolver for the bundled model-catalog seed JSON.
 *
 * The seed ships at `apps/dashboard/data/model-catalog-seed.json`. Modules resolve it
 * with an `import.meta.url`-relative climb (e.g. `../../../../data/model-catalog-seed.json`),
 * which is correct in the SOURCE tree and under SvelteKit prerender. But in the bundled
 * adapter-node RUNTIME the importing module is emitted at a SHALLOWER depth, so that fixed
 * relative climb OVERSHOOTS — it drops the `dashboard/` segment and points at
 * `/app/apps/data/model-catalog-seed.json`, which does not exist → ENOENT 500.
 *
 * This is the same class of bug as the bundled REPO_ROOT overshoot fixed in 112b8c99
 * (records gate) and the starter-corpus ENOENT: an `import.meta.url` path that is correct
 * at build time but wrong in the adapter-node bundle.
 *
 * Strategy (mirrors `resolveRepoRoot` in records/gate.ts):
 *   1. Prefer the caller's module-relative candidate when it actually exists on disk
 *      (preserves SOURCE / prerender behaviour EXACTLY — unchanged hot path).
 *   2. Otherwise walk up from `process.cwd()` (the container WORKDIR is the repo root) to
 *      the `pnpm-workspace.yaml` workspace marker, then resolve the canonical seed path
 *      `apps/dashboard/data/model-catalog-seed.json` under it.
 *   3. As a last resort, return the original candidate so the caller's error surfaces the
 *      path it expected (rather than masking it).
 */
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

/** Canonical location of the seed under the repo root. */
const SEED_REL_PATH = join("apps", "dashboard", "data", "model-catalog-seed.json");
/** Marker that identifies the pnpm workspace (repo) root. */
const WORKSPACE_MARKER = "pnpm-workspace.yaml";

/**
 * Resolve an absolute path to the model-catalog seed JSON robustly at runtime.
 *
 * @param moduleRelativeCandidate Absolute path the calling module computed from its own
 *   `import.meta.url` (the prerender-correct path). Prefer this when it exists on disk.
 */
export function resolveSeedPath(moduleRelativeCandidate: string): string {
  // 1. Source / prerender: the module-relative path is correct and present.
  if (existsSync(moduleRelativeCandidate)) return moduleRelativeCandidate;

  // 2. Bundled runtime: walk up from cwd to the workspace marker, then resolve canonically.
  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, WORKSPACE_MARKER))) {
      const fromRoot = join(dir, SEED_REL_PATH);
      if (existsSync(fromRoot)) return fromRoot;
      break;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // 3. Fall back to the original candidate so any error reports the expected path.
  return moduleRelativeCandidate;
}
