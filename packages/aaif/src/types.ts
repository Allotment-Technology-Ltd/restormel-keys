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
