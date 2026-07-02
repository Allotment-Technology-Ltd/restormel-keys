/**
 * Cascade-validation harness — ADR build step 2 (REC-ADR-023 §"Build sequence" step 2;
 * restormel-verification-engineering §7 "harness inputs are dual", §8 instrumentation).
 *
 * ONE harness, TWO input types (ADR step 2):
 *   (i)  first-party corpus claims  -> validates the >=90% supported / <=2% unsupported bar
 *        POST-cascade + abstention, per corpus and per mode, with the three-number report
 *        (accuracy / error / abstention), clustered CIs (skill §7), fixture/live labelling,
 *        and the stage-1 informativeness metric (skill §4). Wired as a CI-runnable check
 *        (scripts/reviews/cascade-harness.ts) but NOT added to required branch checks
 *        (per the task brief).
 *   (ii) a wrapped commodity MCP server scenario -> the Stage-5 in-path latency/cost read
 *        (REC-ADR-023 §"validation" Stage-5 economic read). The real MCP wrapping is STUBBED
 *        here (the live Redis-Iris integration is out of reach in connect-core, which has no
 *        MCP/network deps); the stub is HONESTLY labelled and the report says so.
 *
 * HONESTY (skill §7 "fixture vs live labelled", REC-ADR-016): every number this harness
 * returns carries a `run_kind: "fixture" | "live"` tag and the cache-hit rate alongside
 * accuracy. Fixture doubles are never presented as a live run.
 *
 * The harness is PURE orchestration over the cascade + recorder + scorer — no DB, no
 * network, no keys (connect-core stays MIT). The live legs (real frontier credential, real
 * MCP server) are injected by the host-app runner; when absent, the harness runs the
 * fixture doubles and reports which executions still need a credential/GPU.
 */
import { VerifierCascade, type CascadeClaimInput } from "./cascade.js";
import {
  EconomicsRecorder,
  clusteredProportionEstimate,
  type CascadeMode,
  type EconomicsReport,
  type Estimate,
} from "./economics.js";
import {
  assessStage1Informativeness,
  computeAuroc,
  type Stage1InformativenessFinding,
} from "./calibration.js";
import type { Verdict } from "./verdict.js";

export type RunKind = "fixture" | "live";

/** A labelled first-party corpus claim: the cascade input + the human ground-truth label. */
export interface CorpusClaim extends CascadeClaimInput {
  /** Ground truth for scoring the >=90%/<=2% bar. */
  label: "supported" | "unsupported";
}

export interface CorpusFixture {
  corpus: string;
  version: number;
  description?: string;
  /** Marks whether the frontier tier will run fixture-double or live in this harness run. */
  claims: CorpusClaim[];
}

/**
 * The three-number bar report (skill §7 "three numbers, never one"), per corpus + mode.
 * accuracy, error rate and abstention rate are SEPARATE figures; confident errors are
 * penalised more than abstentions (an unsupported claim marked supported is an ERROR; an
 * abstention is not). All carry cluster-robust CIs keyed by source document (skill §7).
 */
export interface BarReport {
  corpus: string;
  mode: CascadeMode;
  run_kind: RunKind;
  /** Supported-recall on truly-supported claims (the >=90% bar), post-cascade+abstention. */
  supportedAccuracy: Estimate;
  /** Unsupported "leak" rate: truly-unsupported claims the cascade marked supported (<=2% bar). */
  unsupportedErrorRate: Estimate;
  /** Share of claims routed to human (abstained) — reported, never hidden. */
  abstentionRate: Estimate;
  /** Cache-hit rate alongside accuracy (a hash cache makes bare accuracy ambiguous — skill §7). */
  cacheHitRate: Estimate;
  /** Pass/fail against the published bar, computed AFTER cascade + abstention. */
  barPass: boolean;
  barReasons: string[];
  /** Stage-1 confidence informativeness for this corpus (skill §4). */
  stage1: Stage1InformativenessFinding;
  /** Full unit-economics for this (corpus, mode) partition (skill §8 five metrics). */
  economics: EconomicsReport;
}

export const BAR_SUPPORTED_MIN_PCT = 90;
export const BAR_UNSUPPORTED_MAX_PCT = 2;

/**
 * ENTRY POINT (i): run a first-party labelled corpus through the cascade and score the bar
 * post-cascade + abstention, per mode. Returns one BarReport per requested mode.
 */
