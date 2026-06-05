/**
 * Post-ingest quality report — surfaces validation breakdown and kg-audit summary.
 */
import { buildAuditSummary, type KgAuditIssueDraft, type KgAuditMetrics } from "@restormel/connect-core";

export type RunQualityReport = {
  preset: "production" | "starter";
  execution_mode: "stub" | "full";
  units: number;
  relations: number;
  embedded: number;
  validation: { ok: number; weak: number; unsupported: number; unvalidated: number };
  quarantine_count: number;
  quarantine_pct: number;
  weak_pct: number;
  unsupported_pct: number;
  pack_readiness_warnings: string[];
  extraction_warning_count?: number;
  ok_pct: number;
  stub_warning: string | null;
  kg_audit: {
    trust_score: number;
    total_issues: number;
    formula: string;
  } | null;
  next_actions: string[];
};

export function buildRunQualityReport(args: {
  preset: "production" | "starter";
  executionMode: "stub" | "full";
  units: number;
  relations: number;
  embedded: number;
  validation: RunQualityReport["validation"];
  graphStats?: { units: number; embedded: number; validation: RunQualityReport["validation"] };
  extractionWarningCount?: number;
  packReadinessWarnings?: string[];
}): RunQualityReport {
  const v = args.validation;
  const denom = v.ok + v.weak + v.unsupported;
  const ok_pct = denom > 0 ? Math.round((v.ok / denom) * 100) : 0;
  const quarantine_count = v.weak + v.unsupported;
  const quarantine_pct = args.units > 0 ? Math.round((quarantine_count / args.units) * 100) : 0;
  const weak_pct = denom > 0 ? Math.round((v.weak / denom) * 100) : 0;
  const unsupported_pct = denom > 0 ? Math.round((v.unsupported / denom) * 100) : 0;
  const pack_readiness_warnings = args.packReadinessWarnings ?? [];

  const stub_warning =
    args.executionMode === "stub"
      ? "This run used stub/preview mode — no graph was written. Connect a graph store and use full worker mode."
      : args.preset === "production" && args.units === 0
        ? "Production run completed with zero units — check sources, routes, and graph store connectivity."
        : null;

  const next_actions: string[] = [];
  if (stub_warning) next_actions.push("Restart run after graph store + Keys routes are configured.");
  if (quarantine_count > 0) {
    next_actions.push(
      `Triage ${quarantine_count} quarantine item(s) in Graph Explorer (?filter=review).`,
    );
  }
  if (ok_pct < 90 && denom > 0) next_actions.push("Consider re-validation job or pack prompt tuning.");
  if (args.embedded < args.units) next_actions.push("Some units missing embeddings — check embedding route.");

  let kg_audit: RunQualityReport["kg_audit"] = null;
  if (args.graphStats && args.graphStats.units > 0) {
    const gs = args.graphStats;
    const metrics: KgAuditMetrics = {
      accepted_claims: gs.units,
      accepted_unverified: gs.validation.unvalidated + gs.validation.weak + gs.validation.unsupported,
      accepted_missing_embedding: Math.max(0, gs.units - gs.embedded),
      orphan_claims: 0,
      vector_index: { ok: gs.embedded > 0 },
      relation_totals: { supports: args.relations, contradicts: 0 },
    };
    const issues: KgAuditIssueDraft[] = [];
    if (ok_pct < 90) {
      issues.push({ kind: "low_ok_rate", severity: "medium", message: `${ok_pct}% units ok after remediation` });
    }
    if (gs.embedded < gs.units) {
      issues.push({ kind: "missing_embeddings", severity: "high", message: "Some units lack embeddings" });
    }
    const summary = buildAuditSummary(metrics, issues, 3);
    kg_audit = {
      trust_score: summary.trust_score,
      total_issues: summary.total_issues,
      formula: summary.trust_formula,
    };
  }

  return {
    preset: args.preset,
    execution_mode: args.executionMode,
    units: args.units,
    relations: args.relations,
    embedded: args.embedded,
    validation: v,
    quarantine_count,
    quarantine_pct,
    weak_pct,
    unsupported_pct,
    pack_readiness_warnings,
    ...(args.extractionWarningCount != null
      ? { extraction_warning_count: args.extractionWarningCount }
      : {}),
    ok_pct,
    stub_warning,
    kg_audit,
    next_actions,
  };
}
