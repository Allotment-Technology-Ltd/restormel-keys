import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConnectEvalVerdictSchema } from "@restormel/contracts/connect-eval";
import type { ConnectIngestJob, ConnectIngestQualityReport } from "@restormel/contracts/connect";
import {
  buildEvalVerdict,
  EVAL_EXIT_CONFIG_ERROR,
  EVAL_EXIT_PASS,
  EVAL_EXIT_QUALITY_FAIL,
  exitCodeForVerdict,
  parseCountsInput,
  pickLatestAssessedJob,
  verdictFromQualityReport,
} from "./connect-eval.js";
import { renderEvalJson, renderEvalPretty } from "./connect-eval-format.js";

const EVALUATED_AT = "2026-06-09T12:00:00.000Z";

function qualityReport(overrides: Partial<ConnectIngestQualityReport> = {}): ConnectIngestQualityReport {
  return {
    trust_score: 88,
    supported_count: 95,
    weak_count: 3,
    unsupported_count: 1,
    total_count: 99,
    remediation_applied: true,
    assessed_at: "2026-06-09T11:58:00.000Z",
    ...overrides,
  };
}

function job(id: string, report: ConnectIngestQualityReport | null): ConnectIngestJob {
  return {
    id,
    workspace_id: "11111111-1111-4111-8111-111111111111",
    status: "completed",
    created_at: "2026-06-09T11:00:00.000Z",
    updated_at: "2026-06-09T11:58:00.000Z",
    quality_report: report,
  };
}

describe("parseCountsInput", () => {
  it("accepts canonical counts with optional passthrough fields", () => {
    const res = parseCountsInput({ ok: 95, weak: 3, unsupported: 1, trust_score: 88, coverage_gaps: 2, fingerprint: "abc123" });
    expect(res).toEqual({
      ok: true,
      input: { counts: { ok: 95, weak: 3, unsupported: 1 }, trust_score: 88, coverage_gaps: 2, fingerprint: "abc123" },
    });
  });

  it("accepts a run's public quality report shape (supported_count → ok)", () => {
    const res = parseCountsInput(qualityReport());
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.input.counts).toEqual({ ok: 95, weak: 3, unsupported: 1 });
      expect(res.input.trust_score).toBe(88);
      expect(res.input.assessed_at).toBe("2026-06-09T11:58:00.000Z");
    }
  });

  it("rejects non-objects, missing counts, negatives, and fractions", () => {
    expect(parseCountsInput(null).ok).toBe(false);
    expect(parseCountsInput([1, 2, 3]).ok).toBe(false);
    expect(parseCountsInput({ ok: 1, weak: 2 }).ok).toBe(false);
    expect(parseCountsInput({ ok: -1, weak: 0, unsupported: 0 }).ok).toBe(false);
    expect(parseCountsInput({ ok: 1.5, weak: 0, unsupported: 0 }).ok).toBe(false);
    expect(parseCountsInput({ supported_count: 1, weak_count: -2, unsupported_count: 0 }).ok).toBe(false);
  });

  it("rejects out-of-range trust_score and invalid coverage_gaps/fingerprint", () => {
    expect(parseCountsInput({ ok: 1, weak: 0, unsupported: 0, trust_score: 101 }).ok).toBe(false);
    expect(parseCountsInput({ ok: 1, weak: 0, unsupported: 0, coverage_gaps: -1 }).ok).toBe(false);
    expect(parseCountsInput({ ok: 1, weak: 0, unsupported: 0, fingerprint: "" }).ok).toBe(false);
  });
});

