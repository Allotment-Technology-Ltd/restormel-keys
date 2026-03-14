import type { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import {
  openaiProvider,
  anthropicProvider,
  googleProvider,
} from "@restormel/keys";
import type { ProviderDefinition } from "@restormel/keys";
import { readStore, writeStore, maskApiKey } from "../store.js";

const PROVIDERS: Record<string, ProviderDefinition> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  google: googleProvider,
};

export function registerAdd(program: Command): void {
  program
    .command("add <provider>")
    .description("Prompt for API key, validate, and store (provider: openai | anthropic | google)")
    .action(async (providerArg: string) => {
      const providerId = providerArg.toLowerCase();
      const provider = PROVIDERS[providerId];
      if (!provider) {
        console.error(chalk.red("Unknown provider:"), providerArg);
        console.error(chalk.gray("Use: openai | anthropic | google"));
        process.exit(1);
      }

      const { apiKey } = await inquirer.prompt<{ apiKey: string }>([
        {
          type: "password",
          name: "apiKey",
          message: `${provider.name} API key:`,
          mask: "*",
        },
      ]);
      if (!apiKey?.trim()) {
        console.error(chalk.red("No key provided."));
        process.exit(1);
      }

      const validation = await provider.validateKey(apiKey.trim());
      if (!validation.valid) {
        console.error(chalk.red("Validation failed:"), validation.errors?.join(" ") ?? "Invalid key");
        process.exit(1);
      }

      const cwd = process.cwd();
      const store = await readStore(cwd);
      const id = `key-${providerId}-${Date.now()}`;
      const masked = maskApiKey(apiKey.trim());
      store.keys.push({
        id,
        provider: providerId,
        apiKey: apiKey.trim(),
        mask: masked,
      });
      await writeStore(cwd, store);
      console.log(chalk.green("Key added:"), providerId, chalk.gray(`(${masked})`));
    });
}
