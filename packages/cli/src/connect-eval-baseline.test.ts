import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ConnectEvalBaselineSchema,
  ConnectEvalDiffSchema,
  ConnectEvalVerdictSchema,
  type ConnectEvalClaimRef,
  type ConnectEvalVerdict,
} from "@restormel/contracts/connect-eval";
import { buildEvalVerdict, EVAL_EXIT_CONFIG_ERROR, EVAL_EXIT_PASS, EVAL_EXIT_QUALITY_FAIL } from "./connect-eval.js";
import {
  buildBaseline,
  claimIdentity,
  computeEvalDiff,
  DEFAULT_EVAL_TOLERANCE,
  EVAL_EXIT_REGRESSION,
  exitCodeForEval,
  parseBaseline,
} from "./connect-eval-baseline.js";
import { renderEvalDiffMarkdown, renderEvalDiffPretty } from "./connect-eval-format.js";

const SAVED_AT = "2026-06-09T12:00:00.000Z";
const COMPARED_AT = "2026-06-10T08:00:00.000Z";
const FINGERPRINT = "00000000a1b2c3d4";

const BAD_CLAIM: ConnectEvalClaimRef = {
  id: "claim-9",
  text: "Utilitarianism was first formalised in 1900.",
  source_ref: "https://plato.stanford.edu/entries/utilitarianism-history/",
};

function verdict(overrides: {
  ok?: number;
  weak?: number;
  unsupported?: number;
  trust_score?: number;
  coverage_gaps?: number;
  fingerprint?: string;
  unsupported_claims?: ConnectEvalClaimRef[];
} = {}): ConnectEvalVerdict {
  return buildEvalVerdict({
    counts: { ok: overrides.ok ?? 95, weak: overrides.weak ?? 3, unsupported: overrides.unsupported ?? 1 },
    source: { kind: "counts_file", path: "./counts.json" },
    evaluatedAt: COMPARED_AT,
    trust_score: overrides.trust_score ?? 88,
    coverage_gaps: overrides.coverage_gaps,
    fingerprint: overrides.fingerprint ?? FINGERPRINT,
    unsupported_claims: overrides.unsupported_claims,
  });
}

describe("buildBaseline / parseBaseline", () => {
  it("round-trips a verdict through the committed-friendly artifact", () => {
    const baseline = buildBaseline(verdict(), SAVED_AT);
    expect(ConnectEvalBaselineSchema.safeParse(baseline).success).toBe(true);
    expect(baseline.fingerprint).toBe(FINGERPRINT);
    expect(baseline.saved_at).toBe(SAVED_AT);
    const reparsed = parseBaseline(JSON.parse(JSON.stringify(baseline)));
    expect(reparsed).toEqual({ ok: true, baseline });
  });

  it("rejects non-baseline documents with a readable error", () => {
    const bad = parseBaseline({ verdict: { pass: true } });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toContain("Not a valid connect-eval baseline");
    expect(parseBaseline(null).ok).toBe(false);
    expect(parseBaseline([1, 2]).ok).toBe(false);
  });
});

describe("claimIdentity", () => {
  it("prefers the stable claim id when present", () => {
    expect(claimIdentity(BAD_CLAIM)).toBe("id:claim-9");
    expect(claimIdentity({ ...BAD_CLAIM, text: "Reworded text, same claim." })).toBe("id:claim-9");
  });

  it("falls back to normalized text + source ref", () => {
    const a = claimIdentity({ text: "  Some   CLAIM text\n here. ", source_ref: "doc-1" });
    const b = claimIdentity({ text: "some claim text here.", source_ref: "doc-1" });
    expect(a).toBe(b);
    expect(claimIdentity({ text: "some claim text here.", source_ref: "doc-2" })).not.toBe(b);
  });
});

