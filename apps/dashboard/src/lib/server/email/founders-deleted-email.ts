/**
 * "Founders Circle request removed" — neutral/administrative notice, sent ONLY when an operator
 * opts in while deleting a request (default delete is SILENT — clearing test/spam entries should
 * not email anyone). GDPR-friendly: the request and associated details have been removed from our
 * system; if this was a mistake, reply / contact us. No dashboard CTA.
 * Transactional stream (no unsubscribe — direct administrative notice about the person's record).
 *
 * Kept separate from send-mail.ts so the transport + identity primitives stay free of any
 * Svelte/template imports (mirrors founders-approved-email.ts).
 */
import { buildMailEnvelope, type MailEnvelope } from "./send-mail";
import { renderEmailDocument } from "./render";
import { sendAndRecord } from "./email-send-log";
import FoundersDeleted from "./templates/FoundersDeleted.svelte";

export type FoundersDeletedArgs = {
  to: string;
  /** Applicant display name (optional — falls back to a neutral greeting). */
  name?: string | null;
};

export const FOUNDERS_DELETED_SUBJECT =
  "Your Restormel Keys Founders Circle request has been removed";

/** Plain-text alternative — pure, so the copy + greeting fallback can be unit-tested. */
export function foundersDeletedText(name: string | null | undefined): string {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return [
    "Your Restormel Keys Founders Circle request has been removed.",
    "",
    greeting,
    "",
    "We're writing to let you know that your Restormel Keys Founders Circle request, and the " +
      "details associated with it, have been removed from our system.",
    "",
    "If this was a mistake, or you'd like to apply again, just reply to this email or contact us " +
      "at contact@restormel.dev and we'll be glad to help.",
    "",
    "The Restormel team",
    "",
    "—",
    "Allotment Technology Ltd · Company no. 16925574 · United Kingdom",
  ].join("\n");
}

/** Build the full envelope (no send) — pure, so the mapping + render can be unit-tested. */
export function buildFoundersDeletedEmail(args: FoundersDeletedArgs): MailEnvelope {
  const name = args.name ?? "";
  const html = renderEmailDocument(FoundersDeleted, { name });
  return buildMailEnvelope({
    to: args.to,
    subject: FOUNDERS_DELETED_SUBJECT,
    text: foundersDeletedText(args.name),
    html,
    category: "transactional",
  });
}

/** Render + send the removal notice via the transactional mailbox, recording the outcome. */
export async function sendFoundersDeletedEmail(args: FoundersDeletedArgs): Promise<void> {
  await sendAndRecord({
    envelope: buildFoundersDeletedEmail(args),
    category: "founders_deleted",
    contextKey: args.to,
  });
}
