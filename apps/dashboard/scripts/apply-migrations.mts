/**
 * Dashboard migration runner CLI (Stage 1.7 — deploy-time migrations).
 *
 * Thin CLI wrapper around $lib/server/migration-runner logic.
 * Applies pending *.sql files from apps/dashboard/migrations/ in numeric order,
 * tracking each applied file in the schema_migrations table.
 *
 * Usage:
 *   pnpm --filter dashboard run migrate
 *
 * Requires DATABASE_URL (set by CI via DASHBOARD_DATABASE_URL_PROD, or from
 * .env.local in local dev — same env-loading order as other dashboard scripts).
 */

import "./load-dashboard-env.mjs";
import { getDb } from "../src/lib/server/db-adapter.ts";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runMigrations, type SqlFn } from "../src/lib/server/migration-runner.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("ERROR: DATABASE_URL is not set");
    process.exit(1);
  }

  // Dual-driver (P3a): getDb routes to neon-http for Neon URLs or a pg Pool for
  // plain Postgres. The migration runner's transaction callback + statement
  // splitting are driver-agnostic and work identically on both.
  const sql = getDb(dbUrl) as unknown as SqlFn;

  console.log("Dashboard migration runner (Stage 1.7)");
  console.log(`Migrations dir: ${MIGRATIONS_DIR}`);

  const { applied, skipped } = await runMigrations(
    sql,
    () => readdirSync(MIGRATIONS_DIR),
    (name) => readFileSync(join(MIGRATIONS_DIR, name), "utf-8"),
  );

  if (skipped.length > 0) {
    console.log(`  (skipped ${skipped.length} already-applied file(s))`);
  }
  if (applied.length === 0) {
    console.log("No new migrations to apply.");
  } else {
    console.log(`Applied ${applied.length} migration(s): ${applied.join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
