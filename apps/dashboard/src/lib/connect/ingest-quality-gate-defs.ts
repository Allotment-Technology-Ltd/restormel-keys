import {
  G2_OK_PCT_TARGET,
  G2_UNSUPPORTED_PCT_MAX,
} from "@restormel/connect-core/ingest/golden-eval";
import { TRUST_SCORE_FORMULA } from "@restormel/connect-core";

export const G3_TRUST_SCORE_TARGET = 85;

export type IngestQualityGateDef = {
  id: string;
  shortName: string;
  /** One-line target for summary table */
  target: string;
  /** Self-contained explanation — no repo links required to understand */
  body: string;
  /** What to do when this gate blocks release or Apply calibration */
  whenBlocked: string;
};

export const INGEST_QUALITY_GATES: IngestQualityGateDef[] = [
  {
    id: "g1",
    shortName: "G1 Extraction structure",
    target: "100% pass before production spend",
    body:
      "Before any LLM tokens are spent, pre-scan rejects empty sources, binary PDFs, unreachable URLs, and jobs over the cost ceiling. Separately, golden fixture URLs (philosophy starter Stanford Encyclopedia articles) are dry-run through extraction at strict mode. Structural failures — pattern violations or orphan units — must be zero. This gate is enforced in CI and at run planning time, not on this dashboard.",
    whenBlocked:
      "Fix pack/schema mismatch or source shape before starting a production ingest. Re-run golden eval locally or wait for CI on connect-core changes.",
  },
  {
    id: "g2",
    shortName: "G2 Faithfulness",
    target: `≥${G2_OK_PCT_TARGET}% ok · ≤${G2_UNSUPPORTED_PCT_MAX}% unsupported (production sample)`,
    body:
      "After validate and remediate stages on production-preset ingests, each job stores a quality_report on its progress record. Faithfulness is the share of graph units marked ok versus weak or unsupported. We average ok% and unsupported% across the latest completed production jobs in the sample table below. This aggregate must pass before Apply calibration unlocks on the ingest-quality loop — prompt bumps are unsafe while live extraction is systematically weak.",
    whenBlocked:
      "Open failing runs in the sample table and inspect unit validation in the ingest console. Triage overrides in Graph Explorer, fix sources or pack config, then re-run production ingests until the aggregate clears.",
  },
  {
    id: "g3",
    shortName: "G3 Corpus health",
    target: `Trust score ≥${G3_TRUST_SCORE_TARGET}`,
    body:
      `High unit ok% can still hide corpus problems: missing embeddings, orphan claims, a down vector index, or severe audit issues. After store, buildRunQualityReport attaches kg_audit.trust_score — ${TRUST_SCORE_FORMULA}. The Trust column in the production sample shows per-job scores when a graph stats snapshot exists; we average those for live status here.`,
    whenBlocked:
      "Use Graph Explorer to find orphans, missing embeddings, or relation imbalance on failing jobs. Re-ingest or revalidate affected sources before claiming corpus readiness.",
  },
  {
    id: "g4",
    shortName: "G4 Retrieval",
    target: "No regression vs archived golden-query baseline",
    body:
      "Ingest quality must translate to retrieval usefulness, not only validation labels on units. An offline golden-query suite exercises retrieve-context against a frozen SOPHIA benchmark artifact. Hits at k are compared release-over-release; this gate is not computed live on the admin dashboard.",
    whenBlocked:
      "Run the offline retrieval benchmark before external best-in-class claims. Investigate graph coverage and embedding quality if hit@k regresses versus the archived baseline.",
  },
  {
    id: "g5",
    shortName: "G5 Operator loop",
    target: "Median ingest-complete → review-complete latency (PostHog)",
    body:
      "Automated ingest is only useful if operators close the loop quickly. PostHog records connect_ingest_completed and connect_review_completed with time_since_ingest_complete_ms. The Connect Ingest Quality dashboard tracks median triage latency. Review signals from human corrections feed threshold evaluation on the ingest-quality page.",
    whenBlocked:
      "If triage latency spikes, check Graph Explorer queue depth, notification paths, and whether production runs are completing with actionable validation summaries.",
  },
  {
    id: "g6",
    shortName: "G6 Pipeline truth",
    target: "0% stub-complete or zero-unit production runs in sample",
    body:
      "Quality metrics are meaningless if production runs never executed the real worker pipeline or wrote zero graph units. Each quality_report records execution_mode (stub vs full) and units count. Any production-preset job in the sample window that completed as stub, with zero units, or with a stub warning fails this gate.",
    whenBlocked:
      "Confirm the hosted connect-ingest worker is running and jobs use quality_preset production with full execution. Restart failed stub runs after worker or env fixes.",
  },
  {
    id: "g7",
    shortName: "G7 Regression",
    target: "CI blocks golden-eval failures; Apply audits pack versions",
    body:
      "golden-eval.test.ts runs in CI on connect-core and pack seeds so prompt or pack changes cannot silently regress extraction structure. When admins Apply calibration, builtin pack prompt_template_version bumps are recorded in knowledge_ingest_quality_runs for audit.",
    whenBlocked:
      "Do not merge pack or prompt changes until golden eval passes in CI. After Apply, confirm run history on the ingest-quality page shows the expected version bumps.",
  },
];