describe("computeEvalDiff — no change", () => {
  it("reports no regression and exits 0 when nothing moved", () => {
    const baseline = buildBaseline(verdict({ unsupported_claims: [BAD_CLAIM] }), SAVED_AT);
    const current = verdict({ unsupported_claims: [BAD_CLAIM] });
    const diff = computeEvalDiff({ baseline, current, comparedAt: COMPARED_AT });
    expect(diff).toMatchObject({
      fingerprint_changed: false,
      tolerance: DEFAULT_EVAL_TOLERANCE,
      deltas: { ok_pct: 0, unsupported_pct: 0, trust_score: 0 },
      claims_compared: true,
      new_unsupported_claims: [],
      regression: false,
      regressions: [],
    });
    expect(ConnectEvalDiffSchema.safeParse(diff).success).toBe(true);
    expect(exitCodeForEval(current, diff)).toBe(EVAL_EXIT_PASS);
  });

  it("the same unsupported claims (re-ordered) are not NEW — identity, not count", () => {
    const other: ConnectEvalClaimRef = { text: "Another weak claim.", source_ref: "doc-2" };
    const baseline = buildBaseline(verdict({ unsupported: 2, unsupported_claims: [BAD_CLAIM, other] }), SAVED_AT);
    const current = verdict({ unsupported: 2, unsupported_claims: [other, BAD_CLAIM] });
    const diff = computeEvalDiff({ baseline, current, comparedAt: COMPARED_AT });
    expect(diff.new_unsupported_claims).toEqual([]);
    expect(diff.regression).toBe(false);
  });
});

describe("computeEvalDiff — threshold regression", () => {
  it("flags an ok_pct drop beyond tolerance (exit 3, distinct from absolute-bar exit 1)", () => {
    const baseline = buildBaseline(verdict({ ok: 98, weak: 1, unsupported: 1 }), SAVED_AT); // 98%
    const current = verdict({ ok: 95, weak: 4, unsupported: 1 }); // 95% — still above the 90% bar
    const diff = computeEvalDiff({ baseline, current, comparedAt: COMPARED_AT, tolerance: 1 });
    expect(diff.regression).toBe(true);
    expect(diff.regressions).toContain("ok_pct dropped 98% → 95% (Δ -3 beyond tolerance 1)");
    expect(current.pass).toBe(true);
    expect(exitCodeForEval(current, diff)).toBe(EVAL_EXIT_REGRESSION);
  });

  it("allows a drop within tolerance", () => {
    const baseline = buildBaseline(verdict({ ok: 96, weak: 3, unsupported: 1 }), SAVED_AT); // 96%
    const current = verdict({ ok: 95, weak: 4, unsupported: 1 }); // 95%, Δ -1
    const diff = computeEvalDiff({ baseline, current, comparedAt: COMPARED_AT, tolerance: 1 });
    expect(diff.deltas.ok_pct).toBe(-1);
    expect(diff.regression).toBe(false);
    expect(exitCodeForEval(current, diff)).toBe(EVAL_EXIT_PASS);
  });

  it("flags a trust-score drop beyond tolerance", () => {
    const baseline = buildBaseline(verdict({ trust_score: 88 }), SAVED_AT);
    const current = verdict({ trust_score: 80 });
    const diff = computeEvalDiff({ baseline, current, comparedAt: COMPARED_AT, tolerance: 2 });
    expect(diff.regression).toBe(true);
    expect(diff.regressions).toContain("trust_score dropped 88 → 80 (Δ -8 beyond tolerance 2)");
  });

  it("flags new coverage gaps (any increase)", () => {
    const baseline = buildBaseline(verdict({ coverage_gaps: 2 }), SAVED_AT);
    const current = verdict({ coverage_gaps: 4 });
    const diff = computeEvalDiff({ baseline, current, comparedAt: COMPARED_AT });
    expect(diff.regression).toBe(true);
    expect(diff.regressions).toContain("coverage_gaps increased 2 → 4 (+2 new)");
  });

  it("skips trust/coverage checks when either side does not carry them", () => {
    const baseline = buildBaseline(verdict({ coverage_gaps: 2 }), SAVED_AT);
    const current = verdict({}); // no coverage_gaps
    const diff = computeEvalDiff({ baseline, current, comparedAt: COMPARED_AT });
    expect(diff.deltas.coverage_gaps).toBeUndefined();
    expect(diff.regression).toBe(false);
  });

  it("absolute-bar failure (exit 1) wins over regression (exit 3)", () => {
    const baseline = buildBaseline(verdict({ ok: 98, weak: 1, unsupported: 1 }), SAVED_AT);
    const current = verdict({ ok: 50, weak: 30, unsupported: 20 });
    const diff = computeEvalDiff({ baseline, current, comparedAt: COMPARED_AT });
    expect(diff.regression).toBe(true);
    expect(current.pass).toBe(false);
    expect(exitCodeForEval(current, diff)).toBe(EVAL_EXIT_QUALITY_FAIL);
  });
});

