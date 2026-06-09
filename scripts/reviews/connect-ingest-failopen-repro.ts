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
  type ValidationInput,
  type UnitValidation,
} from "../../packages/connect-core/src/ingest/validation.js";
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

/* ───────────────────────── H1: malformed JSON still loses the batch, but C1 now fails it safe ───────────────────────── */
hr("H1 — loose-JSON parse drops verdicts on truncated output (coverage gap now fails safe)");

// A response truncated mid-array (max_tokens / network cut). Note the dangling object.
const truncated =
  '{"results":[{"ref":"v1","status":"ok"},{"ref":"v2","status":"unsupported"},{"ref":"v3","stat';
const parsed = parseValidationResponse(truncated);
console.log(`  Model intended verdicts for v1..v3, but the response was truncated at v3.`);
console.log(`  parseValidationResponse returned ${parsed.length} verdict(s) — no error raised.`);
// What the pipeline then persists for the units it asked about:
const h1Units: ValidationInput[] = [
  { ref: "v1", text: "..." },
  { ref: "v2", text: "..." },
  { ref: "v3", text: "..." },
];
const h1Final = finalizeValidationCoverage(h1Units, parsed);
console.log(`  After finalize, persisted statuses: ${h1Final.map((v) => `${v.ref}=${v.status}`).join(", ")}`);
console.log(
  "  ⇒ Brace-slice still can't recover the truncated array, so the batch is lost — but\n" +
    "    coverage finalize now stamps every lost unit 'weak' (coverage_gap), not 'ok'.\n" +
    "    A truncated verdict batch no longer flips a known-unsupported claim to supported;\n" +
    "    the silent-parse-loss itself (H1) remains open as a separate finding.",
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
    "  CONNECT_SOURCE_CONTEXT_CHARS. H1's consequence is defused by C1/C2 (lost batches fail\n" +
    "  safe), but the silent loose-JSON parse loss itself remains open, as do H3/M1/M3/M4/L1.\n" +
    "  See docs/reviews/connect-ingest-context.md §6; extend this script to ground new findings.",
);
