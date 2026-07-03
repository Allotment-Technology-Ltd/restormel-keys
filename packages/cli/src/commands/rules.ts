/**
 * `keys rules show|list` — inspect verification rule sets (Stage 4C).
 *
 * `show` displays the active rule set for the workspace (GET /connect/v1/verification-rules).
 * `list` lists available rule sets (the built-in core plus the workspace's active set).
 */
import type { Command } from "commander";
import chalk from "chalk";
import type { VerificationRuleSet } from "@restormel/contracts/verification-rules";

interface RulesOptions {
  output?: string;
  workspace?: string;
  project?: string;
  siteBase?: string;
}

function fail(message: string, detail?: unknown): void {
  console.error(chalk.red(message), detail !== undefined ? detail : "");
  process.exitCode = 1;
}

function resolveSiteBase(opt?: string): string {
  const env = process.env.RESTORMEL_KEYS_BASE?.trim() || process.env.RESTORMEL_CONNECT_API_BASE?.trim();
  return (opt?.trim() || env || "https://restormel.dev").replace(/\/$/, "");
}

function authHeaders(key?: string): Record<string, string> {
  return key ? { Authorization: `Bearer ${key}` } : {};
}

async function fetchJson(url: string, key?: string): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(url, { headers: authHeaders(key) });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

function renderRuleSetPretty(rs: VerificationRuleSet): string {
  const lines: string[] = [];
  lines.push(chalk.bold(`${rs.name} ${chalk.dim(`(${rs.id} · v${rs.version})`)}`));
  lines.push(rs.description);
  lines.push("");
  lines.push(chalk.bold("Dimensions (weight · passing threshold)"));
  for (const d of rs.dimensions) {
    lines.push(`  ${d.weight.toFixed(2)}  ${chalk.cyan(d.id.padEnd(24))} pass≥${d.passing_threshold.toFixed(2)}`);
  }
  lines.push("");
  lines.push(chalk.bold("Policies (supported ≥ min · weak ≥ threshold)"));
  for (const p of rs.policies) {
    lines.push(`  ${chalk.yellow(p.name.padEnd(10))} supported≥${p.min_overall_score.toFixed(2)} · weak≥${p.weak_threshold.toFixed(2)}`);
  }
  return lines.join("\n");
}

function renderListPretty(sets: Array<{ ruleSet: VerificationRuleSet; active: boolean }>): string {
  const lines: string[] = [chalk.bold("Verification rule sets")];
  for (const { ruleSet, active } of sets) {
    const marker = active ? chalk.green(" ● active") : "";
    lines.push(`  ${chalk.cyan(ruleSet.id.padEnd(24))} ${ruleSet.name} ${chalk.dim(`v${ruleSet.version}`)}${marker}`);
  }
  return lines.join("\n");
}

export function registerRules(program: Command): void {
  const rules = program.command("rules").description("Inspect verification rule sets");

  rules
    .command("show")
    .description("Show the active verification rule set for your workspace")
    .option("--output <format>", "json | pretty", "pretty")
    .option("--workspace <id>", "Keys workspace id (default RESTORMEL_WORKSPACE_ID)")
    .option("--project <id>", "Keys project id (default RESTORMEL_PROJECT_ID)")
    .option("--site-base <url>", "Restormel site origin (default RESTORMEL_KEYS_BASE or https://restormel.dev)")
    .action(async (opts: RulesOptions) => {
      const format = (opts.output ?? "pretty").toLowerCase();
      if (!["pretty", "json"].includes(format)) return fail(`Unknown --output ${opts.output}. Use pretty or json.`);

      const base = resolveSiteBase(opts.siteBase);
      const key = process.env.RESTORMEL_GATEWAY_KEY?.trim();
      const workspace = opts.workspace?.trim() || process.env.RESTORMEL_WORKSPACE_ID?.trim();
      const project = opts.project?.trim() || process.env.RESTORMEL_PROJECT_ID?.trim();
      if (!key) return fail("RESTORMEL_GATEWAY_KEY is required (run `keys login`).");
      if (!workspace) return fail("A workspace is required. Set RESTORMEL_WORKSPACE_ID or pass --workspace.");

      const params = new URLSearchParams({ workspace_id: workspace });
      if (project) params.set("project_id", project);
      const { ok, status, body } = await fetchJson(`${base}/connect/v1/verification-rules?${params}`, key).catch(
        (e) => ({ ok: false, status: 0, body: { message: e instanceof Error ? e.message : String(e) } }),
      );
      if (!ok) return fail(`Could not fetch the active rule set (${status}):`, (body as Record<string, unknown>).message ?? (body as Record<string, unknown>).error);

      const ruleSet = body as VerificationRuleSet;
      console.log(format === "json" ? JSON.stringify(ruleSet, null, 2) : renderRuleSetPretty(ruleSet));
    });

  rules
    .command("list")
    .description("List available verification rule sets")
    .option("--output <format>", "json | pretty", "pretty")
    .option("--workspace <id>", "Keys workspace id (default RESTORMEL_WORKSPACE_ID)")
    .option("--project <id>", "Keys project id (default RESTORMEL_PROJECT_ID)")
    .option("--site-base <url>", "Restormel site origin (default RESTORMEL_KEYS_BASE or https://restormel.dev)")
    .action(async (opts: RulesOptions) => {
      const format = (opts.output ?? "pretty").toLowerCase();
      if (!["pretty", "json"].includes(format)) return fail(`Unknown --output ${opts.output}. Use pretty or json.`);

      const base = resolveSiteBase(opts.siteBase);
      const key = process.env.RESTORMEL_GATEWAY_KEY?.trim();
      const workspace = opts.workspace?.trim() || process.env.RESTORMEL_WORKSPACE_ID?.trim();
      const project = opts.project?.trim() || process.env.RESTORMEL_PROJECT_ID?.trim();

      const builtIn = await fetchJson(`${base}/connect/v1/verification-rules/built-in`, key).catch(
        () => ({ ok: false, status: 0, body: null }),
      );
      if (!builtIn.ok) return fail(`Could not fetch built-in rule sets (${builtIn.status}).`);
      const builtInSet = builtIn.body as VerificationRuleSet;

      // Resolve the workspace's active set when credentials are available.
      let active: VerificationRuleSet | null = null;
      if (key && workspace) {
        const params = new URLSearchParams({ workspace_id: workspace });
        if (project) params.set("project_id", project);
        const res = await fetchJson(`${base}/connect/v1/verification-rules?${params}`, key).catch(() => null);
        if (res && res.ok) active = res.body as VerificationRuleSet;
      }

      const sets: Array<{ ruleSet: VerificationRuleSet; active: boolean }> = [
        { ruleSet: builtInSet, active: active?.id === builtInSet.id },
      ];
      // A workspace override resolves to a derived set not in the built-in list — show it too.
      if (active && active.id !== builtInSet.id) sets.push({ ruleSet: active, active: true });

      if (format === "json") {
        console.log(JSON.stringify(sets.map((s) => ({ ...s.ruleSet, active: s.active })), null, 2));
      } else {
        console.log(renderListPretty(sets));
      }
    });
}
