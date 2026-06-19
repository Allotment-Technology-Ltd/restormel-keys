/**
 * "Founders access not approved (at this time)" — applicant notice, sent when an operator
 * flips a request status → rejected. Warm and brief: not approved for access right now, their
 * details are kept, and they're welcome as more spots open / we may be in touch. No dashboard CTA.
 * Transactional stream (no unsubscribe — it's a direct reply to an action the person took).
 *
 * Kept separate from send-mail.ts so the transport + identity primitives stay free of any
 * Svelte/template imports (mirrors founders-approved-email.ts).
 */
import { buildMailEnvelope, type MailEnvelope } from "./send-mail";
import { renderEmailDocument } from "./render";
import { sendAndRecord } from "./email-send-log";
import FoundersRejected from "./templates/FoundersRejected.svelte";

export type FoundersRejectedArgs = {
  to: string;
  /** Applicant display name (optional — falls back to a neutral greeting). */
  name?: string | null;
};

export const FOUNDERS_REJECTED_SUBJECT =
  "Update on your Restormel Keys Founders Circle application";

/** Plain-text alternative — pure, so the copy + greeting fallback can be unit-tested. */
export function foundersRejectedText(name: string | null | undefined): string {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return [
    "An update on your Restormel Keys Founders Circle application.",
    "",
    greeting,
    "",
    "Thanks for your interest in the Restormel Keys Founders Circle. We're not able to approve " +
      "your access at this time — the Founders Circle is small and we open spots gradually.",
    "",
    "We've kept your details on file. As more places open up you're welcome to join, and we may " +
      "be in touch when there's room. Nothing more is needed from you right now.",
    "",
    "With thanks,",
    "The Restormel team",
    "",
    "—",
    "Allotment Technology Ltd · Company no. 16925574 · United Kingdom",
  ].join("\n");
}

/** Build the full envelope (no send) — pure, so the mapping + render can be unit-tested. */
export function buildFoundersRejectedEmail(args: FoundersRejectedArgs): MailEnvelope {
  const name = args.name ?? "";
  const html = renderEmailDocument(FoundersRejected, { name });
  return buildMailEnvelope({
    to: args.to,
    subject: FOUNDERS_REJECTED_SUBJECT,
    text: foundersRejectedText(args.name),
    html,
    category: "transactional",
  });
}

/** Render + send the rejection notice via the transactional mailbox, recording the outcome. */
export async function sendFoundersRejectedEmail(args: FoundersRejectedArgs): Promise<void> {
  await sendAndRecord({
    envelope: buildFoundersRejectedEmail(args),
    category: "founders_rejected",
    contextKey: args.to,
  });
}
