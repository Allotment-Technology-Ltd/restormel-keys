import type { Command } from "commander";
import chalk from "chalk";
import { estimateCost, openaiProvider, anthropicProvider, googleProvider } from "@restormel/keys";
import type { ProviderDefinition } from "@restormel/keys";

const PROVIDERS: ProviderDefinition[] = [openaiProvider, anthropicProvider, googleProvider];

export function registerEstimate(program: Command): void {
  program
    .command("estimate <model>")
    .description("Cost estimate for a model (e.g. gpt-4o, claude-sonnet-4)")
    .option("-i, --input <n>", "Input tokens (millions)", "1")
    .option("-o, --output <n>", "Output tokens (millions)", "1")
    .action(async (model: string, opts: { input?: string; output?: string }) => {
      const inputM = parseFloat(opts.input ?? "1");
      const outputM = parseFloat(opts.output ?? "1");
      if (Number.isNaN(inputM) || Number.isNaN(outputM) || inputM < 0 || outputM < 0) {
        console.error(chalk.red("--input and --output must be non-negative numbers."));
        process.exit(1);
      }
      const result = estimateCost(model, PROVIDERS);
      if (!result) {
        console.error(chalk.red("Unknown model:"), model);
        process.exit(1);
      }
      const inputCost = (result.inputPerMillion ?? 0) * inputM;
      const outputCost = (result.outputPerMillion ?? 0) * outputM;
      const total = inputCost + outputCost;
      const unit = result.unit ?? "USD";
      console.log(chalk.cyan("Cost estimate:"), model, chalk.gray(`(${result.providerId})`));
      console.log(" ", "Input ", inputM, "M tokens →", chalk.white(`${inputCost.toFixed(4)} ${unit}`));
      console.log(" ", "Output", outputM, "M tokens →", chalk.white(`${outputCost.toFixed(4)} ${unit}`));
      console.log(" ", chalk.green("Total"), chalk.white(`${total.toFixed(4)} ${unit}`));
    });
}
