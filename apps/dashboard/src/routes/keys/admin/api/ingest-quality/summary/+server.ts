import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { checkIngestQualityG2Gate } from "$lib/server/connect/ingest-quality-apply";
import { summarizeReviewSignals } from "$lib/server/connect/ingest-quality-thresholds";
import { listIngestQualityRuns, listReviewSignalsForEval } from "$lib/server/neon";
import { sessionUser } from "$lib/server/session-user";

export const config = { runtime: "nodejs22.x" as const };

const DEFAULT_DAYS = 7;

export const GET: RequestHandler = async ({ locals, url }) => {
  const u = sessionUser(locals);
  if (!u || !u.isServiceAdmin) {
    return json({ error: "forbidden" }, { status: 403 });
  }

  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") ?? DEFAULT_DAYS) || DEFAULT_DAYS));

  try {
    const [rows, runs, g2] = await Promise.all([
      listReviewSignalsForEval({ days }),
      listIngestQualityRuns({ limit: 10 }),
      checkIngestQualityG2Gate(),
    ]);
    const summary = summarizeReviewSignals(rows, days);
    const latestRun = runs[0] ?? null;
    return json({ summary, latestRun, runs, g2 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "summary_failed";
    return json({ error: msg.slice(0, 280) }, { status: 500 });
  }
};
