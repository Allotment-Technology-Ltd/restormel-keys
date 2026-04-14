export type AAIFTask = "chat" | "completion" | "embedding";

export type AAIFLatency = "low" | "balanced" | "high";

export type AAIFConstraints = {
  maxCost?: number;
  latency?: AAIFLatency;
  /**
   * Optional token volume hints (in millions) for deterministic cost estimation.
   * Used by AAIF runtime helpers; the host should supply true usage when available.
   */
  tokens?: {
    inputTokensM?: number;
    outputTokensM?: number;
  };
};

export type AAIFUser = {
  id: string;
  plan?: string;
};

export type AAIFRoutingHints = {
  model?: string;
  provider?: string;
};

/**
 * Optional context aligned with Restormel dashboard `POST .../resolve` (workload/stage discovery, retry attempts).
 * The AAIF package does **not** perform HTTP resolve; hosts pass resolved `routing` hints or use `@restormel/keys` `resolve()` and then call `executeAAIFRequest`.
 */
export type AAIFRoutingContext = {
  routeId?: string;
  workload?: string;
  stage?: string;
  attemptNumber?: number;
  previousFailure?: { selectedOrderIndex?: number | null; selectedStepId?: string | null };
  failureKind?: string;
};

/** Hypothetical tier outcome from dashboard simulate when `includeRoutingAttempts` is used (no LLM in Keys). */
export type AAIFRoutingAttemptOutcome =
  | "selected"
  | "blocked_by_policy"
  | "not_executable"
  | "not_selected";

/** One row of simulate `routingAttempts` — attach from HTTP response for typed hosts. */
export type AAIFRoutingAttempt = {
  stepId: string;
  orderIndex: number;
  providerType?: string | null;
  modelId?: string | null;
  hypotheticalOutcome?: AAIFRoutingAttemptOutcome;
};

/**
 * Optional mirror of dashboard resolve `stepChain` / simulate extras for strongly typed hosts.
 * Populate from `POST …/resolve` or `POST …/simulate` JSON; AAIF does not perform HTTP resolve.
 */
export type AAIFRoutingPlanStep = {
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

export type AAIFRoutingPlan = {
  contractVersion?: string;
  routeId?: string;
  stepChain?: AAIFRoutingPlanStep[];
  routingAttempts?: AAIFRoutingAttempt[];
};

/** Machine-readable host / integration environment metadata (orthogonal to {@link AAIFRoutingContext}). */
export type AAIFIntegrationStackSchemaVersion = "1";

export type AAIFIntegrationStackComponent = {
  /** Stable id from `INTEGRATION_COMPONENT_IDS` in `./integration-stack-catalog.js`. */
  id: string;
  /** Optional role within the stack, e.g. `database`, `ci`, `gateway`. */
  role?: string;
};

export type AAIFIntegrationStack = {
  schemaVersion: AAIFIntegrationStackSchemaVersion;
  /** Optional preset id from `INTEGRATION_STACK_TEMPLATES` in `./integration-stack-catalog.js`. */
  templateId?: string;
  components: AAIFIntegrationStackComponent[];
};

export type AAIFRequest = {
  input: string;
  task?: AAIFTask;
  constraints?: AAIFConstraints;
  user?: AAIFUser;
  /**
   * Optional routing hints for AAIF runtime execution.
   * - `model` / `provider` are used by the runtime helper to align routing and pricing.
   * - This does not change the AAIF contract; it is optional.
   */
  routing?: AAIFRoutingHints;
  /** Pass-through for hosts that also use dashboard resolve; see {@link AAIFRoutingContext}. */
  routingContext?: AAIFRoutingContext;
  /** Optional typed copy of resolve/simulate chain rows for logging or downstream agents (see {@link AAIFRoutingPlan}). */
  routingPlan?: AAIFRoutingPlan;
  /**
   * Optional declaration of third-party products in the host environment (Neon, Vercel, gateways, etc.).
   * Use for logs, MCP agents, and analytics — not for Keys resolve behaviour.
   */
  integrationStack?: AAIFIntegrationStack;
};

export type AAIFRouting = {
  reason: string;
};

export type AAIFResponse = {
  /** Text output for chat/completion, or a legacy string form for embeddings (often JSON of the vector). */
  output: string;
  /** When the task is `embedding`, numeric vector from the host (avoids JSON round-trips on `output`). */
  embedding?: number[];
  /** Explicit text alias for chat/completion; mirrors `output` for non-embedding tasks. */
  outputText?: string;
  provider: string;
  model: string;
  cost: number;
  routing: AAIFRouting;
};
