import type { Command } from "commander";
import chalk from "chalk";
import { readStore } from "../store.js";
import { maskApiKey } from "../store.js";

export function registerList(program: Command): void {
  program
    .command("list")
    .description("Show stored keys (masked)")
    .action(async () => {
      const cwd = process.cwd();
      const store = await readStore(cwd);
      if (store.keys.length === 0) {
        console.log(chalk.gray("No keys stored. Use keys add <provider> to add one."));
        return;
      }
      console.log(chalk.cyan("Stored keys (masked):"));
      for (const k of store.keys) {
        const mask = k.mask ?? maskApiKey(k.apiKey);
        console.log(" ", chalk.white(k.provider), chalk.gray(mask), k.label ? chalk.gray(`(${k.label})`) : "");
      }
    });
}
