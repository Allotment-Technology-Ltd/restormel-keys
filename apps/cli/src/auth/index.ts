/**
 * auth/index — registers `restormel auth login` (interactive prompt to set
 * workspace + API key in ~/.restormel/config.json) and `restormel auth status`
 * (show the resolved auth config, masking the key).
 */
import type { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import {
  configPath,
  readStoredConfig,
  resolveConfig,
  writeStoredConfig,
  type GlobalFlags,
} from "../config.js";

function maskKey(key: string | undefined): string {
  if (!key) return chalk.dim("(not set)");
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export function registerAuth(program: Command): void {
  const auth = program.command("auth").description("Manage Restormel CLI auth config");

  auth
    .command("login")
    .description("Interactively set the workspace and API key in ~/.restormel/config.json")
    .action(async () => {
      const existing = readStoredConfig();
      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "workspace",
          message: "Workspace ID:",
          default: existing.workspace,
        },
        {
          type: "password",
          name: "apiKey",
          message: "API key (leave blank to keep current):",
          mask: "*",
        },
        {
          type: "input",
          name: "graphStore",
          message: "Graph store URL (optional, for local --graph-store mode):",
          default: existing.graphStore,
        },
      ]);

      const next = {
        ...existing,
        workspace: (answers.workspace as string)?.trim() || existing.workspace,
        apiKey: (answers.apiKey as string)?.trim() || existing.apiKey,
        graphStore: (answers.graphStore as string)?.trim() || existing.graphStore,
      };
      writeStoredConfig(next);
      process.stderr.write(chalk.green(`Saved to ${configPath()}\n`));
    });

  auth
    .command("status")
    .description("Show the current auth configuration")
    .action((_opts, command: Command) => {
      const globalFlags = command.parent?.parent?.opts<GlobalFlags>() ?? {};
      const config = resolveConfig(globalFlags);
      const lines = [
        chalk.bold("Restormel auth status"),
        `  Config file: ${configPath()}`,
        `  Workspace:   ${config.workspace ?? chalk.dim("(not set)")}`,
        `  API key:     ${maskKey(config.apiKey)}`,
        `  API base:    ${config.apiBase}`,
        `  Graph store: ${config.graphStore ?? chalk.dim("(not set)")}`,
      ];
      process.stdout.write(lines.join("\n") + "\n");
    });
}
