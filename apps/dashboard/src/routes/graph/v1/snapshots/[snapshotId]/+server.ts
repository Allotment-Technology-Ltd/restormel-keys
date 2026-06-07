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
      error: "not_implemented",
      message: "Graph snapshots are not yet available. See restormel.dev/changelog for updates.",
    },
    { status: 501 }
  );
};
