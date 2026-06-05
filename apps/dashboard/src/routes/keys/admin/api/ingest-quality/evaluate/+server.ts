import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { runIngestQualityEvaluation } from "$lib/server/connect/ingest-quality-thresholds";

export const config = { runtime: "nodejs22.x" as const };

type PostBody = { days?: number };

export const POST: RequestHandler = async ({ locals, request }) => {
  const u = locals.user;
  if (!u || u.authType !== "session" || !u.isServiceAdmin) {
    return json({ error: "forbidden" }, { status: 403 });
  }

  let body: PostBody = {};
  try {
    body = (await request.json()) as PostBody;
  } catch {
    // default days
  }

  const days = Math.min(90, Math.max(1, Number(body.days ?? 7) || 7));

  try {
    const result = await runIngestQualityEvaluation({
      days,
      createdByUserId: u.uid,
    });
    return json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "evaluate_failed";
    return json({ error: msg.slice(0, 280) }, { status: 500 });
  }
};
