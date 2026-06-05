#!/usr/bin/env node
/**
 * Export knowledge_review_signals rows for threshold evaluation (last N days).
 * Requires DATABASE_URL (Neon Postgres).
 */
import { neon } from "@neondatabase/serverless";

/**
 * @param {string} databaseUrl
 * @param {number} days
 */
export async function exportReviewSignals(databaseUrl, days = 7) {
  const sql = neon(databaseUrl);
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const rows = await sql`
    SELECT
      verdict_delta,
      pack_archetype,
      ai_flag_theme,
      human_note_theme,
      action_type
    FROM knowledge_review_signals
    WHERE created_at >= ${since}
  `;
  return rows;
}

async function main() {
  const days = Number(process.env.SIGNAL_DAYS ?? process.argv[2] ?? 7);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const rows = await exportReviewSignals(databaseUrl, days);
  process.stdout.write(JSON.stringify(rows, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
