/**
 * Unit tests for resolveSeedPath — the runtime seed-path resolver that fixes the bundled
 * adapter-node `import.meta.url` overshoot (ENOENT) on the catalog seed JSON.
 */
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveSeedPath } from "./seed-path";

const SEED_REL = join("apps", "dashboard", "data", "model-catalog-seed.json");

function makeFakeWorkspace(): string {
  // realpathSync normalizes the macOS /var → /private/var symlink so it matches the
  // real cwd the resolver walks up from.
  const root = realpathSync(mkdtempSync(join(tmpdir(), "seed-path-test-")));
  writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n");
  const dataDir = join(root, "apps", "dashboard", "data");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(root, SEED_REL), JSON.stringify({ models: [] }));
  return root;
}

describe("resolveSeedPath", () => {
  const origCwd = process.cwd();
  const cleanups: string[] = [];

  afterEach(() => {
    process.chdir(origCwd);
    while (cleanups.length) rmSync(cleanups.pop()!, { recursive: true, force: true });
  });

  it("returns the module-relative candidate when it exists (source / prerender hot path)", () => {
    const root = makeFakeWorkspace();
    cleanups.push(root);
    const candidate = join(root, SEED_REL); // exists on disk
    expect(resolveSeedPath(candidate)).toBe(candidate);
  });

  it("walks up from cwd to the workspace root when the candidate overshoots (bundled runtime)", () => {
    const root = makeFakeWorkspace();
    cleanups.push(root);
    // Simulate the bundled adapter-node overshoot: dashboard/ segment dropped → wrong path.
    const overshot = join(root, "apps", "data", "model-catalog-seed.json");
    // Run from a nested dir inside the workspace, like a container WORKDIR/subprocess.
    const nested = join(root, "apps", "dashboard");
    process.chdir(nested);
    expect(resolveSeedPath(overshot)).toBe(join(root, SEED_REL));
  });

  it("falls back to the original candidate when no workspace marker is found", () => {
    const orphan = realpathSync(mkdtempSync(join(tmpdir(), "seed-path-orphan-")));
    cleanups.push(orphan);
    process.chdir(orphan);
    const candidate = join(orphan, "nope", "model-catalog-seed.json");
    expect(resolveSeedPath(candidate)).toBe(candidate);
  });
});
