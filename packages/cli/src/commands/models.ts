import type { Command } from "commander";
import chalk from "chalk";
import { defaultProviders } from "@restormel/keys";

export function registerModels(program: Command): void {
  const modelsCmd = program
    .command("models")
    .description("Model operations");

  modelsCmd
    .command("list")
    .description("List available models across all configured providers")
    .option("-p, --provider <id>", "Filter by provider (e.g. openai, anthropic)")
    .action(async (opts: { provider?: string }) => {
      const providers = opts.provider
        ? defaultProviders.filter((p) => p.id === opts.provider || p.aliases?.includes(opts.provider!))
        : defaultProviders;

      if (providers.length === 0) {
        console.error(chalk.red("No matching provider:"), opts.provider);
        process.exit(1);
      }

      for (const provider of providers) {
        console.log(chalk.cyan(provider.name), chalk.gray(`(${provider.id})`));
        for (const model of provider.models) {
          const cost = provider.estimateCost(model);
          const pricing = cost
            ? chalk.gray(
                `$${cost.inputPerMillion?.toFixed(2) ?? "?"}/M in, $${cost.outputPerMillion?.toFixed(2) ?? "?"}/M out`,
              )
            : "";
          console.log("  ", chalk.white(model), pricing);
        }
      }
    });
}
