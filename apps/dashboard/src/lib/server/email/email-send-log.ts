/**
 * Transactional email SEND OBSERVABILITY (REC-PLAN-028 / founders-approval no-send incident).
 *
 * Records every transactional send — category, MASKED recipient, success/failure + a short
 * error reason, timestamp, provider message-id — to the durable `email_send_log` table, and
 * exposes the last founders-approval send status for the admin Founders UI.
 *
 * SECURITY / PII: recipients are MASKED before they ever touch the DB or logs (the security
 * baseline forbids raw Founders Circle addresses in logs). `error_reason` is a short, sanitised
 * code/name only — never a raw SMTP message (which can echo the recipient). The DB access
 * mirrors founders-access.ts: fail-safe, never throws into the caller (a logging failure must
 * not break a send, and a send result must always be best-effort recorded fail-open).
 */
import { env } from "$env/dynamic/private";
import { getDb } from "$lib/server/db-adapter";
import { normalizeEmailForServiceOwnerMatch } from "$lib/server/service-admin";
import { sendMail, type MailEnvelope } from "./send-mail";

/** Logical category for a send — also the `email_send_log.category` value. */
export type EmailSendCategory =
  | "founders_approved"
  | "founders_rejected"
  | "founders_deleted"
  | "founders_apply_confirmation"
  | "founders_admin_notify"
  | "verification"
  | "password_reset"
  | "security_alert"
  | "other";

export type EmailSendOutcome = {
  category: EmailSendCategory;
  /** Raw recipient — masked HERE before any persistence/log. Never stored raw. */
  recipient: string;
  /** Correlation key (e.g. normalised founders applicant email) — masking-independent lookup. */
  contextKey?: string | null;
  success: boolean;
  /** Provider message-id (opaque) on success. */
  messageId?: string | null;
  /** Short, pre-sanitised error code/name on failure (caller must NOT pass a raw SMTP message). */
  errorReason?: string | null;
  sentAtMs?: number;
};

/** Last recorded send for a founders applicant, for the admin UI status line. */
export type FoundersSendStatus = {
  category: EmailSendCategory;
  success: boolean;
  messageId: string | null;
  errorReason: string | null;
  sentAtMs: number;
};

function getSql() {
  const url = env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return getDb(url);
}

/**
 * Mask an email for storage/display: keep the first two chars of the local part and the
 * first char of each domain label, star the rest. Pure + dependency-free → unit-testable.
 *   "ada.lovelace@example.com" → "ad***@e***.com"
 *   "x@y.io"                   → "x***@y***.io"
 */
export function maskEmail(email: string | null | undefined): string {
  const raw = (email ?? "").trim();
  if (!raw || !raw.includes("@")) return "***";
  const at = raw.lastIndexOf("@");
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  const maskLocal = local.length <= 2 ? `${local[0] ?? ""}***` : `${local.slice(0, 2)}***`;
  const labels = domain.split(".");
  const tld = labels.length > 1 ? labels[labels.length - 1] : "";
  const head = labels[0] ?? "";
  const maskedHead = head ? `${head[0]}***` : "***";
  return tld ? `${maskLocal}@${maskedHead}.${tld}` : `${maskLocal}@${maskedHead}`;
}

/** Truncate + strip newlines from an error reason so only a short sanitised token is stored. */
export function sanitiseErrorReason(reason: unknown): string {
  if (reason == null) return "unknown";
  const s = String(reason).replace(/\s+/g, " ").trim();
  return (s || "unknown").slice(0, 60);
}

/**
 * Best-effort durable record of a send outcome. NEVER throws — observability must not break
 * a send, and a fail-open send already committed must still get recorded. The recipient is
 * masked here; `contextKey` is normalised (lower-cased) so admin lookups are stable.
 */
export async function recordEmailSend(outcome: EmailSendOutcome): Promise<void> {
  const recipientMasked = maskEmail(outcome.recipient);
  const contextKey = outcome.contextKey
    ? normalizeEmailForServiceOwnerMatch(outcome.contextKey)
    : null;
  const sentAtMs = outcome.sentAtMs ?? Date.now();
  const errorReason = outcome.success ? null : sanitiseErrorReason(outcome.errorReason);
  const messageId = outcome.messageId ? String(outcome.messageId).slice(0, 200) : null;

  try {
    const sql = getSql();
    await sql`
      INSERT INTO email_send_log (
        category, recipient_masked, context_key, success, message_id, error_reason, sent_at_ms
      )
      VALUES (
        ${outcome.category},
        ${recipientMasked},
        ${contextKey},
        ${outcome.success},
        ${messageId},
        ${errorReason},
        ${sentAtMs}
      )
    `;
  } catch (e) {
    // 42P01 = table missing (pre-migration) — silent. Otherwise log only an opaque code.
    const code = (e as { code?: string })?.code;
    if (code === "42P01") return;
    console.error("[email-send-log] record failed:", String(code ?? "unknown").slice(0, 40));
  }
}

