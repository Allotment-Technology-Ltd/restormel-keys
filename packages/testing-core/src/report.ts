import type { RunRecord } from "./run.js";

export interface ArtifactRef {
  kind: "screenshot" | "trace" | "log" | "network" | "console" | "report" | "other";
  /** Relative to run artefact directory or workspace-relative path. */
  path: string;
  mimeType?: string;
}

export interface ReproductionHint {
  argv: string[];
  cwd?: string;
  notes?: string;
}

/** Human-facing bundle over a completed run (local files + summary). */
export interface Report {
  run: RunRecord;
  highlights: string[];
  artifacts: ArtifactRef[];
  reproduction?: ReproductionHint;
}

/** Alias aligned with architecture docs. */
export type RunReport = Report;