export async function runFirstPartyCorpus(args: {
  cascade: VerifierCascade;
  fixture: CorpusFixture;
  modes?: CascadeMode[];
  /** Door-2 latency budget (ms) applied in in_path mode. */
  latencyBudgetMs?: number;
  /** Honest label: is the frontier tier a fixture double this run? (from buildDefaultCascade) */
  runKind: RunKind;
}): Promise<BarReport[]> {
  const modes = args.modes ?? ["batch"];
  const reports: BarReport[] = [];

  for (const mode of modes) {
    const recorder = new EconomicsRecorder();
    // Per-claim outcome + label, for scoring the bar. Stage-1 confidence for the AUROC is
    // read from the recorder's prefilter spans (joined by ref) in buildBarReport.
    const outcomes: {
      label: "supported" | "unsupported";
      verdict: Verdict;
      sourceDocId: string;
    }[] = [];

    for (const claim of args.fixture.claims) {
      const record = await args.cascade.verify(claim, {
        corpus: args.fixture.corpus,
        mode,
        ...(args.latencyBudgetMs ? { latencyBudgetMs: args.latencyBudgetMs } : {}),
        recorder,
      });
      outcomes.push({
        label: claim.label,
        verdict: record.finalVerdict,
        sourceDocId: claim.sourceDocId,
      });
    }

    reports.push(
      buildBarReport({
        corpus: args.fixture.corpus,
        mode,
        runKind: args.runKind,
        outcomes,
        recorder,
      }),
    );
  }
  return reports;
}

function buildBarReport(args: {
  corpus: string;
  mode: CascadeMode;
  runKind: RunKind;
  outcomes: {
    label: "supported" | "unsupported";
    verdict: Verdict;
    sourceDocId: string;
  }[];
  recorder: EconomicsRecorder;
}): BarReport {
  const { outcomes } = args;

  // Supported-recall: among truly-supported claims, share the cascade marked "supported".
  const trulySupported = outcomes.filter((o) => o.label === "supported");
  const supportedHits = trulySupported.map((o) => o.verdict === "supported");
  const supportedAccuracy = clusteredProportionEstimate(
    supportedHits,
    trulySupported.map((o) => o.sourceDocId),
  );

  // Unsupported LEAK: among truly-unsupported claims, share marked "supported" (a real error).
  const trulyUnsupported = outcomes.filter((o) => o.label === "unsupported");
  const leaks = trulyUnsupported.map((o) => o.verdict === "supported");
  const unsupportedErrorRate = clusteredProportionEstimate(
    leaks,
    trulyUnsupported.map((o) => o.sourceDocId),
  );

  // Abstention rate across ALL claims (reported separately, never folded into accuracy).
  const abstained = outcomes.map((o) => o.verdict === "abstained");
  const abstentionRate = clusteredProportionEstimate(
    abstained,
    outcomes.map((o) => o.sourceDocId),
  );

  const economics = args.recorder.report(args.corpus, args.mode);

  // Stage-1 AUROC (skill §4 "know when a cascade loses"): does the pre-filter's CONFIDENCE
  // predict a decisive final verdict? Score = the prefilter span's confidence for the claim;
  // positive = the cascade ultimately reached a decisive verdict. AUROC near 0.5 means the
  // pre-filter's confidence carries no signal about final outcomes on this corpus.
  const prefilterConfByRef = new Map<string, number>();
  for (const s of args.recorder.allSpans()) {
    if (s.tier !== "prefilter" || s.corpus !== args.corpus || s.mode !== args.mode) continue;
    if (s.confidence !== null && !prefilterConfByRef.has(s.ref)) {
      prefilterConfByRef.set(s.ref, s.confidence);
    }
  }
  const stage1Scores: number[] = [];
  const stage1Positives: boolean[] = [];
  for (const rec of args.recorder.allRecords()) {
    if (rec.corpus !== args.corpus || rec.mode !== args.mode) continue;
    const conf = prefilterConfByRef.get(rec.ref);
    if (conf === undefined) continue; // cache hit or empty-span: no prefilter run to score
    stage1Scores.push(conf);
    stage1Positives.push(rec.finalVerdict === "supported" || rec.finalVerdict === "contradicted");
  }
  const auroc = computeAuroc(stage1Scores, stage1Positives);
  const stage1 = assessStage1Informativeness(args.corpus, auroc);

  const supportedPct = supportedAccuracy.value * 100;
  const unsupportedPct = unsupportedErrorRate.value * 100;
  const barReasons: string[] = [];
  if (supportedPct < BAR_SUPPORTED_MIN_PCT) {
    barReasons.push(`supported ${supportedPct.toFixed(1)}% < ${BAR_SUPPORTED_MIN_PCT}%`);
  }
  if (unsupportedPct > BAR_UNSUPPORTED_MAX_PCT) {
    barReasons.push(`unsupported-leak ${unsupportedPct.toFixed(1)}% > ${BAR_UNSUPPORTED_MAX_PCT}%`);
  }

  return {
    corpus: args.corpus,
    mode: args.mode,
    run_kind: args.runKind,
    supportedAccuracy,
    unsupportedErrorRate,
    abstentionRate,
    cacheHitRate: economics.cacheHitRate,
    barPass: barReasons.length === 0,
    barReasons,
    stage1,
    economics,
  };
}

