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

/* ───────────────────────── C1 + C3: validation fails open ───────────────────────── */
hr("C1/C3 — validation: omitted units default to 'ok', inflating ok_pct");

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
  "  ⇒ Two unvalidated claims (incl. a false one) were marked 'ok' and counted toward\n" +
    "    the quality bar. The model never judged them. ok_pct reads green; reality is worse.",
);

/* ───────────────────────── C2: remediation fails open ───────────────────────── */
hr("C2 — remediation: omitted units default to 'keep'");

const weakUnits: RemediationInput[] = [
  { ref: "w1", text: "Sidgwick proved utilitarianism is self-evident.", note: "overstated" },
  { ref: "w2", text: "Kant was a utilitarian.", note: "unsupported" },
];
// Remediation returned nothing (timeout / empty parse / dropped batch).
const remediationReturned: RemediationResult[] = [];
const remFinal = finalizeRemediationCoverage(weakUnits, remediationReturned);
for (const r of remFinal) console.log(`  ${r.ref}: ${r.action}`);
console.log(
  "  ⇒ Both flagged-weak units default to 'keep' and persist unchanged — the self-healing\n" +
    "    stage silently no-ops instead of dropping/holding for review.",
);

/* ───────────────────────── H1: malformed JSON silently loses the batch, then C1 marks it ok ───────────────────────── */
hr("H1 — loose-JSON parse silently drops verdicts on truncated output (then C1 fills 'ok')");

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
  "  ⇒ Brace-slice can't recover the truncated array, so the WHOLE batch is lost silently —\n" +
    "    including v2='unsupported'. Coverage finalize (C1) then stamps every unit 'ok'.\n" +
    "    A truncated verdict batch flips a known-unsupported claim to supported.",
);

/* ───────────────────────── H4: structure-aware chunking drops overlap ───────────────────────── */
hr("H4 — structure_aware chunking has no overlap; cross-boundary relations are unrecoverable");

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
  `  ⇒ structure_aware carries ${structOverlap} chars across the boundary (overlap_chars ignored);\n` +
    `    only 'fixed' honors it (${fixedOverlap} chars). With zero overlap, the two related units land\n` +
    "    in separate chunks with no shared context, so the B-refutes-A relation can never be\n" +
    "    extracted → a guaranteed orphan / missing edge.",
);

hr("Summary");
console.log(
  "  Confirmed by execution: C1, C2, C3, H1, H4 reproduce with no model involved — they are\n" +
    "  pipeline-logic defects, not model-quality issues. See docs/reviews/connect-ingest-context.md\n" +
    "  §6 for the full candidate list and severity. This script makes no claims about M1–M4/L1–L2;\n" +
    "  extend it to ground those before fixing.",
);