/**
 * Send a built envelope AND durably record the outcome (success → message-id; failure →
 * sanitised reason + masked recipient). This is the single choke point so EVERY send is
 * observable. On transport failure it records, then RE-THROWS so the caller's own fail-open
 * policy decides whether to surface the error — recording never swallows the throw.
 */
export async function sendAndRecord(args: {
  envelope: MailEnvelope;
  category: EmailSendCategory;
  /** Correlation key for admin lookups (e.g. the founders applicant email). */
  contextKey?: string | null;
}): Promise<{ messageId: string | null }> {
  try {
    const result = await sendMail(args.envelope);
    await recordEmailSend({
      category: args.category,
      recipient: args.envelope.to,
      contextKey: args.contextKey ?? null,
      success: true,
      messageId: result.messageId,
    });
    return result;
  } catch (e) {
    // Opaque code/name only — an SMTP error message can echo the recipient (PII).
    const reason =
      (e as { code?: string })?.code ?? (e instanceof Error ? e.name : "unknown");
    await recordEmailSend({
      category: args.category,
      recipient: args.envelope.to,
      contextKey: args.contextKey ?? null,
      success: false,
      errorReason: reason,
    });
    throw e;
  }
}

/**
 * Last send recorded for a given founders applicant email (any founders category), for the
 * admin status line. Returns null when there's no record (or the table is missing). Fail-safe.
 */
export async function getLastFoundersSend(
  email: string | null | undefined,
): Promise<FoundersSendStatus | null> {
  const key = normalizeEmailForServiceOwnerMatch(email);
  if (!key) return null;
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT category, success, message_id AS "messageId", error_reason AS "errorReason", sent_at_ms AS "sentAtMs"
      FROM email_send_log
      WHERE context_key = ${key}
        AND category IN ('founders_approved', 'founders_rejected', 'founders_deleted', 'founders_apply_confirmation')
      ORDER BY sent_at_ms DESC
      LIMIT 1
    `;
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      category: String(row.category ?? "other") as EmailSendCategory,
      success: Boolean(row.success),
      messageId: row.messageId != null ? String(row.messageId) : null,
      errorReason: row.errorReason != null ? String(row.errorReason) : null,
      sentAtMs: Number(row.sentAtMs ?? 0),
    };
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "42P01") return null;
    console.error("[email-send-log] lookup failed:", String(code ?? "unknown").slice(0, 40));
    return null;
  }
}

/**
 * Batch lookup of the last founders send per applicant email — used by the admin list so it
 * can show a per-row send status without N round-trips. Returns a Map keyed by normalised email.
 */
export async function getLastFoundersSendsFor(
  emails: ReadonlyArray<string>,
): Promise<Map<string, FoundersSendStatus>> {
  const keys = Array.from(
    new Set(
      emails
        .map((e) => normalizeEmailForServiceOwnerMatch(e))
        .filter((e): e is string => e != null),
    ),
  );
  const out = new Map<string, FoundersSendStatus>();
  if (keys.length === 0) return out;
  try {
    const sql = getSql();
    // DISTINCT ON the newest row per context_key.
    const rows = await sql`
      SELECT DISTINCT ON (context_key)
        context_key AS "contextKey", category, success,
        message_id AS "messageId", error_reason AS "errorReason", sent_at_ms AS "sentAtMs"
      FROM email_send_log
      WHERE context_key = ANY(${keys})
        AND category IN ('founders_approved', 'founders_rejected', 'founders_deleted', 'founders_apply_confirmation')
      ORDER BY context_key, sent_at_ms DESC
    `;
    for (const r of rows as Array<Record<string, unknown>>) {
      const k = r.contextKey != null ? String(r.contextKey) : null;
      if (!k) continue;
      out.set(k, {
        category: String(r.category ?? "other") as EmailSendCategory,
        success: Boolean(r.success),
        messageId: r.messageId != null ? String(r.messageId) : null,
        errorReason: r.errorReason != null ? String(r.errorReason) : null,
        sentAtMs: Number(r.sentAtMs ?? 0),
      });
    }
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "42P01") return out;
    console.error("[email-send-log] batch lookup failed:", String(code ?? "unknown").slice(0, 40));
  }
  return out;
}