describe("computeEvalDiff — new unsupported claim (headline feature)", () => {
  it("cites the claim text + source ref for a claim that went bad", () => {
    const baseline = buildBaseline(verdict({ unsupported_claims: [] }), SAVED_AT);
    const current = verdict({ unsupported_claims: [BAD_CLAIM] });
    const diff = computeEvalDiff({ baseline, current, comparedAt: COMPARED_AT });
    expect(diff.claims_compared).toBe(true);
    expect(diff.new_unsupported_claims).toEqual([BAD_CLAIM]);
    expect(diff.regression).toBe(true);
    expect(diff.regressions).toContain(
      'new unsupported claim: "Utilitarianism was first formalised in 1900." ' +
        "(source: https://plato.stanford.edu/entries/utilitarianism-history/)",
    );
    expect(exitCodeForEval(current, diff)).toBe(EVAL_EXIT_REGRESSION);
  });

  it("matches by id when present — a reworded claim with the same id is not NEW", () => {
    const baseline = buildBaseline(verdict({ unsupported_claims: [BAD_CLAIM] }), SAVED_AT);
    const current = verdict({
      unsupported_claims: [{ ...BAD_CLAIM, text: "Utilitarianism was formalised around 1900." }],
    });
    const diff = computeEvalDiff({ baseline, current, comparedAt: COMPARED_AT });
    expect(diff.new_unsupported_claims).toEqual([]);
    expect(diff.regression).toBe(false);
  });

  it("skips the claim diff (claims_compared=false) when either side lacks the list", () => {
    const baseline = buildBaseline(verdict({}), SAVED_AT); // no unsupported_claims recorded
    const current = verdict({ unsupported_claims: [BAD_CLAIM] });
    const diff = computeEvalDiff({ baseline, current, comparedAt: COMPARED_AT });
    expect(diff.claims_compared).toBe(false);
    expect(diff.new_unsupported_claims).toEqual([]);
    expect(diff.regression).toBe(false);
  });

  it("attributes changes to the re-ingested source (Stage 3.2): carried claims from other sources never flag", () => {
    // Source A's unsupported claim was at baseline; an incremental re-ingest of source B
    // (only) introduces one new unsupported claim. Carried claims keep their text +
    // source_ref identity across a re-ingest, so ONLY source B's claim is flagged —
    // and the regression line attributes it to B.
    const carriedFromA: ConnectEvalClaimRef = {
      text: "Pleasure is the only intrinsic good.",
      source_ref: "https://example.com/source-a",
    };
    const newFromReingestedB: ConnectEvalClaimRef = {
      text: "Sidgwick proved utilitarianism self-evident.",
      source_ref: "https://example.com/source-b",
    };
    const baseline = buildBaseline(verdict({ unsupported_claims: [carriedFromA] }), SAVED_AT);
    const current = verdict({
      unsupported: 2,
      unsupported_claims: [carriedFromA, newFromReingestedB],
    });
    const diff = computeEvalDiff({ baseline, current, comparedAt: COMPARED_AT });
    expect(diff.new_unsupported_claims).toEqual([newFromReingestedB]);
    expect(diff.regressions).toContain(
      'new unsupported claim: "Sidgwick proved utilitarianism self-evident." ' +
        "(source: https://example.com/source-b)",
    );
    expect(diff.regressions.some((r) => r.includes("source-a"))).toBe(false);
  });
});