describe("buildEvalVerdict", () => {
  it("passes when the bar is met and echoes the published targets", () => {
    const verdict = buildEvalVerdict({
      counts: { ok: 95, weak: 3, unsupported: 1 },
      source: { kind: "stdin" },
      evaluatedAt: EVALUATED_AT,
      trust_score: 88,
    });
    expect(verdict).toMatchObject({
      schema_version: "1.0",
      evaluated_at: EVALUATED_AT,
      g2: { ok: 95, weak: 3, unsupported: 1, ok_pct: 96, unsupported_pct: 1 },
      targets: { ok_pct_min: 90, unsupported_pct_max: 2 },
      trust_score: 88,
      pass: true,
      reasons: [],
    });
    // The verdict is the CI contract — it must always validate against it.
    expect(ConnectEvalVerdictSchema.safeParse(verdict).success).toBe(true);
  });

  it("fails with an ok_pct reason below the 90% bar", () => {
    const verdict = buildEvalVerdict({
      counts: { ok: 80, weak: 19, unsupported: 1 },
      source: { kind: "counts_file", path: "./counts.json" },
      evaluatedAt: EVALUATED_AT,
    });
    expect(verdict.pass).toBe(false);
    expect(verdict.g2.ok_pct).toBe(80);
    expect(verdict.reasons).toEqual(["ok_pct 80% < 90%"]);
  });

  it("fails with an unsupported_pct reason above the 2% bar", () => {
    const verdict = buildEvalVerdict({
      counts: { ok: 92, weak: 3, unsupported: 5 },
      source: { kind: "stdin" },
      evaluatedAt: EVALUATED_AT,
    });
    expect(verdict.pass).toBe(false);
    expect(verdict.g2).toMatchObject({ ok_pct: 92, unsupported_pct: 5 });
    expect(verdict.reasons).toEqual(["unsupported_pct 5% > 2%"]);
  });

  it("reports both reasons when both bars are breached", () => {
    const verdict = buildEvalVerdict({
      counts: { ok: 10, weak: 5, unsupported: 5 },
      source: { kind: "stdin" },
      evaluatedAt: EVALUATED_AT,
    });
    expect(verdict.pass).toBe(false);
    expect(verdict.reasons).toEqual(["ok_pct 50% < 90%", "unsupported_pct 25% > 2%"]);
  });

  it("treats zero validated units as a failure (fail-safe, never a silent pass)", () => {
    const verdict = buildEvalVerdict({
      counts: { ok: 0, weak: 0, unsupported: 0 },
      source: { kind: "stdin" },
      evaluatedAt: EVALUATED_AT,
    });
    expect(verdict.pass).toBe(false);
    expect(verdict.g2.ok_pct).toBe(0);
    expect(verdict.reasons).toEqual(["ok_pct 0% < 90%"]);
  });

  it("rounds exactly like computeG2Metrics at the bar boundary (89.5% → 90% → pass)", () => {
    const verdict = buildEvalVerdict({
      counts: { ok: 179, weak: 21, unsupported: 0 },
      source: { kind: "stdin" },
      evaluatedAt: EVALUATED_AT,
    });
    expect(verdict.g2.ok_pct).toBe(90);
    expect(verdict.pass).toBe(true);
  });

  it("carries coverage_gaps and fingerprint through to the verdict", () => {
    const verdict = buildEvalVerdict({
      counts: { ok: 95, weak: 3, unsupported: 1 },
      source: { kind: "counts_file", path: "./counts.json" },
      evaluatedAt: EVALUATED_AT,
      coverage_gaps: 4,
      fingerprint: "00000000a1b2c3d4",
    });
    expect(verdict.coverage_gaps).toBe(4);
    expect(verdict.fingerprint).toBe("00000000a1b2c3d4");
  });
});

describe("verdictFromQualityReport", () => {
  it("maps supported/weak/unsupported counts, trust score, and assessed_at", () => {
    const verdict = verdictFromQualityReport({
      report: qualityReport(),
      source: { kind: "ingest_job", workspace_id: "ws-1", job_id: "job-1" },
      evaluatedAt: EVALUATED_AT,
    });
    expect(verdict).toMatchObject({
      source: { kind: "ingest_job", workspace_id: "ws-1", job_id: "job-1", assessed_at: "2026-06-09T11:58:00.000Z" },
      g2: { ok: 95, weak: 3, unsupported: 1 },
      trust_score: 88,
      pass: true,
    });
  });

  it("fails a poor-quality run", () => {
    const verdict = verdictFromQualityReport({
      report: qualityReport({ supported_count: 50, weak_count: 30, unsupported_count: 20, trust_score: 31 }),
      source: { kind: "ingest_job", workspace_id: "ws-1", job_id: "job-1" },
      evaluatedAt: EVALUATED_AT,
    });
    expect(verdict.pass).toBe(false);
    expect(verdict.reasons).toEqual(["ok_pct 50% < 90%", "unsupported_pct 20% > 2%"]);
    expect(exitCodeForVerdict(verdict)).toBe(EVAL_EXIT_QUALITY_FAIL);
  });
});

describe("pickLatestAssessedJob", () => {
  it("skips jobs without a quality report and picks the most recently assessed", () => {
    const older = job("job-old", qualityReport({ assessed_at: "2026-06-08T10:00:00.000Z" }));
    const newest = job("job-new", qualityReport({ assessed_at: "2026-06-09T11:58:00.000Z" }));
    const unassessed = job("job-running", null);
    expect(pickLatestAssessedJob([unassessed, older, newest])?.id).toBe("job-new");
    expect(pickLatestAssessedJob([newest, older])?.id).toBe("job-new");
  });

  it("returns null when no job carries a quality report", () => {
    expect(pickLatestAssessedJob([job("a", null), job("b", null)])).toBeNull();
    expect(pickLatestAssessedJob([])).toBeNull();
  });
});

