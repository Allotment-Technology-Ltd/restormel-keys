import type { Command } from "commander";
import chalk from "chalk";
import { fetchCanonicalCatalog } from "@restormel/keys/dashboard";

function getBaseUrl(explicit?: string): string {
  const fromEnv = typeof process !== "undefined" ? process.env.RESTORMEL_KEYS_BASE?.trim() : "";
  const raw = explicit?.trim() || fromEnv || "https://restormel.dev";
  return raw.replace(/\/$/, "");
}

export function registerCatalog(program: Command): void {
  const catalogCmd = program
    .command("catalog")
    .description("Canonical provider + model catalog (public HTTP feed)");

  catalogCmd
    .command("fetch")
    .description("Fetch GET /keys/dashboard/api/catalog and print a summary (or JSON with --json)")
    .option("--base-url <url>", "Restormel site base (default RESTORMEL_KEYS_BASE or https://restormel.dev)")
    .option("--limit <n>", "Page size (1–1000, default 500)", "500")
    .option("--offset <n>", "Paging offset (default 0)", "0")
    .option("--include-unhealthy", "Include deprecated models and non-available variants (operator/debug)")
    .option(
      "--skip-allowlist",
      "Include DB rows not in @restormel/keys defaultProviders (operator/debug; same as skipDefaultAllowlist=1)"
    )
    .option("--json", "Print full JSON response to stdout")
    .action(
      async (opts: {
        baseUrl?: string;
        limit?: string;
        offset?: string;
        includeUnhealthy?: boolean;
        skipAllowlist?: boolean;
        json?: boolean;
      }) => {
        const baseUrl = getBaseUrl(opts.baseUrl);
        const limit = Math.min(1000, Math.max(1, parseInt(opts.limit ?? "500", 10) || 500));
        const offset = Math.max(0, parseInt(opts.offset ?? "0", 10) || 0);

        try {
          const catalog = await fetchCanonicalCatalog({
            baseUrl,
            limit,
            offset,
            includeUnhealthy: Boolean(opts.includeUnhealthy),
            skipDefaultAllowlist: Boolean(opts.skipAllowlist),
          });

          if (opts.json) {
            console.log(JSON.stringify(catalog, null, 2));
            return;
          }

          console.log(chalk.cyan("Restormel canonical catalog"));
          console.log(chalk.gray("  base:"), baseUrl);
          console.log(chalk.gray("  contractVersion:"), catalog.contractVersion);
          console.log(chalk.gray("  generatedAt:"), catalog.generatedAt);
          if (catalog.compatibility) {
            console.log(chalk.gray("  min CLI version:"), catalog.compatibility.minCliVersion);
            console.log(chalk.gray("  min @restormel/keys version:"), catalog.compatibility.minCoreDashboardVersion);
            console.log(chalk.gray("  docs:"), catalog.compatibility.docsUrl);
            console.log(
              chalk.yellow(
                "  upgrade hint: use `npx @restormel/keys-cli@latest catalog fetch` for the latest catalog contract support"
              )
            );
          }
          console.log(
            chalk.gray("  page:"),
            `offset ${catalog.paging.offset}, limit ${catalog.paging.limit}, rows ${catalog.paging.count}`
          );
          console.log(chalk.gray("  providers:"), catalog.providers.length);
          console.log(chalk.gray("  models (this page):"), catalog.data.length);

          if (catalog.providers.length > 0) {
            console.log(chalk.bold("\nProviders (id → modelCount, validation.mode)"));
            for (const p of catalog.providers) {
              const mode = p.validation?.mode ?? "?";
              console.log(
                "  ",
                chalk.white(p.id),
                chalk.gray("→"),
                p.modelCount,
                chalk.gray(`(${mode})`)
              );
            }
          }

          if (catalog.data.length > 0 && catalog.data.length <= 15) {
            console.log(chalk.bold("\nModels (this page)"));
            for (const m of catalog.data) {
              console.log("  ", chalk.white(m.id), chalk.gray(m.canonicalName ?? ""));
            }
          } else if (catalog.data.length > 15) {
            console.log(
              chalk.gray(
                `\n(Showing ${catalog.data.length} models on this page; use --json or adjust --limit/--offset.)`
              )
            );
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(chalk.red("Catalog fetch failed:"), msg);
          process.exit(1);
        }
      }
    );
}
