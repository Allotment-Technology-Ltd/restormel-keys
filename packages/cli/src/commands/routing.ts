import type { Command } from "commander";
import chalk from "chalk";
import { defaultProviders } from "@restormel/keys";
import type { ProviderDefinition } from "@restormel/keys";

function findProviderForModel(
  modelId: string,
  providers: ProviderDefinition[],
): ProviderDefinition | undefined {
  return providers.find((p) => p.models.includes(modelId));
}

export function registerRouting(program: Command): void {
  const routingCmd = program
    .command("routing")
    .description("Routing operations");

  routingCmd
    .command("explain <model>")
    .description("Explain routing decisions for a model")
    .action(async (model: string) => {
      console.log(chalk.cyan("Routing explanation for:"), chalk.white(model));
      console.log();

      const provider = findProviderForModel(model, defaultProviders);
      if (!provider) {
        console.log(chalk.yellow("Step 1:"), "Search default providers for model");
        console.log(chalk.red("  → Model not found in any configured provider."));
        console.log();
        console.log(chalk.gray("Available providers:"), defaultProviders.map((p) => p.id).join(", "));
        process.exit(1);
      }

      console.log(chalk.yellow("Step 1:"), "Search default providers for model");
      console.log(chalk.green("  → Found in provider:"), provider.name, chalk.gray(`(${provider.id})`));

      const cost = provider.estimateCost(model);
      if (cost) {
        console.log(chalk.yellow("Step 2:"), "Cost lookup");
        console.log(
          chalk.green("  →"),
          `$${cost.inputPerMillion?.toFixed(2) ?? "?"}/M input, $${cost.outputPerMillion?.toFixed(2) ?? "?"}/M output`,
        );
      }

      console.log(chalk.yellow("Step 3:"), "Resolution");
      console.log(chalk.green("  → Route to"), chalk.white(`${provider.id}/${model}`));
      console.log();
      console.log(
        chalk.gray("Note: This shows static provider resolution. Route/policy-based routing"),
      );
      console.log(chalk.gray("requires a configured project with routes and policies."));
    });
}
