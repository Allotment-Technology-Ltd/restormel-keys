/**
 * EBV Layer 1 — deterministic evidence binding repro (no LLM keys required).
 *
 * Demonstrates the four properties the ADR (docs/decisions/evidence-bound-verification.md)
 * claims for Layer 1, using only pure functions from @restormel/connect-core:
 *   1. a claim's quote binds to offsets in its cited source version;
 *   2. the binding re-verifies deterministically (anyone can re-run it, no model);
 *   3. tampering — source change (hash) or text drift at the offsets — fails CLOSED;
 *   4. misattribution — a quote true of source B cited against source A — fails to bind,
 *      with no judgment involved (the structural fix the efficacy benchmark motivates).
 *
 * Run: pnpm exec tsx scripts/reviews/ebv-layer1-repro.ts
 */
import {
  bindEvidenceSpan,
  contentHash,
  verifyEvidenceSpan,
} from "../../packages/connect-core/src/ingest/evidence-binding.js";
import { deriveLayer1State } from "../../packages/connect-core/src/ingest/verification-state.js";

function hr(title: string): void {
  console.log("\n" + "═".repeat(72) + "\n" + title + "\n" + "─".repeat(72));
}

const sourceA =
  "Classical utilitarianism begins with Jeremy Bentham. Every person's happiness counts " +
  "equally in the aggregate. Mill distinguished higher pleasures from lower, bodily pleasures.";
const sourceB =
  "For Kant, an action has moral worth when it is done from duty rather than from inclination. " +
  "The humanity formulation directs agents to treat humanity always as an end.";

async function main() {
  const hashA = await contentHash(sourceA);
  const hashB = await contentHash(sourceB);

  hr("1. Binding: a verbatim quote binds to offsets in the cited source version");
  const quote = "Every person's happiness counts equally in the aggregate.";
  const binding = bindEvidenceSpan({ quote, sourceText: sourceA, sourceHash: hashA });
  if (binding.status !== "bound") throw new Error("expected bound");
  console.log(`  quote   : "${quote}"`);
  console.log(`  bound   : [${binding.span.start}, ${binding.span.end}) match=${binding.span.match}`);
  console.log(`  hash    : ${binding.span.source_hash.slice(0, 16)}…`);
  console.log(`  slice   : "${sourceA.slice(binding.span.start, binding.span.end)}"`);

  hr("2. Re-verification: deterministic, model-free, repeatable");
  const recheck = verifyEvidenceSpan({ span: binding.span, sourceText: sourceA, sourceHash: hashA });
  console.log(`  re-check against unchanged source: ${JSON.stringify(recheck)}`);
  console.log("  ⇒ anyone holding the source version can re-run this — no LLM, no trust required.");

  hr("3. Tamper-evidence: source change or text drift fails CLOSED");
  const editedA = sourceA.replace("counts equally", "counts unequally");
  const hashEdited = await contentHash(editedA);
  console.log(
    `  source edited, hash check     : ${JSON.stringify(
      verifyEvidenceSpan({ span: binding.span, sourceText: editedA, sourceHash: hashEdited }),
    )}`,
  );
  console.log(
    `  same hash claimed, text drift : ${JSON.stringify(
      verifyEvidenceSpan({ span: binding.span, sourceText: editedA, sourceHash: hashA }),
    )}`,
  );
  console.log("  ⇒ a claim's 'supported' status cannot silently survive a source change.");

  hr("4. Misattribution fails structurally (no judge involved)");
  const misattributed = bindEvidenceSpan({
    quote: "an action has moral worth when it is done from duty rather than from inclination",
    sourceText: sourceA, // cited against the WRONG source
    sourceHash: hashA,
  });
  console.log(`  quote from source B cited against source A → ${JSON.stringify(misattributed)}`);
  const bindsToB = bindEvidenceSpan({
    quote: "an action has moral worth when it is done from duty rather than from inclination",
    sourceText: sourceB,
    sourceHash: hashB,
  });
  console.log(
    `  same quote against its TRUE source → status=${bindsToB.status}` +
      (bindsToB.status === "bound" ? ` match=${bindsToB.span.match}` : ""),
  );
  console.log(
    "  ⇒ the efficacy benchmark showed the legacy validator affirms 100% of claims whose\n" +
      "    evidence it cannot see; Layer 1 makes the same failure impossible by construction.",
  );

  hr("5. Interim state derivation (until Layer 2 entailment lands in Stage 1.0d)");
  console.log(`  bound + legacy ok        → ${deriveLayer1State({ binding, legacyVerdict: "ok" })}`);
  console.log(`  unbound + legacy ok      → ${deriveLayer1State({ binding: misattributed, legacyVerdict: "ok" })}`);
  console.log(`  bound + legacy weak      → ${deriveLayer1State({ binding, legacyVerdict: "weak" })}`);
  console.log(`  any + omitted            → ${deriveLayer1State({ binding, legacyVerdict: "omitted" })}`);
  console.log("  ⇒ no span in the cited source ⇒ never 'supported', whatever the judge said.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
