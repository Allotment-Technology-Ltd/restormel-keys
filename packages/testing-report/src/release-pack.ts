import type { RunRecord } from "@restormel/testing-core";
import type { MvpJsonReportV1 } from "./mvp-json-report.js";
import { MVP_REPORT_SCHEMA_VERSION } from "./mvp-json-report.js";

/** Stable id for Restormel Release pack JSON exports. */
export const RELEASE_PACK_SCHEMA_VERSION = "restormel-release-pack/1" as const;

export interface ReleasePackControlPlaneRefsV1 {
  route_id?: string;
  route_version?: string;
  policy_id?: string;
  policy_version?: string;
  /** Free-text provenance (e.g. commit SHA, build id) — no secrets. */
  notes?: string;
}

export interface ReleasePackTestingSectionV1 {
  mvp_report_schema_version: typeof MVP_REPORT_SCHEMA_VERSION;
  artifact_dir?: string;
  run_id: string;
  suite_id?: string;
  environment_id?: string;
  verdict: RunRecord["verdict"];
  /** Compact AC snapshot for auditors (ids + verdicts only). */
  acceptance_results?: { id: string; verdict: string; summary?: string }[];
  /** Full MVP report (includes run record). */
  mvp_report: MvpJsonReportV1;
}

/**
 * Exportable “safe to ship” bundle linking control-plane versions to Testing results.
 * See in-app docs: `/keys/docs/guides/release-pack-and-merge-gates`.
 */
export interface ReleasePackV1 {
  schema_version: typeof RELEASE_PACK_SCHEMA_VERSION;
  generated_at: string;
  control_plane?: ReleasePackControlPlaneRefsV1;
  testing: ReleasePackTestingSectionV1;
}

export function buildReleasePackV1(input: {
  mvpReport: MvpJsonReportV1;
  controlPlane?: ReleasePackControlPlaneRefsV1;
  artifactDir?: string;
  generatedAt?: string;
}): ReleasePackV1 {
  const run = input.mvpReport.run;
  const ac = run.acceptanceResults;
  return {
    schema_version: RELEASE_PACK_SCHEMA_VERSION,
    generated_at: input.generatedAt ?? new Date().toISOString(),
    control_plane: input.controlPlane,
    testing: {
      mvp_report_schema_version: MVP_REPORT_SCHEMA_VERSION,
      artifact_dir: input.artifactDir,
      run_id: run.id,
      suite_id: run.suiteId,
      environment_id: run.environmentId,
      verdict: run.verdict,
      acceptance_results:
        ac !== undefined && ac.length > 0
          ? ac.map((r) => ({
              id: r.id,
              verdict: r.verdict,
              summary: r.summary,
            }))
          : undefined,
      mvp_report: input.mvpReport,
    },
  };
}

export function serializeReleasePackV1(doc: ReleasePackV1): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}
