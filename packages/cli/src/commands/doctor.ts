import type { Command } from "commander";
import chalk from "chalk";
import { existsSync } from "fs";
import { join } from "path";
import { detectFramework } from "../detect.js";
import { readConfig } from "../config.js";
import { readStore } from "../store.js";

export function registerDoctor(program: Command): void {
  program
    .command("doctor")
    .description("Check framework, packages, config, key health")
    .action(async () => {
      const cwd = process.cwd();
      const detected = await detectFramework(cwd);
      const config = await readConfig(cwd);
      const store = await readStore(cwd);

      console.log(chalk.cyan("Restormel Keys — doctor"));
      console.log("");

      let ok = true;

      console.log(chalk.gray("Framework:"));
      console.log(" ", detected.name);
      if (detected.id === "none") {
        console.log(chalk.yellow("  No supported framework detected. keys init will suggest @restormel/keys only."));
      }
      console.log("");

      console.log(chalk.gray("Config:"));
      if (config) {
        console.log(" ", "restormel.config.json", chalk.green("found"));
        if (config.framework) console.log(" ", "framework:", config.framework);
        if (config.providers?.length) console.log(" ", "providers:", config.providers.join(", "));
      } else {
        console.log(" ", chalk.yellow("restormel.config.json not found. Run keys init."));
        ok = false;
      }
      console.log("");

      console.log(chalk.gray("Suggested packages:"));
      for (const p of detected.packagePaths) {
        const pkgPath = join(cwd, "node_modules", p);
        const found = existsSync(pkgPath);
        console.log(" ", found ? chalk.green("✓") : chalk.yellow("○"), p);
        if (!found) ok = false;
      }
      console.log("");

      console.log(chalk.gray("Stored keys:"));
      if (store.keys.length === 0) {
        console.log(" ", chalk.gray("None. Use keys add <provider> to add one."));
      } else {
        for (const k of store.keys) {
          console.log(" ", k.provider, chalk.gray(k.mask ?? k.id));
        }
      }

      process.exit(ok ? 0 : 1);
    });
}
