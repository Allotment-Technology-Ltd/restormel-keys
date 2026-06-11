/**
 * Regression test for the production migration-pipeline outage (PRs #224–#236):
 *
 * `apps/dashboard/package.json` scripts that shell out via `pnpm -w exec` run
 * with CWD at the WORKSPACE ROOT, so every relative path in those commands must
 * resolve from the repo root — not from apps/dashboard. The `migrate` script
 * previously pointed at `./scripts/apply-migrations.mts`, which resolved to
 * <root>/scripts/apply-migrations.mts (nonexistent) and made the CI job
 * `apply-dashboard-migrations-prod` fail with ERR_MODULE_NOT_FOUND on every
 * push that carried a migration. Production never got `schema_migrations`,
 * and the runtime schema assertion took down signed-in dashboard loads.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DASHBOARD_DIR = resolve(__dirname, "..", "..", "..");
const WORKSPACE_ROOT = resolve(DASHBOARD_DIR, "..", "..");

function dashboardScripts(): Record<string, string> {
  const pkg = JSON.parse(readFileSync(join(DASHBOARD_DIR, "package.json"), "utf-8")) as {
    scripts?: Record<string, string>;
  };
  return pkg.scripts ?? {};
}

describe("dashboard package.json — pnpm -w exec script paths", () => {
  it("sanity: resolves the workspace root", () => {
    expect(existsSync(join(WORKSPACE_ROOT, "pnpm-workspace.yaml"))).toBe(true);
  });

  it("every relative path in a `pnpm -w exec` script exists relative to the workspace root", () => {
    const scripts = dashboardScripts();
    const offenders: string[] = [];
    let checkedPaths = 0;

    for (const [name, command] of Object.entries(scripts)) {
      if (!command.includes("pnpm -w exec")) continue;
      // Relative path tokens (./foo or ../foo), e.g. tsconfig and script files.
      const tokens = command.split(/\s+/).filter((t) => t.startsWith("./") || t.startsWith("../"));
      for (const token of tokens) {
        checkedPaths += 1;
        if (!existsSync(resolve(WORKSPACE_ROOT, token))) {
          offenders.push(`${name}: ${token} (resolved from workspace root)`);
        }
      }
    }

    expect(checkedPaths).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it("the migrate script targets the dashboard migration runner", () => {
    const migrate = dashboardScripts()["migrate"];
    expect(migrate).toBeDefined();
    expect(migrate).toContain("apps/dashboard/scripts/apply-migrations.mts");
  });
});
