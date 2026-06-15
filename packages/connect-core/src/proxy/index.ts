/**
 * Verifying proxy — public surface (verify core only; no MCP, no keys, no network).
 * (planning/w2-1-phase-a-reference-integration.md, REC-PLAN-009.)
 */
export type {
  Mode1Source,
  Mode1Result,
  ClaimWithSources,
  EnvelopeStatus,
  AnswerAuthor,
  EnvelopeClaim,
  EnvelopeMeta,
  VerifiedEnvelope,
} from "./types.js";

export { parseMode1Result, retrieveQuotes, EVIDENCE_RETRIEVAL_SYSTEM } from "./extract-claims.js";

export { verifyEnvelope, deriveEnvelopeStatus, type VerifyEnvelopeArgs } from "./verify-envelope.js";

export {
  assertValidatorIndependent,
  ValidatorIndependenceError,
  makeFailClosedValidator,
  makeStubValidator,
  type RestormelValidator,
  type StubVerdict,
} from "./validator.js";