describe("computeEvalDiff — fingerprint change (new corpus, not a regression)", () => {
  it("supersedes the baseline and skips all regression checks", () => {
    const baseline = buildBaseline(
      verdict({ ok: 98, weak: 1, unsupported: 1, trust_score: 95, unsupported_claims: [] }),
      SAVED_AT,
    );
    const current = verdict({
      ok: 91,
      weak: 8,
      unsupported: 1,
      trust_score: 80,
      fingerprint: "ffffffff00000000",
      unsupported_claims: [BAD_CLAIM],
    });
    const diff = computeEvalDiff({ baseline, current, comparedAt: COMPARED_AT });
    expect(diff.fingerprint_changed).toBe(true);
    expect(diff.baseline_fingerprint).toBe(FINGERPRINT);
    expect(diff.current_fingerprint).toBe("ffffffff00000000");
    expect(diff.claims_compared).toBe(false);
    expect(diff.new_unsupported_claims).toEqual([]);
    expect(diff.regression).toBe(false);
    expect(diff.regressions).toEqual([]);
    // The absolute bar still applies — exit follows the verdict, not the diff.
    expect(exitCodeForEval(current, diff)).toBe(EVAL_EXIT_PASS);
  });

  it("compares when either fingerprint is unknown (cannot prove a corpus change)", () => {
    const baseline = buildBaseline(verdict({ ok: 98, weak: 1, unsupported: 1, fingerprint: undefined }), SAVED_AT);
    const current = verdict({ ok: 90, weak: 9, unsupported: 1 });
    const diff = computeEvalDiff({ baseline, current, comparedAt: COMPARED_AT });
    expect(diff.fingerprint_changed).toBe(false);
    expect(diff.regression).toBe(true);
  });
});

describe("diff renderers", () => {
  const baseline = buildBaseline(
    verdict({ ok: 98, weak: 1, unsupported: 1, trust_score: 95, coverage_gaps: 1, unsupported_claims: [] }),
    SAVED_AT,
  );
  const current = verdict({
    ok: 90,
    weak: 8,
    unsupported: 2,
    trust_score: 80,
    coverage_gaps: 3,
    unsupported_claims: [BAD_CLAIM],
  });
  const diff = computeEvalDiff({ baseline, current, comparedAt: COMPARED_AT });

  it("markdown emits a PR-comment table with metric rows and the claim citation table", () => {
    const md = renderEvalDiffMarkdown(current, diff, baseline.verdict);
    expect(md).toContain("# Restormel connect eval — baseline diff");
    expect(md).toContain("| Metric | Baseline | Current | Δ | Status |");
    expect(md).toContain("| ok % | 98% | 90% | -8 | ❌ regression |");
    expect(md).toContain("| trust score | 95 | 80 | -15 | ❌ regression |");
    expect(md).toContain("| coverage gaps | 1 | 3 | +2 | ❌ regression |");
    expect(md).toContain("## New unsupported claims (1)");
    expect(md).toContain("| Claim | Source |");
    expect(md).toContain(BAD_CLAIM.text);
    expect(md).toContain(BAD_CLAIM.source_ref!);
    expect(md).toContain("**Summary:** REGRESSION");
  });

  it("markdown escapes pipes in claim text so the table never breaks", () => {
    const piped: ConnectEvalClaimRef = { text: "a | b | c", source_ref: "doc|1" };
    const cur = verdict({ unsupported_claims: [piped] });
    const base = buildBaseline(verdict({ unsupported_claims: [] }), SAVED_AT);
    const d = computeEvalDiff({ baseline: base, current: cur, comparedAt: COMPARED_AT });
    const md = renderEvalDiffMarkdown(cur, d, base.verdict);
    expect(md).toContain("a \\| b \\| c");
    expect(md).toContain("doc\\|1");
  });

  it("markdown reports the superseded baseline on a fingerprint change", () => {
    const cur = verdict({ fingerprint: "ffffffff00000000" });
    const d = computeEvalDiff({ baseline, current: cur, comparedAt: COMPARED_AT });
    const md = renderEvalDiffMarkdown(cur, d, baseline.verdict);
    expect(md).toContain("Source-set fingerprint changed");
    expect(md).toContain("**Summary:** BASELINE SUPERSEDED");
    expect(md).not.toContain("REGRESSION —");
  });

  it("pretty output lists each regression finding with the claim citation", () => {
    const out = renderEvalDiffPretty(current, diff, baseline.verdict);
    expect(out).toContain("BASELINE DIFF");
    expect(out).toContain("REGRESSION:");
    expect(out).toContain("new unsupported claim:");
    expect(out).toContain(BAD_CLAIM.source_ref!);
  });

  it("pretty output reports NO REGRESSION on a no-change diff", () => {
    const same = verdict({ ok: 98, weak: 1, unsupported: 1, trust_score: 95, coverage_gaps: 1, unsupported_claims: [] });
    const d = computeEvalDiff({ baseline, current: same, comparedAt: COMPARED_AT });
    expect(renderEvalDiffPretty(same, d, baseline.verdict)).toContain("NO REGRESSION");
  });
});

