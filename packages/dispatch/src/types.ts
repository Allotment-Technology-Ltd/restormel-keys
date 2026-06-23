export type DispatchTask = "chat" | "completion" | "embedding";

export type DispatchLatency = "low" | "balanced" | "high";

export type DispatchConstraints = {
  maxCost?: number;
  latency?: DispatchLatency;
  /**
   * Optional token volume hints (in millions) for deterministic cost estimation.
   * Used by Dispatch runtime helpers; the host should supply true usage when available.
   */
  tokens?: {
    inputTokensM?: number;
    outputTokensM?: number;
  };
};

export type DispatchUser = {
  id: string;
  plan?: string;
};

export type DispatchRoutingHints = {
  model?: string;
  provider?: string;
};

/**
 * Optional context aligned with Restormel dashboard `POST .../resolve` (workload/stage discovery, retry attempts).
 * The Dispatch package does **not** perform HTTP resolve; hosts pass resolved `routing` hints or use `@restormel/keys` `resolve()` and then call `executeDispatchRequest`.
 */
export type DispatchRoutingContext = {
  routeId?: string;
  workload?: string;
  stage?: string;
  attemptNumber?: number;
  previousFailure?: { selectedOrderIndex?: number | null; selectedStepId?: string | null };
  failureKind?: string;
};

/** Hypothetical tier outcome from dashboard simulate when `includeRoutingAttempts` is used (no LLM in Keys). */
export type DispatchRoutingAttemptOutcome =
  | "selected"
  | "blocked_by_policy"
  | "not_executable"
  | "not_selected";

/** One row of simulate `routingAttempts` — attach from HTTP response for typed hosts. */
export type DispatchRoutingAttempt = {
  stepId: string;
  orderIndex: number;
  providerType?: string | null;
  modelId?: string | null;
  hypotheticalOutcome?: DispatchRoutingAttemptOutcome;
};

/**
 * Optional mirror of dashboard resolve `stepChain` / simulate extras for strongly typed hosts.
 * Populate from `POST …/resolve` or `POST …/simulate` JSON; Dispatch does not perform HTTP resolve.
 */
export type DispatchRoutingPlanStep = {
  stepId: string;
  orderIndex: number;
  providerType?: string | null;
  modelId?: string | null;
  enabled?: boolean;
  selected?: boolean;
  label?: string | null;
  timeoutMs?: number | null;
  fallbackOn?: string | null;
  switchCriteria?: Record<string, unknown> | null;
  retryPolicy?: Record<string, unknown> | null;
  costPolicy?: Record<string, unknown> | null;
  notes?: string | null;
  advanceOn?: string[];
  retryOn?: string[];
};

export type DispatchRoutingPlan = {
  contractVersion?: string;
  routeId?: string;
  stepChain?: DispatchRoutingPlanStep[];
  routingAttempts?: DispatchRoutingAttempt[];
};

/** Machine-readable host / integration environment metadata (orthogonal to {@link DispatchRoutingContext}). */
export type DispatchIntegrationStackSchemaVersion = "1";

export type DispatchIntegrationStackComponent = {
  /** Stable id from `INTEGRATION_COMPONENT_IDS` in `./integration-stack-catalog.js`. */
  id: string;
  /** Optional role within the stack, e.g. `database`, `ci`, `gateway`. */
  role?: string;
};

export type DispatchIntegrationStack = {
  schemaVersion: DispatchIntegrationStackSchemaVersion;
  /** Optional preset id from `INTEGRATION_STACK_TEMPLATES` in `./integration-stack-catalog.js`. */
  templateId?: string;
  components: DispatchIntegrationStackComponent[];
};