// ────────────────────────────────────────────────────────────────────────────────────────
// ENTRY POINT (ii): wrapped commodity MCP server scenario — the Stage-5 in-path economics.
// ────────────────────────────────────────────────────────────────────────────────────────

/**
 * A single third-party MCP response to verify in-path. In production this is what a wrapped
 * commodity MCP server (Redis Iris, the named candidate) returns; here it is supplied by a
 * STUB (mcpWrappingIsStub: true) because connect-core carries no MCP/network deps.
 */
export interface McpResponseClaim extends CascadeClaimInput {
  /** The tool/server that produced the response (recorded, not verified). */
  serverId: string;
}

export interface McpScenarioReport {
  scenario: string;
  run_kind: RunKind;
  /**
   * TRUE means the MCP wrapping (the callTool leg + transport) is a STUB, not a live wrapped
   * server. The latency here is the Restormel VERIFY legs only; the upstream callTool latency
   * must be folded in by the live runner (mirrors proxy/verify-envelope.ts leg accounting).
   */
  mcpWrappingIsStub: boolean;
  /** In-path economics: cost/claim, cache-hit rate, tier distribution, abstention, latency. */
  economics: EconomicsReport;
  /** Added latency per verified response (ms) — the Stage-5 go/no-go input. Verify legs only. */
  addedVerifyLatencyMsPerClaim: number;
  /** Honest note on what remains to measure with a real credential / real server. */
  honesty: string;
}

/**
 * ENTRY POINT (ii): run wrapped-MCP responses through the cascade IN-PATH (cache-first,
 * latency-budgeted) and produce the Stage-5 economic read. `mcpWrappingIsStub` is set from
 * the caller: true when the responses come from the in-repo stub, false when a live wrapped
 * server supplied them.
 */
export async function runWrappedMcpScenario(args: {
  cascade: VerifierCascade;
  scenario: string;
  claims: McpResponseClaim[];
  latencyBudgetMs: number;
  runKind: RunKind;
  mcpWrappingIsStub: boolean;
}): Promise<McpScenarioReport> {
  const recorder = new EconomicsRecorder();
  let totalVerifyLatency = 0;
  for (const claim of args.claims) {
    const started = typeof performance !== "undefined" ? performance.now() : Date.now();
    await args.cascade.verify(claim, {
      corpus: args.scenario,
      mode: "in_path",
      latencyBudgetMs: args.latencyBudgetMs,
      recorder,
    });
    const ended = typeof performance !== "undefined" ? performance.now() : Date.now();
    totalVerifyLatency += ended - started;
  }
  const economics = recorder.report(args.scenario, "in_path");
  const n = args.claims.length || 1;
  return {
    scenario: args.scenario,
    run_kind: args.runKind,
    mcpWrappingIsStub: args.mcpWrappingIsStub,
    economics,
    addedVerifyLatencyMsPerClaim: totalVerifyLatency / n,
    honesty: args.mcpWrappingIsStub
      ? "MCP wrapping STUBBED (no MCP/network dep in connect-core): latency covers Restormel " +
        "verify legs only; upstream callTool latency + a real credentialed frontier tier still " +
        "need a live runner to measure. Frontier tier is a fixture double unless run_kind==live."
      : "Live wrapped MCP server supplied responses; fold callTool latency per the runner.",
  };
}
