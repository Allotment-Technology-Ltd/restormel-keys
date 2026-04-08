import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  isRunRecord,
  isTraceEvent,
  resolvePathUnderRoot,
  type RunRecord,
  type TraceEvent,
} from "@restormel/testing-core";
import { RUN_JSON, TRACES_JSON, WARNINGS_TXT, type ArtifactIoOptions } from "./write-artifacts.js";

export interface LoadedRunArtifacts {
  run: RunRecord;
  traces: TraceEvent[];
  warnings: string[];
  /** Directory containing `run.json` (or the parent when `path` was a file). */
  artifactDir: string;
}

function isTraceEventArray(value: unknown): value is TraceEvent[] {
  return Array.isArray(value) && value.every((x) => isTraceEvent(x));
}

/**
 * Load `run.json` (+ optional `traces.json`, `warnings.txt`) from a run directory,
 * or from a direct path to `run.json`.
 */
export async function readRunArtifacts(
  path: string,
  options?: ArtifactIoOptions,
): Promise<LoadedRunArtifacts | { ok: false; message: string }> {
  const root = options?.allowedRoot ?? process.cwd();
  const resolved = resolvePathUnderRoot(root, path);
  if (!resolved.ok) {
    return { ok: false, message: resolved.reason };
  }
  const safePath = resolved.path;
  const st = await stat(safePath).catch(() => undefined);
  if (st === undefined) {
    return { ok: false, message: `Not found: ${safePath}` };
  }

  const runJsonPath = st.isDirectory() ? join(safePath, RUN_JSON) : safePath;
  const artifactDir = st.isDirectory() ? safePath : dirname(safePath);

  let runRaw: string;
  try {
    runRaw = await readFile(runJsonPath, "utf8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Cannot read ${runJsonPath}: ${msg}` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(runRaw) as unknown;
  } catch {
    return { ok: false, message: `Invalid JSON in ${runJsonPath}` };
  }

  if (!isRunRecord(parsed)) {
    return { ok: false, message: `File is not a valid RunRecord: ${runJsonPath}` };
  }

  const run = parsed;
  let traces: TraceEvent[] = [];
  const tracesPath = join(artifactDir, TRACES_JSON);
  try {
    const tRaw = await readFile(tracesPath, "utf8");
    const tParsed = JSON.parse(tRaw) as unknown;
    if (isTraceEventArray(tParsed)) {
      traces = tParsed;
    }
  } catch {
    /* traces optional */
  }

  let warnings: string[] = [];
  try {
    const wRaw = await readFile(join(artifactDir, WARNINGS_TXT), "utf8");
    warnings = wRaw
      .split("\n")
      .map((l) => l.trimEnd())
      .filter((l) => l.length > 0);
  } catch {
    /* optional */
  }

  return { run, traces, warnings, artifactDir };
}
