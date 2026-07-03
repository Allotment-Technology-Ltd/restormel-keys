/**
 * Connect ingestion — fail-open / truncation repro.
 *
 * Grounds the candidate findings in docs/reviews/connect-ingest-context.md (§6) using the
 * exported PURE functions of @restormel/connect-core. No LLM keys or network required: we
 * feed each stage's coverage/parse helpers the kind of incomplete or garbled output a model
 * produces in practice, and print what the pipeline does with it.
 *
 * Run: pnpm tsx scripts/reviews/connect-ingest-failopen-repro.ts
 *
 * This is a REVIEW AID, not a test. It always exits 0; read the output. Extend it to ground
 * any new finding before proposing a fix.
 */
import {
  finalizeValidationCoverage,
  parseValidationResponse,
  parseValidationResponseDetailed,
  type ValidationInput,
  type UnitValidation,
} from "../../packages/connect-core/src/ingest/validation.js";
import { askBatchWithCoverageRetry } from "../../packages/connect-core/src/ingest/batch-coverage.js";
import {
  evaluateExtractionGate,
  EXTRACTION_GATE_THRESHOLDS,
} from "../../packages/connect-core/src/ingest/extraction-gates.js";
import type { ExtractionWarning } from "../../packages/connect-core/src/ingest/extract.js";
import {
  finalizeRemediationCoverage,
  type RemediationInput,
  type RemediationResult,
} from "../../packages/connect-core/src/ingest/remediation.js";
import { computeG2Metrics } from "../../packages/connect-core/src/ingest/golden-eval.js";
import { chunkDocument } from "../../packages/connect-core/src/ingest/chunking.js";

function hr(title: string): void {
  console.log("\n" + "═".repeat(72) + "\n" + title + "\n" + "─".repeat(72));
}

