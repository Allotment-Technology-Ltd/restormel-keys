/**
 * GET /connect/v1/graph/scorecard — per-graph trust scorecard (Stage 1.2).
 *
 * Returns the persistent quality scorecard for the workspace's active graph: kg-audit
 * trust score with factor breakdown, G2 metrics vs the published bar, EBV verification
 * states and % evidence-bound, embedding coverage, coverage gaps, last-verified-at.
 * Same Gateway-key / management-key / session auth as the other Knowledge v1 reads.
 */
import {
  CONNECT_API_CONTRACT_VERSION,
  type ConnectTrustScorecardResponse,
} from "@restormel/contracts";
import { authorizeKnowledgeWorkspaceRequest } from "./auth.js";
import { loadConnectTrustScorecard } from "$lib/server/connect/trust-scorecard-service";

export type TrustScorecardOutcome =
  | { ok: true; status: 200; body: ConnectTrustScorecardResponse }
  | { ok: false; status: number; body: Record<string, unknown> };

export async function handleGetTrustScorecard(args: {
  locals: App.Locals;
  workspaceId: string | null;
  projectId?: string;
}): Promise<TrustScorecardOutcome> {
  const workspaceId = args.workspaceId?.trim();
  if (!workspaceId) {
    return {
      ok: false,
      status: 400,
      body: { error: "invalid_request", message: "workspace_id is required" },
    };
  }

  const auth = await authorizeKnowledgeWorkspaceRequest({
    locals: args.locals,
    workspaceId,
    projectId: args.projectId,
  });
  if ("error" in auth && "status" in auth) {
    return { ok: false, status: auth.status, body: { error: auth.error, message: auth.message } };
  }

  try {
    const scorecard = await loadConnectTrustScorecard(auth.workspaceId);
    return {
      ok: true,
      status: 200,
      body: { contract_version: CONNECT_API_CONTRACT_VERSION, scorecard },
    };
  } catch {
    return {
      ok: false,
      status: 502,
      body: {
        error: "graph_store_error",
        message: "Could not read the configured graph store to compute the scorecard.",
      },
    };
  }
}
