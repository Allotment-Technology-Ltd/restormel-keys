/**
 * POST /keys/dashboard/connect/proof/api/delta
 * Runs the quality-delta analysis (third BYOK LLM call) over both completed responses.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireConnectWorkspace } from "$lib/server/connect/workspace-cache";
import {
  resolveByokChatContext,
  resolveByokChatTarget,
} from "$lib/server/graph-comparison/byok-chat";
import { analyseQualityDelta } from "$lib/server/graph-comparison/analyseQualityDelta";

type DeltaBody = {
  question?: string;
  responseA?: string;
  responseB?: string;
  claims?: string[];
  routeId?: string;
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user || locals.user.authType !== "session") {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: DeltaBody;
  try {
    body = (await request.json()) as DeltaBody;
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const question = body.question?.trim() ?? "";
  if (!question) {
    return json({ error: "question is required" }, { status: 400 });
  }

  const workspace = await requireConnectWorkspace(locals, () =>
    Promise.resolve({ connectWorkspace: null }),
  );
  if (!workspace) {
    return json({ error: "Workspace not found" }, { status: 404 });
  }

  const userId = locals.user.uid;
  try {
    const ctx = await resolveByokChatContext({ workspaceId: workspace.id, userId });
    if (!ctx) {
      return json({ error: "No model route configured" }, { status: 400 });
    }
    const targetOutcome = await resolveByokChatTarget({ ctx, routeId: body.routeId });
    if (!targetOutcome.ok) {
      return json({ error: targetOutcome.error }, { status: 400 });
    }

    const delta = await analyseQualityDelta({
      target: targetOutcome.target,
      question,
      responseA: body.responseA ?? "",
      responseB: body.responseB ?? "",
      claims: Array.isArray(body.claims) ? body.claims.filter((c) => typeof c === "string") : [],
      signal: request.signal,
    });
    return json({ delta });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Quality analysis failed" },
      { status: 500 },
    );
  }
};
