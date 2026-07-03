#!/usr/bin/env node
/**
 * restormel — the developer CLI for a Restormel knowledge graph. Registers the
 * global options and the inspect + auth subcommands. Diagnostics go to stderr,
 * data goes to stdout (same convention as the MCP server).
 */
import { Command } from "commander";
import { registerInspect } from "./inspect/index.js";
import { registerAuth } from "./auth/index.js";

const program = new Command();

program
  .name("restormel")
  .description("Restormel CLI — inspect a knowledge graph from the terminal")
  .version("0.1.0")
  .option("--workspace <id>", "Restormel workspace ID")
  .option("--api-key <key>", "Restormel API key (or RESTORMEL_API_KEY env var)")
  .option("--graph-store <url>", "Direct graph store URL (bypasses API, for local use)")
  .option("--output <format>", "json | pretty (default: pretty)", "pretty")
  .option("--quiet", "Suppress explanatory text, output data only");

registerInspect(program);
registerAuth(program);

program.parseAsync().catch((err) => {
  process.stderr.write(`restormel: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
