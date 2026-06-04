/**
 * POST /keys/v1/projects/{projectId}/resolve — public Keys REST (Phase 1).
 * Delegates to the dashboard resolve handler; path param `projectId` maps to legacy `id`.
 */
import type { RequestHandler } from "./$types";
import { POST as dashboardResolvePost } from "../../../../dashboard/api/projects/[id]/resolve/+server";

export const POST: RequestHandler = async (event) =>
  dashboardResolvePost({
    ...event,
    params: { id: event.params.projectId },
  } as unknown as Parameters<typeof dashboardResolvePost>[0]);