describe("exit codes", () => {
  it("uses the stable 0/1/2 mapping (validate precedent)", () => {
    expect(EVAL_EXIT_PASS).toBe(0);
    expect(EVAL_EXIT_QUALITY_FAIL).toBe(1);
    expect(EVAL_EXIT_CONFIG_ERROR).toBe(2);
    const pass = buildEvalVerdict({ counts: { ok: 100, weak: 0, unsupported: 0 }, source: { kind: "stdin" }, evaluatedAt: EVALUATED_AT });
    const fail = buildEvalVerdict({ counts: { ok: 1, weak: 9, unsupported: 0 }, source: { kind: "stdin" }, evaluatedAt: EVALUATED_AT });
    expect(exitCodeForVerdict(pass)).toBe(0);
    expect(exitCodeForVerdict(fail)).toBe(1);
  });
});

describe("renderers", () => {
  const failVerdict = buildEvalVerdict({
    counts: { ok: 50, weak: 30, unsupported: 20 },
    source: { kind: "counts_file", path: "./counts.json" },
    evaluatedAt: EVALUATED_AT,
    trust_score: 31,
  });

  it("pretty output names the verdict, counts, bar, and reasons", () => {
    const out = renderEvalPretty(failVerdict);
    expect(out).toContain("RESTORMEL CONNECT EVAL");
    expect(out).toContain("50 ok");
    expect(out).toContain("20 unsupported");
    expect(out).toContain("ok ≥ 90%");
    expect(out).toContain("VERDICT: FAIL");
    expect(out).toContain("ok_pct 50% < 90%");
  });

  it("pretty output reports PASS when the bar is met", () => {
    const pass = buildEvalVerdict({ counts: { ok: 98, weak: 1, unsupported: 1 }, source: { kind: "stdin" }, evaluatedAt: EVALUATED_AT });
    expect(renderEvalPretty(pass)).toContain("VERDICT: PASS");
  });

  it("json output round-trips through the contract schema", () => {
    const parsed = ConnectEvalVerdictSchema.parse(JSON.parse(renderEvalJson(failVerdict)));
    expect(parsed).toEqual(failVerdict);
  });
});

describe("keys connect eval (command, local mode — no network)", () => {
  let dir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  const initialExitCode = process.exitCode;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "keys-connect-eval-"));
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

  it("exits 0 and prints a schema-valid JSON verdict for passing counts", async () => {
    const file = join(dir, "counts.json");
    await writeFile(file, JSON.stringify({ ok: 95, weak: 3, unsupported: 1, trust_score: 88 }), "utf-8");
    await runEval(["--counts", file, "--output", "json"]);
    expect(process.exitCode).toBe(EVAL_EXIT_PASS);
    const verdict = ConnectEvalVerdictSchema.parse(JSON.parse(String(logSpy.mock.calls[0][0])));
    expect(verdict.pass).toBe(true);
    expect(verdict.source).toMatchObject({ kind: "counts_file", path: file });
  });

  it("exits 1 (quality fail) for counts below the bar", async () => {
    const file = join(dir, "counts.json");
    await writeFile(file, JSON.stringify({ ok: 10, weak: 5, unsupported: 5 }), "utf-8");
    await runEval(["--counts", file, "--output", "json"]);
    expect(process.exitCode).toBe(EVAL_EXIT_QUALITY_FAIL);
    const verdict = ConnectEvalVerdictSchema.parse(JSON.parse(String(logSpy.mock.calls[0][0])));
    expect(verdict.reasons).toEqual(["ok_pct 50% < 90%", "unsupported_pct 25% > 2%"]);
  });

  it("exits 2 (config error) for a missing counts file", async () => {
    await runEval(["--counts", join(dir, "does-not-exist.json")]);
    expect(process.exitCode).toBe(EVAL_EXIT_CONFIG_ERROR);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("exits 2 (config error) for malformed JSON and for invalid counts", async () => {
    const bad = join(dir, "bad.json");
    await writeFile(bad, "{not json", "utf-8");
    await runEval(["--counts", bad]);
    expect(process.exitCode).toBe(EVAL_EXIT_CONFIG_ERROR);

    process.exitCode = undefined;
    const invalid = join(dir, "invalid.json");
    await writeFile(invalid, JSON.stringify({ ok: -1, weak: 0, unsupported: 0 }), "utf-8");
    await runEval(["--counts", invalid]);
    expect(process.exitCode).toBe(EVAL_EXIT_CONFIG_ERROR);
  });

  it("exits 2 (config error) for conflicting flags or an unknown output format", async () => {
    const file = join(dir, "counts.json");
    await writeFile(file, JSON.stringify({ ok: 1, weak: 0, unsupported: 0 }), "utf-8");
    await runEval(["--counts", file, "--stdin"]);
    expect(process.exitCode).toBe(EVAL_EXIT_CONFIG_ERROR);

    process.exitCode = undefined;
    await runEval(["--counts", file, "--output", "yaml"]);
    expect(process.exitCode).toBe(EVAL_EXIT_CONFIG_ERROR);
  });
});