export type DispatchRequest = {
  input: string;
  task?: DispatchTask;
  constraints?: DispatchConstraints;
  user?: DispatchUser;
  /**
   * Optional routing hints for Dispatch runtime execution.
   * - `model` / `provider` are used by the runtime helper to align routing and pricing.
   * - This does not change the Dispatch contract; it is optional.
   */
  routing?: DispatchRoutingHints;
  /** Pass-through for hosts that also use dashboard resolve; see {@link DispatchRoutingContext}. */
  routingContext?: DispatchRoutingContext;
  /** Optional typed copy of resolve/simulate chain rows for logging or downstream agents (see {@link DispatchRoutingPlan}). */
  routingPlan?: DispatchRoutingPlan;
  /**
   * Optional declaration of third-party products in the host environment (Neon, Vercel, gateways, etc.).
   * Use for logs, MCP agents, and analytics — not for Keys resolve behaviour.
   */
  integrationStack?: DispatchIntegrationStack;
  /**
   * Optional verified-context block: the Connect-sourced, EBV-verified claim envelopes
   * the host is feeding as grounded context to the model. Use this so routing/audit logs
   * and response consumers can see which verified claims shaped the model's context.
   *
   * Sourced from Connect v1 `POST /connect/v1/retrieve` or the MCP
   * `connect.retrieve_verified` tool. (Additive optional field — patch bump.)
   */
  verifiedContext?: DispatchVerifiedContextInput;
};

export type DispatchRouting = {
  reason: string;
};

// ---------------------------------------------------------------------------
// Verified-context envelope (Stage 4.3 of the verified-context roadmap)
//
// These types mirror the canonical shapes from @restormel/contracts
// (VerifiedClaimEnvelope, VerifiedClaimEvidence, VerifiedClaimJudge) but are
// re-declared here as plain TypeScript so @restormel/dispatch keeps ZERO runtime
// dependencies on Zod / @restormel/contracts. Consumers that need Zod schema
// validation should import from @restormel/contracts directly.
//
// Placement per docs/decisions/aaif-envelope-placement.md (Stage 4.3 update):
//   - DispatchRequest.verifiedContext  — verified claim envelopes the HOST is
//     providing as grounded context TO the model (sourced from Connect v1
//     retrieve, then threaded through the Dispatch request).
//   - DispatchResponse.verifiedContext — the same envelopes echoed back on the
//     response, so a non-MCP consumer (LangChain, LlamaIndex, etc.) can read
//     verification metadata from the response without a separate roundtrip to
//     the Connect API.
// ---------------------------------------------------------------------------

/** EBV verification state — mirrors VerifiedClaimState in @restormel/contracts. */
export type DispatchVerifiedClaimState =
  | "supported"
  | "inferred"
  | "unverified"
  | "contradicted"
  | "excluded";

/** Evidence span match precision — mirrors VerifiedClaimEvidence.match in @restormel/contracts. */
export type DispatchEvidenceMatch = "exact" | "normalized" | "fuzzy";

/**
 * One bound evidence span — mirrors VerifiedClaimEvidence in @restormel/contracts.
 * Deterministically re-checkable without a model (EBV Layer 1).
 */
export type DispatchVerifiedClaimEvidence = {
  /** Verbatim quote as bound at extraction time. */
  quote: string;
  /** [start, end) character offsets into the original source version text. */
  offsets: [number, number];
  /** Graph record reference of the cited source (e.g. `source:abc123`). Null when unavailable. */
  source_ref: string | null;
  /** SHA-256 (hex) of the source version the span was bound against. Null when unavailable. */
  source_hash: string | null;
  /** How strictly the quote matched: exact, normalized (whitespace/unicode folding), or fuzzy. */
  match?: DispatchEvidenceMatch | null;
};

/**
 * Attribution of the most recent span-scoped entailment verdict (EBV Layer 2).
 * Mirrors VerifiedClaimJudge in @restormel/contracts.
 */
export type DispatchVerifiedClaimJudge = {
  /** Judge model identifier when known (route-resolved); null otherwise. */
  model: string | null;
  /** Entailment prompt version the verdict was produced under. */
  prompt_version: number;
  /** Judge-reported confidence 0–1; null when the judge omitted it. */
  confidence: number | null;
  /** ISO 8601 timestamp the claim was judged. */
  at: string;
};

