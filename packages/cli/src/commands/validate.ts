import type { Command } from "commander";
import chalk from "chalk";
import {
  openaiProvider,
  anthropicProvider,
  googleProvider,
} from "@restormel/keys";
import type { ProviderDefinition } from "@restormel/keys";
import { readStore } from "../store.js";

const PROVIDERS: Record<string, ProviderDefinition> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  google: googleProvider,
};

export function registerValidate(program: Command): void {
  program
    .command("validate")
    .description("Re-validate all stored keys (exit 1 if any invalid — CI-friendly)")
    .action(async () => {
      const cwd = process.cwd();
      const store = await readStore(cwd);
      if (store.keys.length === 0) {
        console.log(chalk.gray("No keys to validate."));
        process.exit(0);
      }
      let allValid = true;
      for (const k of store.keys) {
        const provider = PROVIDERS[k.provider];
        if (!provider) {
          console.log(chalk.yellow("Skip (unknown provider):"), k.provider);
          continue;
        }
        const result = await provider.validateKey(k.apiKey);
        if (result.valid) {
          console.log(chalk.green("OK"), k.provider, chalk.gray(k.mask ?? k.id));
        } else {
          console.log(chalk.red("INVALID"), k.provider, chalk.gray(k.mask ?? k.id), result.errors?.[0] ?? "");
          allValid = false;
        }
      }
      process.exit(allValid ? 0 : 1);
    });
}
