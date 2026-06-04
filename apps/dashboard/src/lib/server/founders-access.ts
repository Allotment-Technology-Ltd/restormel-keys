/**
 * Founders Circle email gate — dashboard access requires approved status.
 * Service operators bypass via service-admin resolution.
 */
import { env } from "$env/dynamic/private";
import { neon } from "@neondatabase/serverless";
import {
  emailImpliesServiceOwner,
  normalizeEmailForServiceOwnerMatch,
} from "$lib/server/service-admin";

export type FoundersAccessStatus = "pending" | "approved" | "rejected";

export type FoundersAccessRow = {
  email: string;
  status: FoundersAccessStatus;
  applicationId: string | null;
  applicantName: string | null;
  submittedAtMs: number | null;
  reviewedAtMs: number | null;
  reviewedByUserId: string | null;
  note: string | null;
};

function getSql() {
  const url = env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

export function normalizeFoundersEmail(email: string | null | undefined): string | null {
  return normalizeEmailForServiceOwnerMatch(email);
}

/**
 * @returns `true` / `false` when known; `null` when the DB lookup failed (gate should not block).
 */
export async function isFoundersCircleApproved(
  email: string | null | undefined
): Promise<boolean | null> {
  const normalized = normalizeFoundersEmail(email);
  if (!normalized) return false;
  if (emailImpliesServiceOwner(normalized)) return true;

  try {
    const sql = getSql();
    const rows = await sql`
      SELECT status FROM founders_circle_access
      WHERE email = ${normalized}
      LIMIT 1
    `;
    const row = rows[0] as { status?: string } | undefined;
    return row?.status === "approved";
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "42P01") return false;
    const msg = e instanceof Error ? e.message : "";
    if (msg) console.error("[founders-access] approval lookup failed:", msg.slice(0, 80));
    return null;
  }
}

export async function upsertFoundersAccessPending(params: {
  email: string;
  applicationId: string;
  applicantName?: string | null;
  submittedAtMs?: number;
}): Promise<void> {
  const normalized = normalizeFoundersEmail(params.email);
  if (!normalized) return;

  try {
    const sql = getSql();
    const submittedAt = params.submittedAtMs ?? Date.now();
    await sql`
      INSERT INTO founders_circle_access (
        email, status, application_id, applicant_name, submitted_at_ms
      )
      VALUES (
        ${normalized},
        'pending',
        ${params.applicationId},
        ${params.applicantName ?? null},
        ${submittedAt}
      )
      ON CONFLICT (email) DO UPDATE SET
        application_id = COALESCE(founders_circle_access.application_id, EXCLUDED.application_id),
        applicant_name = COALESCE(EXCLUDED.applicant_name, founders_circle_access.applicant_name),
        submitted_at_ms = COALESCE(founders_circle_access.submitted_at_ms, EXCLUDED.submitted_at_ms)
      WHERE founders_circle_access.status IN ('pending', 'rejected')
    `;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "42P01") return;
    const msg = e instanceof Error ? e.message : "";
    if (msg) console.error("[founders-access] upsert pending failed:", msg.slice(0, 80));
  }
}

export async function setFoundersAccessStatus(params: {
  email: string;
  status: FoundersAccessStatus;
  reviewerUserId: string;
  note?: string | null;
}): Promise<{ ok: true } | { ok: false; code: "not_found" | "db_error"; message: string }> {
  const normalized = normalizeFoundersEmail(params.email);
  if (!normalized) {
    return { ok: false, code: "not_found", message: "Invalid email." };
  }

  try {
    const sql = getSql();
    const now = Date.now();
    const rows = await sql`
      UPDATE founders_circle_access
      SET status = ${params.status},
          reviewed_at_ms = ${now},
          reviewed_by_user_id = ${params.reviewerUserId},
          note = ${params.note ?? null}
      WHERE email = ${normalized}
      RETURNING email
    `;
    if (!Array.isArray(rows) || rows.length === 0) {
      await sql`
        INSERT INTO founders_circle_access (
          email, status, reviewed_at_ms, reviewed_by_user_id, note, submitted_at_ms
        )
        VALUES (
          ${normalized},
          ${params.status},
          ${now},
          ${params.reviewerUserId},
          ${params.note ?? null},
          ${now}
        )
      `;
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Database error";
    console.error("[founders-access] set status failed:", msg.slice(0, 80));
    return { ok: false, code: "db_error", message: "Could not update access status." };
  }
}

export async function listFoundersAccessForAdmin(): Promise<FoundersAccessRow[]> {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT
        email,
        status,
        application_id AS "applicationId",
        applicant_name AS "applicantName",
        submitted_at_ms AS "submittedAtMs",
        reviewed_at_ms AS "reviewedAtMs",
        reviewed_by_user_id AS "reviewedByUserId",
        note
      FROM founders_circle_access
      ORDER BY
        CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
        submitted_at_ms DESC NULLS LAST
    `;
    return rows.map((r: Record<string, unknown>) => ({
      email: String(r.email ?? ""),
      status: String(r.status ?? "pending") as FoundersAccessStatus,
      applicationId: r.applicationId != null ? String(r.applicationId) : null,
      applicantName: r.applicantName != null ? String(r.applicantName) : null,
      submittedAtMs: r.submittedAtMs != null ? Number(r.submittedAtMs) : null,
      reviewedAtMs: r.reviewedAtMs != null ? Number(r.reviewedAtMs) : null,
      reviewedByUserId: r.reviewedByUserId != null ? String(r.reviewedByUserId) : null,
      note: r.note != null ? String(r.note) : null,
    }));
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "42P01") return [];
    const msg = e instanceof Error ? e.message : "";
    if (msg) console.error("[founders-access] list failed:", msg.slice(0, 80));
    return [];
  }
}

/** Service owners are always approved for founders gate bookkeeping. */
export async function syncFoundersAccessForServiceOwner(email: string | null | undefined): Promise<void> {
  const normalized = normalizeFoundersEmail(email);
  if (!normalized || !emailImpliesServiceOwner(normalized)) return;

  try {
    const sql = getSql();
    const now = Date.now();
    await sql`
      INSERT INTO founders_circle_access (email, status, submitted_at_ms, reviewed_at_ms, note)
      VALUES (${normalized}, 'approved', ${now}, ${now}, ${"bootstrap:service_owner_email"})
      ON CONFLICT (email) DO UPDATE SET
        status = 'approved',
        reviewed_at_ms = ${now},
        note = COALESCE(founders_circle_access.note, ${"bootstrap:service_owner_email"})
    `;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "42P01") return;
    const msg = e instanceof Error ? e.message : "";
    if (msg) console.error("[founders-access] service owner sync failed:", msg.slice(0, 80));
  }
}
