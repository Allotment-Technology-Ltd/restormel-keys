/**
 * GET /graph/v1/snapshots/{snapshotId} — hosted snapshot read (Phase 2 stub).
 * Persisted workspace snapshots ship with the Graph operator hub (Phase 6).
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
  const snapshotId = params.snapshotId?.trim() ?? "";
  if (!snapshotId) {
    return json({ error: "invalid_snapshot_id" }, { status: 400 });
  }

  return json(
    {
      error: "snapshot_not_found",
      message:
        "Hosted graph snapshot storage is not available yet. Pass snapshot inline to POST /graph/v1/layout, or use in-app GraphData until Phase 6 operator persistence.",
      snapshotId,
    },
    { status: 404 }
  );
};
