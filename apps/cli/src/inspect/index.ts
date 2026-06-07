/**
 * inspect/index — registers the `restormel inspect` command. Resolves the mode
 * (local --graph-store vs hosted API), runs the inspect, picks a renderer, and
 * maps the common failures to specific, actionable messages.
 */
import type { Command } from "commander";
import chalk from "chalk";
import { resolveConfig, type GlobalFlags, type OutputFormat } from "../config.js";
import { runLocalInspect, GraphStoreUnreachableError } from "./orchestrator.js";
import { runApiInspect, ApiInspectUnavailableError } from "./api-client.js";
import { renderPretty } from "./renderer-pretty.js";
import { renderJson } from "./renderer-json.js";
import { renderMarkdown } from "./renderer-markdown.js";
import { runWatch } from "./watch.js";
import type { InspectOptions, InspectResult } from "./types.js";

interface InspectCliOptions {
  includeWeak?: boolean;
  includeUnsupported?: boolean;
  depth?: string;
  maxTokens?: string;
  showFiltered?: boolean;
  seed?: string;
  format?: OutputFormat;
  minTrust?: string;
  watch?: boolean;
  watchInterval?: string;
}

function parseIntOpt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Pick the renderer: --format wins, else the global --output format. */
function pickFormat(local: OutputFormat | undefined, global: OutputFormat): OutputFormat {
  return local ?? global;
}

function render(result: InspectResult, format: OutputFormat, quiet: boolean): void {
  if (format === "json") {
    process.stdout.write(renderJson(result) + "\n");
  } else if (format === "markdown") {
    process.stdout.write(renderMarkdown(result) + "\n");
  } else {
    process.stdout.write(renderPretty(result, quiet) + "\n");
  }
}

/** Emit the "no claims retrieved" guidance to stderr (it is advice, not data). */
function warnNoClaims(): void {
  process.stderr.write(
    chalk.yellow(
      [
        "",
        "No supported claims matched your query. Your graph may not contain",
        "relevant content, or the trust score threshold may be too high.",
        "  Try: restormel inspect --include-weak   to see weak claims.",
        "  Try: restormel inspect --depth 5         to traverse deeper.",
        "",
      ].join("\n"),
    ),
  );
}

export function registerInspect(program: Command): void {
  program
    .command("inspect")
    .description("Dry-run retrieval: show what WOULD be retrieved vs filtered, and why.")
    .argument("[query]", "Natural-language query to inspect")
    .option("--include-weak", "Include weak claims (default: supported only)")
    .option("--include-unsupported", "Include unsupported claims")
    .option("--depth <n>", "Traversal depth (default: 3)")
    .option("--max-tokens <n>", "Token budget for context (default: 2000)")
    .option("--min-trust <n>", "Minimum trust score (0-100) to admit a claim")
    .option("--no-show-filtered", "Hide what was filtered out")
    .option("--seed <nodeId>", "Start traversal from a specific node")
    .option("--format <fmt>", "pretty | json | markdown")
    .option("--watch", "Re-run on a timer and print a diff of what changed")
    .option("--watch-interval <s>", "Watch poll interval in seconds (default: 60)")
    .action(async (query: string | undefined, opts: InspectCliOptions, command: Command) => {
      const globalFlags = command.parent?.opts<GlobalFlags>() ?? {};
      const config = resolveConfig(globalFlags);

      if (!query || query.trim().length === 0) {
        process.stderr.write(chalk.red("A query is required: restormel inspect \"<your question>\"\n"));
        process.exitCode = 1;
        return;
      }

      const options: InspectOptions = {
        includeWeak: opts.includeWeak ?? false,
        includeUnsupported: opts.includeUnsupported ?? false,
        depth: parseIntOpt(opts.depth, 3),
        maxTokens: parseIntOpt(opts.maxTokens, 2000),
        showFiltered: opts.showFiltered ?? true,
        seed: opts.seed,
        ...(opts.minTrust !== undefined ? { minTrustScore: parseIntOpt(opts.minTrust, 0) } : {}),
      };

      const format = pickFormat(opts.format, config.output);
      const quiet = config.quiet || !options.showFiltered;

      const useLocal = Boolean(config.graphStore);
      const useApi = !useLocal && Boolean(config.apiKey);

      if (!useLocal && !useApi) {
        process.stderr.write(
          chalk.red(
            [
              "No graph store or API key configured.",
              "  Local:  restormel inspect \"<query>\" --graph-store <url>",
              "  Hosted: restormel auth login   (then inspect uses your stored API key)",
            ].join("\n") + "\n",
          ),
        );
        process.exitCode = 1;
        return;
      }

      const run = (): Promise<InspectResult> =>
        useLocal ? runLocalInspect(config, query, options) : runApiInspect(config, query, options);

      try {
        if (opts.watch) {
          const intervalMs = parseIntOpt(opts.watchInterval, 60) * 1000;
          await runWatch(run, (r) => {
            render(r, format, quiet);
            if (r.wouldRetrieve.length === 0 && format === "pretty" && !quiet) warnNoClaims();
          }, intervalMs);
          return;
        }

        const result = await run();
        render(result, format, quiet);

        if (result.wouldRetrieve.length === 0) {
          if (format === "pretty" && !quiet) warnNoClaims();
          process.exitCode = 2;
        }

        if (result.traceSummary.truncated && format === "pretty" && !quiet) {
          process.stderr.write(
            chalk.yellow(
              `Result truncated: ${result.traceSummary.nodesDropped} additional claim(s) available beyond the token budget. Use --max-tokens ${result.traceSummary.tokenBudget * 2} to retrieve more.\n`,
            ),
          );
        }
      } catch (err) {
        handleInspectError(err, config.graphStore);
        process.exitCode = 1;
      }
    });
}

/** Map known failure shapes to the specific, actionable messages from the spec. */
function handleInspectError(err: unknown, graphStoreUrl: string | undefined): void {
  if (err instanceof GraphStoreUnreachableError) {
    process.stderr.write(
      chalk.red(
        `Cannot reach graph store at ${err.url}. Check your connection and the RESTORMEL_GRAPH_STORE_URL configuration.\n`,
      ),
    );
    return;
  }
  if (err instanceof ApiInspectUnavailableError) {
    process.stderr.write(chalk.yellow(err.message + "\n"));
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (lower.includes("domain pack") || lower.includes("no domain")) {
    process.stderr.write(
      chalk.red(
        "This workspace has no domain pack configured. Complete pipeline setup at restormel.dev/dashboard before inspecting.\n",
      ),
    );
    return;
  }
  if (
    lower.includes("econnrefused") ||
    lower.includes("timeout") ||
    lower.includes("network") ||
    lower.includes("fetch failed")
  ) {
    process.stderr.write(
      chalk.red(
        `Cannot reach graph store at ${graphStoreUrl ?? "(unknown)"}. Check your connection and the RESTORMEL_GRAPH_STORE_URL configuration.\n`,
      ),
    );
    return;
  }
  process.stderr.write(chalk.red(`inspect failed: ${message}\n`));
}
