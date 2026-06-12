/**
 * POST /keys/dashboard/prove/api/suggest
 * Returns up to 5 suggested questions generated from the workspace graph (cached per run).
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireConnectWorkspace } from "$lib/server/connect/workspace-cache";
import { resolveByokChatContext } from "$lib/server/graph-comparison/byok-chat";
import { suggestQuestions } from "$lib/server/graph-comparison/suggestQuestions";
import { sessionUser } from "$lib/server/session-user";

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = sessionUser(locals);
  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  let cacheKey = "";
  try {
    const body = (await request.json()) as { cacheKey?: string };
    cacheKey = typeof body.cacheKey === "string" ? body.cacheKey : "";
  } catch {
    /* empty body is fine */
  }

  const workspace = await requireConnectWorkspace(locals, () =>
    Promise.resolve({ connectWorkspace: null }),
  );
  if (!workspace) {
    return json({ error: "Workspace not found" }, { status: 404 });
  }

  const userId = user.uid;
  try {
    const ctx = await resolveByokChatContext({ workspaceId: workspace.id, userId });
    const questions = await suggestQuestions({
      workspaceId: workspace.id,
      userId,
      projectId: ctx?.projectId ?? null,
      cacheKey: cacheKey || `${workspace.id}:default`,
    });
    return json({ questions });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Could not generate suggestions" },
      { status: 500 },
    );
  }
};
