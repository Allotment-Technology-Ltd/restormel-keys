/**
 * Operator email grants — admins can promote emails before first sign-in.
 */
import { env } from "$env/dynamic/private";
import { neon } from "@neondatabase/serverless";
import { normalizeEmailForServiceOwnerMatch } from "$lib/server/service-admin";

export type ServiceAdminEmailRow = {
  email: string;
  createdAtMs: number;
  createdByUserId: string | null;
  note: string | null;
};

function getSql() {
  const url = env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

const MIGRATION_HINT =
  "The service_admin_emails table is missing. Apply dashboard migrations: bash scripts/apply-dashboard-migrations.sh (see docs/runbooks/dashboard-postgres-migrations.md).";

function isMissingTableError(e: unknown): boolean {
  return (e as { code?: string })?.code === "42P01";
}

export async function isServiceAdminEmailInDb(email: string | null | undefined): Promise<boolean> {
  const normalized = normalizeEmailForServiceOwnerMatch(email);
  if (!normalized) return false;
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT 1 AS ok FROM service_admin_emails WHERE email = ${normalized} LIMIT 1
    `;
    return Array.isArray(rows) && rows.length > 0;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "42P01") return false;
    const msg = e instanceof Error ? e.message : "";
    if (msg) console.error("[service-admin-emails] lookup failed:", msg.slice(0, 80));
    return false;
  }
}

export async function listServiceAdminEmails(): Promise<ServiceAdminEmailRow[]> {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT
        email,
        created_at_ms AS "createdAtMs",
        created_by_user_id AS "createdByUserId",
        note
      FROM service_admin_emails
      ORDER BY created_at_ms DESC
    `;
    return rows.map((r: Record<string, unknown>) => ({
      email: String(r.email ?? ""),
      createdAtMs: Number(r.createdAtMs ?? 0),
      createdByUserId: r.createdByUserId != null ? String(r.createdByUserId) : null,
      note: r.note != null ? String(r.note) : null,
    }));
  } catch (e) {
    if (isMissingTableError(e)) return [];
    const msg = e instanceof Error ? e.message : "";
    if (msg) console.error("[service-admin-emails] list failed:", msg.slice(0, 80));
    return [];
  }
}

/** False when migration 042 (service_admin_emails) has not been applied. */
export async function isServiceAdminEmailsTableReady(): Promise<boolean> {
  try {
    const sql = getSql();
    await sql`SELECT 1 FROM service_admin_emails LIMIT 0`;
    return true;
  } catch (e) {
    if (isMissingTableError(e)) return false;
    return false;
  }
}

export async function addServiceAdminEmail(params: {
  email: string;
  createdByUserId: string;
  note?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const normalized = normalizeEmailForServiceOwnerMatch(params.email);
  if (!normalized) return { ok: false, message: "Enter a valid email address." };

  try {
    const sql = getSql();
    const now = Date.now();
    await sql`
      INSERT INTO service_admin_emails (email, created_at_ms, created_by_user_id, note)
      VALUES (${normalized}, ${now}, ${params.createdByUserId}, ${params.note ?? null})
      ON CONFLICT (email) DO NOTHING
    `;
    return { ok: true };
  } catch (e) {
    if (isMissingTableError(e)) return { ok: false, message: MIGRATION_HINT };
    const msg = e instanceof Error ? e.message : "";
    if (msg) console.error("[service-admin-emails] insert failed:", msg.slice(0, 120));
    return { ok: false, message: "Could not save operator email." };
  }
}

export async function removeServiceAdminEmail(email: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const normalized = normalizeEmailForServiceOwnerMatch(email);
  if (!normalized) return { ok: false, message: "Invalid email." };

  try {
    const sql = getSql();
    await sql`DELETE FROM service_admin_emails WHERE email = ${normalized}`;
    return { ok: true };
  } catch (e) {
    if (isMissingTableError(e)) return { ok: false, message: MIGRATION_HINT };
    const msg = e instanceof Error ? e.message : "";
    if (msg) console.error("[service-admin-emails] delete failed:", msg.slice(0, 120));
    return { ok: false, message: "Could not remove operator email." };
  }
}
