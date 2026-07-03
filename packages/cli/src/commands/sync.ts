import type { Command } from "commander";
import chalk from "chalk";

type OpenRouterActivityItem = {
  date: string;
  model: string;
  provider_name: string;
  usage: number;
  byok_usage_inference: number;
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  reasoning_tokens: number;
};

function parseUtcDayToRange(dateUtc: string): { startMs: number; endMs: number } {
  const startMs = Date.parse(dateUtc + "T00:00:00.000Z");
  if (!Number.isFinite(startMs)) throw new Error(`Invalid date: ${dateUtc}`);
  return { startMs, endMs: startMs + 24 * 60 * 60 * 1000 };
}

export function registerSync(program: Command): void {
  program
    .command("sync")
    .description("Sync gateway data into Restormel (builder-run)")
    .requiredOption("--integration-id <id>", "Integration ID in Restormel dashboard")
    .requiredOption("--restormel-url <url>", "Restormel dashboard base URL (e.g. https://restormel.dev/keys/dashboard)")
    .option("--restormel-gateway-key <key>", "Restormel Gateway Key (Bearer)")
    .option("--openrouter-key <key>", "OpenRouter management key (Bearer)")
    .option("--source <source>", "Source: openrouter-activity", "openrouter-activity")
    .action(async (opts: {
      integrationId: string;
      restormelUrl: string;
      restormelGatewayKey?: string;
      openrouterKey?: string;
      source?: string;
    }) => {
      const source = (opts.source ?? "openrouter-activity").toLowerCase();
      if (source !== "openrouter-activity") {
        console.error(chalk.red("Only --source openrouter-activity is supported in v1."));
        process.exitCode = 2;
        return;
      }
      if (!opts.openrouterKey) {
        console.error(chalk.red("--openrouter-key is required for openrouter-activity."));
        process.exitCode = 2;
        return;
      }
      if (!opts.restormelGatewayKey) {
        console.error(chalk.red("--restormel-gateway-key is required to POST into Restormel."));
        process.exitCode = 2;
        return;
      }

      const openrouterRes = await fetch("https://openrouter.ai/api/v1/activity", {
        headers: { Authorization: `Bearer ${opts.openrouterKey}` },
      });
      if (!openrouterRes.ok) {
        const body = await openrouterRes.text().catch(() => "");
        console.error(chalk.red(`OpenRouter activity failed (${openrouterRes.status}).`));
        console.error(body.slice(0, 400));
        process.exitCode = 1;
        return;
      }
      const payload = (await openrouterRes.json()) as { data?: OpenRouterActivityItem[] };
      const data = Array.isArray(payload.data) ? payload.data : [];
      // Basic sanity to avoid accidental huge posts
      if (data.length > 50000) {
        console.error(chalk.red(`Refusing to sync ${data.length} rows (too many).`));
        process.exitCode = 2;
        return;
      }
      // Validate date shapes early so we fail locally
      for (const row of data) parseUtcDayToRange(row.date);

      const restormelBase = opts.restormelUrl.replace(/\/+$/, "");
      const importUrl = `${restormelBase}/api/integrations/${opts.integrationId}/import/openrouter-activity`;
      const importRes = await fetch(importUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${opts.restormelGatewayKey}`,
        },
        body: JSON.stringify({ data }),
      });
      const importBody = await importRes.json().catch(() => ({}));
      if (!importRes.ok) {
        console.error(chalk.red(`Restormel import failed (${importRes.status}).`));
        console.error(chalk.gray(JSON.stringify(importBody).slice(0, 400)));
        process.exitCode = 1;
        return;
      }

      console.log(chalk.green("Synced OpenRouter activity into Restormel."));
      console.log(chalk.gray(JSON.stringify(importBody, null, 2)));
    });
}

