/**
 * Structured error shape returned by every tool. Tools never throw raw errors
 * back to the MCP client — they catch and return one of these so an agent can
 * reason about whether to retry, widen its query, or give up.
 */

export interface ToolError {
  error: string;
  code: string;
  recoverable: boolean;
  suggestion: string;
}

/** True when a value is a {@link ToolError} (so callers can branch on it). */
export function isToolError(value: unknown): value is ToolError {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    "code" in value &&
    "recoverable" in value &&
    "suggestion" in value
  );
}

/** Build a {@link ToolError}. */
export function toolError(
  error: string,
  code: string,
  recoverable: boolean,
  suggestion: string,
): ToolError {
  return { error, code, recoverable, suggestion };
}

/** A not-implemented error for orchestrator operations missing in the linked graphrag-core. */
export function notImplementedError(operation: string): ToolError {
  return toolError(
    "not_implemented",
    "RST_NOT_IMPLEMENTED",
    false,
    `Operation "${operation}" requires graphrag-core >= 0.2.0.`,
  );
}

/**
 * Translate an unknown thrown value into a structured {@link ToolError}.
 * Recognises the GraphStore "database unavailable" signal so agents know to retry.
 */
export function fromUnknown(err: unknown, operation: string): ToolError {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (
    lower.includes("unavailable") ||
    lower.includes("econnrefused") ||
    lower.includes("timeout") ||
    lower.includes("network")
  ) {
    return toolError(
      `Graph store unreachable during ${operation}: ${message}`,
      "RST_GRAPH_STORE_UNAVAILABLE",
      true,
      "Verify RESTORMEL_GRAPH_STORE_URL and credentials, and that the graph store is reachable. Retry once connectivity is restored.",
    );
  }
  return toolError(
    `${operation} failed: ${message}`,
    "RST_TOOL_EXECUTION",
    false,
    "Inspect the message; if it references the query or seed ids, adjust the inputs and retry.",
  );
}
