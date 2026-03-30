import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
  const dbUrl = process.env.DATABASE_URL;
  const neonAuthUrl = process.env.NEON_AUTH_BASE_URL;
  const feedbackToken = process.env.FEEDBACK_GITHUB_TOKEN;
  const feedbackRepo = process.env.FEEDBACK_GITHUB_REPO ?? "Allotment-Technology-Ltd/restormel-keys";

  let dbStatus = "not_configured";
  if (dbUrl) {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(dbUrl);
      await sql`SELECT 1`;
      dbStatus = "ok";
    } catch (e) {
      dbStatus = `error: ${e instanceof Error ? e.message.slice(0, 80) : "unknown"}`;
    }
  }

  return json({
    status: "ok",
    service: "keys-dashboard",
    db: dbStatus,
    neonAuth: neonAuthUrl ? "configured" : "not_configured",
    feedbackGitHubToken: feedbackToken ? "configured" : "not_configured",
    feedbackGitHubRepo: feedbackRepo,
  });
};
