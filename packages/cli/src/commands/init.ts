import type { Command } from "commander";
import chalk from "chalk";
import { detectFramework } from "../detect.js";
import { readConfig, writeConfig, CONFIG_FILENAME } from "../config.js";
import type { DetectedFramework } from "../detect.js";
import {
  MCP_CLIENTS,
  MCP_CLIENT_LABELS,
  formatMcpConfig,
  mcpConfigFilePaths,
  type McpClient,
} from "../init-mcp.js";

interface InitOptions {
  mcp?: boolean;
  mcpClient?: string;
}

function printMcpOutput(client: McpClient): void {
  const paths = mcpConfigFilePaths(client);
  const label = MCP_CLIENT_LABELS[client];

  console.log(chalk.cyan(`\n── ${label} ──`));
  console.log(chalk.gray("Config file location:"));
  for (const p of paths) {
    console.log(chalk.white(`  ${p}`));
  }
  console.log(chalk.gray("\nPaste into mcpServers (merge with any existing servers):"));
  console.log(chalk.white(formatMcpConfig(client)));
  console.log(chalk.gray("Fill in RESTORMEL_GATEWAY_KEY and RESTORMEL_WORKSPACE_ID from your Connect hub:"));
  console.log(chalk.white("  https://restormel.dev/keys/dashboard/connect"));
  console.log(chalk.gray("Then restart the MCP client to load the server."));
}

export function registerInit(program: Command): void {
  program
    .command("init")
    .description("Detect framework, prompt providers/storage, generate config, suggest packages")
    .option(
      "--mcp",
      "Emit a ready MCP config for Claude Code, Claude Desktop, and Cursor (connect.retrieve_verified tool)"
    )
    .option(
      "--mcp-client <client>",
      "Limit MCP output to one client: claude-code | claude-desktop | cursor"
    )
    .action(async (opts: InitOptions) => {
      // --mcp mode: emit MCP server config and exit; skip normal init flow.
      if (opts.mcp) {
        console.log(chalk.cyan("Restormel Keys — MCP config"));
        console.log("");
        console.log(
          "The " +
            chalk.bold("connect.retrieve_verified") +
            " tool returns evidence-bound, citation-grounded context"
        );
        console.log("from your Restormel Connect knowledge graph directly inside your AI client.");
        console.log("");
        console.log(chalk.yellow("Before you paste:"));
        console.log("  1. Build your knowledge graph in the Connect hub (keys add + ingest).");
        console.log("  2. Copy your workspace ID from https://restormel.dev/keys/dashboard/connect");
        console.log("  3. Copy a Gateway key from https://restormel.dev/keys/dashboard");
        console.log("  4. Replace the placeholder values below with your real values.");
        console.log(
          chalk.red("  Never commit your Gateway key. Inject it via your OS keychain or a secret manager.")
        );
        console.log("");

        const rawClient = opts.mcpClient?.trim().toLowerCase() as McpClient | undefined;
        let clients: McpClient[];
        if (rawClient) {
          if (!(MCP_CLIENTS as readonly string[]).includes(rawClient)) {
            console.error(
              chalk.red(`Unknown --mcp-client "${rawClient}". Valid values: ${MCP_CLIENTS.join(", ")}`)
            );
            process.exitCode = 2;
            return;
          }
          clients = [rawClient as McpClient];
        } else {
          clients = [...MCP_CLIENTS];
        }

        for (const client of clients) {
          printMcpOutput(client);
        }

        console.log("");
        console.log(chalk.cyan("Quickstart guide:"));
        console.log(
          chalk.white("  https://restormel.dev/keys/docs/guides/mcp-verified-context")
        );
        return;
      }

      // Standard init flow (unchanged).
      const detected = await detectFramework();
      const existing = await readConfig();

      console.log(chalk.cyan("Restormel Keys — init"));
      console.log("");
      console.log(chalk.gray("Detected framework:"), chalk.white(detected.name));
      if (detected.packagePaths.length) {
        console.log(chalk.gray("Suggested packages:"), chalk.white(detected.packagePaths.join(", ")));
        if (detected.optionalUiPackages.length) {
          console.log(
            chalk.gray("Optional UI (Phase 5 — ModelSelector / KeyManager):"),
            chalk.white(detected.optionalUiPackages.join(", "))
          );
        }
      }
      console.log("");

      const config = {
        framework: detected.id,
        providers: existing?.providers ?? [],
      };
      await writeConfig(config);
      console.log(chalk.green("Wrote"), CONFIG_FILENAME);
      console.log(chalk.gray("Next: keys add <provider> to add keys, keys doctor to check setup."));
    });
}
