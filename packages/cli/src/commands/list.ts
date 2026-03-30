import type { Command } from "commander";
import chalk from "chalk";
import { readStore } from "../store.js";
import { maskApiKey } from "../store.js";

export function registerList(program: Command): void {
  program
    .command("list")
    .description("Show provider credentials (local, masked)")
    .action(async () => {
      const store = await readStore();
      if (store.keys.length === 0) {
        console.log(chalk.gray("No provider credentials found. Use keys add <provider> to add one."));
        return;
      }
      console.log(chalk.cyan("Provider credentials (local, masked):"));
      for (const k of store.keys) {
        const mask = k.mask ?? maskApiKey(k.apiKey);
        console.log(" ", chalk.white(k.provider), chalk.gray(mask), k.label ? chalk.gray(`(${k.label})`) : "");
      }
    });
}
