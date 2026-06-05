import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { applyIngestQualityCalibration } from "$lib/server/connect/ingest-quality-apply";

export const config = { runtime: "nodejs22.x" as const };

type PostBody = { runId?: string; confirm?: boolean };

export const POST: RequestHandler = async ({ locals, request }) => {
  const u = locals.user;
  if (!u || u.authType !== "session" || !u.isServiceAdmin) {
    return json({ error: "forbidden" }, { status: 403 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const runId = String(body.runId ?? "").trim();
  if (!runId) {
    return json({ error: "runId required" }, { status: 400 });
  }
  if (body.confirm !== true) {
    return json({ error: "confirm_required", message: "Set confirm: true to apply calibration." }, { status: 400 });
  }

  const outcome = await applyIngestQualityCalibration({ runId });
  if (!outcome.ok) {
    return json(
      { error: outcome.message, g2: outcome.g2 ?? undefined },
      { status: outcome.status },
    );
  }
  return json({ ok: true, result: outcome.result, g2: outcome.g2 });
};
