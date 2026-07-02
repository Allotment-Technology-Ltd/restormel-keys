/**
 * Cascade-validation harness runner (REC-ADR-023 build step 2; restormel-verification-
 * engineering §7 "harness inputs are dual"). CI-RUNNABLE, but NOT wired into required branch
 * checks (per the build brief) — it is a MEASUREMENT AID. Exit code 0 unless the harness
 * itself faults; the >=90%/<=2% bar is REPORTED, not enforced here (a fixture-double run must
 * never gate a branch as if it were the live private-eval CI gate).
 *
 * Two input types, one harness:
 *   (i)  first-party corpora  -> the three-number bar report (accuracy / error / abstention)
 *        + cache-hit rate + stage-1 informativeness, per corpus and per mode.
 *   (ii) wrapped commodity MCP server (Redis Iris candidate) -> the Stage-5 in-path latency/
 *        cost read.
 *
 * HONESTY (skill §7, REC-ADR-016): with no frontier credential and no GPU/weights in this
 * environment, the escalation + cheap/mid tiers run as FIXTURE DOUBLES and the MCP wrapping
 * is STUBBED. Every printed number is tagged run_kind=fixture and the MCP report is flagged
 * mcpWrappingIsStub=true. To run the frontier tier live, inject a credentialed `generate`
 * via buildDefaultCascade({ frontierGenerate }) in a host-app runner (out of connect-core).
 *
 * Usage:
 *   pnpm exec tsx scripts/reviews/cascade-harness.ts [--json] [--budget-ms 800]
 */
import {
  buildDefaultCascade,
  runFirstPartyCorpus,
  runWrappedMcpScenario,
  ALL_CORPUS_FIXTURES,
  REDIS_IRIS_STUB_CLAIMS,
  type BarReport,
  type McpScenarioReport,
} from "../../packages/connect-core/src/cascade/index.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const budgetIdx = args.indexOf("--budget-ms");
  const latencyBudgetMs = budgetIdx >= 0 ? Number(args[budgetIdx + 1]) : 800;

  const barReports: BarReport[] = [];
  for (const fixture of ALL_CORPUS_FIXTURES) {
    // A fresh cascade per corpus keeps the (small) fixture cache from bleeding across corpora.
    const { cascade, frontierIsFixture } = buildDefaultCascade();
    const reports = await runFirstPartyCorpus({
      cascade,
      fixture,
      modes: ["batch", "in_path"],
      latencyBudgetMs,
      runKind: frontierIsFixture ? "fixture" : "live",
    });
    barReports.push(...reports);
  }

  const { cascade: mcpCascade, frontierIsFixture: mcpFixture } = buildDefaultCascade();
  const mcpReport: McpScenarioReport = await runWrappedMcpScenario({
    cascade: mcpCascade,
    scenario: "redis-iris-stub",
    claims: REDIS_IRIS_STUB_CLAIMS,
    latencyBudgetMs,
    runKind: mcpFixture ? "fixture" : "live",
    mcpWrappingIsStub: true,
  });

  if (asJson) {
    process.stdout.write(JSON.stringify({ barReports, mcpReport }, null, 2) + "\n");
    return;
  }

  printBarReports(barReports);
  printMcpReport(mcpReport);
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function printBarReports(reports: BarReport[]): void {
  process.stdout.write("\n=== First-party corpus bar reports (ADR step 2, input i) ===\n");
  process.stdout.write(
    "run_kind is FIXTURE — doubles stand in for HHEM/Granite weights + frontier API " +
      "(no GPU/credential here). The real >=90%/<=2% bar is measured on the private eval " +
      "set by the host-app CI gate.\n\n",
  );
  for (const r of reports) {
    process.stdout.write(`[${r.corpus} | ${r.mode} | ${r.run_kind}]\n`);
    process.stdout.write(
      `  supported-accuracy: ${pct(r.supportedAccuracy.value)} ±${pct(r.supportedAccuracy.ci95)} ` +
        `(n=${r.supportedAccuracy.n}, clustered SE)\n`,
    );
    process.stdout.write(
      `  unsupported-leak:   ${pct(r.unsupportedErrorRate.value)} ±${pct(r.unsupportedErrorRate.ci95)} ` +
        `(n=${r.unsupportedErrorRate.n})\n`,
    );
    process.stdout.write(`  abstention-rate:    ${pct(r.abstentionRate.value)} ±${pct(r.abstentionRate.ci95)}\n`);
    process.stdout.write(`  cache-hit-rate:     ${pct(r.cacheHitRate.value)}\n`);
    process.stdout.write(`  bar (reported):     ${r.barPass ? "PASS" : "FAIL"} ${r.barReasons.join("; ")}\n`);
    process.stdout.write(`  stage-1 AUROC:      ${r.stage1.auroc.toFixed(3)} — ${r.stage1.finding}\n`);
    const e = r.economics;
    process.stdout.write(
      `  economics: cost/claim=${e.costPerVerifiedClaim.value === 0 && e.claimsWithAuthoritativeCost === 0 ? "n/a (fixture: no authoritative token usage)" : `$${e.costPerVerifiedClaim.value.toFixed(6)}`}` +
        `, escalation-rate(β)=${pct(e.escalationRate.value)}, tiers=${JSON.stringify(
          Object.fromEntries(Object.entries(e.tierDistribution).map(([k, v]) => [k, pct(v)])),
        )}\n\n`,
    );
  }
}

function printMcpReport(r: McpScenarioReport): void {
  process.stdout.write("=== Wrapped-MCP in-path scenario (ADR step 2, input ii; Stage-5 read) ===\n");
  process.stdout.write(`[${r.scenario} | in_path | ${r.run_kind}]  mcpWrappingIsStub=${r.mcpWrappingIsStub}\n`);
  process.stdout.write(`  added verify latency / claim: ${r.addedVerifyLatencyMsPerClaim.toFixed(2)} ms (verify legs only)\n`);
  process.stdout.write(`  cache-hit-rate: ${pct(r.economics.cacheHitRate.value)}, abstention: ${pct(r.economics.abstentionRate.value)}, escalation(β): ${pct(r.economics.escalationRate.value)}\n`);
  process.stdout.write(`  tier distribution: ${JSON.stringify(Object.fromEntries(Object.entries(r.economics.tierDistribution).map(([k, v]) => [k, pct(v)])))}\n`);
  process.stdout.write(`  HONESTY: ${r.honesty}\n`);
}

main().catch((err) => {
  process.stderr.write(`cascade-harness FAILED: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
