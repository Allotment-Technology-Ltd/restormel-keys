/**
 * api-client — API (--api-key) inspect mode. POSTs to the hosted Restormel
 * inspect endpoint. The endpoint is not yet live, so a 404/501 (or a connection
 * failure) surfaces as a clear "not yet available — use --graph-store" message
 * rather than a raw HTTP error.
 */
import type { ResolvedConfig } from "../config.js";
import { buildPolicy } from "./orchestrator.js";
import type { InspectOptions, InspectResult } from "./types.js";

/** Raised when the API inspect endpoint is unavailable; carries the actionable hint. */
export class ApiInspectUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiInspectUnavailableError";
  }
}

const UNAVAILABLE_HINT =
  "API inspect endpoint is not yet available. Use --graph-store for direct local inspection.";

export async function runApiInspect(
  config: ResolvedConfig,
  query: string,
  options: InspectOptions,
): Promise<InspectResult> {
  if (!config.workspace) {
    throw new Error("No workspace configured. Pass --workspace or run: restormel auth login");
  }

  const policy = buildPolicy(options);
  const url = `${config.apiBase.replace(/\/$/, "")}/connect/v1/inspect`;
  const body = JSON.stringify({
    query,
    workspace_id: config.workspace,
    depth: options.depth,
    max_tokens: options.maxTokens,
    verification_policy: {
      include: policy.include,
      exclude_flagged: policy.excludeFlagged,
      ...(policy.minTrustScore !== undefined ? { min_trust_score: policy.minTrustScore } : {}),
    },
  });

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body,
    });
  } catch {
    throw new ApiInspectUnavailableError(UNAVAILABLE_HINT);
  }

  if (res.status === 404 || res.status === 501) {
    throw new ApiInspectUnavailableError(UNAVAILABLE_HINT);
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error("API rejected the credentials. Check your API key with: restormel auth status");
  }
  if (!res.ok) {
    throw new ApiInspectUnavailableError(UNAVAILABLE_HINT);
  }

  // Endpoint shape is provisional; if it ever ships it should return InspectResult JSON.
  return (await res.json()) as InspectResult;
}