/**
 * One verified-claim envelope — mirrors VerifiedClaimEnvelope in @restormel/contracts.
 *
 * Carried on DispatchRequest.verifiedContext (context the host is feeding to the
 * model) and echoed on DispatchResponse.verifiedContext (so a LangChain / LlamaIndex
 * integration can inspect verification metadata from the response).
 */
export type DispatchVerifiedClaimEnvelope = {
  /** The claim as served: graph record id and text. */
  claim: { id: string; text: string };
  /** EBV verification state. Only `supported` claims carry a fully verified chain. */
  state: DispatchVerifiedClaimState;
  /**
   * Bound evidence spans (0–n). Empty when no evidence could be bound (the claim is then at
   * best `inferred`, never `supported`) or when the graph store omits the EBV fields.
   */
  evidence: DispatchVerifiedClaimEvidence[];
  /** Latest entailment judgment, when the claim has been judged (EBV Layer 2). */
  judge?: DispatchVerifiedClaimJudge;
  /** Human-readable source citation (the cited source's title). Null when unavailable. */
  citation: string | null;
  /**
   * Provenance trace link for the query that returned this claim. Fetch the full audit
   * document at `/connect/v1/traces/{trace_id}`. Null when trace persistence was unavailable.
   */
  trace_ref: string | null;
  /** Graph trust score 0–100 for this claim, when the graph supplies one. */
  trust_score?: number | null;
};

/**
 * Verified-context block carried on DispatchRequest: the host-supplied verified claim
 * envelopes that should be threaded into the model's context window. Sourced from
 * Connect v1 `retrieve` or the MCP `connect.retrieve_verified` tool.
 */
export type DispatchVerifiedContextInput = {
  /**
   * The verified claim envelopes to include as grounded context. The host is responsible
   * for serialising these into the model prompt; Dispatch carries them for routing/auditing.
   */
  claims: DispatchVerifiedClaimEnvelope[];
  /**
   * Optional trace reference for the Connect retrieval query that produced these claims,
   * for end-to-end audit linkage.
   */
  retrieval_trace_ref?: string | null;
};

/**
 * Verified-context block carried on DispatchResponse: the verified claim envelopes that were
 * included in the context window when generating this response. Non-MCP consumers
 * (LangChain, LlamaIndex, etc.) read this to inspect verification metadata without a
 * separate Connect API roundtrip.
 */
export type DispatchVerifiedContextOutput = {
  /** The verified claim envelopes that grounded this response. */
  claims: DispatchVerifiedClaimEnvelope[];
  /**
   * Per-state counts (keys: DispatchVerifiedClaimState values) for a quick gate check:
   * "were any non-supported claims included in context?".
   */
  summary?: Partial<Record<DispatchVerifiedClaimState, number>>;
  /**
   * Optional trace reference for the Connect retrieval query that produced these claims,
   * preserved from the request for audit linkage.
   */
  retrieval_trace_ref?: string | null;
};

export type DispatchResponse = {
  /** Text output for chat/completion, or a legacy string form for embeddings (often JSON of the vector). */
  output: string;
  /** When the task is `embedding`, numeric vector from the host (avoids JSON round-trips on `output`). */
  embedding?: number[];
  /** Explicit text alias for chat/completion; mirrors `output` for non-embedding tasks. */
  outputText?: string;
  provider: string;
  model: string;
  cost: number;
  routing: DispatchRouting;
  /**
   * Verified-context envelopes that were included in the model's context window for this
   * response. Populated by the host (via executeDispatchRequest options or post-processing) so
   * non-MCP consumers (LangChain / LlamaIndex / etc.) can inspect verification metadata
   * without a separate Connect API roundtrip.
   *
   * Only present when the host passed verified claims via the request or options.
   * (Additive optional field — patch bump per Dispatch semver discipline.)
   */
  verifiedContext?: DispatchVerifiedContextOutput;
};
