import type { Command } from "commander";
import chalk from "chalk";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

async function delegateTo(pkgName: string, passthroughArgs: string[]): Promise<number> {
  let resolved: string;
  try {
    resolved = import.meta.resolve(pkgName);
  } catch {
    console.error(chalk.red("Cannot resolve"), pkgName);
    return 2;
  }
  const entryPath = fileURLToPath(resolved);
  const child = spawn(process.execPath, [entryPath, ...passthroughArgs], { stdio: "inherit" });
  return await new Promise<number>((resolve) => {
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(2));
  });
}

export function registerValidate(program: Command): void {
  program
    .command("validate [args...]")
    .description("Run Restormel Validate (standalone OSS CLI; CI-friendly)")
    .allowUnknownOption(true)
    .action(async (args: string[] = []) => {
      const code = await delegateTo("@restormel/validate", args);
      process.exit(code);
    });
}
