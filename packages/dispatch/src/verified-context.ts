/**
 * Verified-context runtime helpers for Dispatch (Stage 4.3).
 *
 * These helpers let non-MCP agent frameworks (LangChain, LlamaIndex, custom
 * orchestrators) work with the verified-claim envelopes carried on Dispatch
 * request/response payloads without importing @restormel/contracts or Zod.
 *
 * Placement: docs/decisions/aaif-envelope-placement.md (Stage 4.3 update).
 */
import type {
  DispatchVerifiedClaimEnvelope,
  DispatchVerifiedClaimState,
  DispatchVerifiedContextInput,
  DispatchVerifiedContextOutput,
  DispatchRequest,
  DispatchResponse,
} from "./types.js";

// ---------------------------------------------------------------------------
// Per-state summary helpers
// ---------------------------------------------------------------------------

/**
 * Build a per-state count summary from an array of verified claim envelopes.
 * Use this to produce the `summary` field on DispatchVerifiedContextOutput without
 * iterating the claims array yourself.
 *
 * @example
 * const summary = summariseVerifiedClaims(claims);
 * // { supported: 3, inferred: 1, unverified: 0 }
 */
export function summariseVerifiedClaims(
  claims: DispatchVerifiedClaimEnvelope[],
): Partial<Record<DispatchVerifiedClaimState, number>> {
  const counts: Partial<Record<DispatchVerifiedClaimState, number>> = {};
  for (const c of claims) {
    counts[c.state] = (counts[c.state] ?? 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Envelope accessors
// ---------------------------------------------------------------------------

/**
 * Return only the claims with a given verification state from a context block.
 *
 * @example
 * const supported = filterClaimsByState(response.verifiedContext, "supported");
 */
export function filterClaimsByState(
  ctx: DispatchVerifiedContextInput | DispatchVerifiedContextOutput | undefined | null,
  state: DispatchVerifiedClaimState,
): DispatchVerifiedClaimEnvelope[] {
  if (!ctx) return [];
  return ctx.claims.filter((c) => c.state === state);
}

/**
 * True if every claim in the context block has `state === "supported"`.
 * Use this as a quick gate before including context in a production response.
 *
 * @example
 * if (!allClaimsSupported(request.verifiedContext)) {
 *   throw new Error("context contains non-supported claims");
 * }
 */
export function allClaimsSupported(
  ctx: DispatchVerifiedContextInput | DispatchVerifiedContextOutput | undefined | null,
): boolean {
  if (!ctx || ctx.claims.length === 0) return false;
  return ctx.claims.every((c) => c.state === "supported");
}

/**
 * True if any claim in the context block has `state === "contradicted"`.
 */
export function hasContradictedClaims(
  ctx: DispatchVerifiedContextInput | DispatchVerifiedContextOutput | undefined | null,
): boolean {
  if (!ctx) return false;
  return ctx.claims.some((c) => c.state === "contradicted");
}

// ---------------------------------------------------------------------------
// Context builders
// ---------------------------------------------------------------------------

/**
 * Build a DispatchVerifiedContextInput from an array of verified claim envelopes.
 * Use after fetching claims from Connect v1 `retrieve` or the MCP
 * `connect.retrieve_verified` tool before embedding them in a DispatchRequest.
 *
 * @example
 * const connectClaims = await connectClient.retrieve(query);
 * const request: DispatchRequest = {
 *   input: buildPromptWithClaims(connectClaims),
 *   verifiedContext: buildVerifiedContextInput(connectClaims, traceRef),
 * };
 */
export function buildVerifiedContextInput(
  claims: DispatchVerifiedClaimEnvelope[],
  retrievalTraceRef?: string | null,
): DispatchVerifiedContextInput {
  return {
    claims,
    ...(retrievalTraceRef != null ? { retrieval_trace_ref: retrievalTraceRef } : {}),
  };
}

/**
 * Build a DispatchVerifiedContextOutput from an array of verified claim envelopes,
 * computing the summary automatically.
 *
 * Use this inside a host's generate callback or post-processing step to attach
 * verification metadata to the Dispatch response.
 *
 * @example
 * const response = await executeDispatchRequest(request, keys, {
 *   generate: async (ctx) => {
 *     const output = await myLlm(ctx.request.input);
 *     return output;
 *   },
 * });
 * response.verifiedContext = buildVerifiedContextOutput(claims, request.verifiedContext?.retrieval_trace_ref);
 */
export function buildVerifiedContextOutput(
  claims: DispatchVerifiedClaimEnvelope[],
  retrievalTraceRef?: string | null,
): DispatchVerifiedContextOutput {
  return {
    claims,
    summary: summariseVerifiedClaims(claims),
    ...(retrievalTraceRef != null ? { retrieval_trace_ref: retrievalTraceRef } : {}),
  };
}

// ---------------------------------------------------------------------------
// Extraction helpers (read verification fields from request / response)
// ---------------------------------------------------------------------------

/**
 * Extract the verified context input block from a Dispatch request, or `undefined`
 * if the request carries no verified context.
 */
export function getRequestVerifiedContext(
  request: DispatchRequest,
): DispatchVerifiedContextInput | undefined {
  return request.verifiedContext;
}

/**
 * Extract the verified context output block from a Dispatch response, or `undefined`
 * if the response carries no verified context.
 */
export function getResponseVerifiedContext(
  response: DispatchResponse,
): DispatchVerifiedContextOutput | undefined {
  return response.verifiedContext;
}

/**
 * Convenience: extract only the supported claim envelopes from a Dispatch response.
 * Returns an empty array when the response carries no verified context or when no
 * claims are supported.
 */
export function getSupportedClaims(response: DispatchResponse): DispatchVerifiedClaimEnvelope[] {
  return filterClaimsByState(response.verifiedContext, "supported");
}
