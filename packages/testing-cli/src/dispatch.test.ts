import { realpathSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EXIT_OK, EXIT_USAGE } from "./exit-codes.js";
import { runCli } from "./dispatch.js";
import { STARTER_CONFIG_YAML } from "./starter-config.js";
import { PRE_RUN_FAILURE_JSON, writeRunArtifacts } from "@restormel/testing-report";

describe("runCli", () => {
  let workDir: string;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (workDir) {
      await rm(workDir, { recursive: true, force: true });
    }
  });

  it("prints starter config on init --print", async () => {
    const chunks: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
      chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    });
    const code = await runCli(["init", "--print"]);
    spy.mockRestore();
    expect(code).toBe(EXIT_OK);
    expect(chunks.join("")).toContain("schema_version");
  });

  it("validate exits 0 for valid config", async () => {
    workDir = await mkdtemp(join(tmpdir(), "rt-cli-"));
    const prev = process.cwd();
    try {
      process.chdir(workDir);
      await writeFile("cfg.yaml", STARTER_CONFIG_YAML, "utf8");
      const code = await runCli(["validate", "-c", "cfg.yaml"]);
      expect(code).toBe(EXIT_OK);
    } finally {
      process.chdir(prev);
    }
  });

  it("validate exits non-zero for broken config", async () => {
    workDir = await mkdtemp(join(tmpdir(), "rt-cli-"));
    const prev = process.cwd();
    try {
      process.chdir(workDir);
      await writeFile("bad.yaml", "not: yaml: [[", "utf8");
      const code = await runCli(["validate", "-c", "bad.yaml"]);
      expect(code).toBe(EXIT_USAGE);
    } finally {
      process.chdir(prev);
    }
  });

  it("run without --suite is usage error", async () => {
    const code = await runCli(["run"]);
    expect(code).toBe(EXIT_USAGE);
  });

  it("run --json on pre-run failure writes pre-run-failure.json and prints artifact_dir", async () => {
    workDir = await mkdtemp(join(tmpdir(), "rt-cli-"));
    const prev = process.cwd();
    try {
      process.chdir(workDir);
      await writeFile("cfg.yaml", STARTER_CONFIG_YAML, "utf8");
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
      const code = await runCli([
        "run",
        "--suite",
        "no-such-suite",
        "-c",
        "cfg.yaml",
        "--json",
        "--artifact-dir",
        "art",
      ]);
      const logCalls = [...logSpy.mock.calls];
      logSpy.mockRestore();
      expect(code).toBe(EXIT_USAGE);
      const jsonLine = logCalls.map((c) => String(c[0])).find((s) => s.includes('"artifact_dir"'));
      expect(jsonLine).toBeDefined();
      const payload = JSON.parse(jsonLine!);
      expect(payload.ok).toBe(false);
      const artPath = join(workDir, "art");
      expect(realpathSync(String(payload.artifact_dir))).toBe(realpathSync(artPath));
      expect(payload.partial_artifacts).toEqual([PRE_RUN_FAILURE_JSON]);
      const disk = JSON.parse(await readFile(join(artPath, PRE_RUN_FAILURE_JSON), "utf8")) as {
        ok: boolean;
        phase: string;
      };
      expect(disk.ok).toBe(false);
      expect(disk.phase).toBe("pre_run");
    } finally {
      process.chdir(prev);
    }
  });

  it("help unknown topic is usage error", async () => {
    const code = await runCli(["help", "nope"]);
    expect(code).toBe(EXIT_USAGE);
  });

  it("report reads a written artefact directory", async () => {
    workDir = await mkdtemp(join(tmpdir(), "rt-cli-"));
    const prev = process.cwd();
    const run = {
      id: "r-cli-1",
      suiteId: "example",
      environmentId: "local",
      trigger: "local" as const,
      startedAt: "2026-04-07T12:00:00.000Z",
      verdict: "failed" as const,
      goalRuns: [
        {
          goalId: "smoke",
          verdict: "failed" as const,
          reasonCode: "TEXT_NOT_FOUND",
          summary: "missing text",
          retriesUsed: 0,
          evidenceRefs: [] as string[],
        },
      ],
    };
    try {
      process.chdir(workDir);
      await writeRunArtifacts(".", { run, traces: [] });

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
      const code = await runCli(["report", "."]);

      expect(code).toBe(EXIT_OK);
      expect(logSpy.mock.calls.some((c) => String(c[0]).includes("r-cli-1"))).toBe(true);
      logSpy.mockRestore();
    } finally {
      process.chdir(prev);
    }
  });

  it("report missing path is usage error", async () => {
    const code = await runCli(["report"]);
    expect(code).toBe(EXIT_USAGE);
  });
});
