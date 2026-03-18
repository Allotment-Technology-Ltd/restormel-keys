import type { Command } from "commander";
import chalk from "chalk";
import { detectFramework } from "../detect.js";
import { readConfig, writeConfig, CONFIG_FILENAME } from "../config.js";
import type { DetectedFramework } from "../detect.js";

export function registerInit(program: Command): void {
  program
    .command("init")
    .description("Detect framework, prompt providers/storage, generate config, suggest packages")
    .action(async () => {
      const cwd = process.cwd();
      const detected = await detectFramework(cwd);
      const existing = await readConfig(cwd);

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
      await writeConfig(cwd, config);
      console.log(chalk.green("Wrote"), CONFIG_FILENAME);
      console.log(chalk.gray("Next: keys add <provider> to add keys, keys doctor to check setup."));
    });
}
