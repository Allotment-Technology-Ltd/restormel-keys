/**
 * Excluded-cheap-tier slot — PERMANENT EXPLICIT STUB (restormel-verification-engineering §4
 * resolution on the small-cross-encoder cheap tier; REC-GOV-022; D-2026-07-02-1 scope bound).
 *
 * WHY A STUB, NOT A TIER: 2026 research names small fine-tuned cross-encoder entailment
 * checkers the ideal cheap tier, BUT the two concrete candidate checkpoints for that slot are
 * excluded and at-risk does NOT reopen them (rollback cannot cure a licence breach):
 *   - one is BLOCKED (custom non-commercial licence),
 *   - one is AMBIGUOUS (excluded until counsel clears).
 * See REC-GOV-022's verdict tables (planning/, prose) for the specific model names — this
 * code file names none of them, so the licensing-enforcement grep over code/config stays
 * binary-clean. The *architecture pattern* (small fine-tuned cross-encoder, claim->span
 * entailment) carries; the checkpoints do not. The CLEARED cheap tier is HHEM-2.1-Open
 * (hhem-prefilter.ts).
 *
 * This file wires NO model and references NO excluded model id in code/config. It exists so
 * the slot is VISIBLE and DELIBERATE rather than a silent omission, and so the cascade can
 * assert the stub never decides a claim.
 *
 * CONTRACT: a stub tier has `isStub: true`, returns "unverifiable" with `confidence: null`
 * and an exclusion note, and the cascade SKIPS it (records the skip) rather than counting its
 * output. Should this ever be swapped for a real CLEARED cheap checker, it becomes a normal
 * tier and this file is deleted (clean removability, D-2026-07-02-1).
 */
import type { VerifierRequest, VerifierResult, VerifierTier } from "../verifier-port.js";

export function createExcludedCheapSlotStub(): VerifierTier {
  return {
    id: "excluded-cheap-tier-slot-stub",
    modelFamily: "none",
    modelVersion: "stub",
    configHash: "stub",
    promptTemplateVersion: "stub",
    isStub: true,
    async verify(request: VerifierRequest): Promise<VerifierResult> {
      return {
        ref: request.ref,
        verdict: "unverifiable",
        confidence: null,
        note:
          "STUB: the small-cross-encoder cheap-tier candidate checkpoints are excluded " +
          "(one BLOCKED, one AMBIGUOUS per REC-GOV-022). Cleared cheap tier is HHEM-2.1-Open. " +
          "This stub never decides.",
      };
    },
  };
}
