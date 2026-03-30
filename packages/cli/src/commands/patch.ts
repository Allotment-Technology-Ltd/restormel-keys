import type { Command } from "commander";
import chalk from "chalk";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

type PackageManager = "pnpm" | "npm" | "yarn" | "bun";
type DependencySection = "dependencies" | "devDependencies";

const RESTORMEL_PACKAGES = [
  "@restormel/keys",
  "@restormel/keys-react",
  "@restormel/keys-svelte",
  "@restormel/keys-elements",
  "@restormel/keys-cli",
] as const;

function detectPackageManager(): PackageManager {
  const has = (name: string): boolean => existsSync(name);
  if (has("pnpm-lock.yaml")) return "pnpm";
  if (has("yarn.lock")) return "yarn";
  if (has("bun.lockb") || has("bun.lock")) return "bun";
  return "npm";
}

function isPnpmWorkspaceRoot(): boolean {
  return existsSync("pnpm-workspace.yaml");
}

async function readPackageJson(): Promise<Record<string, unknown> | null> {
  if (!existsSync("package.json")) return null;
  try {
    return JSON.parse(await readFile("package.json", "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function collectInstalledRestormelPackages(
  pkg: Record<string, unknown> | null
): Record<string, DependencySection> {
  const out: Record<string, DependencySection> = {};
  if (!pkg) return out;
  const deps = (pkg.dependencies as Record<string, string> | undefined) ?? {};
  const devDeps = (pkg.devDependencies as Record<string, string> | undefined) ?? {};
  for (const name of RESTORMEL_PACKAGES) {
    if (deps[name]) out[name] = "dependencies";
    else if (devDeps[name]) out[name] = "devDependencies";
  }
  return out;
}

async function runCmd(cwd: string, cmd: string, args: string[]): Promise<number> {
  const child = spawn(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  return await new Promise<number>((resolve) => {
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

async function updatePackages(
  cwd: string,
  pm: PackageManager,
  sections: Record<string, DependencySection>,
  dryRun: boolean,
  opts: { workspaceRoot: boolean }
): Promise<number> {
  const prod = Object.entries(sections)
    .filter(([, section]) => section === "dependencies")
    .map(([name]) => `${name}@latest`);
  const dev = Object.entries(sections)
    .filter(([, section]) => section === "devDependencies")
    .map(([name]) => `${name}@latest`);

  if (prod.length === 0 && dev.length === 0) return 0;

  const steps: Array<{ cmd: string; args: string[]; label: string }> = [];
  if (pm === "pnpm") {
    if (opts.workspaceRoot) {
      const targets = Array.from(
        new Set((prod.length || dev.length ? [...prod, ...dev] : RESTORMEL_PACKAGES.map((name) => `${name}@latest`)))
      );
      if (targets.length) {
        steps.push({
          cmd: "pnpm",
          args: ["up", "-r", ...targets],
          label: "workspace dependencies",
        });
      }
    } else {
      if (prod.length) steps.push({ cmd: "pnpm", args: ["add", ...prod], label: "dependencies" });
      if (dev.length) steps.push({ cmd: "pnpm", args: ["add", "-D", ...dev], label: "devDependencies" });
    }
  } else if (pm === "yarn") {
    if (prod.length) steps.push({ cmd: "yarn", args: ["add", ...prod], label: "dependencies" });
    if (dev.length) steps.push({ cmd: "yarn", args: ["add", "-D", ...dev], label: "devDependencies" });
  } else if (pm === "bun") {
    if (prod.length) steps.push({ cmd: "bun", args: ["add", ...prod], label: "dependencies" });
    if (dev.length) steps.push({ cmd: "bun", args: ["add", "-d", ...dev], label: "devDependencies" });
  } else {
    if (prod.length) steps.push({ cmd: "npm", args: ["install", ...prod], label: "dependencies" });
    if (dev.length) steps.push({ cmd: "npm", args: ["install", "-D", ...dev], label: "devDependencies" });
  }

  for (const step of steps) {
    console.log(chalk.gray(`Updating ${step.label}:`), chalk.white(step.args.join(" ")));
    if (dryRun) continue;
    const code = await runCmd(cwd, step.cmd, step.args);
    if (code !== 0) return code;
  }
  return 0;
}

async function verifyCatalog(): Promise<{ ok: boolean; details: string }> {
  const endpoint = new URL("/keys/dashboard/api/catalog?limit=1", "https://restormel.dev");
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return { ok: false, details: `HTTP ${res.status}` };
    const body = (await res.json()) as { contractVersion?: string; providers?: unknown[] };
    const contract = body.contractVersion ?? "unknown";
    const providerCount = Array.isArray(body.providers) ? body.providers.length : 0;
    return { ok: true, details: `contract=${contract}, providers=${providerCount}` };
  } catch (e) {
    return { ok: false, details: e instanceof Error ? e.message : "fetch_failed" };
  }
}

export function registerPatch(program: Command): void {
  program
    .command("patch")
    .description("Apply latest Restormel package patch updates with minimal manual steps")
    .option("--dry-run", "Print upgrade commands without running them")
    .option("--no-verify-catalog", "Skip catalog endpoint verification")
    .action(async (opts: { dryRun?: boolean; verifyCatalog?: boolean }) => {
      const cwd = process.cwd();
      const pm = detectPackageManager();
      const workspaceRoot = pm === "pnpm" && isPnpmWorkspaceRoot();
      const pkg = await readPackageJson();
      const installed = collectInstalledRestormelPackages(pkg);

      if (!workspaceRoot && Object.keys(installed).length === 0) {
        installed["@restormel/keys"] = "dependencies";
      }

      console.log(chalk.cyan("Restormel Keys — patch upgrade"));
      console.log(chalk.gray("Package manager:"), chalk.white(pm));
      if (workspaceRoot) {
        console.log(chalk.gray("Scope:"), chalk.white("pnpm workspace root (recursive upgrade)"));
      }
      const packageSummary = Object.keys(installed);
      console.log(
        chalk.gray("Packages:"),
        chalk.white(packageSummary.length ? packageSummary.join(", ") : workspaceRoot ? "(auto-detect in workspace)" : "@restormel/keys")
      );

      const code = await updatePackages(cwd, pm, installed, Boolean(opts.dryRun), { workspaceRoot });
      if (code !== 0) {
        console.error(chalk.red("Patch update failed. Fix package manager errors and retry."));
        process.exit(code);
      }

      if (!opts.dryRun && opts.verifyCatalog !== false) {
        const verify = await verifyCatalog();
        if (verify.ok) {
          console.log(chalk.green("Catalog check passed:"), chalk.white(verify.details));
        } else {
          console.log(chalk.yellow("Catalog check warning:"), chalk.white(verify.details));
          console.log(
            chalk.gray("Your app can still run with local fallback. Re-test canonical feed after dashboard deployment.")
          );
        }
      }

      if (opts.dryRun) {
        console.log(chalk.green("Dry run complete."));
      } else {
        console.log(chalk.green("Patch update complete."));
      }
    });
}
