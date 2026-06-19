/**
 * "A Founders Circle request needs review" — internal ops notification, sent on apply to the
 * service-owner admin address(es) (RESTORMEL_SERVICE_OWNER_EMAILS / defaults). Carries the
 * applicant's name + email and a link to the admin review screen.
 *
 * Identity: transactional category (From = notify@send.restormel.dev, Reply-To = contact@). The
 * recipient is the operator, who is authorised to see the applicant's details. No unsubscribe.
 *
 * Kept separate from send-mail.ts so the transport + identity primitives stay free of any
 * Svelte/template imports (mirrors founders-approved-email.ts).
 */
import { buildMailEnvelope, type MailEnvelope } from "./send-mail";
import { renderEmailDocument } from "./render";
import { sendAndRecord } from "./email-send-log";
import { serviceOwnerEmails } from "$lib/server/service-admin";
import FoundersAdminNotify from "./templates/FoundersAdminNotify.svelte";

export type FoundersAdminNotifyArgs = {
  applicantEmail: string;
  applicantName?: string | null;
  /** Absolute URL to the admin founders review screen. */
  reviewUrl: string;
  /** Explicit recipient override (defaults to the service-owner admin emails). */
  to?: string;
};

export const FOUNDERS_ADMIN_NOTIFY_SUBJECT =
  "New Founders Circle request needs review";

/** Plain-text alternative — pure, so the copy can be unit-tested without Svelte. */
export function foundersAdminNotifyText(
  applicantName: string | null | undefined,
  applicantEmail: string,
  reviewUrl: string,
): string {
  return [
    "A new Founders Circle request needs review.",
    "",
    `Name:  ${applicantName || "—"}`,
    `Email: ${applicantEmail}`,
    "",
    "Review it in the admin console:",
    reviewUrl,
    "",
    "— Restormel Keys",
    "",
    "—",
    "Allotment Technology Ltd · Company no. 16925574 · United Kingdom",
  ].join("\n");
}

/**
 * Build the envelope (no send) — pure. `to` defaults to the comma-joined service-owner admin
 * emails. Returns null when there are no admin recipients configured (env blanked).
 */
export function buildFoundersAdminNotifyEmail(
  args: FoundersAdminNotifyArgs,
): MailEnvelope | null {
  const recipients = args.to ? [args.to] : serviceOwnerEmails();
  if (recipients.length === 0) return null;
  const html = renderEmailDocument(FoundersAdminNotify, {
    applicantName: args.applicantName ?? "",
    applicantEmail: args.applicantEmail,
    reviewUrl: args.reviewUrl,
  });
  return buildMailEnvelope({
    to: recipients.join(", "),
    subject: FOUNDERS_ADMIN_NOTIFY_SUBJECT,
    text: foundersAdminNotifyText(args.applicantName, args.applicantEmail, args.reviewUrl),
    html,
    category: "transactional",
  });
}

/**
 * Render + send the admin notification, recording the outcome keyed by the APPLICANT email so
 * the admin UI can correlate. No-op (resolves) when no admin recipients are configured.
 */
export async function sendFoundersAdminNotifyEmail(
  args: FoundersAdminNotifyArgs,
): Promise<void> {
  const envelope = buildFoundersAdminNotifyEmail(args);
  if (!envelope) return;
  await sendAndRecord({
    envelope,
    category: "founders_admin_notify",
    contextKey: args.applicantEmail,
  });
}
