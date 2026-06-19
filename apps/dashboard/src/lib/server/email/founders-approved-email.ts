/**
 * "Founders access approved" — the first design-system email (REC-PLAN-017 pilot).
 * Transactional stream (no unsubscribe): notifies an applicant that their Founders Circle
 * access is approved. Authored as a Svelte template (FoundersApproved.svelte) rendered to
 * email-safe HTML, with a plain-text alternative.
 *
 * Kept separate from send-mail.ts so the transport + identity primitives stay free of any
 * Svelte/template imports (and their pure unit tests stay light).
 */
import { buildMailEnvelope, type MailEnvelope } from "./send-mail";
import { renderEmailDocument } from "./render";
import { sendAndRecord } from "./email-send-log";
import FoundersApproved from "./templates/FoundersApproved.svelte";

export type FoundersApprovedArgs = {
  to: string;
  /** Applicant display name (optional — falls back to a neutral greeting). */
  name?: string | null;
  /** Absolute URL to the dashboard the approved user should open. */
  dashboardUrl: string;
};

export const FOUNDERS_APPROVED_SUBJECT = "You're in — your Restormel Keys access is approved";

/** Plain-text alternative — pure, so the copy + greeting fallback can be unit-tested. */
export function foundersApprovedText(
  name: string | null | undefined,
  dashboardUrl: string,
): string {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return [
    "You're in — your Restormel Keys access is approved.",
    "",
    greeting,
    "",
    "Your application to the Restormel Keys Founders Circle has been approved. Your account now " +
      "has full access to the dashboard — keys, routing, and the Connect pipelines.",
    "",
    "Open your dashboard:",
    dashboardUrl,
    "",
    "Welcome aboard,",
    "The Restormel team",
    "",
    "—",
    "Allotment Technology Ltd · Company no. 16925574 · United Kingdom",
  ].join("\n");
}

/** Build the full envelope (no send) — pure, so the mapping + render can be unit-tested. */
export function buildFoundersApprovedEmail(args: FoundersApprovedArgs): MailEnvelope {
  const name = args.name ?? "";
  const html = renderEmailDocument(FoundersApproved, {
    name,
    dashboardUrl: args.dashboardUrl,
  });
  return buildMailEnvelope({
    to: args.to,
    subject: FOUNDERS_APPROVED_SUBJECT,
    text: foundersApprovedText(args.name, args.dashboardUrl),
    html,
    category: "transactional",
  });
}

/** Render + send the approval email via the transactional mailbox, recording the outcome
 *  (success message-id or sanitised failure reason) to the durable send log keyed by the
 *  applicant email so the admin Founders UI can show the delivery status. */
export async function sendFoundersApprovedEmail(args: FoundersApprovedArgs): Promise<void> {
  await sendAndRecord({
    envelope: buildFoundersApprovedEmail(args),
    category: "founders_approved",
    contextKey: args.to,
  });
}