describe("keys connect eval --baseline / --save-baseline (command, local mode — no network)", () => {
  let dir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  const initialExitCode = process.exitCode;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "keys-connect-eval-baseline-"));
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.exitCode = undefined;
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    logSpy.mockRestore();
    errorSpy.mockRestore();
    process.exitCode = initialExitCode;
  });

  async function runEval(args: string[]): Promise<void> {
    const { registerConnect } = await import("./commands/connect.js");
    const { Command } = await import("commander");
    const program = new Command();
    registerConnect(program);
    await program.parseAsync(["connect", "eval", ...args], { from: "user" });
  }

  function countsDoc(overrides: Record<string, unknown> = {}): string {
    return JSON.stringify({
      ok: 95,
      weak: 3,
      unsupported: 1,
      trust_score: 88,
      fingerprint: FINGERPRINT,
      unsupported_claims: [],
      ...overrides,
    });
  }

  it("--save-baseline writes a schema-valid committed-friendly artifact and exits 0", async () => {
    const counts = join(dir, "counts.json");
    const baselinePath = join(dir, "baseline.json");
    await writeFile(counts, countsDoc(), "utf-8");
    await runEval(["--counts", counts, "--save-baseline", baselinePath, "--output", "json"]);
    expect(process.exitCode).toBe(EVAL_EXIT_PASS);
    const raw = await readFile(baselinePath, "utf-8");
    expect(raw.endsWith("\n")).toBe(true);
    const baseline = ConnectEvalBaselineSchema.parse(JSON.parse(raw));
    expect(baseline.fingerprint).toBe(FINGERPRINT);
    expect(baseline.verdict.g2).toMatchObject({ ok: 95, weak: 3, unsupported: 1 });
  });

  it("--baseline with no change exits 0 and emits verdict + diff JSON", async () => {
    const counts = join(dir, "counts.json");
    const baselinePath = join(dir, "baseline.json");
    await writeFile(counts, countsDoc(), "utf-8");
    await runEval(["--counts", counts, "--save-baseline", baselinePath]);
    process.exitCode = undefined;
    logSpy.mockClear();

    await runEval(["--counts", counts, "--baseline", baselinePath, "--output", "json"]);
    expect(process.exitCode).toBe(EVAL_EXIT_PASS);
    const payload = JSON.parse(String(logSpy.mock.calls[0][0])) as { verdict: unknown; diff: unknown };
    expect(ConnectEvalVerdictSchema.safeParse(payload.verdict).success).toBe(true);
    const diff = ConnectEvalDiffSchema.parse(payload.diff);
    expect(diff.regression).toBe(false);
  });

  it("--baseline exits 3 on a new unsupported claim and the markdown cites it", async () => {
    const goodCounts = join(dir, "counts-good.json");
    const badCounts = join(dir, "counts-bad.json");
    const baselinePath = join(dir, "baseline.json");
    await writeFile(goodCounts, countsDoc(), "utf-8");
    await writeFile(
      badCounts,
      countsDoc({ ok: 94, unsupported: 2, unsupported_claims: [BAD_CLAIM] }),
      "utf-8",
    );
    await runEval(["--counts", goodCounts, "--save-baseline", baselinePath]);
    process.exitCode = undefined;
    logSpy.mockClear();

    await runEval(["--counts", badCounts, "--baseline", baselinePath, "--output", "markdown"]);
    expect(process.exitCode).toBe(EVAL_EXIT_REGRESSION);
    const md = String(logSpy.mock.calls[0][0]);
    expect(md).toContain("## New unsupported claims (1)");
    expect(md).toContain(BAD_CLAIM.text);
    expect(md).toContain(BAD_CLAIM.source_ref!);
  });

  it("--baseline exits 0 on a fingerprint change (new corpus, baseline superseded)", async () => {
    const counts = join(dir, "counts.json");
    const newCorpus = join(dir, "counts-new-corpus.json");
    const baselinePath = join(dir, "baseline.json");
    await writeFile(counts, countsDoc(), "utf-8");
    await writeFile(
      newCorpus,
      countsDoc({ ok: 90, weak: 8, fingerprint: "ffffffff00000000", unsupported_claims: [BAD_CLAIM] }),
      "utf-8",
    );
    await runEval(["--counts", counts, "--save-baseline", baselinePath]);
    process.exitCode = undefined;
    logSpy.mockClear();

    await runEval(["--counts", newCorpus, "--baseline", baselinePath, "--output", "markdown"]);
    expect(process.exitCode).toBe(EVAL_EXIT_PASS);
    expect(String(logSpy.mock.calls[0][0])).toContain("BASELINE SUPERSEDED");
  });

  it("exits 2 (config error) for a missing or invalid baseline file and a bad --tolerance", async () => {
    const counts = join(dir, "counts.json");
    await writeFile(counts, countsDoc(), "utf-8");

    await runEval(["--counts", counts, "--baseline", join(dir, "nope.json")]);
    expect(process.exitCode).toBe(EVAL_EXIT_CONFIG_ERROR);

    process.exitCode = undefined;
    const notBaseline = join(dir, "not-baseline.json");
    await writeFile(notBaseline, JSON.stringify({ hello: "world" }), "utf-8");
    await runEval(["--counts", counts, "--baseline", notBaseline]);
    expect(process.exitCode).toBe(EVAL_EXIT_CONFIG_ERROR);

    process.exitCode = undefined;
    await runEval(["--counts", counts, "--tolerance", "-2"]);
    expect(process.exitCode).toBe(EVAL_EXIT_CONFIG_ERROR);

    process.exitCode = undefined;
    await runEval(["--counts", counts, "--tolerance", "abc"]);
    expect(process.exitCode).toBe(EVAL_EXIT_CONFIG_ERROR);
  });

  it("--tolerance widens the allowed ok_pct drop", async () => {
    const goodCounts = join(dir, "counts-good.json");
    const dropCounts = join(dir, "counts-drop.json");
    const baselinePath = join(dir, "baseline.json");
    await writeFile(goodCounts, countsDoc({ ok: 98, weak: 1 }), "utf-8"); // 98%
    await writeFile(dropCounts, countsDoc({ ok: 95, weak: 4 }), "utf-8"); // 95%
    await runEval(["--counts", goodCounts, "--save-baseline", baselinePath]);
    process.exitCode = undefined;

    await runEval(["--counts", dropCounts, "--baseline", baselinePath]);
    expect(process.exitCode).toBe(EVAL_EXIT_REGRESSION);

    process.exitCode = undefined;
    await runEval(["--counts", dropCounts, "--baseline", baselinePath, "--tolerance", "5"]);
    expect(process.exitCode).toBe(EVAL_EXIT_PASS);
  });
});