// Wrapped in main() because the H1 re-ask demo awaits (tsx compiles this file CJS — no TLA).
async function main(): Promise<void> {
/* ───────────────────────── C1 + C3: validation now fails safe ───────────────────────── */
hr("C1/C3 (FIXED) — validation: omitted units default to 'weak', ok_pct honest");

// 5 extracted units sent to the validator.
const units: ValidationInput[] = [
  { ref: "u1", text: "Bentham founded classical utilitarianism." },
  { ref: "u2", text: "Mill distinguished higher and lower pleasures." },
  { ref: "u3", text: "Utilitarianism is a form of consequentialism." },
  { ref: "u4", text: "Sidgwick proved utilitarianism is self-evident." }, // dubious
  { ref: "u5", text: "Kant was a utilitarian." }, // false
];

// The validator only returned verdicts for 3 of 5 (u4, u5 dropped — common under
// batch pressure / truncation / a malformed tail). The two it dropped are the two
// shakiest claims.
const validatorReturned: UnitValidation[] = [
  { ref: "u1", status: "ok" },
  { ref: "u2", status: "ok" },
  { ref: "u3", status: "ok" },
];

const finalized = finalizeValidationCoverage(units, validatorReturned);
for (const v of finalized) {
  const flag = v.note ? `  ← ${v.note}` : "";
  console.log(`  ${v.ref}: ${v.status}${flag}`);
}

const counts = { ok: 0, weak: 0, unsupported: 0 };
for (const v of finalized) counts[v.status] += 1;
const g2 = computeG2Metrics(counts);
console.log(
  `\n  Verdicts after finalize: ok=${counts.ok} weak=${counts.weak} unsupported=${counts.unsupported}`,
);
console.log(`  G2 ok_pct = ${g2.ok_pct}%  (G2 bar: >= 90%)`);
console.log(
  "  ⇒ The two unvalidated claims (incl. a false one) now finalize as 'weak' with a\n" +
    "    coverage_gap note, so they flow to remediation instead of into the graph as 'ok',\n" +
    "    and ok_pct reflects the real coverage (60%, below the bar) instead of a green 100%.",
);

/* ───────────────────────── C2: remediation now fails safe ───────────────────────── */
hr("C2 (FIXED) — remediation: omitted units default to 'drop', not 'keep'");

const weakUnits: RemediationInput[] = [
  { ref: "w1", text: "Sidgwick proved utilitarianism is self-evident.", note: "overstated" },
  { ref: "w2", text: "Kant was a utilitarian.", note: "unsupported" },
];
// Remediation returned nothing (timeout / empty parse / dropped batch).
const remediationReturned: RemediationResult[] = [];
const remFinal = finalizeRemediationCoverage(weakUnits, remediationReturned);
for (const r of remFinal) console.log(`  ${r.ref}: ${r.action}`);
console.log(
  "  ⇒ Both flagged-weak units now default to 'drop': the orchestrator maps that to a\n" +
    "    reversible soft-exclude (strictness policy still applies), instead of silently\n" +
    "    persisting known-weak units as if remediation succeeded.",
);

/* ───────────────────────── H1: parse loss is now SIGNALLED, warned about, and re-asked once ───────────────────────── */
hr("H1 (FIXED) — lost verdict batches are signalled, warned about, and re-asked once");

// A response truncated mid-array (max_tokens / network cut). Note the dangling object.
const truncated =
  '{"results":[{"ref":"v1","status":"ok"},{"ref":"v2","status":"unsupported"},{"ref":"v3","stat';
console.log(`  Model intended verdicts for v1..v3, but the response was truncated at v3.`);
console.log(
  `  legacy parseValidationResponse: ${parseValidationResponse(truncated).length} verdict(s), no signal (the old H1).`,
);
const detailed = parseValidationResponseDetailed(truncated);
console.log(
  `  parseValidationResponseDetailed: ${detailed.results.length} verdict(s), parseFailed=${detailed.parseFailed} ← the batch-lost signal`,
);

// What the orchestrator (ingest-full-runner / graph-remediation-pass) now does with it:
// warn with the omitted ref count, re-ask the lost refs EXACTLY ONCE, then let the
// fail-safe coverage finalize stamp anything still missing.
const h1Units: ValidationInput[] = [
  { ref: "v1", text: "..." },
  { ref: "v2", text: "..." },
  { ref: "v3", text: "..." },
];
let h1Asks = 0;
const h1 = await askBatchWithCoverageRetry<ValidationInput, UnitValidation>({
  inputs: h1Units,
  ask: async () => {
    h1Asks += 1;
    if (h1Asks === 1) return parseValidationResponseDetailed(truncated);
    // The re-ask succeeds for v1+v2; the model omits v3 AGAIN (worst case).
    return parseValidationResponseDetailed(
      '{"results":[{"ref":"v1","status":"ok"},{"ref":"v2","status":"unsupported"}]}',
    );
  },
  onShortfall: ({ omittedRefs, parseFailed }) => {
    console.log(
      `  [orchestrator log] Coverage shortfall — ${omittedRefs.length}/${h1Units.length} verdict(s) missing` +
        (parseFailed ? " (response unparseable)" : "") +
        " — re-asking once",
    );
  },
});
console.log(`  Model asked ${h1Asks} time(s) (re-ask happened exactly once, never twice).`);
const h1Final = finalizeValidationCoverage(h1Units, h1.results);
console.log(
  `  After re-ask + finalize, persisted statuses: ${h1Final.map((v) => `${v.ref}=${v.status}`).join(", ")}`,
);
console.log(
  "  ⇒ The truncated batch is no longer a silent loss: the parser signals it, the\n" +
    "    orchestrator logs a coverage-shortfall warning with the omitted ref count and\n" +
    "    re-asks that batch exactly once. v1/v2 recover their real verdicts; only the\n" +
    "    twice-omitted v3 falls through to the fail-safe 'weak' (coverage_gap) default.",
);

/* ───────────────────────── H3: orphan/dangling/no_relations warnings now gate ───────────────────────── */
hr("H3 (FIXED) — extraction gate acts on orphan/dangling thresholds (preset-driven)");

const w = (code: ExtractionWarning["code"], count?: number): ExtractionWarning => ({
  code,
  severity: "warning",
  message: code,
  ...(count != null ? { count } : {}),
});

console.log(
  `  Preset thresholds (pack.quality_preset drives the preset — nothing hardcoded per call):`,
);
for (const preset of ["production", "starter"] as const) {
  const t = EXTRACTION_GATE_THRESHOLDS[preset];
  console.log(
    `    ${preset.padEnd(10)} → mode=${t.mode}, orphan ratio > ${t.maxOrphanUnitRatio} (≥${t.orphanGateMinUnits} units), dangling ratio > ${t.maxDanglingRelationRatio}`,
  );
}

// A disconnected chunk: 5 units, zero relations (the philosophy lesson).
const orphanChunk = { warnings: [w("no_relations")], totals: { units: 5, relations: 0 } };
// An incoherent chunk: 3 of 4 relations reference units that were never extracted.
const danglingChunk = {
  warnings: [w("dangling_relation", 3)],
  totals: { units: 10, relations: 4 },
};

for (const [label, c] of [
  ["all-orphan chunk (no_relations)", orphanChunk],
  ["dangling relations 3/4", danglingChunk],
] as const) {
  const prod = evaluateExtractionGate(c.warnings, "production", "guided", { totals: c.totals });
  const starter = evaluateExtractionGate(c.warnings, "starter", "guided", { totals: c.totals });
  console.log(
    `  ${label}:\n` +
      `    production → allowPersist=${prod.allowPersist} (${(prod.breaches ?? []).join(", ") || "no breach"})\n` +
      `    starter    → allowPersist=${starter.allowPersist}, warned: ${(starter.breaches ?? []).join(", ")}`,
  );
}

// Strict-mode pattern violations: the old gate returned allowPersist:true with a
// blocking-sounding reason ("strict_pattern_violation:N") — a contradiction. Resolved:
// strict + production now BLOCKS; guided mode / starter preset stay lenient.
const strictGate = evaluateExtractionGate([w("pattern_violation", 2)], "production", "strict", {
  totals: { units: 5, relations: 5 },
});
console.log(
  `  strict pattern_violation(2): production+strict → allowPersist=${strictGate.allowPersist} ` +
    `(reason=${strictGate.reason}) — was allowPersist=true with reason "strict_pattern_violation:2"`,
);
console.log(
  "  ⇒ Orphan/dangling/no_relations warnings now gate persist with preset-driven\n" +
    "    thresholds (production blocks, starter warns via `breaches` the orchestrator\n" +
    "    logs), and the strict pattern_violation contradiction is resolved to a block.",
);

/* ───────────────────────── H4: structure-aware chunking now honors overlap ───────────────────────── */
hr("H4 (FIXED) — structure_aware chunking honors overlap_chars across boundaries");

/** Largest k where a's last k chars == b's first k chars (the real carried-over overlap region). */
function boundaryOverlap(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  for (let k = max; k > 0; k--) {
    if (a.slice(a.length - k) === b.slice(0, k)) return k;
  }
  return 0;
}

// Two paragraphs where the relation (B refutes A) spans the boundary between them.
const doc =
  "Paragraph A. Bentham holds that pleasure is the only intrinsic good. " +
  "This hedonistic axiom is the foundation of his entire system.\n\n" +
  "Paragraph B. Nozick's experience-machine argument refutes that axiom directly, " +
  "showing we value more than felt pleasure.";
const profile = { min_chars: 40, max_chars: 160, overlap_chars: 40 }; // force a split, request overlap

const structureChunks = chunkDocument(doc, { strategy: "structure_aware", ...profile });
const fixedChunks = chunkDocument(doc, { strategy: "fixed", ...profile });

const structOverlap =
  structureChunks.length >= 2 ? boundaryOverlap(structureChunks[0]!.text, structureChunks[1]!.text) : 0;
const fixedOverlap =
  fixedChunks.length >= 2 ? boundaryOverlap(fixedChunks[0]!.text, fixedChunks[1]!.text) : 0;

console.log(`  Same doc, requested overlap_chars=${profile.overlap_chars}:`);
console.log(`    structure_aware → ${structureChunks.length} chunks, boundary overlap = ${structOverlap} chars`);
console.log(`    fixed          → ${fixedChunks.length} chunks, boundary overlap = ${fixedOverlap} chars`);
console.log(
  `  ⇒ structure_aware now carries ${structOverlap} chars across the boundary (was 0 —\n` +
    `    overlap_chars was ignored); 'fixed' still honors it too (${fixedOverlap} chars). The two\n` +
    "    related units now share boundary context, so the B-refutes-A relation is extractable.",
);

hr("Summary");
console.log(
  "  C1/C2/C3 are FIXED: omitted validation verdicts finalize as 'weak' (coverage_gap),\n" +
    "  omitted remediation verdicts finalize as 'drop', and G2 ok_pct no longer counts\n" +
    "  never-judged units as ok. H4 is FIXED: structure_aware chunking carries overlap_chars\n" +
    "  across boundaries. H2 is mitigated: the 12k source cap is now tunable via\n" +
    "  CONNECT_SOURCE_CONTEXT_CHARS. H1 is FIXED: parsers signal a lost batch\n" +
    "  (parse*ResponseDetailed.parseFailed), orchestrators log a coverage-shortfall warning\n" +
    "  and re-ask the lost refs exactly once before the fail-safe defaults apply. H3 is\n" +
    "  FIXED: the extraction gate now acts on orphan/dangling/no_relations with preset-driven\n" +
    "  thresholds (production blocks, starter warns) and strict pattern_violation blocks.\n" +
    "  Remaining open: M1/M3/M4/L1. See docs/reviews/connect-ingest-context.md §6; extend\n" +
    "  this script to ground new findings.",
);
}

void main();
