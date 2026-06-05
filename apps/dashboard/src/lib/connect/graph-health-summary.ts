/**
 * Graph pulse health summary — kg-audit trust score + human-readable issue list for Connect hub.
 */
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { buildAuditSummary, type KgAuditIssueDraft, type KgAuditMetrics } from "@restormel/connect-core";

const CONNECT_BASE = `${DASHBOARD_BASE}/connect`;
const OK_RATE_TARGET_PCT = 90;

export type GraphHealthIssue = {
  kind: "low_ok_rate" | "missing_embeddings";
  severity: "medium" | "high";
  title: string;
  detail: string;
  actionLabel: string;
  actionHref: string;
};

export type GraphHealthSummary = {
  trust_score: number;
  total_issues: number;
  formula: string;
  ok_pct: number;
  issues: GraphHealthIssue[];
};

export type GraphHealthStatsInput = {
  units: number;
  embedded: number;
  validation: { ok: number; weak: number; unsupported: number; unvalidated: number };
  relations?: number;
};

function buildIssueDisplays(
  stats: GraphHealthStatsInput,
  ok_pct: number,
  drafts: KgAuditIssueDraft[],
): GraphHealthIssue[] {
  const { units, embedded, validation } = stats;
  const missingEmb = Math.max(0, units - embedded);
  const quarantine = validation.weak + validation.unsupported;

  return drafts.map((draft) => {
    if (draft.kind === "low_ok_rate") {
      return {
        kind: "low_ok_rate" as const,
        severity: "medium" as const,
        title: "Low support rate",
        detail:
          quarantine > 0
            ? `Only ${ok_pct}% of validated ideas are fully supported (${OK_RATE_TARGET_PCT}%+ target). ${validation.unsupported.toLocaleString()} unsupported and ${validation.weak.toLocaleString()} weak ideas may need triage in the graph explorer.`
            : `Only ${ok_pct}% of validated ideas are fully supported (${OK_RATE_TARGET_PCT}%+ target). Consider re-validation or domain pack tuning.`,
        actionLabel: quarantine > 0 ? "Open quarantine queue" : "Review graph",
        actionHref: `${CONNECT_BASE}/graph?filter=review`,
      };
    }
    return {
      kind: "missing_embeddings" as const,
      severity: "high" as const,
      title: "Missing embeddings",
      detail: `${missingEmb.toLocaleString()} of ${units.toLocaleString()} ideas lack embedding vectors — semantic search and agent retrieval may skip them until you embed the missing ideas.`,
      actionLabel: "Embed missing ideas",
      actionHref: `${CONNECT_BASE}/graph?workspace=tools&focus=embed`,
    };
  });
}

export function graphStatsToHealthSummary(stats: GraphHealthStatsInput): GraphHealthSummary | null {
  if (stats.units <= 0) return null;
  const denom = stats.validation.ok + stats.validation.weak + stats.validation.unsupported;
  const ok_pct = denom > 0 ? Math.round((stats.validation.ok / denom) * 100) : 0;
  const metrics: KgAuditMetrics = {
    accepted_claims: stats.units,
    accepted_unverified:
      stats.validation.unvalidated + stats.validation.weak + stats.validation.unsupported,
    accepted_missing_embedding: Math.max(0, stats.units - stats.embedded),
    orphan_claims: 0,
    vector_index: { ok: stats.embedded > 0 },
    relation_totals: { supports: stats.relations ?? 0, contradicts: 0 },
  };
  const drafts: KgAuditIssueDraft[] = [];
  if (ok_pct < OK_RATE_TARGET_PCT && denom > 0) {
    drafts.push({ kind: "low_ok_rate", severity: "medium", message: `${ok_pct}% ok` });
  }
  if (stats.embedded < stats.units) {
    drafts.push({ kind: "missing_embeddings", severity: "high", message: "Missing embeddings" });
  }
  const summary = buildAuditSummary(metrics, drafts, 3);
  const issues = buildIssueDisplays(stats, ok_pct, drafts);
  return {
    trust_score: summary.trust_score,
    total_issues: summary.total_issues,
    formula: summary.trust_formula,
    ok_pct,
    issues,
  };
}
