import type { Command } from "commander";
import chalk from "chalk";
import { spawn } from "node:child_process";
import os from "node:os";
import { fileURLToPath, URLSearchParams } from "node:url";

async function delegateTo(pkgName: string, passthroughArgs: string[]): Promise<{ exitCode: number; output: string }> {
  let resolved: string;
  try {
    resolved = import.meta.resolve(pkgName);
  } catch {
    console.error(chalk.red("Cannot resolve"), pkgName);
    return { exitCode: 2, output: "" };
  }
  const entryPath = fileURLToPath(resolved);
  const child = spawn(process.execPath, [entryPath, ...passthroughArgs], { stdio: ["inherit", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (chunk: Buffer | string) => {
    const text = String(chunk);
    output += text;
    process.stdout.write(text);
  });
  child.stderr.on("data", (chunk: Buffer | string) => {
    const text = String(chunk);
    output += text;
    process.stderr.write(text);
  });

  const exitCode = await new Promise<number>((resolve) => {
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(2));
  });
  return { exitCode, output };
}

function detectPackageManager(): string {
  const userAgent = process.env.npm_config_user_agent ?? "";
  if (userAgent.startsWith("pnpm/")) return "pnpm";
  if (userAgent.startsWith("yarn/")) return "yarn";
  if (userAgent.startsWith("npm/")) return "npm";
  return "unknown";
}

function buildReportUrl(doctorOutput: string): string {
  const body =
    `## keys doctor output\n\n` +
    "```\n" +
    `${doctorOutput.trim()}\n` +
    "```\n\n" +
    `- Node: \`${process.version}\`\n` +
    `- OS: \`${os.platform()} ${os.release()}\`\n` +
    `- Package manager: \`${detectPackageManager()}\`\n` +
    `- Timestamp: \`${new Date().toISOString()}\`\n`;
  const params = new URLSearchParams({
    template: "bug_report.md",
    title: "[keys doctor failure]",
    body,
  });
  return `https://github.com/restormel-keys/restormel-keys/new?${params.toString()}`;
}

export function registerDoctor(program: Command): void {
  program
    .command("doctor [args...]")
    .description("Run Restormel Doctor (standalone OSS CLI)")
    .option("--report", "print a pre-filled GitHub issue URL when checks fail")
    .allowUnknownOption(true)
    .action(async (args: string[] = [], options: { report?: boolean }) => {
      const { exitCode, output } = await delegateTo("@restormel/doctor", args);
      if (options.report && exitCode !== 0) {
        console.log("\nSome checks failed. Open a pre-filled GitHub issue?");
        console.log(buildReportUrl(output));
      }
      process.exit(exitCode);
    });
}
